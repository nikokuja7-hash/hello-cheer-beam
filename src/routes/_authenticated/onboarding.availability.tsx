import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding/availability")({
  ssr: false,
  head: () => ({ meta: [{ title: "Your availability — Nexarena" }] }),
  component: AvailabilitySetup,
  validateSearch: (search: any) => ({
    tournamentId: search.tournamentId as string,
  }),
});

interface AvailabilitySetupSearchParams {
  tournamentId: string;
}

function AvailabilitySetup() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/onboarding/availability" }) as AvailabilitySetupSearchParams;
  const tournamentId = search.tournamentId;

  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState({
    weekday_morning: false,
    weekday_afternoon: false,
    weekday_evening: true, // Default to evening
    weekend_morning: false,
    weekend_afternoon: false,
    weekend_evening: true, // Default to evening
  });

  const hasSelection = Object.values(availability).some((v) => v);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!hasSelection) {
      toast.error("Select at least one time slot.");
      return;
    }

    if (!tournamentId) {
      toast.error("Tournament ID not provided.");
      return;
    }

    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      const { error } = await supabase.from("player_availability").upsert(
        {
          tournament_id: tournamentId,
          user_id: u.user.id,
          ...availability,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "tournament_id,user_id",
        }
      );

      if (error) throw error;

      toast.success("Availability saved. You're in!");
      navigate({ to: `/tournaments/${tournamentId}` });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save availability");
    } finally {
      setLoading(false);
    }
  }

  const toggleTime = (field: string) => {
    setAvailability((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-md px-5 py-10">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Scheduling Preferences
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-wide">When are you available?</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Select your preferred time slots. We'll schedule your matches when both
            opponents are available. If no common slot exists, we default to evenings.
          </p>
        </div>

        <form onSubmit={save} className="mt-8 space-y-6">
          {/* Weekday options */}
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Weekdays (Mon–Fri)
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-card/80 transition">
                <Checkbox
                  checked={availability.weekday_morning}
                  onCheckedChange={() => toggleTime("weekday_morning")}
                />
                <div>
                  <p className="font-medium text-sm">Morning</p>
                  <p className="text-[11px] text-muted-foreground">8:00 AM – 12:00 PM</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-card/80 transition">
                <Checkbox
                  checked={availability.weekday_afternoon}
                  onCheckedChange={() => toggleTime("weekday_afternoon")}
                />
                <div>
                  <p className="font-medium text-sm">Afternoon</p>
                  <p className="text-[11px] text-muted-foreground">12:00 PM – 5:00 PM</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-card/80 transition">
                <Checkbox
                  checked={availability.weekday_evening}
                  onCheckedChange={() => toggleTime("weekday_evening")}
                />
                <div>
                  <p className="font-medium text-sm">Evening</p>
                  <p className="text-[11px] text-muted-foreground">6:00 PM – 9:00 PM</p>
                </div>
              </label>
            </div>
          </div>

          {/* Weekend options */}
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Weekends (Sat–Sun)
            </h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-card/80 transition">
                <Checkbox
                  checked={availability.weekend_morning}
                  onCheckedChange={() => toggleTime("weekend_morning")}
                />
                <div>
                  <p className="font-medium text-sm">Morning</p>
                  <p className="text-[11px] text-muted-foreground">8:00 AM – 12:00 PM</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-card/80 transition">
                <Checkbox
                  checked={availability.weekend_afternoon}
                  onCheckedChange={() => toggleTime("weekend_afternoon")}
                />
                <div>
                  <p className="font-medium text-sm">Afternoon</p>
                  <p className="text-[11px] text-muted-foreground">12:00 PM – 5:00 PM</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-border hover:bg-card/80 transition">
                <Checkbox
                  checked={availability.weekend_evening}
                  onCheckedChange={() => toggleTime("weekend_evening")}
                />
                <div>
                  <p className="font-medium text-sm">Evening</p>
                  <p className="text-[11px] text-muted-foreground">6:00 PM – 9:00 PM</p>
                </div>
              </label>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading || !hasSelection}
            className="crimson-glow h-12 w-full font-display tracking-wider"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue to Tournament"
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          You can update this anytime before the bracket is generated.
        </p>
      </div>
    </div>
  );
}
