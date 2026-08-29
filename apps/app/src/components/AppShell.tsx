"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@household/ui";
import { ProfileSwitcher } from "./ProfileSwitcher";

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/calendar", label: "Calendar" },
  { href: "/tasks", label: "Tasks & Chores" },
  { href: "/lists", label: "Lists" },
  { href: "/family", label: "Family" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-gray-200 bg-white p-4">
        <div>
          <p className="mb-6 px-2 text-lg font-bold text-gray-900">🏠 Household</p>
          <nav className="space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100",
                  pathname.startsWith(item.href) && "bg-blue-50 text-blue-700",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <ProfileSwitcher />
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
