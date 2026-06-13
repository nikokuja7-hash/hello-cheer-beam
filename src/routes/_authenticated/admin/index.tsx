import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/bottom-nav";
import { BarChart3, AlertTriangle, DollarSign, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin Dashboard — Nexarena" }] }),
  component: AdminDashboard,
});

interface DashboardStats {
  disputedMatches: number;
  pendingPayouts: number;
  totalPayouts: number;
  unverifiedUsers: number;
}

function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    disputedMatches: 0,
    pendingPayouts: 0,
    totalPayouts: 0,
    unverifiedUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try {
      const { count: disputed } = await supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "disputed");
      const { data: payouts } = await supabase.from("payouts").select("amount_kes").eq("status", "pending");
      const pendingCount = payouts?.length || 0;
      const pendingTotal = payouts?.reduce((sum, p: any) => sum + (p.amount_kes || 0), 0) || 0;
      const { count: unverified } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_verified", false);

      setStats({
        disputedMatches: disputed || 0,
        pendingPayouts: pendingCount,
        totalPayouts: pendingTotal,
        unverifiedUsers: unverified || 0,
      });
    } catch (error) {
      console.error("Failed to load stats:", error);
      toast.error("Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <div className="mx-auto max-w-md px-5 py-10 text-center text-muted-foreground">Loading admin dashboard...</div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 py-4">
          <h1 className="font-display text-xl tracking-wider flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Admin Dashboard
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6 space-y-6">
        {stats.disputedMatches > 0 && (
          <Link to="/admin/flagged-matches" className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 hover:bg-red-500/10 transition block">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">Action Required</p>
                <p className="mt-1 font-semibold text-red-600">{stats.disputedMatches} disputed match{stats.disputedMatches !== 1 ? "es" : ""}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Review and override results if needed</p>
              </div>
              <ArrowRight className="h-5 w-5 text-red-500" />
            </div>
          </Link>
        )}

        {stats.pendingPayouts > 0 && (
          <Link to="/admin/payouts" className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-4 hover:bg-yellow-500/10 transition block">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-600">Pending</p>
                <p className="mt-1 font-semibold">KES {stats.totalPayouts.toLocaleString()}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{stats.pendingPayouts} payout{stats.pendingPayouts !== 1 ? "s" : ""} to process</p>
              </div>
              <ArrowRight className="h-5 w-5 text-yellow-600" />
            </div>
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link to="/admin/flagged-matches" className="rounded-lg border border-border bg-card p-4 hover:bg-card/80 transition block">
            <AlertTriangle className="h-5 w-5 text-red-500 mb-2" />
            <p className="font-semibold text-[11px]">Disputed Matches</p>
            <p className="text-2xl font-display mt-1">{stats.disputedMatches}</p>
          </Link>
          <Link to="/admin/payouts" className="rounded-lg border border-border bg-card p-4 hover:bg-card/80 transition block">
            <DollarSign className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold text-[11px]">Payouts</p>
            <p className="text-2xl font-display mt-1">{stats.pendingPayouts}</p>
          </Link>
          <Link to="/admin/users" className="rounded-lg border border-border bg-card p-4 hover:bg-card/80 transition block">
            <Users className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold text-[11px]">User Management</p>
            <p className="text-2xl font-display mt-1">{stats.unverifiedUsers}</p>
            <p className="text-[9px] text-muted-foreground">unverified</p>
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
