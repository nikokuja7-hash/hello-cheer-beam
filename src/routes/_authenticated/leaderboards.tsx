import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { Trophy, TrendingUp, Target, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leaderboards")({
  ssr: false,
  head: () => ({ meta: [{ title: "Leaderboards — Nexarena" }] }),
  component: Leaderboards,
});

type LeaderboardType = "earnings" | "wins" | "scorers" | "division1" | "division2" | "division3";

interface LeaderboardEntry {
  rank: number;
  username: string;
  value: number;
  secondary?: number;
  division?: number;
}

function Leaderboards() {
  const [board, setBoard] = useState<LeaderboardType>("earnings");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const boards = [
    { id: "earnings", label: "Earnings", icon: Trophy },
    { id: "wins", label: "Most Wins", icon: Zap },
    { id: "scorers", label: "Top Scorers", icon: Target },
    { id: "division1", label: "Division 1", icon: Trophy },
    { id: "division2", label: "Division 2", icon: Trophy },
    { id: "division3", label: "Division 3", icon: Trophy },
  ];

  useEffect(() => {
    loadLeaderboard();
  }, [board]);

  async function loadLeaderboard() {
    setLoading(true);
    try {
      let query;
      let leaderboard: LeaderboardEntry[] = [];

      switch (board) {
        case "earnings": {
          const { data } = await supabase
            .from("profiles")
            .select("username, career_earnings")
            .order("career_earnings", { ascending: false })
            .limit(50);

          leaderboard = (data || []).map((p, i) => ({
            rank: i + 1,
            username: p.username,
            value: p.career_earnings,
          }));
          break;
        }

        case "wins": {
          // Calculate wins from matches
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username");

          const stats = new Map<string, number>();

          for (const p of profiles || []) {
            const { data: p1Matches } = await supabase
              .from("matches")
              .select("winner_id")
              .eq("player1_id", p.id)
              .eq("winner_id", p.id)
              .in("status", ["verified", "closed", "forfeit"]);

            const { data: p2Matches } = await supabase
              .from("matches")
              .select("winner_id")
              .eq("player2_id", p.id)
              .eq("winner_id", p.id)
              .in("status", ["verified", "closed", "forfeit"]);

            const wins = (p1Matches?.length || 0) + (p2Matches?.length || 0);
            stats.set(p.username, wins);
          }

          leaderboard = Array.from(stats.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 50)
            .map(([username, wins], i) => ({
              rank: i + 1,
              username,
              value: wins,
            }));
          break;
        }

        case "scorers": {
          // Calculate goals from matches
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username");

          const stats = new Map<string, number>();

          for (const p of profiles || []) {
            const { data: p1Matches } = await supabase
              .from("matches")
              .select("player1_score")
              .eq("player1_id", p.id)
              .in("status", ["verified", "closed", "forfeit"]);

            const { data: p2Matches } = await supabase
              .from("matches")
              .select("player2_score")
              .eq("player2_id", p.id)
              .in("status", ["verified", "closed", "forfeit"]);

            const goals = (p1Matches?.reduce((s, m) => s + (m.player1_score || 0), 0) || 0) +
              (p2Matches?.reduce((s, m) => s + (m.player2_score || 0), 0) || 0);
            stats.set(p.username, goals);
          }

          leaderboard = Array.from(stats.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 50)
            .map(([username, goals], i) => ({
              rank: i + 1,
              username,
              value: goals,
            }));
          break;
        }

        case "division1":
        case "division2":
        case "division3": {
          const div = parseInt(board.split("division")[1]);
          const { data } = await supabase
            .from("league_standings")
            .select("user_id, points, goals_for, goals_against, position")
            .eq("division", div)
            .order("points", { ascending: false })
            .order("goals_for", { ascending: false })
            .limit(30);

          // Fetch usernames
          if (data && data.length > 0) {
            const userIds = data.map((d) => d.user_id);
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, username")
              .in("id", userIds);

            const profileMap = new Map(profiles?.map((p) => [p.id, p.username]) || []);

            leaderboard = data.map((s, i) => ({
              rank: i + 1,
              username: profileMap.get(s.user_id) || "Unknown",
              value: s.points,
              secondary: s.goals_for - s.goals_against,
              division: div,
            }));
          }
          break;
        }
      }

      setEntries(leaderboard);
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }

  const currentBoard = boards.find((b) => b.id === board);
  const IconComponent = currentBoard?.icon || Trophy;

  return (
    <div className="min-h-dvh bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 py-4">
          <h1 className="font-display text-xl tracking-wider flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Leaderboards
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6 space-y-6">
        {/* Board Selector */}
        <div className="space-y-2 overflow-x-auto pb-2">
          <div className="grid grid-cols-2 gap-2">
            {boards.map((b) => (
              <button
                key={b.id}
                onClick={() => setBoard(b.id as LeaderboardType)}
                className={`no-tap rounded-lg border p-3 text-left transition text-xs font-semibold uppercase tracking-widest ${
                  board === b.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard Table */}
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Loading leaderboard...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No data available yet.
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-12 gap-1 border-b border-border bg-card/80 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-6">Player</div>
              {board.startsWith("division") ? (
                <>
                  <div className="col-span-3 text-right">Pts</div>
                  <div className="col-span-2 text-right">GD</div>
                </>
              ) : board === "earnings" ? (
                <div className="col-span-5 text-right">KES</div>
              ) : board === "scorers" ? (
                <div className="col-span-5 text-right">Goals</div>
              ) : (
                <div className="col-span-5 text-right">Wins</div>
              )}
            </div>

            {entries.map((entry) => (
              <div
                key={entry.rank}
                className="grid grid-cols-12 gap-1 border-b border-border/50 px-3 py-3 text-[11px] hover:bg-card/80 transition"
              >
                <div className="col-span-1 text-center font-bold text-primary">
                  {entry.rank <= 3 ? "🥇🥈🥉"[entry.rank - 1] : entry.rank}
                </div>
                <div className="col-span-6 truncate text-foreground">{entry.username}</div>
                {board.startsWith("division") ? (
                  <>
                    <div className="col-span-3 text-right font-semibold">{entry.value}</div>
                    <div className="col-span-2 text-right text-muted-foreground">
                      {entry.secondary && entry.secondary > 0 ? "+" : ""}
                      {entry.secondary}
                    </div>
                  </>
                ) : (
                  <div className="col-span-5 text-right font-semibold">
                    {board === "earnings" ? "KES " : ""}
                    {entry.value.toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stats Info */}
        <div className="text-center text-[10px] text-muted-foreground">
          <p>Rankings update automatically after match completion</p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
