import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Zap, Trophy, Users, Clock, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quickcash")({
  ssr: false,
  head: () => ({ meta: [{ title: "Quick Cash — Nexarena" }] }),
  component: QuickCash,
});

type T = {
  id: string; name: string; entry_fee_kes: number;
  max_players: number; min_players: number; status: string;
  registration_closes_at: string | null; starts_at: string | null;
};

function QuickCash() {
  const [t, setT] = useState<T | null>(null);
  const [count, setCount] = useState(0);
  const [joined, setJoined] = useState(false);

  async function load() {
    const { data: qc } = await supabase.from("tournaments")
      .select("*")
      .eq("kind", "quick_cash")
      .in("status", ["open", "filling"])
      .order("starts_at", { ascending: true })
      .limit(1).maybeSingle();
    if (!qc) return;
    setT(qc as T);
    const { count: c } = await supabase.from("tournament_entries")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", qc.id);
    setCount(c ?? 0);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const { data: e } = await supabase.from("tournament_entries")
        .select("id").eq("tournament_id", qc.id).eq("user_id", u.user.id).maybeSingle();
      setJoined(!!e);
    }
  }
  useEffect(() => { load(); }, []);

  async function join() {
    if (!t) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    // Stub: in production this triggers M-Pesa STK push; for now we mark intent
    const { error } = await supabase.from("tournament_entries").insert({
      tournament_id: t.id, user_id: u.user.id, paid: false,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Slot reserved. M-Pesa prompt incoming when payments go live.");
    load();
  }

  if (!t) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <Header />
        <div className="mx-auto max-w-md px-5 py-10 text-center text-sm text-muted-foreground">
          No Quick Cash event scheduled. Check back Thursday.
        </div>
        <BottomNav />
      </div>
    );
  }

  const pool = t.entry_fee_kes * t.max_players;
  const prize = Math.floor(pool * 0.85);
  const livePool = t.entry_fee_kes * count;
  const livePrize = Math.floor(livePool * 0.85);
  const prizes = {
    first: Math.floor(livePrize * 0.5),
    second: Math.floor(livePrize * 0.3),
    third: Math.floor(livePrize * 0.2),
  };

  return (
    <div className="min-h-dvh bg-background pb-28">
      <Header />

      <main className="mx-auto max-w-md px-5 py-5 space-y-5">
        {/* Hero pot */}
        <section className="relative overflow-hidden rounded-xl border border-primary/50 bg-gradient-to-br from-primary/25 via-card to-card p-6 text-center">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Zap className="h-3 w-3" /> {t.name}
            </span>
            <p className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">Live prize pool</p>
            <p className="mt-1 font-display text-6xl tracking-wide text-primary">
              {livePrize.toLocaleString()}
            </p>
            <p className="mt-1 font-display text-sm tracking-widest text-muted-foreground">KES</p>
            <p className="mt-3 text-[11px] text-muted-foreground">
              At capacity: <span className="text-foreground font-semibold">KES {prize.toLocaleString()}</span>
            </p>
          </div>
        </section>

        {/* Prize split — live */}
        <section>
          <h2 className="font-display text-xl tracking-wider">Prize Split</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">Updates in real time as players join.</p>
          <div className="mt-3 space-y-2">
            <PrizeRow rank="1st" amount={prizes.first} accent />
            <PrizeRow rank="2nd" amount={prizes.second} />
            <PrizeRow rank="3rd" amount={prizes.third} />
          </div>
        </section>

        {/* Counters */}
        <section className="grid grid-cols-3 gap-2">
          <Counter icon={Users} label="Players" value={`${count}/${t.max_players}`} />
          <Counter icon={Trophy} label="Min" value={`${t.min_players}`} />
          <Counter icon={Clock} label="Closes" value={t.registration_closes_at ? new Date(t.registration_closes_at).toLocaleDateString("en-KE", { weekday: "short" }) : "—"} />
        </section>

        {/* Rules */}
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base tracking-wider">Rules</h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            <li>· Authentic Team mode · 6-min halves</li>
            <li>· Saturday: group stage · Sunday: finals</li>
            <li>· Check in by 9:00 AM Sat or forfeit</li>
            <li>· Minimum {t.min_players} players or full refund</li>
            <li>· Winners paid by Mon noon via M-Pesa</li>
          </ul>
        </section>

        {/* Join CTA */}
        {joined ? (
          <div className="rounded-lg border border-primary/50 bg-primary/10 p-4 text-center">
            <p className="font-display text-lg tracking-wider text-primary">You're in.</p>
            <p className="mt-1 text-xs text-muted-foreground">You'll be notified when matches are assigned.</p>
          </div>
        ) : (
          <Button onClick={join} className="crimson-glow h-14 w-full font-display text-lg tracking-wider">
            <Zap className="mr-2 h-5 w-5" />
            Join for KES {t.entry_fee_kes}
          </Button>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
        <h1 className="font-display text-xl tracking-wider">Quick Cash</h1>
        <Link to="/home" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Close</Link>
      </div>
    </header>
  );
}

function PrizeRow({ rank, amount, accent }: { rank: string; amount: number; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border p-4 ${accent ? "border-primary/40 bg-primary/10" : "border-border bg-card"}`}>
      <span className="font-display text-xl tracking-wider">{rank}</span>
      <span className={`font-display text-xl tracking-wider ${accent ? "text-primary" : ""}`}>
        KES {amount.toLocaleString()}
      </span>
    </div>
  );
}

function Counter({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-sm tracking-wider">{value}</p>
    </div>
  );
}
