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
  flaggedMatches: number;
  pendingPayouts: number;
  totalPayouts: number;
  suspendedUsers: number;
  unverifiedUsers: number;
}

function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    flaggedMatches: 0,
    pendingPayouts: 0,
    totalPayouts: 0,
    suspendedUsers: 0,
    unverifiedUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      // Count flagged matches
      const { count: flagged } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("status", "flagged");

      // Count pending payouts
      const { data: payouts } = await supabase
        .from("payouts")
        .select("amount")
        .eq("status", "pending");

      const pendingCount = payouts?.length || 0;
      const pendingTotal = payouts?.reduce((sum, p) => sum + p.amount, 0) || 0;

      // Count suspended users
      const { count: suspended } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_suspended", true);

      // Count unverified users
      const { count: unverified } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_verified", false);

      setStats({
        flaggedMatches: flagged || 0,
        pendingPayouts: pendingCount,
        totalPayouts: pendingTotal,
        suspendedUsers: suspended || 0,
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
        <div className="mx-auto max-w-md px-5 py-10 text-center text-muted-foreground">
          Loading admin dashboard...
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 py-4">
          <h1 className="font-display text-xl tracking-wider flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Admin Dashboard
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6 space-y-6">
        {/* Alert Cards */}
        {stats.flaggedMatches > 0 && (
          <Link
            to="/admin/flagged-matches"
            className="rounded-lg border border-red-500/40 bg-red-500/5 p-4 hover:bg-red-500/10 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">
                  ⚠️ Action Required
                </p>
                <p className="mt-1 font-semibold text-red-600">
                  {stats.flaggedMatches} flagged match{stats.flaggedMatches !== 1 ? "es" : ""}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Review disputes and override results if needed
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-red-500" />
            </div>
          </Link>
        )}

        {stats.pendingPayouts > 0 && (
          <Link
            to="/admin/payouts"
            className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-4 hover:bg-yellow-500/10 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-600">
                  💰 Pending
                </p>
                <p className="mt-1 font-semibold">
                  KES {stats.totalPayouts.toLocaleString()}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {stats.pendingPayouts} payout{stats.pendingPayouts !== 1 ? "s" : ""} to process
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-yellow-600" />
            </div>
          </Link>
        )}

        {/* Dashboard Links */}
        <div className="grid grid-cols-2 gap-3">
          {/* Flagged Matches */}
          <Link
            to="/admin/flagged-matches"
            className="rounded-lg border border-border bg-card p-4 hover:bg-card/80 transition"
          >
            <AlertTriangle className="h-5 w-5 text-red-500 mb-2" />
            <p className="font-semibold text-[11px]">Flagged Matches</p>
            <p className="text-2xl font-display mt-1">{stats.flaggedMatches}</p>
          </Link>

          {/* Payouts */}
          <Link
            to="/admin/payouts"
            className="rounded-lg border border-border bg-card p-4 hover:bg-card/80 transition"
          >
            <DollarSign className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold text-[11px]">Payouts</p>
            <p className="text-2xl font-display mt-1">{stats.pendingPayouts}</p>
          </Link>

          {/* Users */}
          <Link
            to="/admin/users"
            className="rounded-lg border border-border bg-card p-4 hover:bg-card/80 transition"
          >
            <Users className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold text-[11px]">User Management</p>
            <p className="text-2xl font-display mt-1">{stats.suspendedUsers}</p>
            <p className="text-[9px] text-muted-foreground">suspended</p>
          </Link>

          {/* Unverified */}
          <Link
            to="/admin/users"
            className="rounded-lg border border-border bg-card p-4 hover:bg-card/80 transition"
          >
            <AlertTriangle className="h-5 w-5 text-yellow-500 mb-2" />
            <p className="font-semibold text-[11px]">Unverified</p>
            <p className="text-2xl font-display mt-1">{stats.unverifiedUsers}</p>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h3 className="font-display text-sm tracking-wider">Status Overview</h3>
          <div className="text-[10px] space-y-1 text-muted-foreground">
            <p>
              Flagged matches: <span className="text-foreground font-semibold">{stats.flaggedMatches}</span>
            </p>
            <p>
              Pending payouts: <span className="text-foreground font-semibold">{stats.pendingPayouts}</span>
            </p>
            <p>
              Total owed: <span className="text-foreground font-semibold">KES {stats.totalPayouts.toLocaleString()}</span>
            </p>
            <p>
              Suspended users: <span className="text-foreground font-semibold">{stats.suspendedUsers}</span>
            </p>
            <p>
              Unverified users: <span className="text-foreground font-semibold">{stats.unverifiedUsers}</span>
            </p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
