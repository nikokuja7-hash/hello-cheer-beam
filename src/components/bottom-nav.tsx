import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, BarChart3, User2, Zap } from "lucide-react";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/quickcash", label: "Quick", icon: Zap },
  { to: "/league", label: "League", icon: BarChart3 },
  { to: "/tournaments", label: "Cups", icon: Trophy },
  { to: "/profile", label: "Me", icon: User2 },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl">
      <div className="mx-auto max-w-md grid grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className="no-tap flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] uppercase tracking-wider"
            >
              <Icon
                className={`h-5 w-5 transition ${active ? "text-primary" : "text-muted-foreground"}`}
                strokeWidth={active ? 2.5 : 2}
              />
              <span className={active ? "text-foreground font-semibold" : "text-muted-foreground"}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
