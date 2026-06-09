import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { NexarenaLogo } from "@/components/logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/home" });
  },
  head: () => ({ meta: [{ title: "Sign in — Nexarena" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding/notifications`,
            data: { username, phone },
          },
        });
        if (error) throw error;
        toast.success("Account created. Let's set things up.");
        navigate({ to: "/onboarding/notifications" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/home" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) {
        toast.error((result.error as any)?.message ?? "Google sign-in failed");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/onboarding/notifications" });
    } catch (err: any) {
      toast.error(err.message ?? "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-md px-5 pt-10 pb-12">
        <div className="flex justify-center"><NexarenaLogo /></div>

        <div className="mt-10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-wide">
            {mode === "signup" ? "Step onto the pitch." : "Sign in to compete."}
          </h1>
        </div>

        <Button
          type="button"
          variant="outline"
          className="mt-8 h-12 w-full border-border bg-card text-sm font-semibold uppercase tracking-wider"
          onClick={handleGoogle}
          disabled={loading}
        >
          <GoogleIcon className="mr-2 h-4 w-4" />
          Continue with Google
        </Button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <Field label="Username">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={20} placeholder="e.g. king_otieno" />
              </Field>
              <Field label="Phone (M-Pesa)">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" placeholder="07XX XXX XXX" />
              </Field>
            </>
          )}
          <Field label="Email">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" minLength={6} placeholder="••••••••" />
          </Field>

          <Button type="submit" disabled={loading} className="crimson-glow h-12 w-full font-display text-lg tracking-wider">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (mode === "signup" ? "Create account" : "Sign in")}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-6 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signup" ? "Already have an account? " : "New here? "}
          <span className="font-semibold uppercase tracking-wider text-primary">
            {mode === "signup" ? "Sign in" : "Create one"}
          </span>
        </button>
      </div>
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

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path fill="#EA4335" d="M12 10.9v3.2h5.4c-.2 1.4-1.6 4.1-5.4 4.1-3.2 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.6 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"/>
    </svg>
  );
}
