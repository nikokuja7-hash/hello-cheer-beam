import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Clock, ArrowLeft, MessageCircle, Eye, PlayCircle, Share2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Countdown } from "@/components/countdown";
import { TournamentChat } from "@/components/tournament/tournament-chat";
import { PreviewBracket } from "@/components/tournament/preview-bracket";
import { BracketPreview } from "@/components/bracket-preview";
import { useAuth } from "@/hooks/use-auth";
import { generateTournamentBracket, determineTournamentFormat } from "@/lib/bracket";
import { TournamentTransparency } from "@/components/tournament-transparency";
import { getTournamentTransparencyData } from "@/lib/tournament-transparency";

export const Route = createFileRoute("/_authenticated/tournaments/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tournament — Nexarena" }] }),
  component: TDetail,
});

type Tab = "overview" | "bracket" | "chat";

interface TournamentData {
  id: string;
  name: string;
  kind: string;
  status: string;
  entry_fee_kes: number;
  max_players: number;
  min_players: number;
  format: "single_elim" | "group_stage";
  match_window_hours: number;
  registration_closes_at: string;
  starts_at: string;
  created_by: string;
  bracket_generated_at?: string;
}

function TDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [t, setT] = useState<TournamentData | null>(null);
  const [count, setCount] = useState(0);
  const [joined, setJoined] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [showAvailabilityFlow, setShowAvailabilityFlow] = useState(false);
  const [userAvailability, setUserAvailability] = useState<boolean | null>(null);
  const [bracketGenerated, setBracketGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [transparencyData, setTransparencyData] = useState<any>(null);
  
  const isCreator = useMemo(() => t && user && t.created_by === user.id, [t, user]);

  async function load() {
    const { data } = await supabase.from("tournaments").select("*").eq("id", id).maybeSingle();
    setT(data);
    setBracketGenerated(!!data?.bracket_generated_at);
    
    const { count: c } = await supabase.from("tournament_entries").select("id", { count: "exact", head: true }).eq("tournament_id", id);
    setCount(c ?? 0);
    
    if (user) {
      const { data: e } = await supabase.from("tournament_entries").select("id").eq("tournament_id", id).eq("user_id", user.id).maybeSingle();
      setJoined(!!e);
      
      // Check if user has set availability
      if (e) {
        const { data: avail } = await supabase.from("player_availability").select("id").eq("tournament_id", id).eq("user_id", user.id).maybeSingle();
        setUserAvailability(!!avail);
      }
    }

    // Load transparency data if bracket is generated
    if (data?.bracket_generated_at) {
      const transparencyInfo = await getTournamentTransparencyData(id);
      setTransparencyData(transparencyInfo);
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

  // Show availability setup for active tournaments that need it
  const shouldShowAvailability = t.status === "active" && joined && !userAvailability && !bracketGenerated;

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

  async function generateBracket() {
    setGenerating(true);
    try {
      // Get all players in the tournament
      const { data: entries } = await supabase
        .from("tournament_entries")
        .select("user_id")
        .eq("tournament_id", id);

      if (!entries || entries.length === 0) {
        toast.error("No players joined.");
        return;
      }

      const playerIds = entries.map((e) => e.user_id);
      
      // Generate tournament bracket using new Format A/B system
      const tournamentStart = t.starts_at ? new Date(t.starts_at) : new Date();
      const bracket = generateTournamentBracket(playerIds, id, tournamentStart);
      
      // Combine all matches from all stages
      const allMatches = [
        ...(bracket.knockout_matches || []),
        ...bracket.group_matches,
        ...(bracket.semifinal_matches || []),
        ...(bracket.final_match ? [bracket.final_match] : []),
        ...(bracket.third_place_match ? [bracket.third_place_match] : []),
      ];

      // Insert all matches into database
      for (const match of allMatches) {
        await supabase.from("matches").insert({
          tournament_id: match.tournament_id,
          player1_id: match.player1_id,
          player2_id: match.player2_id,
          status: match.status,
          stage: match.stage,
          group_id: match.group_id,
          match_date: match.match_date,
          time_slot_start: match.time_slot_start,
          time_slot_end: match.time_slot_end,
        });
      }

      // Store bracket metadata
      await supabase.from("tournaments").update({
        bracket_generated_at: new Date().toISOString(),
        bracket_format: bracket.format,
        total_matches: allMatches.length,
      }).eq("id", id);

      toast.success(`Bracket generated (${bracket.format === "A" ? "Group Stage" : "Knockout + Group"} • ${allMatches.length} matches)`);
      load();
    } catch (error) {
      console.error("Failed to generate bracket:", error);
      toast.error("Failed to generate bracket");
    } finally {
      setGenerating(false);
    }
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
        {shouldShowAvailability && (
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-4">
            <p className="flex items-center gap-2 text-[11px] font-semibold text-yellow-600 mb-2">
              <AlertTriangle className="h-4 w-4" />
              Set Your Availability
            </p>
            <p className="text-[10px] text-muted-foreground mb-3">
              Tell us when you're available for matches so we can schedule them at times that work for you.
            </p>
            <Button
              onClick={() => navigate({ to: `/onboarding/availability?tournamentId=${id}` })}
              className="w-full h-9 text-[10px]"
            >
              Set Availability
            </Button>
          </div>
        )}
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

        {tab === "bracket" && (joined ? (
          <div className="space-y-4">
            {bracketGenerated ? (
              <>
                {transparencyData && (
                  <TournamentTransparency
                    stage={transparencyData.stage}
                    dayNumber={transparencyData.dayNumber}
                    totalDays={transparencyData.totalDays}
                    matchesPending={transparencyData.matchesPending}
                    matchesCompleted={transparencyData.matchesCompleted}
                    nextStageDescription={transparencyData.nextStageDescription}
                    timeRemaining={transparencyData.timeRemaining}
                  />
                )}
                <BracketPreview tournamentId={id} tournamentType={t.format === "single_elim" ? "cup" : "league"} />
              </>
            ) : (
              <>
                <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
                  <p className="text-[11px] text-muted-foreground">
                    {count === 0
                      ? "Waiting for players to join."
                      : count < t.min_players
                        ? `Need ${t.min_players - count} more player${t.min_players - count !== 1 ? "s" : ""}.`
                        : "Ready to generate bracket."}
                  </p>
                  {isCreator && count >= t.min_players && (
                    <Button
                      onClick={generateBracket}
                      disabled={generating}
                      className="w-full h-10"
                    >
                      {generating ? "Generating..." : "Generate Bracket"}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
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
