import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Clock, ArrowLeft, MessageCircle, Eye, PlayCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Countdown } from "@/components/countdown";
import { TournamentChat } from "@/components/tournament/tournament-chat";
import { PreviewBracket } from "@/components/tournament/preview-bracket";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/tournaments/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tournament — Nexarena" }] }),
  component: TDetail,
});

type Tab = "overview" | "bracket" | "chat";

function TDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [t, setT] = useState<any>(null);
  const [count, setCount] = useState(0);
  const [joined, setJoined] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const isCreator = useMemo(() => t && user && t.creator_id === user.id, [t, user]);

  async function load() {
    const { data } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
    setT(data);
    const { count: c } = await supabase.from("tournament_entries").select("id", { count: "exact", head: true }).eq("tournament_id", id);
    setCount(c ?? 0);
    if (user) {
      const { data: e } = await supabase.from("tournament_entries").select("id").eq("tournament_id", id).eq("user_id", user.id).maybeSingle();
      setJoined(!!e);
    }
  }
  useEffect(() => { load(); }, [id, user?.id]);

  useEffect(() => {
    const ch = supabase.channel(`t-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournament_entries", filter: `tournament_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  if (!t) return <div className="min-h-dvh bg-background" />;

  const pool = t.entry_fee_kes * count;
  const prize = Math.floor(pool * 0.85);

  async function join() {
    if (!user) return;
    if (t.entry_fee_kes === 0) {
      const { error } = await supabase.from("tournament_entries").insert({ tournament_id: id, user_id: user.id, paid: true });
      if (error) return toast.error(error.message);
      toast.success("Joined the cup.");
      return load();
    }
    const { data: prof } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
    if (!prof?.phone) return toast.error("Add your phone number in Profile first.");
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smartpay-stk`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.session?.access_token}` },
      body: JSON.stringify({ tournament_id: id, amount_kes: t.entry_fee_kes, phone: prof.phone }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(body?.error ?? "Payment failed");
    toast.success(body.mock ? "Mock payment — slot reserved." : "STK push sent. Confirm on your phone.");
    setTimeout(load, 2000);
  }

  async function forceStart() {
    if (!confirm(`You currently have ${count} players. Start now? Registration closes immediately.`)) return;
    const { error } = await supabase.from("tournaments").update({ status: "active", starts_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Tournament started.");
    load();
  }

  async function share() {
    const url = `${window.location.origin}/tournaments/${id}`;
    try {
      if (navigator.share) await navigator.share({ title: t.name, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied."); }
    } catch {}
  }

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <button onClick={() => navigate({ to: "/tournaments" })} className="no-tap"><ArrowLeft className="h-5 w-5" /></button>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t.status}</p>
          <button onClick={share} className="no-tap"><Share2 className="h-5 w-5 text-muted-foreground" /></button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{t.kind.replace("_", " ")}</p>
          <h1 className="mt-1 font-display text-3xl tracking-wide">{t.name}</h1>
          {t.registration_closes_at && (
            <p className="mt-1 text-xs text-muted-foreground">
              <Countdown target={t.registration_closes_at} prefix={t.status === "active" ? "Started" : "Closes in"} />
            </p>
          )}
        </div>

        {/* Live prize pool */}
        <section className="rounded-xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Live prize pool</p>
          <p className="mt-1 font-display text-5xl tracking-wide text-primary">KES {prize.toLocaleString()}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{count} of {t.max_players} players joined</p>
        </section>

        {/* Tabs */}
        <div className="grid grid-cols-3 rounded-lg border border-border bg-card p-1">
          {(["overview", "bracket", "chat"] as Tab[]).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-md py-2 text-[11px] font-bold uppercase tracking-widest ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {k}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            <section className="space-y-2">
              <PrizeRow rank="1st" amount={Math.floor(prize * 0.5)} accent />
              <PrizeRow rank="2nd" amount={Math.floor(prize * 0.3)} />
              <PrizeRow rank="3rd" amount={Math.floor(prize * 0.2)} />
            </section>
            <section className="grid grid-cols-3 gap-2">
              <Meta icon={Users} label="Players" value={`${count}/${t.max_players}`} />
              <Meta icon={Trophy} label="Format" value={t.format === "single_elim" ? "SE" : "GS"} />
              <Meta icon={Clock} label="Window" value={`${t.match_window_hours}h`} />
            </section>

            {joined ? (
              <div className="rounded-lg border border-primary/50 bg-primary/10 p-4 text-center">
                <p className="font-display text-lg tracking-wider text-primary">You're in.</p>
              </div>
            ) : (
              <Button onClick={join} className="crimson-glow h-14 w-full font-display text-lg tracking-wider">
                {t.entry_fee_kes === 0 ? "Join (Free)" : `Join · KES ${t.entry_fee_kes}`}
              </Button>
            )}

            {isCreator && t.status !== "active" && t.status !== "completed" && count >= t.min_players && (
              <Button onClick={forceStart} variant="outline" className="h-12 w-full gap-2">
                <PlayCircle className="h-4 w-4" /> Force start now
              </Button>
            )}
          </>
        )}

        {tab === "bracket" && (joined ? <PreviewBracket tournamentId={id} /> : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            <Eye className="mx-auto mb-2 h-5 w-5" /> Bracket preview is for joined players only.
          </div>
        ))}

        {tab === "chat" && (joined && user ? <TournamentChat tournamentId={id} userId={user.id} /> : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            <MessageCircle className="mx-auto mb-2 h-5 w-5" /> Join to access tournament chat.
          </div>
        ))}
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
