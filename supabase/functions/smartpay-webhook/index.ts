// Receives M-Pesa STK push result from SmartPay/PayHero.
// Marks the matching payment as paid and confirms the tournament entry.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const payload = await req.json().catch(() => ({} as any));
    console.log("smartpay webhook", JSON.stringify(payload));

    const ref = payload?.response?.ExternalReference ?? payload?.external_reference ?? payload?.reference;
    const status = (payload?.response?.Status ?? payload?.status ?? "").toString().toLowerCase();
    const receipt = payload?.response?.MpesaReceiptNumber ?? payload?.mpesa_receipt ?? null;

    if (!ref) return new Response("missing reference", { status: 400 });

    if (status === "success" || status === "paid" || status === "completed") {
      const { data: payment } = await supabase.from("payments")
        .update({ status: "paid", mpesa_receipt: receipt })
        .eq("id", ref).select("user_id,tournament_id").maybeSingle();
      if (payment) {
        await supabase.from("tournament_entries").upsert(
          { tournament_id: payment.tournament_id, user_id: payment.user_id, paid: true },
          { onConflict: "tournament_id,user_id" },
        );
        await supabase.from("notifications").insert({
          user_id: payment.user_id,
          title: "You're in!",
          body: "Slot reserved — finish your eFootball verification to confirm.",
          link: `/tournaments/${payment.tournament_id}`,
        });
      }
    } else if (status === "failed" || status === "cancelled") {
      await supabase.from("payments").update({ status: "failed" }).eq("id", ref);
    }
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response((e as Error).message, { status: 500 });
  }
});
