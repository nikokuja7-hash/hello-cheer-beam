/**
 * Tournament Bracket Generation - Final Format (UPDATED)
 *
 * CORE RULE: Maximum 2 matches per player per day. Every tournament finishes in 3 days.
 *
 * FORMAT A (30-35 players): Straight to Group Stage
 *   Friday Evening → Group Stage Match Day 1
 *   Saturday Morning → Group Stage Match Day 2
 *   Saturday Evening → Group Stage Match Day 3
 *   Sunday Morning → Group Stage Match Day 4 (final group matches, top 2 advance)
 *   Sunday Evening → Semifinals + Final + 3rd Place Playoff
 *
 * FORMAT B (36+ players): Knockout Round 1 → Group Stage → Semifinals
 *   Friday Evening → Knockout Round 1 (all players paired, losers eliminated)
 *   Saturday Morning → Group Stage Match Day 1
 *   Saturday Evening → Group Stage Match Day 2
 *   Sunday Morning → Group Stage Match Day 3 (final group matches, top 2 advance)
 *   Sunday Evening → Semifinals + Final + 3rd Place Playoff
 */

export type TournamentStage = "knockout" | "group" | "semifinal" | "final" | "third_place";
export type TournamentFormat = "A" | "B";

export interface Match {
  id?: string;
  tournament_id: string;
  player1_id: string;
  player2_id: string;
  player1_score?: number;
  player2_score?: number;
  status: "scheduled" | "active" | "verified" | "flagged" | "closed" | "forfeit";
  stage: TournamentStage;
  group_id?: string;
  match_date: string;
  time_slot_start: string;
  time_slot_end: string;
  winner_id?: string;
  created_at?: string;
}

export interface GroupStanding {
  user_id: string;
  username?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
  position: number;
}

export interface Group {
  id: string;
  tournament_id: string;
  group_number: number;
  name: string;
  player_ids: string[];
  standings?: GroupStanding[];
}

export interface TournamentBracket {
  format: TournamentFormat;
  total_players: number;
  knockout_round1_count: number;
  group_count: number;
  group_size: number;
  groups: Group[];
  knockout_matches?: Match[];
  group_matches: Match[];
  semifinal_matches?: Match[];
  final_match?: Match;
  third_place_match?: Match;
}

/**
 * Determine tournament format based on player count
 * Format A: 30-35 players (straight to group stage)
 * Format B: 36+ players (knockout round 1, then group stage)
 */
export function determineTournamentFormat(playerCount: number): TournamentFormat {
  if (playerCount <= 35) {
    return "A";
  }
  return "B";
}

/**
 * Calculate optimal group configuration
 * Returns breakdown of how many players per group
 */
export function calculateGroupConfiguration(playerCount: number): {
  groupCount: number;
  groupSize: number;
  breakdown: number[];
} {
  if (playerCount <= 6) {
    return { groupCount: 1, groupSize: playerCount, breakdown: [playerCount] };
  }

  // 30-35 players: 5 groups of 6-7
  if (playerCount === 30) {
    return { groupCount: 5, groupSize: 6, breakdown: [6, 6, 6, 6, 6] };
  }
  if (playerCount === 31) {
    return { groupCount: 5, groupSize: 6.2, breakdown: [6, 6, 6, 6, 7] };
  }
  if (playerCount === 32) {
    return { groupCount: 5, groupSize: 6.4, breakdown: [6, 6, 7, 6, 7] };
  }
  if (playerCount === 33) {
    return { groupCount: 5, groupSize: 6.6, breakdown: [6, 7, 6, 7, 7] };
  }
  if (playerCount === 34) {
    return { groupCount: 5, groupSize: 6.8, breakdown: [7, 7, 7, 6, 7] };
  }
  if (playerCount === 35) {
    return { groupCount: 5, groupSize: 7, breakdown: [7, 7, 7, 7, 7] };
  }

  // Fallback
  const groupSize = Math.round(playerCount / 5);
  const groupCount = Math.ceil(playerCount / groupSize);
  return { groupCount, groupSize, breakdown: Array(groupCount).fill(groupSize) };
}

/**
 * Generate tournament bracket based on format
 * - Format A: Straight to group stage (Friday evening start)
 * - Format B: Knockout round 1 (Friday evening), then group stage (Saturday morning start)
 */
