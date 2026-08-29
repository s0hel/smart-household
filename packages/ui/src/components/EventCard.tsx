import * as React from "react";
import { cn } from "../cn";
import type { EventView } from "../types";
import { PersonBadge } from "./PersonBadge";

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
  if (dense) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-1.5 overflow-hidden rounded-lg border-l-4 bg-white px-1.5 py-1 text-left shadow-sm transition hover:shadow-md",
          className,
        )}
        style={{ borderLeftColor: event.colorHex }}
      >
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-900">{event.title}</span>
        {event.assignees.length > 0 && (
          <span className="flex shrink-0 -space-x-1">
            {event.assignees.slice(0, 4).map((person) => (
              <span
                key={person.id}
                className="h-2 w-2 rounded-full ring-1 ring-white"
                style={{ backgroundColor: person.colorHex }}
              />
            ))}
          </span>
        )}
        <span className="shrink-0 whitespace-nowrap text-[10px] text-gray-400">{formatTimeRange(event)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-1 overflow-hidden rounded-xl border-l-4 bg-white p-3 text-left shadow-sm transition hover:shadow-md",
        compact && "p-2",
        className,
      )}
      style={{ borderLeftColor: event.colorHex }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("min-w-0 truncate font-semibold text-gray-900", compact ? "text-sm" : "text-base")}>
          {event.title}
        </span>
        <span className="whitespace-nowrap text-xs text-gray-500">{formatTimeRange(event)}</span>
      </div>
      {!compact && (event.location || event.travelTimeMinutes) && (
        <div className="text-xs text-gray-500">
          {event.location && <span>📍 {event.location}</span>}
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
        <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
          {event.checklist.map((item) => (
            <li key={item.id} className={cn(item.checked && "text-gray-400 line-through")}>
              ☑ {item.label}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}
