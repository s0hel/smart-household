"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "../cn";

export const THEMES = [
  { value: "light", label: "Light", swatch: "#1B3A6B" },
  { value: "dark", label: "Dark", swatch: "#3D6FC0" },
  { value: "meadow", label: "Meadow", swatch: "#276B34" },
  { value: "sunset", label: "Sunset", swatch: "#9C4222" },
] as const;

export type ThemeName = (typeof THEMES)[number]["value"];

export function ThemeToggle({
  dropDirection = "down",
  collapsed = false,
  className,
}: {
  dropDirection?: "up" | "down";
  collapsed?: boolean;
  className?: string;
} = {}) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  // Theme isn't known on the server (it lives in localStorage), so render a
  // neutral placeholder until mounted to avoid a hydration mismatch.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const active = THEMES.find((t) => t.value === theme) ?? THEMES[0];

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? "Change theme" : undefined}
        aria-label="Change theme"
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100",
          collapsed && "justify-center px-0",
        )}
      >
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-ink-200"
          style={{ backgroundColor: mounted ? active.swatch : undefined }}
        />
        {!collapsed && <span className="truncate">{mounted ? active.label : "Theme"}</span>}
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-10 w-44 rounded-xl border border-ink-200 bg-surface p-1.5 shadow-lg",
            dropDirection === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
          )}
        >
          <ul className="space-y-0.5">
            {THEMES.map((t) => (
              <li key={t.value}>
                <button
                  type="button"
                  onClick={() => {
                    setTheme(t.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-100",
                    mounted && theme === t.value ? "font-semibold text-sapphire-700" : "text-ink-600",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full border border-ink-200"
                    style={{ backgroundColor: t.swatch }}
                  />
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
