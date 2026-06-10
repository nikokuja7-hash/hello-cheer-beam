import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface PushPayload {
  user_id: string;
  type:
    | "payment_confirmed"
    | "match_assigned"
    | "check_in_reminder"
    | "check_in_missed"
    | "result_verified"
    | "result_disputed"
    | "match_forfeit"
    | "advancement"
    | "elimination"
    | "payment_failed"
    | "tournament_started"
    | "tournament_ended"
    | "prize_distributed"
    | "promotion"
    | "relegation"
    | "season_started"
    | "season_ended"
    | "league_standings_update"
    | "warning_strike";
  title: string;
  body: string;
  data?: Record<string, string>;
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload: PushPayload = await req.json();

    // Validate payload
    if (!payload.user_id || !payload.type || !payload.title || !payload.body) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("subscription_json")
      .eq("user_id", payload.user_id)
      .eq("is_active", true);

    if (subError) {
      console.error("Failed to get subscriptions:", subError);
      return new Response("Failed to retrieve subscriptions", { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No active subscriptions for user ${payload.user_id}`);
      // Still record the notification in the database even if no subscriptions
      await recordNotification(payload);
      return new Response("No subscriptions found", { status: 200 });
    }

    // Get VAPID public key for web push
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPrivateKey || !vapidPublicKey) {
      console.error("VAPID keys not configured");
      // Still record the notification
      await recordNotification(payload);
      return new Response("Server not configured for push", { status: 200 });
    }

    // Send push to each subscription
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const subscription = JSON.parse(sub.subscription_json);

        // Send the push notification
        const response = await fetch(subscription.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "TTL": "24",
          },
          body: JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: "/icon-192x192.png",
            badge: "/badge-72x72.png",
            tag: payload.type,
            data: {
              type: payload.type,
              ...(payload.data || {}),
            },
          }),
        });

        if (!response.ok && response.status === 410) {
          // Subscription expired
          await supabase
            .from("push_subscriptions")
            .update({ is_active: false })
            .eq("subscription_json", sub.subscription_json);
        }

        return { success: response.ok, status: response.status };
      } catch (error) {
        console.error("Failed to send push:", error);
        return { success: false, error: String(error) };
      }
    });

    const results = await Promise.all(sendPromises);

    // Record the notification in database
    await recordNotification(payload);

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `Sent ${successCount}/${results.length} push notifications for type: ${payload.type}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: results.length,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response("Internal server error", { status: 500 });
  }
});

async function recordNotification(payload: PushPayload) {
  try {
    await supabase.from("notifications").insert({
      user_id: payload.user_id,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      is_read: false,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to record notification:", error);
  }
}
