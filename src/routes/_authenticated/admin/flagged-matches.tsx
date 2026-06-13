import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/bottom-nav";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/flagged-matches")({
  ssr: false,
  head: () => ({ meta: [{ title: "Flagged Matches — Nexarena Admin" }] }),
  component: FlaggedMatches,
});

interface FlaggedMatch {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_name?: string;
  player2_name?: string;
  player1_score: number;
  player2_score: number;
  dispute_reason?: string;
  screenshot_url?: string;
  status: "scheduled" | "checked_in" | "active" | "submitted" | "verified" | "disputed" | "closed" | "forfeit";
  created_at: string;
}

function FlaggedMatches() {
  const [matches, setMatches] = useState<FlaggedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<FlaggedMatch | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [action, setAction] = useState<"approve" | "override">("approve");
  const [overrideNote, setOverrideNote] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadFlaggedMatches();
  }, []);

  async function loadFlaggedMatches() {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select(
          `
          id,
          player1_id,
          player2_id,
          player1_score,
          player2_score,
          status,
          created_at,
          player1:player1_id(username),
          player2:player2_id(username)
        `
        )
        .eq("status", "disputed")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const flagged = data?.map((m: any) => ({
        ...m,
        player1_name: m.player1?.username || "Unknown",
        player2_name: m.player2?.username || "Unknown",
      })) || [];

      setMatches(flagged);
    } catch (error) {
      console.error("Failed to load flagged matches:", error);
      toast.error("Failed to load flagged matches");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(match: FlaggedMatch) {
    if (!match) return;

    setSelectedMatch(match);
    setShowDialog(true);
  }

  async function processAction() {
    if (!selectedMatch) return;

    setProcessing(true);
    try {
      let newStatus = "verified" as const;
      let winner_id = null;

      if (action === "approve") {
        if (selectedMatch.player1_score > selectedMatch.player2_score) {
          winner_id = selectedMatch.player1_id;
        } else if (selectedMatch.player2_score > selectedMatch.player1_score) {
          winner_id = selectedMatch.player2_id;
        }
      } else if (action === "override") {
        newStatus = "closed";
        if (selectedMatch.player1_score > selectedMatch.player2_score) {
          winner_id = selectedMatch.player1_id;
        } else {
          winner_id = selectedMatch.player2_id;
        }
      }

      const { error } = await supabase
        .from("matches")
        .update({ status: newStatus, winner_id })
        .eq("id", selectedMatch.id);

      if (error) throw error;

      toast.success(`Match ${action === "approve" ? "approved" : "overridden"}`);
      setShowDialog(false);
      loadFlaggedMatches();
    } catch (error) {
      console.error("Failed to process match:", error);
      toast.error("Failed to process match");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <div className="mx-auto max-w-md px-5 py-10 text-center text-muted-foreground">
          Loading flagged matches...
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
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Flagged Matches
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6 space-y-4">
        {matches.length === 0 ? (
          <Alert>
            <Check className="h-4 w-4 text-green-500" />
            <AlertDescription>No flagged matches. All clear!</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div key={match.id} className="rounded-lg border border-red-500/40 bg-red-500/5 p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{match.player1_name}</p>
                      <p className="text-lg font-display">{match.player1_score}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">VS</p>
                    <div className="text-right">
                      <p className="font-semibold">{match.player2_name}</p>
                      <p className="text-lg font-display">{match.player2_score}</p>
                    </div>
                  </div>

                  {match.dispute_reason && (
                    <p className="text-[10px] text-red-500">
                      <strong>Reason:</strong> {match.dispute_reason}
                    </p>
                  )}

                  <p className="text-[9px] text-muted-foreground">
                    {new Date(match.created_at).toLocaleString("en-KE")}
                  </p>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => {
                        setAction("approve");
                        handleAction(match);
                      }}
                      size="sm"
                      className="flex-1 h-8 text-[10px]"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => {
                        setAction("override");
                        handleAction(match);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-[10px]"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Override
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Dialog */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === "approve" ? "Approve Match" : "Override Match"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedMatch && (
                <>
                  <p className="mb-3">
                    {selectedMatch.player1_name} {selectedMatch.player1_score} -{" "}
                    {selectedMatch.player2_score} {selectedMatch.player2_name}
                  </p>

                  {action === "override" && (
                    <input
                      type="text"
                      placeholder="Admin note (optional)"
                      value={overrideNote}
                      onChange={(e) => setOverrideNote(e.target.value)}
                      maxLength={100}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-[11px]"
                    />
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={processAction}
              disabled={processing}
              className={action === "approve" ? "" : "bg-red-600 hover:bg-red-700"}
            >
              {processing ? "Processing..." : action === "approve" ? "Approve" : "Override"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
