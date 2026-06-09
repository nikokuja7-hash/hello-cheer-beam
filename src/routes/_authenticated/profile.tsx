import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LogOut, ShieldCheck, ShieldAlert, Trophy, Wallet, BellOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  head: () => ({ meta: [{ title: "Profile — Nexarena" }] }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="border-b border-border">
        <div className="mx-auto max-w-md px-5 py-4">
          <h1 className="font-display text-xl tracking-wider">Profile</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-5 space-y-5">
        <section className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-card font-display text-2xl tracking-wider text-primary">
            {(profile?.username ?? "P").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-display text-2xl tracking-wider">{profile?.username}</p>
            <p className="text-[11px] text-muted-foreground">{user?.email}</p>
            <div className="mt-1 flex items-center gap-2">
              {profile?.is_verified ? (
                <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded bg-yellow-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-yellow-500">
                  <ShieldAlert className="h-3 w-3" /> Unverified
                </span>
              )}
              <span className="inline-flex items-center rounded bg-card px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest">
                Division {profile?.division ?? 3}
              </span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <Stat icon={Wallet} label="Career Earnings" value={`KES ${profile?.career_earnings ?? 0}`} />
          <Stat icon={Trophy} label="Konami ID" value={profile?.konami_id ?? "—"} />
        </section>

        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <Row label="M-Pesa Phone" value={profile?.phone ?? "Not set"} />
          <Row label="Warning Strikes" value={`${profile?.warning_strikes ?? 0}/3`} />
          <Row label="Notifications" value={profile?.notifications_enabled ? "On" : "Off"} />
        </section>

        <Button onClick={signOut} variant="outline" className="h-12 w-full gap-2 border-destructive/30 text-destructive">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </main>

      <BottomNav />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-base tracking-wider truncate">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
