// Uses Lovable AI (Gemini Vision) to read a player's eFootball profile
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

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return j({ error: "AI not configured" }, 500);

    const ai = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You extract structured data from eFootball mobile profile screenshots. Reply ONLY with strict JSON." },
          { role: "user", content: [
            { type: "text", text: "Extract konami_id (player ID shown on profile), profile_display_name, club_name (or null), rating (or null). Reply JSON like {\"konami_id\":\"...\",\"profile_display_name\":\"...\",\"club_name\":null,\"rating\":null}." },
            { type: "image_url", image_url: { url: image_url } },
          ] },
        ],
      }),
    });
    if (!ai.ok) {
      const t = await ai.text();
      console.error("AI error", ai.status, t);
      return j({ error: "AI unavailable", status: ai.status }, 502);
    }
    const data = await ai.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { konami_id: null, profile_display_name: null }; }

    await supabase.from("profiles").update({
      konami_id: parsed.konami_id ?? null,
      efootball_name: declared_display_name ?? parsed.profile_display_name ?? null,
      efootball_screenshot_url: image_url,
      is_verified: !!parsed.konami_id,
    }).eq("id", claims.user.id);

    return j({ ok: true, extracted: parsed });
  } catch (e) {
    console.error(e);
    return j({ error: (e as Error).message }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
