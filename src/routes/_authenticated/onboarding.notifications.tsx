import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { initializeNotifications, requestNotificationPermission, subscribeToPush } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/onboarding/notifications")({
  head: () => ({ meta: [{ title: "Allow notifications — Nexarena" }] }),
  component: NotifGate,
});

function NotifGate() {
  const navigate = useNavigate();
  const [requesting, setRequesting] = useState(false);

  async function allow() {
    setRequesting(true);
    try {
      const swReady = await initializeNotifications();
      if (!swReady) { toast.error("Failed to initialize notifications."); return; }
      const permission = await requestNotificationPermission();
      if (permission === "granted") {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
          if (vapidKey) await subscribeToPush(vapidKey);
          await supabase.from("profiles").update({ notifications_enabled: true }).eq("id", u.user.id);
        }
        toast.success("Notifications enabled. You're in.");
        navigate({ to: "/onboarding/profile" });
      } else if (permission === "denied") {
        toast.error("You must enable notifications to use Nexarena.");
      } else {
        toast.error("Notification request dismissed. Try again.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to enable notifications");
    } finally { setRequesting(false); }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-10">
        <div className="mt-6 flex justify-center">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
            <Bell className="relative h-10 w-10 text-primary" />
          </div>
        </div>
        <div className="mt-10 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Required</p>
          <h1 className="mt-3 font-display text-4xl tracking-wide">Turn on notifications.</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Nexarena runs entirely on notifications. Match alerts, opponent assignments, check-in reminders, and prize confirmations all come through push notifications.
            <br /><br />
            <span className="text-foreground font-semibold">You must allow notifications to use the platform.</span>
          </p>
        </div>
        <div className="mt-auto space-y-3 pt-10">
          <Button onClick={allow} disabled={requesting} className="crimson-glow h-14 w-full font-display text-lg tracking-wider">
            <Bell className="mr-2 h-5 w-5" /> Allow Notifications
          </Button>
        </div>
      </div>
    </div>
  );
}
