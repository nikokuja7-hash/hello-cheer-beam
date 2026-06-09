import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Trophy, Zap, Shield, Smartphone, ChevronRight } from "lucide-react";
import { NexarenaLogo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home" });
  },
  head: () => ({
    meta: [
      { title: "Nexarena — Where Champions Are Made" },
      { name: "description", content: "Kenya's premier eFootball league. Real divisions. Real prize money. Played on your phone." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* HERO */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-primary/30 blur-[120px]" />
          <div className="absolute bottom-0 -left-20 h-72 w-72 rounded-full bg-primary/20 blur-[100px]" />
          <div className="scanline absolute inset-0 opacity-20" />
        </div>

        <nav className="mx-auto flex max-w-md items-center justify-between px-5 py-5">
          <NexarenaLogo />
          <Link to="/auth" className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        </nav>

        <div className="mx-auto max-w-md px-5 pt-8 pb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            eFootball · Mobile · Kenya
          </div>

          <h1 className="mt-5 font-display text-[3.5rem] leading-[0.9] tracking-wide">
            Where<br />
            <span className="text-primary">Champions</span><br />
            Are Made.
          </h1>

          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            A real football league. Divisions. Weekly seasons. Cup tournaments.
            A KES 6,000 Quick Cash pot every weekend. All played on eFootball mobile.
          </p>

          <div className="mt-7 space-y-3">
            <Link
              to="/auth"
              className="crimson-glow no-tap flex h-14 items-center justify-between rounded-md bg-primary px-5 font-display text-xl tracking-wider text-primary-foreground transition active:scale-[0.98]"
            >
              Join the league
              <ChevronRight className="h-5 w-5" />
            </Link>
            <Link
              to="/auth"
              className="no-tap flex h-12 items-center justify-center rounded-md border border-border bg-card px-5 text-sm font-semibold uppercase tracking-wider hover:bg-accent"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </header>

      {/* LIVE TICKER */}
      <section className="border-y border-border bg-card/50">
        <div className="mx-auto grid max-w-md grid-cols-3 divide-x divide-border">
          <Stat label="Next Pot" value="KES 6K" sub="Quick Cash" />
          <Stat label="Divisions" value="3" sub="D1 · D2 · D3" />
          <Stat label="Payouts" value="M-Pesa" sub="Verified" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-md px-5 py-12">
        <h2 className="font-display text-3xl tracking-wider">How it works</h2>
        <div className="mt-6 space-y-3">
          <Step n="01" title="Pick your battle" body="League season, Quick Cash weekend, or a creator cup." />
          <Step n="02" title="Pay via M-Pesa" body="STK push hits your phone. Funds held in escrow." />
          <Step n="03" title="Play 1v1 on eFootball" body="Friend match. 6-minute halves. Authentic teams." />
          <Step n="04" title="Upload screenshot" body="AI verifies the result. Winner confirmed in seconds." />
          <Step n="05" title="Get paid" body="Prize sent to your M-Pesa. Standings update. Onto the next." />
        </div>
      </section>

      {/* PILLARS */}
      <section className="mx-auto max-w-md px-5 pb-12">
        <h2 className="font-display text-3xl tracking-wider">Why Nexarena</h2>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Pillar icon={Trophy} title="Real League" body="Promotion. Relegation. Standings." />
          <Pillar icon={Zap} title="Quick Cash" body="Weekend pot. Every week. Forever." />
          <Pillar icon={Shield} title="AI Verified" body="No cheating. No disputes." />
          <Pillar icon={Smartphone} title="Mobile First" body="Built for your 6-inch screen." />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-md px-5 pb-16">
        <div className="rounded-lg border border-primary/40 bg-primary/10 p-6 text-center">
          <p className="font-display text-2xl tracking-wider">Ready?</p>
          <p className="mt-1 text-sm text-muted-foreground">The next season kicks off Monday.</p>
          <Link
            to="/auth"
            className="crimson-glow no-tap mt-5 inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 font-display text-lg tracking-wider text-primary-foreground"
          >
            Sign me up
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
        Nexarena · Kenya · eFootball · 2026
      </footer>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="px-3 py-4 text-center">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl tracking-wider text-primary">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-lg border border-border bg-card p-4">
      <span className="font-display text-2xl tracking-wider text-primary">{n}</span>
      <div>
        <p className="font-semibold uppercase tracking-wider text-sm">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Pillar({ icon: Icon, title, body }: { icon: typeof Trophy; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 font-display text-base tracking-wider">{title}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{body}</p>
    </div>
  );
}
