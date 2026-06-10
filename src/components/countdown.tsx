import { useEffect, useState } from "react";

export function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target) return { d: 0, h: 0, m: 0, s: 0, done: true, total: 0 };
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true, total: 0 };
  const s = Math.floor(diff / 1000) % 60;
  const m = Math.floor(diff / 60000) % 60;
  const h = Math.floor(diff / 3600000) % 24;
  const d = Math.floor(diff / 86400000);
  return { d, h, m, s, done: false, total: diff };
}

export function Countdown({ target, prefix = "Closes in" }: { target: string | null; prefix?: string }) {
  const c = useCountdown(target);
  if (!target) return <span className="text-muted-foreground">—</span>;
  if (c.done) return <span className="text-primary">Closed</span>;
  const parts = c.d > 0 ? `${c.d}d ${c.h}h ${c.m}m` : c.h > 0 ? `${c.h}h ${c.m}m ${c.s}s` : `${c.m}m ${c.s}s`;
  return <span className="font-mono tabular-nums">{prefix} {parts}</span>;
}
