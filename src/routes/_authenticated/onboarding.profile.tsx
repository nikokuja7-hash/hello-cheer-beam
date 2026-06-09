import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding/profile")({
  head: () => ({ meta: [{ title: "Your profile — Nexarena" }] }),
  component: ProfileSetup,
});

function ProfileSetup() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (data) {
        if (!data.username.startsWith("player_")) setUsername(data.username);
        if (data.phone) setPhone(data.phone);
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      const cleanPhone = phone.replace(/\s+/g, "");
      if (!/^0?7\d{8}$/.test(cleanPhone)) throw new Error("Enter a valid Kenyan phone (07XXXXXXXX)");

      const { error } = await supabase.from("profiles")
        .update({ username, phone: cleanPhone })
        .eq("id", u.user.id);
      if (error) {
        if (error.code === "23505") throw new Error("That username is taken.");
        throw error;
      }
      toast.success("Profile saved.");
      navigate({ to: "/onboarding/efootball" });
    } catch (err: any) {
      toast.error(err.message ?? "Could not save profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-md px-5 py-10">
        <div className="flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/40 bg-card">
            <User2 className="h-9 w-9 text-primary" />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Step 2 of 3</p>
          <h1 className="mt-3 font-display text-4xl tracking-wide">Your identity.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This is how rivals will see you on the leaderboard.
          </p>
        </div>

        <form onSubmit={save} className="mt-8 space-y-4">
          <div>
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              required minLength={3} maxLength={20}
              placeholder="king_otieno"
              className="mt-1.5"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Lowercase letters, numbers, underscores. 3–20 chars.</p>
          </div>

          <div>
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">M-Pesa phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required type="tel"
              placeholder="07XX XXX XXX"
              className="mt-1.5"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Your prizes will be sent here.</p>
          </div>

          <Button type="submit" disabled={loading} className="crimson-glow mt-4 h-14 w-full font-display text-lg tracking-wider">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
