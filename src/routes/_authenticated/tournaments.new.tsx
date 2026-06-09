import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tournaments/new")({
  ssr: false,
  head: () => ({ meta: [{ title: "Create cup — Nexarena" }] }),
  component: CreateCup,
});

function CreateCup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [fee, setFee] = useState("0");
  const [max, setMax] = useState("8");
  const [min, setMin] = useState("4");
  const [isPublic, setPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sign in required");
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);

      const { data, error } = await supabase.from("tournaments").insert({
        name, slug, kind: "cup",
        creator_id: u.user.id,
        entry_fee_kes: parseInt(fee) || 0,
        max_players: parseInt(max),
        min_players: parseInt(min),
        is_public: isPublic,
        status: "open",
        format: "single_elim",
      }).select().single();
      if (error) throw error;
      toast.success("Cup created.");
      navigate({ to: "/tournaments/$id", params: { id: data.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Could not create cup");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background pb-10">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <h1 className="font-display text-xl tracking-wider">New Cup</h1>
          <button onClick={() => navigate({ to: "/tournaments" })} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cancel</button>
        </div>
      </header>
      <form onSubmit={submit} className="mx-auto max-w-md space-y-4 px-5 py-6">
        <Field label="Cup name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} placeholder="Friday Night Cup" />
        </Field>

        <Field label="Entry fee (KES)">
          <Input value={fee} onChange={(e) => setFee(e.target.value)} type="number" min="0" max="10000" placeholder="0 for friendly" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Max players">
            <select value={max} onChange={(e) => setMax(e.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm">
              <option>8</option><option>16</option><option>32</option>
            </select>
          </Field>
          <Field label="Min players">
            <Input value={min} onChange={(e) => setMin(e.target.value)} type="number" min="2" max="32" />
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div>
            <p className="font-semibold text-sm">Public</p>
            <p className="text-[11px] text-muted-foreground">Show in browse · anyone can join</p>
          </div>
          <Switch checked={isPublic} onCheckedChange={setPublic} />
        </div>

        <Button type="submit" disabled={loading} className="crimson-glow h-14 w-full font-display text-lg tracking-wider">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create cup"}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
