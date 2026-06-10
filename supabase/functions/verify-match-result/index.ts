// Reads an eFootball match result screenshot and extracts full stats.
// Uses Google Gemini Vision API to verify the result automatically.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAT_WEIGHTS = {
  shots_on_target: 0.30,
  possession: 0.20,
  successful_passes: 0.15,
  shots: 0.15,
  defense: 0.10, // tackles + interceptions
  other: 0.10,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const auth = req.headers.get("authorization") ?? "";
    const { data: claims } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!claims.user) return j({ error: "Unauthorized" }, 401);

    const { match_id, image_url, declared_score, declared_display_names } = await req.json();
    if (!match_id || !image_url) return j({ error: "Missing fields" }, 400);

    const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!geminiKey) return j({ error: "Gemini API not configured" }, 500);

    // Convert image URL to base64 if needed
    let imageData: string;
    let mimeType = "image/jpeg";

    if (image_url.startsWith("data:")) {
      imageData = image_url.split(",")[1];
      const match = image_url.match(/data:([^;]+)/);
      if (match) mimeType = match[1];
    } else {
      const imgRes = await fetch(image_url);
      if (!imgRes.ok) {
        return j({ error: "Could not fetch image", status: imgRes.status }, 502);
      }
      const buffer = await imgRes.arrayBuffer();
      imageData = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const contentType = imgRes.headers.get("content-type");
      if (contentType) mimeType = contentType;
    }

    const prompt = `You are analyzing an eFootball match Full Time result screenshot. Extract the exact data and respond ONLY with valid JSON:
{
  "player1_display_name": "exact name from scoreboard",
  "player2_display_name": "exact name from scoreboard",
  "player1_score": number,
  "player2_score": number,
  "match_status": "Full Time or other status",
  "stats": {
    "possession": {"p1": number, "p2": number},
    "shots": {"p1": number, "p2": number},
    "shots_on_target": {"p1": number, "p2": number},
    "fouls": {"p1": number, "p2": number},
    "offsides": {"p1": number, "p2": number},
    "corner_kicks": {"p1": number, "p2": number},
    "free_kicks": {"p1": number, "p2": number},
    "passes": {"p1": number, "p2": number},
    "successful_passes": {"p1": number, "p2": number},
    "crosses": {"p1": number, "p2": number},
    "interceptions": {"p1": number, "p2": number},
    "tackles": {"p1": number, "p2": number},
    "saves": {"p1": number, "p2": number}
  }
}`;

    // Call Google Gemini Vision API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageData,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error("Gemini error", geminiRes.status, errorText);
      return j({ error: "Gemini Vision API error", status: geminiRes.status }, 502);
    }

    const geminiData = await geminiRes.json();
    const content = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

    const cleaned = content
      .replace(/^```(?:json)?\s*|\s*```$/g, "")
      .replace(/^`|`$/g, "")
      .trim();

    let extracted: any = {};
    try {
      extracted = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse Gemini response:", cleaned);
      return j({ error: "AI returned invalid JSON", raw: cleaned }, 502);
    }

    // Verify match status is Full Time
    if (extracted?.match_status !== "Full Time") {
      return j({
        flagged: true,
        reason: "Not a Full Time result - match may not be completed",
        error: `Expected 'Full Time', got: ${extracted?.match_status}`,
      }, 400);
    }

    // Verify display names match
    if (declared_display_names) {
      const nameMismatch1 = declared_display_names.player1?.toLowerCase() !== extracted?.player1_display_name?.toLowerCase();
      const nameMismatch2 = declared_display_names.player2?.toLowerCase() !== extracted?.player2_display_name?.toLowerCase();

      if (nameMismatch1 || nameMismatch2) {
        return j({
          flagged: true,
          reason: "Display name mismatch - names don't match what was declared",
          details: {
            p1_expected: declared_display_names.player1,
            p1_found: extracted?.player1_display_name,
            p2_expected: declared_display_names.player2,
            p2_found: extracted?.player2_display_name,
          },
        }, 400);
      }
    }

    // Store the submission
    const { error: storeError } = await supabase.from("match_results").insert({
      match_id,
      submitted_by: claims.user.id,
      screenshot_url: image_url,
      ai_extracted: extracted,
      ai_verified: true,
    });

    if (storeError) {
      console.error("Storage error:", storeError);
    }

    // Check if both players have submitted
    const { data: submissions } = await supabase
      .from("match_results")
      .select("submitted_by,ai_extracted")
      .eq("match_id", match_id);

    const { data: match } = await supabase
      .from("matches")
      .select("*")
      .eq("id", match_id)
      .maybeSingle();

    if (!match) {
      return j({ ok: true, extracted });
    }

    // If only one submission so far, just return success
    if ((submissions?.length ?? 0) < 2) {
      return j({ ok: true, extracted, verified_result: { 
        player1_score: extracted.player1_score,
        player2_score: extracted.player2_score,
        stats: extracted.stats
      }});
    }

    // Both submissions present - verify they agree
    const firstSubmission = submissions![0].ai_extracted as any;
    const secondSubmission = submissions![1].ai_extracted as any;

    const scoresAgree =
      firstSubmission.player1_score === secondSubmission.player1_score &&
      firstSubmission.player2_score === secondSubmission.player2_score;
    const fullTime =
      firstSubmission.match_status === "Full Time" &&
      secondSubmission.match_status === "Full Time";

    if (!scoresAgree || !fullTime) {
      await supabase
        .from("matches")
        .update({ status: "disputed" })
        .eq("id", match_id);
      return j({
        flagged: true,
        reason: "Results do not match between players",
      }, 400);
    }

    // Results match - determine winner
    const finalScore1 = firstSubmission.player1_score;
    const finalScore2 = firstSubmission.player2_score;
    let winnerId: string | null = null;

    if (finalScore1 > finalScore2) {
      winnerId = match.player1_id;
    } else if (finalScore2 > finalScore1) {
      winnerId = match.player2_id;
    } else {
      // Draw - check performance score
      const calcPerformance = (stats: any) => {
        return (
          (stats?.shots_on_target?.p1 || 0) * STAT_WEIGHTS.shots_on_target +
          ((stats?.possession?.p1 || 0) / 100) * STAT_WEIGHTS.possession +
          ((stats?.successful_passes?.p1 || 0) / 100) * STAT_WEIGHTS.successful_passes +
          ((stats?.shots?.p1 || 0) / 10) * STAT_WEIGHTS.shots +
          (((stats?.tackles?.p1 || 0) + (stats?.interceptions?.p1 || 0)) / 10) * STAT_WEIGHTS.defense
        );
      };

      const p1Perf = calcPerformance(firstSubmission.stats);
      const p2Perf = calcPerformance({
        ...firstSubmission.stats,
        p1: firstSubmission.stats.p2,
        p2: firstSubmission.stats.p1,
      });

      if (p1Perf > p2Perf) {
        winnerId = match.player1_id;
      } else if (p2Perf > p1Perf) {
        winnerId = match.player2_id;
      }
    }

    // Update match with final result
    const { error: updateError } = await supabase
      .from("matches")
      .update({
        status: "verified",
        winner_id: winnerId,
        player1_score: finalScore1,
        player2_score: finalScore2,
      })
      .eq("id", match_id);

    if (updateError) {
      console.error("Match update error:", updateError);
    }

    // Notify both players
    await supabase.from("notifications").insert([
      {
        user_id: match.player1_id,
        title: "Match result confirmed",
        body:
          winnerId === match.player1_id
            ? `You won ${finalScore1}-${finalScore2}. You advance!`
            : winnerId === match.player2_id
              ? `You lost ${finalScore1}-${finalScore2}. Keep grinding.`
              : `Draw ${finalScore1}-${finalScore2}. Both advance!`,
        link: `/matches/${match_id}`,
      },
      {
        user_id: match.player2_id,
        title: "Match result confirmed",
        body:
          winnerId === match.player2_id
            ? `You won ${finalScore2}-${finalScore1}. You advance!`
            : winnerId === match.player1_id
              ? `You lost ${finalScore2}-${finalScore1}. Keep grinding.`
              : `Draw ${finalScore1}-${finalScore2}. Both advance!`,
        link: `/matches/${match_id}`,
      },
    ]);

    return j({
      ok: true,
      extracted,
      verified_result: {
        player1_score: finalScore1,
        player2_score: finalScore2,
        winner: winnerId,
        stats: firstSubmission.stats,
      },
    });
  } catch (e) {
    console.error(e);
    return j({ error: (e as Error).message }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
