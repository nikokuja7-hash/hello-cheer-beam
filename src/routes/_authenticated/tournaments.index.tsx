import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Trophy, Plus, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tournaments/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tournaments — Nexarena" }] }),
  component: TournamentsList,
});

function TournamentsList() {
  const [tabs, setTab] = useState<"open" | "active" | "mine">("open");
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      let q = supabase.from("tournaments").select("*").neq("kind", "quick_cash").order("created_at", { ascending: false });
      if (tabs === "open") q = q.in("status", ["open", "filling"]).eq("is_public", true);
      else if (tabs === "active") q = q.eq("status", "active");
      else {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) q = q.eq("creator_id", u.user.id);
      }
      const { data } = await q;
      setItems(data ?? []);
    })();
  }, [tabs]);

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <h1 className="font-display text-xl tracking-wider">Cup Tournaments</h1>
          <Link to="/tournaments/new" className="no-tap">
            <Button size="sm" className="h-8 gap-1 px-3 text-[10px] uppercase tracking-widest">
              <Plus className="h-3.5 w-3.5" /> Create
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-5">
        <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-card p-1">
          {(["open", "active", "mine"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`no-tap rounded py-2 text-[10px] font-bold uppercase tracking-widest transition ${tabs === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-2">
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
              <Trophy className="mx-auto h-8 w-8 text-primary/50" />
              <p className="mt-3 font-display text-base tracking-wider">No tournaments here</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {tabs === "mine" ? "You haven't created one yet." : "Check back soon — or create your own."}
              </p>
            </div>
          ) : items.map((t) => (
            <Link key={t.id} to="/tournaments/$id" params={{ id: t.id }} className="no-tap block">
              <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <div>
                  <p className="font-semibold">{t.name}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t.entry_fee_kes === 0 ? "Friendly" : `KES ${t.entry_fee_kes}`} · Max {t.max_players} · {t.status}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
