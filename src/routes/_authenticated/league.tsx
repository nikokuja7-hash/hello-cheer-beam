import { createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/bottom-nav";
import { useState } from "react";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/league")({
  ssr: false,
  head: () => ({ meta: [{ title: "League — Nexarena" }] }),
  component: League,
});

const DIV_META = [
  { n: 1, name: "Elite", fee: 200, color: "from-primary to-primary/60" },
  { n: 2, name: "Challenger", fee: 100, color: "from-yellow-500 to-yellow-700" },
  { n: 3, name: "Rookie", fee: 0, color: "from-emerald-500 to-emerald-700" },
];

function League() {
  const [div, setDiv] = useState(3);
  const meta = DIV_META.find((d) => d.n === div)!;

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 py-4">
          <h1 className="font-display text-xl tracking-wider">League</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-5 space-y-5">
        {/* Division switcher */}
        <div className="grid grid-cols-3 gap-2">
          {DIV_META.map((d) => (
            <button
              key={d.n}
              onClick={() => setDiv(d.n)}
              className={`no-tap rounded-lg border p-3 text-left transition ${div === d.n ? "border-primary bg-card" : "border-border bg-card/40"}`}
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Division</p>
              <p className="font-display text-2xl tracking-wider">{d.n}</p>
              <p className="text-[10px] text-muted-foreground">{d.name}</p>
            </button>
          ))}
        </div>

        {/* Division card */}
        <div className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-br ${meta.color} p-5 text-foreground`}>
          <div className="absolute inset-0 bg-background/60" />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Current Season</p>
            <h2 className="mt-2 font-display text-3xl tracking-wide">Division {meta.n} · {meta.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Entry: {meta.fee === 0 ? "FREE" : `KES ${meta.fee}`} · 5 matchdays · Mon–Fri
            </p>
          </div>
        </div>

        {/* Standings (placeholder until season seeded) */}
        <section>
          <h3 className="font-display text-xl tracking-wider">Standings</h3>
          <div className="mt-3 rounded-lg border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-12 gap-1 border-b border-border bg-card/80 px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Player</div>
              <div className="col-span-2 text-center">P</div>
              <div className="col-span-2 text-center">GD</div>
              <div className="col-span-2 text-right">PTS</div>
            </div>
            <div className="px-3 py-12 text-center text-xs text-muted-foreground">
              <Trophy className="mx-auto mb-3 h-6 w-6 text-primary/50" />
              Season hasn't started yet.<br />
              Next kickoff: <span className="text-foreground font-semibold">Monday</span>
            </div>
          </div>
        </section>

        {/* Promotion / relegation legend */}
        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="font-display text-base tracking-wider">Promotion · Relegation</h3>
          <ul className="mt-3 space-y-1.5 text-xs">
            <li className="flex justify-between"><span className="text-muted-foreground">D3 → D2</span><span>Top 6 promoted</span></li>
            <li className="flex justify-between"><span className="text-muted-foreground">D2 → D1</span><span>Top 4 promoted</span></li>
            <li className="flex justify-between"><span className="text-muted-foreground">D1 → D2</span><span>Bottom 4 relegated</span></li>
            <li className="flex justify-between"><span className="text-muted-foreground">D2 → D3</span><span>Bottom 6 relegated</span></li>
          </ul>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
