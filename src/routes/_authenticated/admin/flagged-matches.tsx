import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/flagged-matches")({
  ssr: false,
  head: () => ({ meta: [{ title: "Flagged Matches — Nexarena Admin" }] }),
  component: FlaggedMatches,
});

function FlaggedMatches() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadFlaggedMatches(); }, []);

  async function loadFlaggedMatches() {
    try {
      const { data, error } = await supabase.from("matches").select("*, player1:player1_id(username), player2:player2_id(username)").eq("status", "disputed").order("created_at", { ascending: false });
      if (error) throw error;
      setMatches((data || []).map((m: any) => ({ ...m, player1_name: m.player1?.username || "Unknown", player2_name: m.player2?.username || "Unknown" })));
    } catch { toast.error("Failed to load flagged matches"); }
    finally { setLoading(false); }
  }

  async function resolveMatch(matchId: string, winnerId: string | null) {
    const { error } = await supabase.from("matches").update({ status: "closed", winner_id: winnerId }).eq("id", matchId);
    if (error) return toast.error(error.message);
    toast.success("Match resolved.");
    loadFlaggedMatches();
  }

  if (loading) return <div className="min-h-dvh bg-background pb-24"><div className="mx-auto max-w-md px-5 py-10 text-center text-muted-foreground">Loading...</div></div>;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 py-4">
          <h1 className="font-display text-xl tracking-wider flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" /> Disputed Matches</h1>
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 py-6 space-y-4">
        {matches.length === 0 ? <p className="text-center text-[11px] text-muted-foreground py-8">No disputes. All clear!</p> : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div key={match.id} className="rounded-lg border border-red-500/40 bg-red-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div><p className="font-semibold">{match.player1_name}</p><p className="text-lg font-display">{match.player1_score ?? 0}</p></div>
                  <p className="text-xs text-muted-foreground">VS</p>
                  <div className="text-right"><p className="font-semibold">{match.player2_name}</p><p className="text-lg font-display">{match.player2_score ?? 0}</p></div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={() => resolveMatch(match.id, match.player1_id)} size="sm" className="flex-1 h-8 text-[10px]"><Check className="h-3 w-3 mr-1" /> {match.player1_name} wins</Button>
                  <Button onClick={() => resolveMatch(match.id, match.player2_id)} size="sm" variant="outline" className="flex-1 h-8 text-[10px]">{match.player2_name} wins</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
