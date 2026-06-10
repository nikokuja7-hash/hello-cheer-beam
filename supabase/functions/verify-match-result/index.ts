// Reads an eFootball match result screenshot and extracts full stats.
// Stores in match_results and (when both players have submitted) determines a winner.
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

    const { match_id, image_url, declared_display_name } = await req.json();
    if (!match_id || !image_url) return j({ error: "Missing fields" }, 400);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return j({ error: "AI not configured" }, 500);

    const prompt = `Extract these from this eFootball Full Time result screen and respond with strict JSON only:
{
 "player1_display_name":"","player2_display_name":"",
 "player1_score":0,"player2_score":0,
 "match_status":"Full Time",
 "stats": {
  "possession":{"p1":0,"p2":0},
  "shots":{"p1":0,"p2":0},
  "shots_on_target":{"p1":0,"p2":0},
  "fouls":{"p1":0,"p2":0},
  "offsides":{"p1":0,"p2":0},
  "corner_kicks":{"p1":0,"p2":0},
  "free_kicks":{"p1":0,"p2":0},
  "passes":{"p1":0,"p2":0},
  "successful_passes":{"p1":0,"p2":0},
  "crosses":{"p1":0,"p2":0},
  "interceptions":{"p1":0,"p2":0},
  "tackles":{"p1":0,"p2":0},
  "saves":{"p1":0,"p2":0}
 }
}`;

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Extract eFootball match stats. Reply ONLY with strict JSON, no prose." },
          { role: "user", content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image_url } },
          ] },
        ],
      }),
    });
    if (!ai.ok) {
      const t = await ai.text();
      console.error("AI error", ai.status, t);
      return j({ error: "AI unavailable" }, 502);
    }
    const data = await ai.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    let extracted: any = {};
    try { extracted = JSON.parse(cleaned); } catch { return j({ error: "AI returned non-JSON", raw }, 502); }

    // Store the submission
    await supabase.from("match_results").insert({
      match_id,
      submitted_by: claims.user.id,
      screenshot_url: image_url,
      ai_extracted: extracted,
      ai_verified: extracted?.match_status === "Full Time",
    });

    // If both submissions present, try to settle
    const { data: subs } = await supabase.from("match_results").select("submitted_by,ai_extracted").eq("match_id", match_id);
    const { data: match } = await supabase.from("matches").select("*").eq("id", match_id).maybeSingle();
    if (!match) return j({ ok: true, extracted });

    if ((subs?.length ?? 0) >= 2) {
      const a = subs![0].ai_extracted as any;
      const b = subs![1].ai_extracted as any;
      const scoresAgree = a.player1_score === b.player1_score && a.player2_score === b.player2_score;
      const fullTime = a.match_status === "Full Time" && b.match_status === "Full Time";
      if (!scoresAgree || !fullTime) {
        await supabase.from("matches").update({ status: "disputed" }).eq("id", match_id);
      } else {
        let winnerId: string | null = null;
        if (a.player1_score > a.player2_score) winnerId = match.player1_id;
        else if (a.player2_score > a.player1_score) winnerId = match.player2_id;
        else {
          // Draw → performance score
          const score = (s: any) => {
            const p1 =
              (s.stats.shots_on_target.p1 * STAT_WEIGHTS.shots_on_target) +
              (s.stats.possession.p1 * STAT_WEIGHTS.possession / 100) +
              (s.stats.successful_passes.p1 * STAT_WEIGHTS.successful_passes / 100) +
              (s.stats.shots.p1 * STAT_WEIGHTS.shots / 10) +
              ((s.stats.tackles.p1 + s.stats.interceptions.p1) * STAT_WEIGHTS.defense / 10);
            const p2 =
              (s.stats.shots_on_target.p2 * STAT_WEIGHTS.shots_on_target) +
              (s.stats.possession.p2 * STAT_WEIGHTS.possession / 100) +
              (s.stats.successful_passes.p2 * STAT_WEIGHTS.successful_passes / 100) +
              (s.stats.shots.p2 * STAT_WEIGHTS.shots / 10) +
              ((s.stats.tackles.p2 + s.stats.interceptions.p2) * STAT_WEIGHTS.defense / 10);
            return { p1, p2 };
          };
          const sa = score(a);
          if (sa.p1 > sa.p2) winnerId = match.player1_id;
          else if (sa.p2 > sa.p1) winnerId = match.player2_id;
        }
        await supabase.from("matches").update({
          status: "completed",
          winner_id: winnerId,
          player1_score: a.player1_score,
          player2_score: a.player2_score,
        }).eq("id", match_id);

        // Notify both players
        await supabase.from("notifications").insert([
          { user_id: match.player1_id, title: "Match confirmed", body: winnerId === match.player1_id ? "You won. You advance." : winnerId === match.player2_id ? "You lost." : "Draw — both advance.", link: `/match/${match_id}` },
          { user_id: match.player2_id, title: "Match confirmed", body: winnerId === match.player2_id ? "You won. You advance." : winnerId === match.player1_id ? "You lost." : "Draw — both advance.", link: `/match/${match_id}` },
        ]);
      }
    }

    return j({ ok: true, extracted });
  } catch (e) {
    console.error(e);
    return j({ error: (e as Error).message }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
