import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { Trophy, Zap, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboards")({
  ssr: false,
  head: () => ({ meta: [{ title: "Leaderboards — Nexarena" }] }),
  component: Leaderboards,
});

type LeaderboardType = "earnings" | "wins" | "scorers";

interface LeaderboardEntry {
  rank: number;
  username: string;
  value: number;
}

function Leaderboards() {
  const [board, setBoard] = useState<LeaderboardType>("earnings");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const boards = [
    { id: "earnings" as LeaderboardType, label: "Earnings", icon: Trophy },
    { id: "wins" as LeaderboardType, label: "Most Wins", icon: Zap },
    { id: "scorers" as LeaderboardType, label: "Top Scorers", icon: Target },
  ];

  useEffect(() => { loadLeaderboard(); }, [board]);

  async function loadLeaderboard() {
    setLoading(true);
    try {
      let leaderboard: LeaderboardEntry[] = [];
      switch (board) {
        case "earnings": {
          const { data } = await supabase.from("profiles").select("username, career_earnings").order("career_earnings", { ascending: false }).limit(50);
          leaderboard = (data || []).map((p: any, i: number) => ({ rank: i + 1, username: p.username, value: p.career_earnings || 0 }));
          break;
        }
        case "wins": {
          const { data: profiles } = await supabase.from("profiles").select("id, username");
          const stats = new Map<string, number>();
          for (const p of profiles || []) {
            const { data: p1 } = await supabase.from("matches").select("winner_id").eq("player1_id", p.id).eq("winner_id", p.id).in("status", ["verified", "closed", "forfeit"]);
            const { data: p2 } = await supabase.from("matches").select("winner_id").eq("player2_id", p.id).eq("winner_id", p.id).in("status", ["verified", "closed", "forfeit"]);
            stats.set(p.username, (p1?.length || 0) + (p2?.length || 0));
          }
          leaderboard = Array.from(stats.entries()).sort(([, a], [, b]) => b - a).slice(0, 50).map(([username, wins], i) => ({ rank: i + 1, username, value: wins }));
          break;
        }
        case "scorers": {
          const { data: profiles } = await supabase.from("profiles").select("id, username");
          const stats = new Map<string, number>();
          for (const p of profiles || []) {
            const { data: p1 } = await supabase.from("matches").select("player1_score").eq("player1_id", p.id).in("status", ["verified", "closed", "forfeit"]);
            const { data: p2 } = await supabase.from("matches").select("player2_score").eq("player2_id", p.id).in("status", ["verified", "closed", "forfeit"]);
            const goals = (p1?.reduce((s: number, m: any) => s + (m.player1_score || 0), 0) || 0) + (p2?.reduce((s: number, m: any) => s + (m.player2_score || 0), 0) || 0);
            stats.set(p.username, goals);
          }
          leaderboard = Array.from(stats.entries()).sort(([, a], [, b]) => b - a).slice(0, 50).map(([username, goals], i) => ({ rank: i + 1, username, value: goals }));
          break;
        }
      }
      setEntries(leaderboard);
    } catch (error) { console.error("Failed to load leaderboard:", error); }
    finally { setLoading(false); }
  }

  const currentBoard = boards.find((b) => b.id === board);
  const IconComponent = currentBoard?.icon || Trophy;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 py-4">
          <h1 className="font-display text-xl tracking-wider flex items-center gap-2">
            <IconComponent className="h-5 w-5 text-primary" /> Leaderboards
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-2">
          {boards.map((b) => (
            <button key={b.id} onClick={() => setBoard(b.id)} className={`no-tap rounded-lg border p-3 text-left transition text-xs font-semibold uppercase tracking-widest ${board === b.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
              {b.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">Loading leaderboard...</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">No data available yet.</div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-12 gap-1 border-b border-border bg-card/80 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-6">Player</div>
              <div className="col-span-5 text-right">{board === "earnings" ? "KES" : board === "scorers" ? "Goals" : "Wins"}</div>
            </div>
            {entries.map((entry) => (
              <div key={entry.rank} className="grid grid-cols-12 gap-1 border-b border-border/50 px-3 py-3 text-[11px] hover:bg-card/80 transition">
                <div className="col-span-1 text-center font-bold text-primary">{entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}</div>
                <div className="col-span-6 truncate text-foreground">{entry.username}</div>
                <div className="col-span-5 text-right font-semibold">{board === "earnings" ? "KES " : ""}{entry.value.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
        <div className="text-center text-[10px] text-muted-foreground"><p>Rankings update automatically after match completion</p></div>
      </main>
      <BottomNav />
    </div>
  );
}
