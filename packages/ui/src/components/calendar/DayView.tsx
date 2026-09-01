import * as React from "react";
import { cn } from "../../cn";
import { colorBackground, eventAccentColors } from "../../colorUtils";
import type { EventView } from "../../types";
import { DAY_START_HOUR, HOUR_HEIGHT_PX, allDayEventsOnDay, eventsOnDay, hoursOfDay, layoutDayEvents } from "./calendarMath";
import { EventCard } from "../EventCard";

export function DayView({
  day,
  events,
  onEventClick,
}: {
  day: Date;
  events: EventView[];
  onEventClick?: (event: EventView) => void;
}) {
  const allDayEvents = allDayEventsOnDay(events, day);
  const dayEvents = eventsOnDay(events, day).filter((e) => !e.allDay);
  const { positions, overflow } = layoutDayEvents(dayEvents);

  return (
    <div className="flex flex-col overflow-y-auto rounded-2xl border border-ink-200 bg-white">
      {allDayEvents.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-ink-100 p-2">
          {allDayEvents.map((event) => (
            <button
              type="button"
              key={event.id}
              onClick={() => onEventClick?.(event)}
              className={cn("rounded px-2 py-1 text-left text-xs font-medium text-white")}
              style={{ background: colorBackground(eventAccentColors(event)) }}
            >
              {event.title}
            </button>
          ))}
        </div>
      )}
        <div className="flex flex-1 overflow-y-auto">
          <div className="w-16 shrink-0 border-r border-ink-100">
            {hoursOfDay().map((hour) => (
              <div key={hour} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-ink-50 pr-2 text-right text-xs text-ink-400">
                {hour % 12 === 0 ? 12 : hour % 12}
                {hour < 12 ? "am" : "pm"}
              </div>
            ))}
          </div>
          <div className="relative flex-1">
            {hoursOfDay().map((hour) => (
              <div key={hour} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-ink-50" />
            ))}
            {dayEvents.map((event) => {
              const position = positions.get(event.id);
              if (!position) return null;
              const { top, height, left, width } = position;
              return (
                <div
                  key={event.id}
                  className="absolute"
                  style={{
                    top,
                    height,
                    left: `calc(${left * 100}% + 4px)`,
                    width: `calc(${width * 100}% - 8px)`,
                  }}
                >
                  <EventCard
                    event={event}
                    compact
                    dense={height < 48 || width < 1}
                    onClick={() => onEventClick?.(event)}
                    className="h-full"
                  />
                </div>
              );
            })}
            {overflow.map((chip, i) => (
              <div
                key={i}
                className="absolute inset-x-1 flex items-center justify-center rounded bg-ink-700/85 text-[10px] font-medium text-white"
                style={{ top: chip.top, height: chip.height }}
              >
                +{chip.count} more
              </div>
            ))}
            {dayEvents.length === 0 && allDayEvents.length === 0 && (
              <p className="absolute inset-x-0 top-4 text-center text-sm text-ink-400">Nothing scheduled today.</p>
            )}
          </div>
        </div>
      </div>
  );
}

// Re-export for callers that only need the hour label formatting.
export { DAY_START_HOUR };
