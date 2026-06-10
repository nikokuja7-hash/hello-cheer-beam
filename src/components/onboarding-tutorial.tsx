import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, Zap, BarChart3, User2, Bell, Gamepad2, X } from "lucide-react";

const STEPS = [
  { icon: Zap, title: "Quick Cash, every weekend", body: "KES 200 entry. Top 3 win. Opens Thursday, closes Friday 6pm." },
  { icon: Trophy, title: "Browse cup tournaments", body: "Players create their own cups. Free or paid. Join any that interests you." },
  { icon: BarChart3, title: "Your league division", body: "You start in Division 3. Win matches, earn points, get promoted." },
  { icon: User2, title: "Your profile", body: "Stats, earnings, history, and division badge — all in one place." },
  { icon: Bell, title: "Notifications matter", body: "Match time, opponent, result, prize confirmations — all push." },
  { icon: Gamepad2, title: "How a match works", body: "Get opponent → check in 30min before → play on eFootball → upload screenshot → AI verifies → prize lands in M-Pesa." },
] as const;

export function OnboardingTutorial({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const Step = STEPS[i];
  const Icon = Step.icon;
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-background/90 backdrop-blur-xl sm:items-center">
      <div className="relative w-full max-w-md rounded-t-2xl border-t border-primary/40 bg-card p-6 sm:rounded-2xl sm:border">
        <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="h-5 w-5" />
        </button>

        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15">
          <Icon className="h-7 w-7 text-primary" />
        </div>

        <p className="mt-5 text-[10px] font-bold uppercase tracking-widest text-primary">Step {i + 1} of {STEPS.length}</p>
        <h2 className="mt-1 font-display text-3xl tracking-wide">{Step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{Step.body}</p>

        <div className="mt-6 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {STEPS.map((_, n) => (
              <span key={n} className={`h-1.5 w-6 rounded-full ${n <= i ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <Button
            onClick={() => last ? onClose() : setI(i + 1)}
            className="crimson-glow h-11 font-display tracking-wider"
          >
            {last ? "Let's compete" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
