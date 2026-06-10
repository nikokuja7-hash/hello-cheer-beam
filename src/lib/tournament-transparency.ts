/**
 * Tournament Transparency Utilities
 * Helper functions to calculate and display tournament stage information
 */

import type { TournamentStage } from "@/lib/bracket";
import { supabase } from "@/integrations/supabase/client";

export async function getTournamentTransparencyData(tournamentId: string) {
  try {
    // Get tournament info
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .maybeSingle();

    if (!tournament) return null;

    // Get matches grouped by stage
    const { data: matches } = await supabase
      .from("matches")
      .select("id, status, stage, match_date")
      .eq("tournament_id", tournamentId)
      .order("match_date", { ascending: true });

    if (!matches) return null;

    // Determine current stage (stage with pending or active matches)
    const activeStages = ["knockout", "group", "semifinal", "final", "third_place"] as TournamentStage[];
    let currentStage: TournamentStage = "group";
    let stageIndex = 0;

    for (const stage of activeStages) {
      const stageMatches = matches.filter((m) => m.stage === stage);
      if (stageMatches.length > 0 && !stageMatches.every((m) => m.status === "verified" || m.status === "closed")) {
        currentStage = stage;
        stageIndex = activeStages.indexOf(stage);
        break;
      }
    }

    // Calculate day number (for now, simplified)
    const dayNumber = currentStage === "knockout" ? 1 : currentStage === "group" ? 2 : 3;
    const totalDays = 3;

    // Count pending and completed matches in current stage
    const currentMatches = matches.filter((m) => m.stage === currentStage);
    const matchesPending = currentMatches.filter((m) => m.status !== "verified" && m.status !== "closed").length;
    const matchesCompleted = currentMatches.filter((m) => m.status === "verified" || m.status === "closed").length;

    // Determine what happens next based on current stage
    let nextStageDescription = "";
    if (currentStage === "knockout") {
      nextStageDescription = "Winners advance to Group Stage starting Saturday morning.";
    } else if (currentStage === "group") {
      nextStageDescription = "Top 2 players from each group advance to Semifinals on Sunday evening.";
    } else if (currentStage === "semifinal") {
      nextStageDescription = "Winners play in the Final. Losers compete in the 3rd Place Playoff.";
    } else if (currentStage === "final") {
      nextStageDescription = "Tournament complete. Payouts processing.";
    }

    // Calculate time remaining (simplified)
    const stageEndTimes: Record<TournamentStage, string> = {
      knockout: "Friday 10pm",
      group: "Sunday 6am",
      semifinal: "Sunday 8pm",
      final: "Tournament Over",
      third_place: "Tournament Over",
    };

    const timeRemaining = `Stage ends by ${stageEndTimes[currentStage]}`;

    return {
      stage: currentStage,
      dayNumber,
      totalDays,
      matchesPending,
      matchesCompleted,
      nextStageDescription,
      timeRemaining,
    };
  } catch (error) {
    console.error("Failed to get tournament transparency data:", error);
    return null;
  }
}