export function generateTournamentBracket(
  playerIds: string[],
  tournamentId: string,
  startDate: Date
): TournamentBracket {
  const format = determineTournamentFormat(playerIds.length);

  const bracket: TournamentBracket = {
    format,
    total_players: playerIds.length,
    knockout_round1_count: 0,
    group_count: 0,
    group_size: 0,
    groups: [],
    group_matches: [],
  };

  // FORMAT B: Knockout Round 1 (Friday Evening)
  if (format === "B") {
    bracket.knockout_matches = generateKnockoutRound1(
      playerIds,
      tournamentId,
      startDate
    );
    bracket.knockout_round1_count = bracket.knockout_matches.length;
  }

  // Group Stage Configuration
  // Format A uses all players, Format B uses ~32-35 (winners from knockout + some byes)
  const effectivePlayerCount = format === "B" ? 32 : playerIds.length;
  const groupConfig = calculateGroupConfiguration(effectivePlayerCount);

  bracket.group_count = groupConfig.groupCount;
  bracket.group_size = groupConfig.groupSize;

  // For Format B, simulate that knockout eliminates down to ~32 players
  const groupPlayers = format === "B" ? playerIds.slice(0, 32) : playerIds;

  // Create Groups (randomized)
  const shuffled = [...groupPlayers].sort(() => Math.random() - 0.5);
  let playerIdx = 0;

  for (let g = 0; g < groupConfig.groupCount; g++) {
    const size = Math.round(groupConfig.breakdown[g] || groupConfig.groupSize);
    const groupPlayerIds = shuffled.slice(playerIdx, playerIdx + size);
    playerIdx += size;

    const group: Group = {
      id: `group-${g + 1}`,
      tournament_id: tournamentId,
      group_number: g + 1,
      name: String.fromCharCode(65 + g), // A, B, C, D, E
      player_ids: groupPlayerIds,
    };

    bracket.groups.push(group);
  }

  // Generate Group Stage Matches
  // Format A: Starts Friday Evening
  // Format B: Starts Saturday Morning
  const groupStartDayOffset = format === "B" ? 1 : 0;
  bracket.group_matches = generateGroupStageMatches(
    bracket.groups,
    tournamentId,
    startDate,
    groupStartDayOffset
  );

  return bracket;
}

/**
 * Generate Knockout Round 1 for Format B
 * All players paired randomly, losers eliminated
 * Friday Evening: 6pm-8pm, 7pm-9pm, 8pm-10pm slots
 */
function generateKnockoutRound1(
  playerIds: string[],
  tournamentId: string,
  startDate: Date
): Match[] {
  const matches: Match[] = [];
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

  const fridayEvening = new Date(startDate);
  fridayEvening.setHours(0, 0, 0, 0); // Start of Friday

  let matchCount = 0;

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    // Distribute into 3 time slots: 6-8pm, 7-9pm, 8-10pm
    const slotIndex = Math.floor(matchCount / Math.ceil(shuffled.length / 6)) % 3;
    const startHour = 18 + slotIndex; // 18, 19, 20 (6pm, 7pm, 8pm)
    const endHour = startHour + 2;

    matches.push({
      tournament_id: tournamentId,
      player1_id: shuffled[i],
      player2_id: shuffled[i + 1],
      status: "scheduled",
      stage: "knockout",
      match_date: fridayEvening.toISOString(),
      time_slot_start: `${startHour.toString().padStart(2, "0")}:00`,
      time_slot_end: `${endHour.toString().padStart(2, "0")}:00`,
    });

    matchCount++;
  }

  return matches;
}

/**
 * Generate Group Stage Matches (4 matchdays maximum, 3 days, max 2 per player per day)
 *
 * Scheduling:
 * - Format A: Friday Evening (day 0), Saturday Morning (day 1), Saturday Evening (day 2), Sunday Morning (day 3)
 * - Format B: Saturday Morning (day 0), Saturday Evening (day 1), Sunday Morning (day 2), Sunday Evening (day 3, but this is finals)
 */
