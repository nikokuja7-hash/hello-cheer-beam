/**
 * Tournament Transparency Utilities — simplified for current schema
 */

import { supabase } from "@/integrations/supabase/client";

export type TournamentStage = "group" | "knockout" | "semifinal" | "final" | "third_place";

export async function getTournamentTransparencyData(tournamentId: string) {
  try {
    const { data: tournament } = await supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle();
    if (!tournament) return null;

    const { data: matches } = await supabase.from("matches").select("id, status, round, scheduled_at").eq("tournament_id", tournamentId).order("scheduled_at", { ascending: true });
    if (!matches) return null;

    const completed = matches.filter((m: any) => m.status === "verified" || m.status === "closed").length;
    const pending = matches.length - completed;

    return {
      stage: "group" as TournamentStage,
      dayNumber: 1,
      totalDays: 3,
      matchesPending: pending,
      matchesCompleted: completed,
      nextStageDescription: "Matches will be assigned once registration closes.",
      timeRemaining: undefined as string | undefined,
    };
  } catch (error) {
    console.error("Failed to get tournament transparency data:", error);
    return null;
  }
}
