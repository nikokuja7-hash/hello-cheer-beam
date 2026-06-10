import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getNotificationPermission } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Check if user has completed onboarding and has notification permission
    const { data: profile } = await supabase.from("profiles")
      .select("onboarding_complete, notifications_enabled")
      .eq("id", data.user.id)
      .maybeSingle();

    // If onboarding not complete, redirect to notifications gate
    if (!profile?.onboarding_complete) {
      throw redirect({ to: "/onboarding/notifications" });
    }

    // Check actual notification permission status
    const permission = getNotificationPermission();
    
    // If permission was revoked or not granted, redirect back to gate
    if (permission !== "granted") {
      throw redirect({ to: "/onboarding/notifications" });
    }

    return { user: data.user, profile };
  },
  component: () => <Outlet />,
});
