import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function PreviewBracket({ tournamentId }: { tournamentId: string }) {
  const [players, setPlayers] = useState<{ id: string; username: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: entries } = await supabase.from("tournament_entries").select("user_id").eq("tournament_id", tournamentId);
      const ids = (entries ?? []).map((e: any) => e.user_id);
      if (ids.length === 0) { setPlayers([]); return; }
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", ids);
      setPlayers((profs ?? []) as any);
    })();
  }, [tournamentId]);

  if (players.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No players yet.</p>;
  }

  // Simple pair preview
  const pairs: [typeof players[0], typeof players[0] | null][] = [];
  for (let i = 0; i < players.length; i += 2) pairs.push([players[i], players[i + 1] ?? null]);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live preview · {players.length} joined</p>
      {pairs.map((p, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg border border-border bg-card p-3">
          <span className="truncate text-sm font-semibold">{p[0]?.username}</span>
          <span className="font-display text-xs tracking-widest text-primary">VS</span>
          <span className="truncate text-right text-sm font-semibold text-muted-foreground">
            {p[1]?.username ?? <span className="italic">TBD</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
