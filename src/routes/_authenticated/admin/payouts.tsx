import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/bottom-nav";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  ssr: false,
  head: () => ({ meta: [{ title: "Payouts — Nexarena Admin" }] }),
  component: PayoutsAdmin,
});

interface Payout {
  id: string;
  user_id: string;
  username?: string;
  amount_kes: number;
  phone?: string;
  tournament_name?: string;
  status: "pending" | "sent" | "failed";
  created_at: string;
  marked_paid_at?: string | null;
}

function PayoutsAdmin() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, paid: 0, total: 0 });
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPayouts();
  }, []);

  async function loadPayouts() {
    try {
      // Get all payouts
      const { data, error } = await supabase
        .from("payouts")
        .select(
          `
          id,
          user_id,
          amount_kes,
          phone,
          status,
          created_at,
          marked_paid_at,
          profiles:user_id(username),
          tournaments:tournament_id(name)
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const parsed = (data || []).map((p: any) => ({
        ...p,
        username: p.profiles?.username || "Unknown",
        tournament_name: p.tournaments?.name || "Unknown",
      }));

      setPayouts(parsed);

      // Calculate stats
      const pending = parsed.filter((p: any) => p.status === "pending").length;
      const paid = parsed.filter((p: any) => p.status === "sent").length;
      const totalAmount = parsed.reduce((sum: number, p: any) => sum + p.amount_kes, 0);

      setStats({ pending, paid, total: totalAmount });
    } catch (error) {
      console.error("Failed to load payouts:", error);
      toast.error("Failed to load payouts");
    } finally {
      setLoading(false);
    }
  }

  async function markAsPaid(payout: Payout) {
    setSelectedPayout(payout);
    setShowDialog(true);
  }

  async function confirmPayout() {
    if (!selectedPayout) return;

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("payouts")
        .update({ status: "sent", marked_paid_at: new Date().toISOString() })
        .eq("id", selectedPayout.id);

      if (error) throw error;

      // Send notification to user
      await supabase.from("notifications").insert({
        user_id: selectedPayout.user_id,
        title: "Prize Paid!",
        body: `Your prize of KES ${selectedPayout.amount_kes.toLocaleString()} has been sent to your M-Pesa`,
        link: "/profile",
      });

      toast.success("Payout marked as paid");
      setShowDialog(false);
      loadPayouts();
    } catch (error) {
      console.error("Failed to mark payout as paid:", error);
      toast.error("Failed to mark payout as paid");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <div className="mx-auto max-w-md px-5 py-10 text-center text-muted-foreground">
          Loading payouts...
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
            <DollarSign className="h-5 w-5 text-primary" />
            Payouts
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Pending
            </p>
            <p className="mt-2 font-display text-2xl text-yellow-500">{stats.pending}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Total Owed
            </p>
            <p className="mt-2 font-display text-lg">KES {stats.total.toLocaleString()}</p>
          </div>
        </div>

        {/* Payouts List */}
        <div className="space-y-2">
          <h2 className="font-display text-sm tracking-wider">Recent Payouts</h2>

          {payouts.length === 0 ? (
            <p className="text-center text-[11px] text-muted-foreground py-8">No payouts.</p>
          ) : (
            <div className="space-y-2">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className={`rounded-lg border p-3 ${
                    payout.status === "pending"
                      ? "border-yellow-500/40 bg-yellow-500/5"
                      : payout.status === "paid"
                        ? "border-green-500/40 bg-green-500/5"
                        : "border-red-500/40 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-[11px]">{payout.username}</p>
                      <p className="text-[10px] text-muted-foreground">{payout.tournament_name}</p>
                      {payout.phone_number && (
                        <p className="text-[9px] text-muted-foreground">{payout.phone_number}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg">KES {payout.amount.toLocaleString()}</p>
                      <Badge
                        variant={
                          payout.status === "paid"
                            ? "default"
                            : payout.status === "pending"
                              ? "secondary"
                              : "destructive"
                        }
                        className="text-[9px] mt-1"
                      >
                        {payout.status}
                      </Badge>
                    </div>
                  </div>

                  {payout.status === "pending" && (
                    <Button
                      onClick={() => markAsPaid(payout)}
                      size="sm"
                      className="mt-2 h-7 w-full text-[10px]"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Mark as Paid
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dialog */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Payout as Paid</AlertDialogTitle>
          <AlertDialogDescription>
              {selectedPayout && (
                <div className="space-y-2">
                  <p>
                    <strong>{selectedPayout.username}</strong>
                  </p>
                  <p>Amount: KES {selectedPayout.amount_kes.toLocaleString()}</p>
                  <p>Phone: {selectedPayout.phone}</p>
                  <p className="text-[10px] text-yellow-600 pt-2">
                    Confirm M-Pesa transfer before marking as paid.
                  </p>
                </div>
              )}
          </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPayout} disabled={processing}>
              {processing ? "Processing..." : "Confirm Paid"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
