"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@household/ui";
import { ProfileSwitcher } from "./ProfileSwitcher";
import {
  CalendarIcon,
  ChevronLeftIcon,
  FamilyIcon,
  HomeIcon,
  ListIcon,
  MealPlanIcon,
  RewardsIcon,
  TasksIcon,
} from "./NavIcons";

const NAV = [
  { href: "/dashboard", label: "Home", Icon: HomeIcon },
  { href: "/calendar", label: "Calendar", Icon: CalendarIcon },
  { href: "/tasks", label: "Tasks & Chores", Icon: TasksIcon },
  { href: "/lists", label: "Lists", Icon: ListIcon },
  { href: "/meal-plan", label: "Meal Plan", Icon: MealPlanIcon },
  { href: "/rewards", label: "Rewards", Icon: RewardsIcon },
  { href: "/family", label: "Family", Icon: FamilyIcon },
];

const COLLAPSE_STORAGE_KEY = "household:sidebar-collapsed";

let collapsedSnapshot = false;
let collapsedSnapshotRead = false;
const collapsedListeners = new Set<() => void>();

function getCollapsedSnapshot() {
  if (!collapsedSnapshotRead) {
    collapsedSnapshot = window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
    collapsedSnapshotRead = true;
  }
  return collapsedSnapshot;
}

function getCollapsedServerSnapshot() {
  return false;
}

function subscribeCollapsed(onChange: () => void) {
  collapsedListeners.add(onChange);
  return () => collapsedListeners.delete(onChange);
}

function setCollapsedSnapshot(next: boolean) {
  collapsedSnapshot = next;
  collapsedSnapshotRead = true;
  window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
  collapsedListeners.forEach((listener) => listener());
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const collapsed = React.useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );

  function toggleCollapsed() {
    setCollapsedSnapshot(!collapsed);
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={cn(
          "relative flex shrink-0 flex-col justify-between border-r border-ink-200 bg-white p-4 transition-[width] duration-200",
          collapsed ? "w-20" : "w-56",
        )}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-8 flex h-6 w-6 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-500 shadow-sm hover:bg-ink-100"
        >
          <ChevronLeftIcon className={cn("h-3.5 w-3.5 transition-transform", collapsed && "rotate-180")} />
        </button>

        <div>
          <p
            className={cn(
              "mb-6 border-b-2 border-gold-400 px-2 pb-4 font-display text-xl italic text-sapphire-800",
              collapsed && "text-center",
            )}
          >
            {collapsed ? "H" : "Household"}
          </p>
          <nav className="space-y-1">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100",
                    collapsed && "justify-center px-0",
                    active && "bg-sapphire-700 text-white hover:bg-sapphire-700",
                  )}
                >
                  <item.Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>
        <ProfileSwitcher collapsed={collapsed} />
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
