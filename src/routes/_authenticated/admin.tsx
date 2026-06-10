import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, AlertTriangle, ArrowLeft, Megaphone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — Nexarena" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!role) throw redirect({ to: "/home" });
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [flagged, setFlagged] = useState<any[]>([]);
  const [stats, setStats] = useState({ revenue: 0, players: 0, active: 0 });

  async function load() {
    const { data: po } = await supabase
      .from("payouts")
      .select("id,user_id,amount_kes,phone,position,status,tournament_id,marked_paid_at,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    const payRows = (po ?? []) as any[];
    const userIds = Array.from(new Set(payRows.map((p) => p.user_id)));
    const tIds = Array.from(new Set(payRows.map((p) => p.tournament_id).filter(Boolean)));
    const [{ data: profs }, { data: ts }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id,username").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
      tIds.length ? supabase.from("tournaments").select("id,name").in("id", tIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p.username]));
    const tmap = new Map((ts ?? []).map((t: any) => [t.id, t.name]));
    setPayouts(payRows.map((p) => ({ ...p, username: pmap.get(p.user_id), tournament: tmap.get(p.tournament_id) })));

    const { data: fm } = await supabase
      .from("matches")
      .select("id,player1_id,player2_id,player1_score,player2_score,status,tournament_id")
      .eq("status", "disputed")
      .limit(20);
    setFlagged((fm ?? []) as any);

    const { count: players } = await supabase.from("profiles").select("id", { count: "exact", head: true });
    const { count: active } = await supabase.from("tournaments").select("id", { count: "exact", head: true }).in("status", ["open", "filling", "active"]);
    const { data: paid } = await supabase.from("payments").select("amount_kes").eq("status", "paid");
    const revenue = (paid ?? []).reduce((s: number, p: any) => s + Math.floor(p.amount_kes * 0.15), 0);
    setStats({ revenue, players: players ?? 0, active: active ?? 0 });
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("admin").on("postgres_changes", { event: "*", schema: "public", table: "payouts" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function markPaid(id: string) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("payouts")
      .update({ status: "paid", marked_paid_at: new Date().toISOString(), marked_paid_by: u.user?.id })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as paid. Player notified.");
    load();
  }

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <Link to="/home" className="no-tap"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <p className="font-display text-base tracking-widest">Admin</p>
          </div>
          <span className="w-5" />
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-5 px-5 py-5">
        <section className="grid grid-cols-3 gap-2">
          <Stat label="Revenue" value={`KES ${stats.revenue.toLocaleString()}`} />
          <Stat label="Players" value={String(stats.players)} />
          <Stat label="Active" value={String(stats.active)} />
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wider">Payout queue</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">Send M-Pesa from your phone, then tap Mark Paid.</p>
          <div className="mt-3 space-y-2">
            {payouts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No payouts yet.</p>
            ) : payouts.map((p) => (
              <div key={p.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg tracking-wider">KES {p.amount_kes.toLocaleString()}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.username ?? p.user_id.slice(0, 8)} · {p.position ? `#${p.position}` : "—"}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{p.tournament ?? "—"}</p>
                    <a href={`tel:${p.phone}`} className="mt-1 inline-block font-mono text-sm text-primary">{p.phone}</a>
                  </div>
                  {p.status === "paid" ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-4 w-4" /> Paid</span>
                  ) : (
                    <Button onClick={() => markPaid(p.id)} size="sm" className="h-9">Mark Paid</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl tracking-wider">Flagged matches</h2>
          <div className="mt-3 space-y-2">
            {flagged.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No disputes.</p>
            ) : flagged.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <div className="text-xs">
                  <p className="font-mono">{m.id.slice(0, 8)}</p>
                  <p className="text-muted-foreground">{m.player1_score} – {m.player2_score}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Link to="/home" className="no-tap flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Megaphone className="h-5 w-5 text-primary" />
            <p className="font-display text-base tracking-wider">Broadcast to all players</p>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Soon</span>
        </Link>
      </main>

      <BottomNav />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-display text-base tracking-wider">{value}</p>
    </div>
  );
}
