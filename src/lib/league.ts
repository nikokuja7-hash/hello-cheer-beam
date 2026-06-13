/**
 * League System Utilities — simplified for current schema
 */

import { supabase } from "@/integrations/supabase/client";

export interface LeagueSeasonMetadata {
  division: number;
  name: string;
  fee: number;
  maxPlayers: number;
  groupSize: number;
}

const DIVISION_CONFIG: Record<number, LeagueSeasonMetadata> = {
  1: { division: 1, name: "Elite", fee: 200, maxPlayers: 30, groupSize: 6 },
  2: { division: 2, name: "Challenger", fee: 100, maxPlayers: 30, groupSize: 6 },
  3: { division: 3, name: "Rookie", fee: 0, maxPlayers: Infinity, groupSize: 6 },
};

export function calcGoalDifference(goalsFor: number, goalsAgainst: number): number {
  return goalsFor - goalsAgainst;
}

export function compareStandings(
  a: { won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number },
  b: { won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; points: number }
): number {
  if (a.points !== b.points) return b.points - a.points;
  const aDiff = calcGoalDifference(a.goalsFor, a.goalsAgainst);
  const bDiff = calcGoalDifference(b.goalsFor, b.goalsAgainst);
  if (aDiff !== bDiff) return bDiff - aDiff;
  if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
  return 0;
}

export function generateRoundRobinMatches(
  playerIds: string[],
  startDate: Date
): Array<{ player1_id: string; player2_id: string; scheduled_at: string; round: number }> {
  const matches: Array<{ player1_id: string; player2_id: string; scheduled_at: string; round: number }> = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const round = Math.min(i + j, playerIds.length - 1);
      const matchDate = new Date(startDate);
      matchDate.setDate(matchDate.getDate() + round);
      matches.push({
        player1_id: playerIds[i],
        player2_id: playerIds[j],
        scheduled_at: matchDate.toISOString(),
        round: round + 1,
      });
    }
  }
  return matches;
}

export async function getCurrentLeagueSeason(division: number): Promise<any | null> {
  const { data } = await supabase
    .from("league_seasons")
    .select("*")
    .eq("division", division)
    .eq("status", "open")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getPlayerLeagueStatus(userId: string): Promise<{ division: number; currentSeason: any } | null> {
  try {
    const { data: profile } = await supabase.from("profiles").select("division").eq("id", userId).maybeSingle();
    if (!profile) return null;
    const division = profile.division || 3;
    const season = await getCurrentLeagueSeason(division);
    return { division, currentSeason: season };
  } catch (error) {
    console.error("Failed to get player league status:", error);
    return null;
  }
}
