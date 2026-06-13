import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/bottom-nav";
import { Badge } from "@/components/ui/badge";
import { Users, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  ssr: false,
  head: () => ({ meta: [{ title: "User Management — Nexarena Admin" }] }),
  component: UserManagement,
});

interface User {
  id: string;
  username: string;
  division: number;
  warning_strikes: number;
  is_verified: boolean;
  created_at: string;
}

function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(users.filter((u) => u.username.toLowerCase().includes(query)));
    }
  }, [searchQuery, users]);

  async function loadUsers() {
    try {
      const { data, error } = await supabase.from("profiles").select("id,username,division,warning_strikes,is_verified,created_at").order("created_at", { ascending: false });
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

  async function warnUser(user: User) {
    const newStrikes = Math.min(user.warning_strikes + 1, 3);
    const { error } = await supabase.from("profiles").update({ warning_strikes: newStrikes }).eq("id", user.id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({
      user_id: user.id, title: newStrikes >= 3 ? "Account Suspended" : "Warning Strike",
      body: newStrikes >= 3 ? "3 strikes — suspended." : `Strike ${newStrikes}/3`, link: "/profile",
    });
    toast.success(newStrikes >= 3 ? "User suspended (3 strikes)" : "Warning strike issued");
    loadUsers();
  }

  async function resetStrikes(user: User) {
    const { error } = await supabase.from("profiles").update({ warning_strikes: 0 }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Strikes reset");
    loadUsers();
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background pb-24">
        <div className="mx-auto max-w-md px-5 py-10 text-center text-muted-foreground">Loading users...</div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 py-4">
          <h1 className="font-display text-xl tracking-wider flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> User Management
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-6 space-y-4">
        <Input placeholder="Search by username..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="text-[11px]" />
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total: {filteredUsers.length}</p>
          {filteredUsers.length === 0 ? (
            <p className="text-center text-[11px] text-muted-foreground py-8">No users found.</p>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <div key={user.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-[11px]">{user.username}</p>
                      <div className="mt-2 flex gap-1 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">D{user.division}</Badge>
                        {user.warning_strikes > 0 && <Badge variant="destructive" className="text-[9px]">⚠️ {user.warning_strikes}/3</Badge>}
                        {!user.is_verified && <Badge variant="secondary" className="text-[9px]">Unverified</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-1">
                    <Button onClick={() => warnUser(user)} size="sm" variant="outline" className="h-6 text-[9px]">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Warn
                    </Button>
                    {user.warning_strikes > 0 && (
                      <Button onClick={() => resetStrikes(user)} size="sm" variant="outline" className="h-6 text-[9px] col-span-2">
                        <RotateCcw className="h-3 w-3 mr-1" /> Reset Strikes
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
