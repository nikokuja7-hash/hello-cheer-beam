import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  id: number;
  tournament_id: string;
  user_id: string;
  username?: string;
  message: string;
  is_pinned: boolean;
  created_at: string;
}

interface TournamentChatProps {
  tournamentId: string;
  isCreator: boolean;
}

const PROFANITY_WORDS = [
  "damn",
  "hell",
  "crap",
  "bastard",
  "ass",
  "bitch",
  "shit",
  "piss",
  "fuck",
  "whore",
  "slut",
  "dick",
];

function filterProfanity(text: string): string {
  let filtered = text;
  PROFANITY_WORDS.forEach((word) => {
    const regex = new RegExp(word, "gi");
    const censored = "*".repeat(word.length);
    filtered = filtered.replace(regex, censored);
  });
  return filtered;
}

export function TournamentChat({ tournamentId, isCreator }: TournamentChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial messages
  useEffect(() => {
    loadMessages();
  }, [tournamentId]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const msg = payload.new as ChatMessage;
            setMessages((prev) => [...prev, msg].sort((a, b) => {
              if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            }));
            scrollToBottom();
          } else if (payload.eventType === "DELETE") {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            );
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [tournamentId]);

  async function loadMessages() {
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select(
          `
          id,
          tournament_id,
          user_id,
          message,
          is_pinned,
          created_at,
          profiles:user_id(username)
        `
        )
        .eq("tournament_id", tournamentId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(100);

      if (error) throw error;

      const messagesWithUsernames = data?.map((msg: any) => ({
        ...msg,
        username: msg.profiles?.username || "Unknown",
      })) || [];

      setMessages(messagesWithUsernames);
      setLoading(false);
      scrollToBottom();
    } catch (error) {
      console.error("Failed to load messages:", error);
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !user) return;

    setSending(true);
    try {
      const filtered = filterProfanity(newMessage);

      const { error } = await supabase.from("chat_messages").insert({
        tournament_id: tournamentId,
        user_id: user.id,
        message: filtered,
        is_pinned: false,
      });

      if (error) throw error;

      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(messageId: number) {
    try {
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("Failed to delete message");
    }
  }

  async function togglePin(messageId: number, currentPin: boolean) {
    if (!isCreator) return;

    try {
      const { error } = await supabase
        .from("chat_messages")
        .update({ is_pinned: !currentPin })
        .eq("id", messageId);

      if (error) throw error;
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      toast.error("Failed to toggle pin");
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        Loading chat...
      </div>
    );
  }

  return (
    <div className="flex h-96 flex-col rounded-lg border border-border bg-card">
      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {messages.length === 0 ? (
            <p className="text-center text-[11px] text-muted-foreground py-6">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-lg p-2 text-[10px] ${
                  msg.is_pinned ? "bg-primary/20 border border-primary/40" : "bg-background/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-primary">{msg.username}</p>
                    <p className="mt-1 text-foreground break-words">{msg.message}</p>
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      {new Date(msg.created_at).toLocaleTimeString("en-KE")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {isCreator && (
                      <button
                        onClick={() => togglePin(msg.id, msg.is_pinned)}
                        className="text-[9px] text-muted-foreground hover:text-primary transition"
                        title={msg.is_pinned ? "Unpin" : "Pin"}
                      >
                        📌
                      </button>
                    )}
                    {(user?.id === msg.user_id || isCreator) && (
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="text-[9px] text-muted-foreground hover:text-red-500 transition"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t border-border bg-background/50 p-2">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message..."
            className="h-8 text-[10px]"
            disabled={sending}
            maxLength={200}
          />
          <Button
            onClick={sendMessage}
            disabled={sending || !newMessage.trim()}
            size="sm"
            className="h-8 w-8 px-0"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
        <p className="mt-1 text-[9px] text-muted-foreground">
          {newMessage.length}/200 characters
        </p>
      </div>
    </div>
  );
}
