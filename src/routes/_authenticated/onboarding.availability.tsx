import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding/availability")({
  ssr: false,
  head: () => ({ meta: [{ title: "Your availability — Nexarena" }] }),
  component: AvailabilitySetup,
});

function AvailabilitySetup() {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-md px-5 py-10">
        <h1 className="font-display text-4xl tracking-wide">Availability</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Match scheduling is handled automatically. You don't need to set anything here.
        </p>
        <Button onClick={() => navigate({ to: "/home" })} className="crimson-glow mt-8 h-12 w-full font-display tracking-wider">
          Continue <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
