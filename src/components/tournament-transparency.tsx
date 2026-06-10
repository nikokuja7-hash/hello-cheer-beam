import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { formatStageName } from "@/lib/bracket";
import type { TournamentStage } from "@/lib/bracket";

interface TournamentTransparencyProps {
  stage: TournamentStage;
  dayNumber: number;
  totalDays: number;
  matchesPending: number;
  matchesCompleted: number;
  nextStageDescription: string;
  timeRemaining?: string;
}

export function TournamentTransparency({
  stage,
  dayNumber,
  totalDays,
  matchesPending,
  matchesCompleted,
  nextStageDescription,
  timeRemaining,
}: TournamentTransparencyProps) {
  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      {/* Current Stage */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Current Stage
          </p>
          <p className="mt-1 font-display text-sm tracking-wider text-primary">
            {formatStageName(stage)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Day Number
          </p>
          <p className="mt-1 font-display text-sm tracking-wider">
            Day {dayNumber} of {totalDays}
          </p>
        </div>
      </div>

      {/* Match Progress */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-background/50 p-2 text-center">
          <p className="text-[9px] text-muted-foreground">Completed</p>
          <p className="mt-1 font-display text-lg text-green-500">{matchesCompleted}</p>
        </div>
        <div className="rounded-lg bg-background/50 p-2 text-center">
          <p className="text-[9px] text-muted-foreground">Pending</p>
          <p className="mt-1 font-display text-lg text-yellow-500">{matchesPending}</p>
        </div>
      </div>

      {/* Next Stage */}
      <div className="rounded-lg bg-background/50 p-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          What Happens Next
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-foreground">{nextStageDescription}</p>
      </div>

      {/* Time Remaining */}
      {timeRemaining && (
        <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/40 p-2">
          <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          <p className="text-[10px] text-yellow-600">{timeRemaining}</p>
        </div>
      )}
    </div>
  );
}
