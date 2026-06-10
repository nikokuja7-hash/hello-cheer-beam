import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

type Msg = { id: string; user_id: string; body: string; created_at: string; is_system: boolean };

export function TournamentChat({ tournamentId, userId }: { tournamentId: string; userId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    const { data } = await supabase
      .from("chat_messages")
      .select("id,user_id,body,created_at,is_system")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) setMsgs(data as Msg[]);
    const userIds = Array.from(new Set((data ?? []).map((m: any) => m.user_id)));
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("id,username").in("id", userIds);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => (map[p.id] = p.username));
      setNames(map);
    }
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`chat-${tournamentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `tournament_id=eq.${tournamentId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tournamentId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    if (!body.trim()) return;
    const text = body.trim().slice(0, 500);
    setBody("");
    await supabase.from("chat_messages").insert({ tournament_id: tournamentId, user_id: userId, body: text });
  }

  return (
    <div className="flex h-[55vh] flex-col rounded-lg border border-border bg-card">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {msgs.length === 0 ? (
          <p className="py-12 text-center text-xs text-muted-foreground">Be the first to say something.</p>
        ) : msgs.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.user_id === userId ? "items-end" : "items-start"}`}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {m.is_system ? "System" : (names[m.user_id] ?? "player")}
            </p>
            <div className={`mt-0.5 max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.user_id === userId ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
              {m.body}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2 border-t border-border p-2"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message tournament chat"
          className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          maxLength={500}
        />
        <Button type="submit" size="icon" className="h-10 w-10">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
