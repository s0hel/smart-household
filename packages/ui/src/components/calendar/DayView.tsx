import * as React from "react";
import type { EventView } from "../../types";
import { DAY_START_HOUR, HOUR_HEIGHT_PX, eventPosition, eventsOnDay, hoursOfDay } from "./calendarMath";
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
  const dayEvents = eventsOnDay(events, day);

  return (
    <div className="flex overflow-y-auto rounded-2xl border border-ink-200 bg-white">
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
          const { top, height } = eventPosition(event);
          return (
            <div key={event.id} className="absolute left-1 right-1" style={{ top, height }}>
              <EventCard
                event={event}
                compact
                dense={height < 48}
                onClick={() => onEventClick?.(event)}
                className="h-full"
              />
            </div>
          );
        })}
        {dayEvents.length === 0 && (
          <p className="absolute inset-x-0 top-4 text-center text-sm text-ink-400">Nothing scheduled today.</p>
        )}
      </div>
    </div>
  );
}

// Re-export for callers that only need the hour label formatting.
export { DAY_START_HOUR };
