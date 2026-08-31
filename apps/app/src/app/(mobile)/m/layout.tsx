"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@household/ui";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";

const NAV = [
  { href: "/m", label: "Home", icon: "🏠" },
  { href: "/m/calendar", label: "Calendar", icon: "📅" },
  { href: "/m/tasks", label: "Tasks", icon: "✅" },
  { href: "/m/lists", label: "Lists", icon: "🛒" },
  { href: "/m/meal-plan", label: "Meals", icon: "🍽️" },
  { href: "/m/rewards", label: "Rewards", icon: "🎁" },
  { href: "/m/family", label: "Family", icon: "👪" },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-paper">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-gold-400 bg-white/95 px-4 pb-3 backdrop-blur [padding-top:max(0.75rem,env(safe-area-inset-top))]">
        <span className="font-display text-lg italic text-sapphire-800">Household</span>
        <ProfileSwitcher dropDirection="down" triggerClassName="p-1.5" />
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t-2 border-gold-400 bg-white/95 backdrop-blur [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-0.5 overflow-x-auto px-1 pt-1.5">
          {NAV.map((item) => {
            const active = item.href === "/m" ? pathname === "/m" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 shrink-0 basis-0 flex-col items-center gap-0.5 whitespace-nowrap rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors",
                  active ? "bg-sapphire-50 text-sapphire-700" : "text-ink-500",
                )}
              >
                <span className={cn("text-lg transition-transform", active && "scale-110")}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
