import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BottomNav } from "@/components/bottom-nav";
import { Trophy, TrendingUp, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/player/$userId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Player Profile — Nexarena" }] }),
  component: PlayerProfile,
});

interface PlayerData {
  id: string;
  username: string;
  photo_url?: string;
  konami_id?: string;
  efootball_name?: string;
  division: number;
  warning_strikes: number;
  career_earnings: number;
  created_at: string;
}

interface PlayerStats {
  total_matches: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  current_position?: number;
}

function PlayerProfile() {
  const { user } = useAuth();
  const { userId } = Route.useParams();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const DIVISION_NAMES = {
    1: "Elite",
    2: "Challenger",
    3: "Rookie",
  };

  useEffect(() => {
    (async () => {
      try {
        // Fetch player profile
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (!prof) {
          setLoading(false);
          return;
        }

        setPlayer(prof);

        // Calculate stats from matches
        const { data: matchesAsP1 } = await supabase
          .from("matches")
          .select("player1_score, player2_score, status, winner_id")
          .eq("player1_id", userId)
          .in("status", ["verified", "closed", "forfeit"]);

        const { data: matchesAsP2 } = await supabase
          .from("matches")
          .select("player1_score, player2_score, status, winner_id")
          .eq("player2_id", userId)
          .in("status", ["verified", "closed", "forfeit"]);

        let wins = 0,
          draws = 0,
          losses = 0,
          gf = 0,
          ga = 0;

        matchesAsP1?.forEach((m) => {
          if (m.status === "forfeit") {
            if (m.winner_id === userId) wins++;
            else losses++;
          } else {
            if (m.player1_score > m.player2_score) wins++;
            else if (m.player1_score < m.player2_score) losses++;
            else draws++;
          }
          gf += m.player1_score || 0;
          ga += m.player2_score || 0;
        });

        matchesAsP2?.forEach((m) => {
          if (m.status === "forfeit") {
            if (m.winner_id === userId) wins++;
            else losses++;
          } else {
            if (m.player2_score > m.player1_score) wins++;
            else if (m.player2_score < m.player1_score) losses++;
            else draws++;
          }
          gf += m.player2_score || 0;
          ga += m.player1_score || 0;
        });

        setStats({
          total_matches: (matchesAsP1?.length || 0) + (matchesAsP2?.length || 0),
          wins,
          draws,
          losses,
          goals_for: gf,
          goals_against: ga,
        });
      } catch (error) {
        console.error("Failed to load player:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <div className="mx-auto max-w-md px-5 py-10 text-center text-muted-foreground">
          Loading profile...
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <div className="mx-auto max-w-md px-5 py-10 text-center text-muted-foreground">
          Player not found.
        </div>
        <BottomNav />
      </div>
    );
  }

  const isOwnProfile = user?.id === userId;

  return (
    <div className="min-h-dvh bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 py-4">
          <h1 className="font-display text-xl tracking-wider">Player</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6 space-y-6">
        {/* Profile Card */}
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          {player.photo_url && (
            <img
              src={player.photo_url}
              alt={player.username}
              className="mx-auto mb-4 h-20 w-20 rounded-full border-2 border-primary"
            />
          )}
          <h1 className="font-display text-3xl tracking-wider">{player.username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Division {player.division} · {DIVISION_NAMES[player.division as keyof typeof DIVISION_NAMES]}
          </p>

          {player.konami_id && (
            <p className="mt-2 text-[11px] font-mono text-muted-foreground">
              Konami ID: {player.konami_id}
            </p>
          )}

          {player.warning_strikes > 0 && (
            <p className="mt-2 text-[11px] text-red-500">
              ⚠️ {player.warning_strikes} warning strike{player.warning_strikes !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Stats Grid */}
        {stats && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Matches
                </p>
                <p className="mt-2 font-display text-2xl tracking-wider">{stats.total_matches}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  W-D-L
                </p>
                <p className="mt-2 font-display text-lg tracking-wider">
                  {stats.wins}-{stats.draws}-{stats.losses}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Win Rate
                </p>
                <p className="mt-2 font-display text-xl tracking-wider">
                  {stats.total_matches > 0
                    ? ((stats.wins / stats.total_matches) * 100).toFixed(0)
                    : 0}
                  %
                </p>
              </div>
            </div>

            {/* Goals Stats */}
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-display text-sm tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Goal Stats
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">For</p>
                  <p className="font-display text-xl">{stats.goals_for}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">Against</p>
                  <p className="font-display text-xl">{stats.goals_against}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">Diff</p>
                  <p className="font-display text-xl text-primary">
                    {(stats.goals_for - stats.goals_against) > 0 ? "+" : ""}{stats.goals_for - stats.goals_against}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Earnings */}
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
          <h3 className="font-display text-sm tracking-wider mb-2 flex items-center gap-2">
            <Award className="h-4 w-4" />
            Career Earnings
          </h3>
          <p className="font-display text-3xl tracking-wider text-primary">
            KES {player.career_earnings.toLocaleString()}
          </p>
        </div>

        {/* Account Info */}
        <div className="text-center text-[10px] text-muted-foreground space-y-1">
          <p>Member since {new Date(player.created_at).toLocaleDateString("en-KE")}</p>
          {isOwnProfile && (
            <p className="text-primary">This is your profile</p>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
