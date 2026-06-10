import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { NexarenaLogo } from "@/components/logo";
import { Zap, Trophy, ChevronRight, Bell, Flame, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-admin";
import { OnboardingTutorial } from "@/components/onboarding-tutorial";

export const Route = createFileRoute("/_authenticated/home")({
  ssr: false,
  head: () => ({ meta: [{ title: "Home — Nexarena" }] }),
  component: HomeScreen,
});

type Tournament = {
  id: string; name: string; slug: string; kind: string;
  entry_fee_kes: number; max_players: number; min_players: number;
  status: string; registration_closes_at: string | null; starts_at: string | null;
};

function HomeScreen() {
  const { profile, user } = useAuth();
  const isAdmin = useIsAdmin(user?.id);
  const [quickCash, setQuickCash] = useState<Tournament | null>(null);
  const [qcCount, setQcCount] = useState(0);
  const [cups, setCups] = useState<(Tournament & { _count: number })[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    const seen = localStorage.getItem(`nx-tutorial-${user.id}`);
    if (!seen) setShowTutorial(true);
  }, [user?.id]);

  function dismissTutorial() {
    if (user) localStorage.setItem(`nx-tutorial-${user.id}`, "1");
    setShowTutorial(false);
  }

  useEffect(() => {
    (async () => {
      const { data: qc } = await supabase.from("tournaments")
        .select("*").eq("kind", "quick_cash").in("status", ["open", "filling"])
        .order("starts_at", { ascending: true }).limit(1).maybeSingle();
      if (qc) {
        setQuickCash(qc as Tournament);
        const { count } = await supabase.from("tournament_entries")
          .select("id", { count: "exact", head: true }).eq("tournament_id", qc.id);
        setQcCount(count ?? 0);
      }
      const { data: cs } = await supabase.from("tournaments")
        .select("*").eq("kind", "cup").in("status", ["open", "filling"])
        .eq("is_public", true).order("created_at", { ascending: false }).limit(5);
      const enriched = await Promise.all(((cs ?? []) as Tournament[]).map(async (t) => {
        const { count } = await supabase.from("tournament_entries")
          .select("id", { count: "exact", head: true }).eq("tournament_id", t.id);
        return { ...t, _count: count ?? 0 };
      }));
      setCups(enriched);
    })();
  }, []);

  return (
    <div className="min-h-dvh bg-background pb-24">
      {showTutorial && <OnboardingTutorial onClose={dismissTutorial} />}

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <NexarenaLogo />
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link to="/admin" className="no-tap rounded-md bg-primary/15 p-1.5">
                <Shield className="h-4 w-4 text-primary" />
              </Link>
            )}
            <Link to="/profile" className="relative no-tap">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-5 space-y-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Welcome back</p>
          <h1 className="mt-1 font-display text-3xl tracking-wide">
            {profile?.username ?? "Player"}
            <span className="ml-2 inline-flex h-6 items-center rounded-sm bg-primary/20 px-2 text-[10px] font-bold tracking-widest text-primary">
              D{profile?.division ?? 3}
            </span>
          </h1>
        </div>

        {quickCash && <QuickCashBanner t={quickCash} count={qcCount} />}

        <div className="grid grid-cols-3 gap-2">
          <Stat title="Earnings" value={`KES ${profile?.career_earnings ?? 0}`} />
          <Stat title="Division" value={`D${profile?.division ?? 3}`} />
          <Stat title="Strikes" value={`${profile?.warning_strikes ?? 0}/3`} />
        </div>

        <section>
          <SectionHeader title="Open Cups" link="/tournaments" />
          {cups.length === 0 ? (
            <EmptyCard title="No open cups" body="Be the first to create one." />
          ) : (
            <div className="mt-3 space-y-2">
              {cups.map((c) => <CupRow key={c.id} t={c} count={c._count} />)}
            </div>
          )}
        </section>

        <Link to="/league" className="no-tap block">
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-primary" />
              <div>
                <p className="font-display text-base tracking-wider">My Division Table</p>
                <p className="text-[11px] text-muted-foreground">Current season standings</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>

        <button
          onClick={() => setShowTutorial(true)}
          className="block w-full rounded-lg border border-dashed border-border bg-card/40 p-4 text-center text-xs text-muted-foreground hover:bg-card"
        >
          How Nexarena works — replay the tutorial
        </button>
      </main>

      <BottomNav />
    </div>
  );
}

function QuickCashBanner({ t, count }: { t: Tournament; count: number }) {
  const pot = t.entry_fee_kes * t.max_players;
  const prizePool = Math.floor(pot * 0.85);
  const closes = t.registration_closes_at ? new Date(t.registration_closes_at) : null;
  const spotsLeft = t.max_players - count;
  return (
    <Link to="/quickcash" className="no-tap block">
      <div className="relative overflow-hidden rounded-xl border border-primary/50 bg-gradient-to-br from-primary/20 via-card to-card p-5">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute inset-0 scanline opacity-10" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Live · Quick Cash</span>
          </div>
          <p className="mt-3 font-display text-[2.5rem] leading-none tracking-wide">
            KES <span className="text-primary">{prizePool.toLocaleString()}</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Total prize pool · {t.name}</p>
          <div className="mt-4 flex items-end justify-between">
            <div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Entry</p><p className="font-display text-lg tracking-wider">KES {t.entry_fee_kes}</p></div>
            <div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Spots</p><p className="font-display text-lg tracking-wider">{spotsLeft}/{t.max_players}</p></div>
            <div><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Closes</p><p className="font-display text-lg tracking-wider">{closes ? closes.toLocaleDateString("en-KE", { weekday: "short" }) : "—"}</p></div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-primary-foreground">
            <Zap className="h-4 w-4" />
            <span className="font-display text-sm tracking-widest">Join for KES {t.entry_fee_kes}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SectionHeader({ title, link }: { title: string; link?: string }) {
  return (
    <div className="flex items-end justify-between">
      <h2 className="font-display text-xl tracking-wider">{title}</h2>
      {link && <Link to={link} className="text-[10px] font-bold uppercase tracking-widest text-primary">See all</Link>}
    </div>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className="mt-1 font-display text-base tracking-wider truncate">{value}</p>
    </div>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-border bg-card/40 p-6 text-center">
      <p className="font-display text-base tracking-wider">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function CupRow({ t, count }: { t: Tournament; count: number }) {
  return (
    <Link to="/tournaments/$id" params={{ id: t.id }} className="no-tap block">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15">
            <Trophy className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{t.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {t.entry_fee_kes === 0 ? "Friendly" : `KES ${t.entry_fee_kes}`} · {count}/{t.max_players}
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
