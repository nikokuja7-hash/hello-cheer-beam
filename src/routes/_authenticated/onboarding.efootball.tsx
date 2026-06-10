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
  const [displayName, setDisplayName] = useState("");
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
    if (!displayName.trim()) {
      toast.error("Enter your current eFootball match display name.");
      return;
    }

    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      // Read file as base64 data URL for Gemini
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const imageDataUrl = reader.result as string;

          // Call Gemini verification function
          const { data: session } = await supabase.auth.getSession();
          const verifyRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-efootball-screenshot`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.session?.access_token}`,
              },
              body: JSON.stringify({
                image_url: imageDataUrl,
                declared_display_name: displayName.trim(),
              }),
            }
          );

          const verifyData = await verifyRes.json();

          if (!verifyRes.ok) {
            throw new Error(verifyData.error || "Verification failed");
          }

          toast.success("eFootball verified! Welcome to Nexarena.");
          
          // Redirect to home after brief delay
          setTimeout(() => {
            navigate({ to: "/home" });
          }, 500);
        } catch (err: any) {
          toast.error(err.message ?? "Verification failed");
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err.message ?? "Verification failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-md px-5 py-10">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Verify eFootball
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-wide">One last step.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Upload your eFootball profile screenshot so we can verify your Konami ID.
            This ensures you are who you say you are before you enter any tournament.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {/* Screenshot upload */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Profile Screenshot
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
              }}
            />

            {preview ? (
              <div className="relative">
                <img
                  src={preview}
                  alt="eFootball profile"
                  className="w-full rounded-lg border border-border"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-3 right-3 rounded-md bg-background/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest backdrop-blur-md hover:bg-background"
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
                <div className="text-center text-[11px] text-muted-foreground">
                  <p className="font-semibold">Tap to upload</p>
                  <p>Profile screenshot</p>
                </div>
              </button>
            )}
            <p className="mt-2 text-[10px] text-muted-foreground">
              Screenshot must show your Konami ID clearly.
            </p>
          </div>

          {/* Display name input */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Match Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Name that appears during matches"
              maxLength={30}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder-muted-foreground"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              This is the name opponents see during eFootball matches. You can change it anytime in eFootball.
            </p>
          </div>

          {/* Submit button */}
          <Button
            onClick={submit}
            disabled={loading || !file || !displayName.trim()}
            className="crimson-glow h-12 w-full font-display tracking-wider"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Verify & Continue
              </>
            )}
          </Button>

          <p className="text-center text-[10px] text-muted-foreground">
            This uses AI to read your profile screenshot. Takes 5-10 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
