/**
 * Bracket utilities placeholder
 */

export type TournamentStage = "group" | "knockout" | "semifinal" | "final" | "third_place";

export function formatStageName(stage: TournamentStage): string {
  const names: Record<string, string> = {
    group: "Group Stage",
    knockout: "Knockout",
    semifinal: "Semifinal",
    final: "Final",
    third_place: "3rd Place",
  };
  return names[stage] || stage;
}
