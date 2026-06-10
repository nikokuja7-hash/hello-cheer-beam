// Uses Google Gemini Vision API to read a player's eFootball profile
// screenshot and extract Konami ID + display name.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { image_url, declared_display_name } = await req.json();
    if (!image_url) return j({ error: "image_url required" }, 400);

    const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!geminiKey) return j({ error: "Gemini API not configured" }, 500);

    // Convert image URL to base64 if needed, or use direct URL
    let imageData: string;
    let mimeType = "image/jpeg";

    if (image_url.startsWith("data:")) {
      // Already base64
      imageData = image_url.split(",")[1];
      const match = image_url.match(/data:([^;]+)/);
      if (match) mimeType = match[1];
    } else {
      // Fetch and convert to base64
      const imgRes = await fetch(image_url);
      if (!imgRes.ok) {
        return j({ error: "Could not fetch image", status: imgRes.status }, 502);
      }
      const buffer = await imgRes.arrayBuffer();
      imageData = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const contentType = imgRes.headers.get("content-type");
      if (contentType) mimeType = contentType;
    }

    // Call Google Gemini Vision API
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "You are analyzing an eFootball mobile game profile screenshot. Extract the following information:\n1. Konami ID (the unique player ID number)\n2. Profile display name (the name shown on profile)\n3. Club name if visible\n4. Rating/rank if visible\n\nRespond ONLY with valid JSON in this exact format:\n{\"konami_id\":\"...\",\"profile_display_name\":\"...\",\"club_name\":null,\"rating\":null}\n\nIf any field cannot be found, use null. Do not include any text outside the JSON.",
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
    });

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      console.error("Gemini error", geminiRes.status, errorText);
      return j({ error: "Gemini Vision API error", status: geminiRes.status }, 502);
    }

    const geminiData = await geminiRes.json();
    const content = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    
    // Clean up response - remove markdown code blocks if present
    const cleaned = content
      .replace(/^```(?:json)?\s*|\s*```$/g, "")
      .replace(/^`|`$/g, "")
      .trim();

    let parsed: any = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse Gemini response:", cleaned);
      parsed = { konami_id: null, profile_display_name: null };
    }

    // Validate extracted data
    const konamiId = parsed.konami_id?.toString() || null;
    const displayName = parsed.profile_display_name?.toString() || null;

    if (!konamiId || !displayName) {
      return j({ error: "Could not extract Konami ID or display name from screenshot" }, 400);
    }

    // Update player profile
    const { error: updateError } = await supabase.from("profiles").update({
      konami_id: konamiId,
      efootball_name: declared_display_name || displayName,
      efootball_screenshot_url: image_url,
      is_verified: true,
      onboarding_complete: true,
    }).eq("id", claims.user.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return j({ error: "Failed to save verification" }, 500);
    }

    return j({ ok: true, extracted: { konami_id: konamiId, display_name: displayName } });
  } catch (e) {
    console.error(e);
    return j({ error: (e as Error).message }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
