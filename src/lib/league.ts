/**
 * League System Utilities
 * Handles season creation, matchmaking, standings, and promotions
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
  1: {
    division: 1,
    name: "Elite",
    fee: 200,
    maxPlayers: 30,
    groupSize: 6,
  },
  2: {
    division: 2,
    name: "Challenger",
    fee: 100,
    maxPlayers: 30,
    groupSize: 6,
  },
  3: {
    division: 3,
    name: "Rookie",
    fee: 0,
    maxPlayers: Infinity,
    groupSize: 6,
  },
};

/**
 * Calculate goal difference
 */
export function calcGoalDifference(
  goalsFor: number,
  goalsAgainst: number
): number {
  return goalsFor - goalsAgainst;
}

/**
 * Tiebreaker comparison function
 * Returns: -1 if a wins, 1 if b wins, 0 if equal
 */
export function compareStandings(
  a: {
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  },
  b: {
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  }
): number {
  // 1. Points
  if (a.points !== b.points) return b.points - a.points;

  // 2. Head-to-head (would need match history - simplified for now)
  
  // 3. Goal difference
  const aDiff = calcGoalDifference(a.goalsFor, a.goalsAgainst);
  const bDiff = calcGoalDifference(b.goalsFor, b.goalsAgainst);
  if (aDiff !== bDiff) return bDiff - aDiff;

  // 4. Goals scored
  if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;

  // 5. Shots on target (if available - defaults to 0)

  return 0;
}

/**
 * Create round-robin matches for a group
 * Groups of 6 players, each plays each other once = 5 matchdays
 */
export function generateRoundRobinMatches(
  groupId: string,
  playerIds: string[],
  startDate: Date
): Array<{
  player1_id: string;
  player2_id: string;
  scheduled_at: string;
  round: number;
}> {
  const matches: Array<{
    player1_id: string;
    player2_id: string;
    scheduled_at: string;
    round: number;
  }> = [];

  // Simple round-robin: each pair plays once
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

/**
 * Calculate standings position for a player in a group
 */
export async function updateGroupStandings(groupId: string): Promise<void> {
  // Fetch all matches in the group with results
  const { data: matches, error: matchError } = await supabase
    .from("matches")
    .select("*")
    .eq("group_id", groupId)
    .in("status", ["verified", "closed"]);

  if (matchError || !matches) return;

  // Get all league standings for this group
  const { data: standings, error: standingsError } = await supabase
    .from("league_standings")
    .select("*")
    .eq("group_id", groupId);

  if (standingsError || !standings) return;

  // Reset standings
  for (const standing of standings) {
    await supabase
      .from("league_standings")
      .update({
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        points: 0,
      })
      .eq("id", standing.id);
  }

  // Process each match and update standings
  for (const match of matches) {
    const p1Standing = standings.find((s) => s.user_id === match.player1_id);
    const p2Standing = standings.find((s) => s.user_id === match.player2_id);

    if (!p1Standing || !p2Standing) continue;

    const score1 = match.player1_score ?? 0;
    const score2 = match.player2_score ?? 0;

    // Update played count
    let p1Updates = {
      played: (p1Standing.played || 0) + 1,
      goals_for: (p1Standing.goals_for || 0) + score1,
      goals_against: (p1Standing.goals_against || 0) + score2,
    };

    let p2Updates = {
      played: (p2Standing.played || 0) + 1,
      goals_for: (p2Standing.goals_for || 0) + score2,
      goals_against: (p2Standing.goals_against || 0) + score1,
    };

    // Determine winner/draw
    if (score1 > score2) {
      p1Updates = { ...p1Updates, won: (p1Standing.won || 0) + 1, points: (p1Standing.points || 0) + 3 };
      p2Updates = { ...p2Updates, lost: (p2Standing.lost || 0) + 1 };
    } else if (score2 > score1) {
      p2Updates = { ...p2Updates, won: (p2Standing.won || 0) + 1, points: (p2Standing.points || 0) + 3 };
      p1Updates = { ...p1Updates, lost: (p1Standing.lost || 0) + 1 };
    } else {
      p1Updates = { ...p1Updates, drawn: (p1Standing.drawn || 0) + 1, points: (p1Standing.points || 0) + 1 };
      p2Updates = { ...p2Updates, drawn: (p2Standing.drawn || 0) + 1, points: (p2Standing.points || 0) + 1 };
    }

    // Update database
    await supabase.from("league_standings").update(p1Updates).eq("id", p1Standing.id);
    await supabase.from("league_standings").update(p2Updates).eq("id", p2Standing.id);
  }

  // Calculate final positions based on standings
  const { data: finalStandings } = await supabase
    .from("league_standings")
    .select("*")
    .eq("group_id", groupId)
    .order("points", { ascending: false })
    .order("goals_for", { ascending: false });

  if (finalStandings) {
    for (let i = 0; i < finalStandings.length; i++) {
      await supabase
        .from("league_standings")
        .update({ position: i + 1 })
        .eq("id", finalStandings[i].id);
    }
  }
}

/**
 * Get current season for a division
 */
export async function getCurrentLeagueSeason(
  division: number
): Promise<any | null> {
  const { data } = await supabase
    .from("league_seasons")
    .select("*")
    .eq("division", division)
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

/**
 * Register player for a league season
 */
export async function registerForLeagueSeason(
  userId: string,
  seasonId: string,
  division: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if already registered
    const { data: existing } = await supabase
      .from("league_entries")
      .select("id")
      .eq("season_id", seasonId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return { success: false, error: "Already registered for this season" };
    }

    // Insert entry (will be assigned to group later)
    const { error } = await supabase.from("league_entries").insert({
      season_id: seasonId,
      user_id: userId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get player's current division and season info
 */
export async function getPlayerLeagueStatus(
  userId: string
): Promise<{ division: number; currentSeason: any; entry: any } | null> {
  try {
    // Get player profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("division")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) return null;

    const division = profile.division || 3;

    // Get current season
    const season = await getCurrentLeagueSeason(division);
    if (!season) return { division, currentSeason: null, entry: null };

    // Get player's entry for this season
    const { data: entry } = await supabase
      .from("league_entries")
      .select("*")
      .eq("season_id", season.id)
      .eq("user_id", userId)
      .maybeSingle();

    return { division, currentSeason: season, entry };
  } catch (error) {
    console.error("Failed to get player league status:", error);
    return null;
  }
}
