import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Users } from "lucide-react";

interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_name?: string;
  player2_name?: string;
  player1_score?: number;
  player2_score?: number;
  match_date: string;
  time_slot_start: string;
  time_slot_end: string;
  status: string;
  winner_id?: string;
  stage?: string;
  group_id?: string;
}

interface BracketPreviewProps {
  tournamentId: string;
  tournamentType: "cup" | "league" | "quick";
}

export function BracketPreview({ tournamentId, tournamentType }: BracketPreviewProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadMatches();
  }, [tournamentId]);

  async function loadMatches() {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          id,
          player1_id,
          player2_id,
          player1_score,
          player2_score,
          match_date,
          time_slot_start,
          time_slot_end,
          status,
          winner_id,
          stage,
          group_id,
          profiles:player1_id(username),
          profiles_2:player2_id(username)
        `
        )
        .eq("tournament_id", tournamentId)
        .order("match_date", { ascending: true });

      if (error) throw error;

      const parsed = data?.map((m: any) => ({
        ...m,
        player1_name: m.profiles?.username || "TBD",
        player2_name: m.profiles_2?.username || "TBD",
      })) || [];

      setMatches(parsed);
    } catch (error) {
      console.error("Failed to load matches:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center text-muted-foreground text-[10px]">
        Loading bracket...
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center text-muted-foreground text-[10px]">
        No matches scheduled yet.
      </div>
    );
  }

  // Group matches by date
  const matchesByDate = matches.reduce(
    (acc, match) => {
      const date = new Date(match.match_date).toLocaleDateString("en-KE");
      if (!acc[date]) acc[date] = [];
      acc[date].push(match);
      return acc;
    },
    {} as Record<string, Match[]>
  );

  const displayMatches = expanded ? matches : matches.slice(0, 3);
  const hiddenCount = Math.max(0, matches.length - 3);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm tracking-wider">Bracket</h3>
        <Badge variant="outline" className="text-[9px]">
          {matches.length} matches
        </Badge>
      </div>

      <div className="space-y-2">
        {displayMatches.map((match) => (
          <div
            key={match.id}
            className={`rounded-lg border p-2 text-[10px] ${
              match.status === "verified" || match.status === "closed"
                ? "border-green-500/40 bg-green-500/5"
                : match.status === "active"
                  ? "border-primary/40 bg-primary/5"
                  : match.status === "flagged"
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-border"
            }`}
          >
            {/* Match Header */}
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-[9px] text-muted-foreground">
                  {match.stage && <span className="uppercase font-semibold text-primary mr-1">{match.stage}</span>}
                  {match.group_id && <span className="text-[8px]">Group {match.group_id.charAt(match.group_id.length - 1)} · </span>}
                  {new Date(match.match_date).toLocaleDateString("en-KE")} ·{" "}
                  {match.time_slot_start}
                </p>
              </div>
              <Badge
                variant={
                  match.status === "verified" || match.status === "closed"
                    ? "default"
                    : "secondary"
                }
                className="text-[8px]"
              >
                {match.status}
              </Badge>
            </div>

            {/* Players */}
            <div className="grid grid-cols-3 gap-1 items-center">
              <div className="text-right">
                <p className="font-semibold truncate">{match.player1_name}</p>
                {match.player1_score !== undefined && (
                  <p className="text-xs font-display">{match.player1_score}</p>
                )}
              </div>
              <p className="text-center text-[8px] text-muted-foreground">VS</p>
              <div className="text-left">
                <p className="font-semibold truncate">{match.player2_name}</p>
                {match.player2_score !== undefined && (
                  <p className="text-xs font-display">{match.player2_score}</p>
                )}
              </div>
            </div>

            {/* Winner Badge */}
            {match.winner_id && (
              <p className="text-[9px] text-green-600 mt-1">
                ✓ Winner: {match.winner_id === match.player1_id ? match.player1_name : match.player2_name}
              </p>
            )}
          </div>
        ))}
      </div>

      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full rounded-lg border border-border bg-card/50 p-2 text-[10px] font-semibold text-primary hover:bg-card transition flex items-center justify-center gap-1"
        >
          <ChevronDown className="h-3 w-3" />
          Show {hiddenCount} more match{hiddenCount !== 1 ? "es" : ""}
        </button>
      )}

      {expanded && hiddenCount === 0 && (
        <button
          onClick={() => setExpanded(false)}
          className="w-full rounded-lg border border-border bg-card/50 p-2 text-[10px] font-semibold text-muted-foreground hover:bg-card transition flex items-center justify-center gap-1"
        >
          Show less
        </button>
      )}
    </div>
  );
}
