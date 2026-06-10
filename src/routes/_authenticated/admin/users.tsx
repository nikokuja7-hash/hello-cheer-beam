import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/bottom-nav";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  ssr: false,
  head: () => ({ meta: [{ title: "User Management — Nexarena Admin" }] }),
  component: UserManagement,
});

interface User {
  id: string;
  username: string;
  email: string;
  division: number;
  warning_strikes: number;
  is_suspended: boolean;
  is_verified: boolean;
  created_at: string;
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [action, setAction] = useState<"warn" | "suspend" | "unsuspend" | "reset">("warn");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (u) =>
            u.username.toLowerCase().includes(query) ||
            u.email.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleUserAction(user: User, userAction: typeof action) {
    setSelectedUser(user);
    setAction(userAction);
    setShowDialog(true);
  }

  async function confirmAction() {
    if (!selectedUser) return;

    setProcessing(true);
    try {
      if (action === "warn") {
        const newStrikes = Math.min(selectedUser.warning_strikes + 1, 3);
        const { error } = await supabase
          .from("profiles")
          .update({ warning_strikes: newStrikes })
          .eq("id", selectedUser.id);

        if (error) throw error;

        // Suspend if 3 strikes
        if (newStrikes >= 3) {
          await supabase
            .from("profiles")
            .update({ is_suspended: true })
            .eq("id", selectedUser.id);

          await supabase.functions.invoke("send-push-notification", {
            body: JSON.stringify({
              user_id: selectedUser.id,
              type: "warning_strike",
              title: "Account Suspended",
              body: "You have received 3 warning strikes and your account has been suspended.",
            }),
          });

          toast.success("User suspended (3 strikes)");
        } else {
          await supabase.functions.invoke("send-push-notification", {
            body: JSON.stringify({
              user_id: selectedUser.id,
              type: "warning_strike",
              title: "Warning Strike",
              body: `You have received a warning strike. (${newStrikes}/3)`,
            }),
          });

          toast.success("Warning strike issued");
        }
      } else if (action === "suspend") {
        const { error } = await supabase
          .from("profiles")
          .update({ is_suspended: true })
          .eq("id", selectedUser.id);

        if (error) throw error;

        await supabase.functions.invoke("send-push-notification", {
          body: JSON.stringify({
            user_id: selectedUser.id,
            type: "warning_strike",
            title: "Account Suspended",
            body: "Your account has been suspended by an administrator.",
          }),
        });

        toast.success("User suspended");
      } else if (action === "unsuspend") {
        const { error } = await supabase
          .from("profiles")
          .update({ is_suspended: false })
          .eq("id", selectedUser.id);

        if (error) throw error;

        await supabase.functions.invoke("send-push-notification", {
          body: JSON.stringify({
            user_id: selectedUser.id,
            type: "warning_strike",
            title: "Account Restored",
            body: "Your account suspension has been lifted.",
          }),
        });

        toast.success("User unsuspended");
      } else if (action === "reset") {
        const { error } = await supabase
          .from("profiles")
          .update({ warning_strikes: 0 })
          .eq("id", selectedUser.id);

        if (error) throw error;

        toast.success("Warning strikes reset");
      }

      setShowDialog(false);
      loadUsers();
    } catch (error) {
      console.error("Failed to perform action:", error);
      toast.error("Failed to perform action");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <div className="mx-auto max-w-md px-5 py-10 text-center text-muted-foreground">
          Loading users...
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
            <Users className="h-5 w-5 text-primary" />
            User Management
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6 space-y-4">
        {/* Search */}
        <Input
          placeholder="Search by username or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-[11px]"
        />

        {/* Users List */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Total: {filteredUsers.length}
          </p>

          {filteredUsers.length === 0 ? (
            <p className="text-center text-[11px] text-muted-foreground py-8">No users found.</p>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`rounded-lg border p-3 ${
                    user.is_suspended ? "border-red-500/40 bg-red-500/5" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-[11px]">{user.username}</p>
                      <p className="text-[9px] text-muted-foreground">{user.email}</p>
                      <div className="mt-2 flex gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">
                          D{user.division}
                        </Badge>
                        {user.warning_strikes > 0 && (
                          <Badge variant="destructive" className="text-[9px]">
                            ⚠️ {user.warning_strikes}/3
                          </Badge>
                        )}
                        {user.is_suspended && (
                          <Badge variant="destructive" className="text-[9px]">
                            Suspended
                          </Badge>
                        )}
                        {!user.is_verified && (
                          <Badge variant="secondary" className="text-[9px]">
                            Unverified
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 grid grid-cols-2 gap-1">
                    {user.is_suspended ? (
                      <Button
                        onClick={() => handleUserAction(user, "unsuspend")}
                        size="sm"
                        variant="outline"
                        className="h-6 text-[9px]"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Unsuspend
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={() => handleUserAction(user, "warn")}
                          size="sm"
                          variant="outline"
                          className="h-6 text-[9px]"
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Warn
                        </Button>
                        <Button
                          onClick={() => handleUserAction(user, "suspend")}
                          size="sm"
                          variant="destructive"
                          className="h-6 text-[9px]"
                        >
                          <Ban className="h-3 w-3 mr-1" />
                          Suspend
                        </Button>
                      </>
                    )}
                    {user.warning_strikes > 0 && (
                      <Button
                        onClick={() => handleUserAction(user, "reset")}
                        size="sm"
                        variant="outline"
                        className="h-6 text-[9px] col-span-2"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset Strikes
                      </Button>
                    )}
                  </div>
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
            <AlertDialogTitle>
              {action === "warn"
                ? "Issue Warning Strike"
                : action === "suspend"
                  ? "Suspend User"
                  : action === "unsuspend"
                    ? "Unsuspend User"
                    : "Reset Warning Strikes"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser && (
                <>
                  <p className="font-semibold mb-2">{selectedUser.username}</p>
                  {action === "warn" && (
                    <p>Current strikes: {selectedUser.warning_strikes}/3</p>
                  )}
                  {action === "suspend" && (
                    <p>This user will not be able to join tournaments.</p>
                  )}
                  {action === "unsuspend" && (
                    <p>This user will be able to join tournaments again.</p>
                  )}
                  {action === "reset" && (
                    <p>Current strikes will be reset to 0.</p>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={processing}
              className={
                action === "suspend" || action === "warn"
                  ? "bg-red-600 hover:bg-red-700"
                  : ""
              }
            >
              {processing ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav />
    </div>
  );
}