function generateGroupStageMatches(
  groups: Group[],
  tournamentId: string,
  startDate: Date,
  dayOffset: number = 0
): Match[] {
  const matches: Match[] = [];

  for (const group of groups) {
    const playerCount = group.player_ids.length;
    const matchdaysNeeded = playerCount - 1; // Round-robin: n-1 matchdays
    const maxMatchdaysPerGroup = 4; // Maximum 4 matchdays for group stage

    for (let matchday = 0; matchday < Math.min(matchdaysNeeded, maxMatchdaysPerGroup); matchday++) {
      // Distribute matches across days
      const dayIndex = dayOffset + Math.floor(matchday / 2); // 2 matchdays per calendar day
      let slotType: "morning" | "afternoon" | "evening" = "evening";

      if (dayIndex === 0 && dayOffset === 0) {
        // Format A, Day 0 (Friday)
        slotType = matchday === 0 ? "evening" : "evening";
      } else if (dayIndex === 0 && dayOffset === 1) {
        // Format B, Day 0 (Saturday morning after knockout)
        slotType = "morning";
      } else if (dayIndex === 1) {
        // Saturday morning (Format A day 1) or Saturday evening (Format B day 1)
        slotType = matchday % 2 === 0 ? "morning" : "evening";
      } else if (dayIndex === 2) {
        // Sunday morning
        slotType = "morning";
      }

      // Generate matches for this matchday using round-robin algorithm
      const dayMatches = generateRoundRobinMatchday(group.player_ids, matchday);

      // Calculate actual date
      const matchDate = new Date(startDate);
      const daysFromStart = dayOffset + Math.floor(matchday / 2);
      matchDate.setDate(matchDate.getDate() + daysFromStart);

      const timeInfo = getTimeSlot(slotType);

      for (let i = 0; i < dayMatches.length; i++) {
        const [p1, p2] = dayMatches[i];

        // Offset time slots: if multiple matches in same slot, use different hours
        let startHour = parseInt(timeInfo.start.split(":")[0]);
        if (i > 0) {
          startHour += (i % 2) * 2; // Every 2 matches, shift by 2 hours
        }
        const endHour = startHour + 2;

        matches.push({
          tournament_id: tournamentId,
          player1_id: p1,
          player2_id: p2,
          status: "scheduled",
          stage: "group",
          group_id: group.id,
          match_date: matchDate.toISOString(),
          time_slot_start: `${startHour.toString().padStart(2, "0")}:00`,
          time_slot_end: `${endHour.toString().padStart(2, "0")}:00`,
        });
      }
    }
  }

  return matches;
}

/**
 * Generate matches for a single round-robin matchday using cyclic scheduling
 */
function generateRoundRobinMatchday(playerIds: string[], matchday: number): [string, string][] {
  const matches: [string, string][] = [];
  const n = playerIds.length;

  for (let i = 0; i < Math.floor(n / 2); i++) {
    const idx1 = (matchday + i) % n;
    const idx2 = (matchday + n - 1 - i) % n;

    if (idx1 !== idx2) {
      matches.push([playerIds[idx1], playerIds[idx2]]);
    }
  }

  return matches;
}

/**
 * Get time slot details
 */
function getTimeSlot(type: "morning" | "afternoon" | "evening"): { start: string; end: string } {
  switch (type) {
    case "morning":
      return { start: "08:00", end: "10:00" };
    case "afternoon":
      return { start: "12:00", end: "14:00" };
    case "evening":
      return { start: "18:00", end: "20:00" };
  }
}

/**
 * Calculate performance score for draws (used in knockout stage if scores equal)
 * Weights: shots_on_target (30%), possession (20%), successful_passes (15%), shots (15%), defense (10%)
 */
export function calculatePerformanceScore(stats: {
  shots_on_target: number;
  possession: number;
  successful_passes: number;
  shots: number;
  tackles: number;
  interceptions: number;
}): number {
  return (
    stats.shots_on_target * 0.3 +
    (stats.possession / 100) * 0.2 +
    (stats.successful_passes / 100) * 0.15 +
    (stats.shots / 10) * 0.15 +
    ((stats.tackles + stats.interceptions) / 10) * 0.1
  );
}

/**
 * Format stage name for display
 */
export function formatStageName(stage: TournamentStage): string {
  switch (stage) {
    case "knockout":
      return "KNOCKOUT STAGE";
    case "group":
      return "GROUP STAGE";
    case "semifinal":
      return "SEMIFINALS";
    case "final":
      return "FINAL";
    case "third_place":
      return "3RD PLACE PLAYOFF";
  }
}

/**
 * Get the round number for knockout stage
 */
export function getKnockoutRound(playerCount: number): number {
  if (playerCount <= 2) return 1;
  if (playerCount <= 4) return 2;
  if (playerCount <= 8) return 3;
  if (playerCount <= 16) return 4;
  if (playerCount <= 32) return 5;
  if (playerCount <= 64) return 6;
  return 7;
}
