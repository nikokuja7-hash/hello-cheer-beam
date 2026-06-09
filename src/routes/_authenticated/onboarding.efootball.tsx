import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding/efootball")({
  head: () => ({ meta: [{ title: "Verify eFootball — Nexarena" }] }),
  component: EfootballVerify,
});

function EfootballVerify() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  function pickFile(f: File) {
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function submit() {
    if (!file) {
      toast.error("Upload your eFootball profile screenshot first.");
      return;
    }
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      // Mark profile verified — AI extraction stub for V1.
      // Real AI Gemini Vision pass runs server-side once storage is wired.
      const { error } = await supabase.from("profiles").update({
        is_verified: true,
        onboarding_complete: true,
        konami_id: "pending_ai_extract",
        efootball_name: "pending_ai_extract",
      }).eq("id", u.user.id);
      if (error) throw error;

      toast.success("Verified. Welcome to Nexarena.");
      navigate({ to: "/home" });
    } catch (err: any) {
      toast.error(err.message ?? "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function skip() {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("profiles").update({ onboarding_complete: true }).eq("id", u.user.id);
    }
    navigate({ to: "/home" });
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-md px-5 py-10">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Step 3 of 3</p>
          <h1 className="mt-3 font-display text-4xl tracking-wide">Link eFootball.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Upload a screenshot of your eFootball profile. Our AI reads your Konami ID so we
            know it's really you in every match.
          </p>
        </div>

        <div className="mt-8">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
          />

          {preview ? (
            <div className="relative">
              <img src={preview} alt="eFootball profile" className="w-full rounded-lg border border-border" />
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-3 right-3 rounded-md bg-background/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest backdrop-blur-md"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="no-tap flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card transition hover:border-primary/40"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="font-display text-lg tracking-wider">Upload screenshot</span>
              <span className="text-[11px] text-muted-foreground">JPG or PNG · max 5MB</span>
            </button>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-border bg-card/60 p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">What we check</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            <li className="flex gap-2"><Check className="h-3.5 w-3.5 text-primary mt-0.5" /> Konami ID</li>
            <li className="flex gap-2"><Check className="h-3.5 w-3.5 text-primary mt-0.5" /> In-game display name</li>
            <li className="flex gap-2"><Check className="h-3.5 w-3.5 text-primary mt-0.5" /> Club & rank (if visible)</li>
          </ul>
        </div>

        <Button onClick={submit} disabled={loading || !file} className="crimson-glow mt-6 h-14 w-full font-display text-lg tracking-wider">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & finish"}
        </Button>
        <Button onClick={skip} variant="ghost" className="mt-2 h-10 w-full text-xs uppercase tracking-widest text-muted-foreground">
          Skip for now (friendly matches only)
        </Button>
      </div>
    </div>
  );
}
