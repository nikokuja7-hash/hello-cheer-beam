// Initiates an M-Pesa STK push via SmartPay/PayHero
// Called from client after user taps "Join". Returns immediately;
// final confirmation arrives via smartpay-webhook.
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
    const token = auth.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getUser(token);
    if (!claims.user) return json({ error: "Unauthorized" }, 401);

    const { tournament_id, amount_kes, phone } = await req.json();
    if (!tournament_id || !amount_kes || !phone) return json({ error: "Missing fields" }, 400);

    // Insert pending payment first
    const { data: payment, error: pErr } = await supabase.from("payments").insert({
      user_id: claims.user.id,
      tournament_id,
      amount_kes,
      phone,
      status: "pending",
    }).select("id").single();
    if (pErr) return json({ error: pErr.message }, 500);

    const channelId = Deno.env.get("PAYHERO_CHANNEL_ID");
    const apiUser = Deno.env.get("PAYHERO_API_USER");
    const apiPassword = Deno.env.get("PAYHERO_API_PASSWORD");
    if (!channelId || !apiUser || !apiPassword) {
      // Mock mode — auto-mark paid for development
      console.warn("PayHero/SmartPay creds not set — running in MOCK mode");
      await supabase.from("payments").update({ status: "paid", mpesa_receipt: `MOCK-${Date.now()}` }).eq("id", payment.id);
      await supabase.from("tournament_entries").upsert(
        { tournament_id, user_id: claims.user.id, paid: true },
        { onConflict: "tournament_id,user_id" },
      );
      return json({ ok: true, mock: true, payment_id: payment.id });
    }

    const basic = btoa(`${apiUser}:${apiPassword}`);
    const callback = `${Deno.env.get("SUPABASE_URL")}/functions/v1/smartpay-webhook`;
    const res = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${basic}` },
      body: JSON.stringify({
        amount: amount_kes,
        phone_number: phone,
        channel_id: Number(channelId),
        provider: "m-pesa",
        external_reference: payment.id,
        callback_url: callback,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
      return json({ error: body?.error_message ?? "Gateway error", details: body }, 502);
    }
    await supabase.from("payments").update({ external_ref: body?.reference ?? body?.CheckoutRequestID ?? null }).eq("id", payment.id);
    return json({ ok: true, payment_id: payment.id, gateway: body });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
