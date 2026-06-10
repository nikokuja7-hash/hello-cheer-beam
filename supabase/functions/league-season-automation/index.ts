import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface LeagueSeason {
  id: string;
  division: number;
  season_number: number;
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req: Request) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    console.log("Starting league season automation...");

    // Get the current date
    const now = new Date();
    const mondayOfThisWeek = new Date(now);
    mondayOfThisWeek.setDate(mondayOfThisWeek.getDate() - mondayOfThisWeek.getDay() + 1);
    mondayOfThisWeek.setHours(0, 0, 0, 0);

    // Check if a season already exists for this week
    const { data: existingSeason } = await supabase
      .from("league_seasons")
      .select("id")
      .gte("starts_at", mondayOfThisWeek.toISOString())
      .lt("starts_at", new Date(mondayOfThisWeek.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (existingSeason && existingSeason.length > 0) {
      console.log("Season already exists for this week");
      return new Response("Season already exists for this week", { status: 200 });
    }

    // Get the latest season for each division to get the season number
    const divisionSeasons = [];
    for (const division of [1, 2, 3]) {
      const { data: lastSeason } = await supabase
        .from("league_seasons")
        .select("season_number")
        .eq("division", division)
        .order("season_number", { ascending: false })
        .limit(1);

      const nextSeasonNumber = (lastSeason?.[0]?.season_number || 0) + 1;

      // Create new season
      const { data: newSeason, error: seasonError } = await supabase
        .from("league_seasons")
        .insert({
          division,
          season_number: nextSeasonNumber,
          starts_at: mondayOfThisWeek.toISOString(),
          ends_at: new Date(mondayOfThisWeek.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          registration_closes_at: new Date(mondayOfThisWeek.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          status: "active",
        })
        .select()
        .single();

      if (seasonError) {
        console.error("Failed to create season for division", division, seasonError);
        continue;
      }

      divisionSeasons.push({ ...newSeason, division });
    }

    // Handle promotions and relegations from previous season
    await handlePromotionsAndRelegations();

    // For each new season, get registered players and assign them to groups
    for (const season of divisionSeasons) {
      await createGroupsAndMatches(season);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "League seasons created and matches generated",
        seasons: divisionSeasons,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("League automation error:", error);
    return new Response("Internal server error", { status: 500 });
  }
});

async function handlePromotionsAndRelegations() {
  try {
    // Get previous season entries and determine promotions/relegations
    // Top 4 from D2 → promoted to D1
    // Top 6 from D3 → promoted to D2
    // Bottom 4 from D1 → relegated to D2
    // Bottom 6 from D2 → relegated to D3

    // D1 relegations (bottom 4)
    const { data: d1Bottom } = await supabase
      .from("league_standings")
      .select("user_id")
      .eq("division", 1)
      .order("position", { ascending: false })
      .limit(4);

    for (const entry of d1Bottom || []) {
      await supabase.from("profiles").update({ division: 2 }).eq("id", entry.user_id);
    }

    // D2 promotions (top 4) and relegations (bottom 6)
    const { data: d2Top } = await supabase
      .from("league_standings")
      .select("user_id")
      .eq("division", 2)
      .order("position", { ascending: true })
      .limit(4);

    for (const entry of d2Top || []) {
      await supabase.from("profiles").update({ division: 1 }).eq("id", entry.user_id);
    }

    const { data: d2Bottom } = await supabase
      .from("league_standings")
      .select("user_id")
      .eq("division", 2)
      .order("position", { ascending: false })
      .limit(6);

    for (const entry of d2Bottom || []) {
      await supabase.from("profiles").update({ division: 3 }).eq("id", entry.user_id);
    }

    // D3 promotions (top 6)
    const { data: d3Top } = await supabase
      .from("league_standings")
      .select("user_id")
      .eq("division", 3)
      .order("position", { ascending: true })
      .limit(6);

    for (const entry of d3Top || []) {
      await supabase.from("profiles").update({ division: 2 }).eq("id", entry.user_id);
    }

    console.log("Promotions and relegations handled");
  } catch (error) {
    console.error("Failed to handle promotions/relegations:", error);
  }
}

async function createGroupsAndMatches(season: any) {
  try {
    // Get all players in this division who have completed onboarding
    const { data: players } = await supabase
      .from("profiles")
      .select("id")
      .eq("division", season.division)
      .eq("onboarding_complete", true)
      .eq("is_verified", true);

    if (!players || players.length === 0) {
      console.log(`No players in division ${season.division}`);
      return;
    }

    // Shuffle players for random group assignment
    const shuffled = [...players].sort(() => Math.random() - 0.5);

    // Create groups (6 players per group)
    const groupSize = 6;
    let groupNumber = 0;

    for (let i = 0; i < shuffled.length; i += groupSize) {
      groupNumber++;
      const groupPlayers = shuffled.slice(i, Math.min(i + groupSize, shuffled.length));

      // Create group
      const { data: group, error: groupError } = await supabase
        .from("league_groups")
        .insert({
          season_id: season.id,
          group_number: groupNumber,
        })
        .select()
        .single();

      if (groupError) {
        console.error("Failed to create group:", groupError);
        continue;
      }

      // Initialize standings for each player
      for (const player of groupPlayers) {
        await supabase.from("league_standings").insert({
          group_id: group.id,
          user_id: player.id,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goals_for: 0,
          goals_against: 0,
          points: 0,
          position: 0,
          division: season.division,
        });

        // Add league entry
        await supabase.from("league_entries").insert({
          season_id: season.id,
          group_id: group.id,
          user_id: player.id,
        });
      }

      // Generate round-robin matches (5 matchdays for 6 players)
      await generateRoundRobinMatches(group.id, groupPlayers, season.starts_at);
    }

    console.log(
      `Created ${groupNumber} groups for division ${season.division} with ${shuffled.length} players`
    );
  } catch (error) {
    console.error("Failed to create groups and matches:", error);
  }
}

async function generateRoundRobinMatches(
  groupId: string,
  players: any[],
  startDate: string
) {
  try {
    const playerIds = players.map((p) => p.id);
    const n = playerIds.length;

    // Simple round-robin: create 5 matchdays (for 6 players)
    // Each player plays each other player once
    for (let matchday = 0; matchday < n - 1; matchday++) {
      for (let i = 0; i < Math.floor(n / 2); i++) {
        const idx1 = (matchday + i) % n;
        const idx2 = (matchday + n - 1 - i) % n;

        if (idx1 !== idx2) {
          const matchDate = new Date(startDate);
          matchDate.setDate(matchDate.getDate() + matchday);

          // Pick a random time slot (evening default)
          const hour = 18 + Math.floor(Math.random() * 3);
          const timeSlotStart = `${hour.toString().padStart(2, "0")}:00`;
          const timeSlotEnd = `${(hour + 2).toString().padStart(2, "0")}:00`;

          await supabase.from("matches").insert({
            tournament_id: groupId, // Use group_id as tournament_id for league matches
            player1_id: playerIds[idx1],
            player2_id: playerIds[idx2],
            match_date: matchDate.toISOString(),
            time_slot_start: timeSlotStart,
            time_slot_end: timeSlotEnd,
            status: "scheduled",
            group_id: groupId,
            tournament_type: "league",
          });
        }
      }
    }

    console.log(`Generated ${n - 1} matchdays for group ${groupId}`);
  } catch (error) {
    console.error("Failed to generate round-robin matches:", error);
  }
}
