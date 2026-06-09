import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      let permission: NotificationPermission = "default";
      if ("Notification" in window) {
        permission = await Notification.requestPermission();
      } else {
        permission = "granted"; // best we can do on platforms without API
      }

      if (permission === "granted") {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          await supabase.from("profiles").update({ notifications_enabled: true }).eq("id", u.user.id);
        }
        toast.success("Notifications enabled. You're in.");
        navigate({ to: "/onboarding/profile" });
      } else {
        toast.error("Permission denied. Enable notifications in your browser settings to continue.");
      }
    } finally {
      setRequesting(false);
    }
  }

  async function later() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Step 1 of 3</p>
          <h1 className="mt-3 font-display text-4xl tracking-wide">Turn on notifications.</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Nexarena runs entirely on notifications. Match alerts, opponent assignments,
            check-in reminders, prize confirmations — all push.
            <br /><br />
            <span className="text-foreground font-semibold">You must allow notifications to use the platform.</span>
          </p>
        </div>

        <div className="mt-auto space-y-3 pt-10">
          <Button
            onClick={allow}
            disabled={requesting}
            className="crimson-glow h-14 w-full font-display text-lg tracking-wider"
          >
            <Bell className="mr-2 h-5 w-5" />
            Allow notifications
          </Button>
          <Button
            onClick={later}
            variant="ghost"
            className="h-12 w-full text-xs uppercase tracking-widest text-muted-foreground"
          >
            <BellOff className="mr-2 h-4 w-4" />
            Maybe later
          </Button>
        </div>
      </div>
    </div>
  );
}
