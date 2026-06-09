import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Clock, ArrowLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tournaments/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tournament — Nexarena" }] }),
  component: TDetail,
});

function TDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<any>(null);
  const [count, setCount] = useState(0);
  const [joined, setJoined] = useState(false);

  async function load() {
    const { data } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
    setT(data);
    const { count: c } = await supabase.from("tournament_entries").select("id", { count: "exact", head: true }).eq("tournament_id", id);
    setCount(c ?? 0);
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const { data: e } = await supabase.from("tournament_entries").select("id").eq("tournament_id", id).eq("user_id", u.user.id).maybeSingle();
      setJoined(!!e);
    }
  }
  useEffect(() => { load(); }, [id]);

  if (!t) return <div className="min-h-dvh bg-background" />;

  const pool = t.entry_fee_kes * count;
  const prize = Math.floor(pool * 0.85);

  async function join() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("tournament_entries").insert({ tournament_id: id, user_id: u.user.id, paid: t.entry_fee_kes === 0 });
    if (error) { toast.error(error.message); return; }
    toast.success(t.entry_fee_kes === 0 ? "Joined the cup." : "Slot reserved. Payment will be requested when payments go live.");
    load();
  }

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <button onClick={() => navigate({ to: "/tournaments" })} className="no-tap">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.status}</p>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{t.kind.replace("_", " ")}</p>
          <h1 className="mt-1 font-display text-3xl tracking-wide">{t.name}</h1>
        </div>

        {/* Live prize pool */}
        <section className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Live prize pool</p>
          <p className="mt-1 font-display text-5xl tracking-wide text-primary">KES {prize.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{count} of {t.max_players} players joined</p>
        </section>

        {/* Prize split */}
        <section className="space-y-2">
          <PrizeRow rank="1st" amount={Math.floor(prize * 0.5)} accent />
          <PrizeRow rank="2nd" amount={Math.floor(prize * 0.3)} />
          <PrizeRow rank="3rd" amount={Math.floor(prize * 0.2)} />
        </section>

        {/* Meta */}
        <section className="grid grid-cols-3 gap-2">
          <Meta icon={Users} label="Players" value={`${count}/${t.max_players}`} />
          <Meta icon={Trophy} label="Format" value={t.format === "single_elim" ? "SE" : "GS"} />
          <Meta icon={Clock} label="Window" value={`${t.match_window_hours}h`} />
        </section>

        {joined ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-primary/50 bg-primary/10 p-4 text-center">
              <p className="font-display text-lg tracking-wider text-primary">You're in.</p>
            </div>
            <Button variant="outline" className="h-12 w-full gap-2">
              <MessageCircle className="h-4 w-4" /> Open tournament chat
            </Button>
          </div>
        ) : (
          <Button onClick={join} className="crimson-glow h-14 w-full font-display text-lg tracking-wider">
            {t.entry_fee_kes === 0 ? "Join (Free)" : `Join · KES ${t.entry_fee_kes}`}
          </Button>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function PrizeRow({ rank, amount, accent }: { rank: string; amount: number; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border p-4 ${accent ? "border-primary/40 bg-primary/10" : "border-border bg-card"}`}>
      <span className="font-display text-lg tracking-wider">{rank}</span>
      <span className={`font-display text-lg tracking-wider ${accent ? "text-primary" : ""}`}>KES {amount.toLocaleString()}</span>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-sm tracking-wider">{value}</p>
    </div>
  );
}
