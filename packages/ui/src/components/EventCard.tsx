import * as React from "react";
import { cn } from "../cn";
import type { EventView } from "../types";
import { PersonBadge } from "./PersonBadge";
import { colorBackground, eventAccentColors, shadeColor, tintColor } from "../colorUtils";

function formatTimeRange(event: EventView) {
  if (event.allDay) return "All day";
  const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${fmt(event.startAt)} – ${fmt(event.endAt)}`;
}

export function EventCard({
  event,
  onClick,
  compact = false,
  dense = false,
  className,
}: {
  event: EventView;
  onClick?: () => void;
  compact?: boolean;
  /** For short slots in the week/day grid: single line, no wrapping, badges collapse to dots. */
  dense?: boolean;
  className?: string;
}) {
  const accentColors = eventAccentColors(event);
  const primaryAccent = accentColors[0]!;

  if (dense) {
    const [firstAssignee, ...otherAssignees] = event.assignees;
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex w-full flex-col justify-center gap-0.5 overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-left shadow-sm transition hover:shadow-md",
          className,
        )}
        style={{ borderLeftColor: primaryAccent, background: colorBackground(accentColors, tintColor) }}
      >
        {firstAssignee && (
          <span
            className="absolute right-1 top-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
            style={{ backgroundColor: firstAssignee.colorHex }}
          >
            {firstAssignee.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span
          className={cn("min-w-0 truncate text-xs font-semibold", firstAssignee && "pr-4")}
          style={{ color: shadeColor(primaryAccent) }}
        >
          {event.title}
        </span>
        <span className="truncate text-[10px] text-ink-500">
          {formatTimeRange(event)}
          {otherAssignees.length > 0 && <span className="ml-1 font-medium">+{otherAssignees.length}</span>}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-1 overflow-hidden rounded-xl border-l-4 p-3 text-left shadow-sm transition hover:shadow-md",
        compact && "p-2",
        className,
      )}
      style={{ borderLeftColor: primaryAccent, background: colorBackground(accentColors, (c) => tintColor(c, 0.92)) }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("min-w-0 truncate font-semibold text-ink-900", compact ? "text-sm" : "text-base")}>
          {event.title}
        </span>
        <span className="whitespace-nowrap text-xs text-ink-500">{formatTimeRange(event)}</span>
      </div>
      {!compact && (event.location || event.travelTimeMinutes) && (
        <div className="text-xs text-ink-500">
          {event.location && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="underline-offset-2 hover:underline"
            >
              📍 {event.location}
            </a>
          )}
          {event.travelTimeMinutes != null && <span className="ml-2">🚗 {event.travelTimeMinutes} min drive</span>}
        </div>
      )}
      {event.assignees.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {event.assignees.map((person) => (
            <PersonBadge key={person.id} person={person} size="sm" />
          ))}
        </div>
      )}
      {!compact && event.checklist.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-ink-600">
          {event.checklist.map((item) => (
            <li key={item.id} className={cn(item.checked && "text-ink-400 line-through")}>
              ☑ {item.label}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}
