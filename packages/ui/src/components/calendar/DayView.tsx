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
    <div className="flex overflow-y-auto rounded-2xl border border-gray-200 bg-white">
      <div className="w-16 shrink-0 border-r border-gray-100">
        {hoursOfDay().map((hour) => (
          <div key={hour} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-gray-50 pr-2 text-right text-xs text-gray-400">
            {hour % 12 === 0 ? 12 : hour % 12}
            {hour < 12 ? "am" : "pm"}
          </div>
        ))}
      </div>
      <div className="relative flex-1">
        {hoursOfDay().map((hour) => (
          <div key={hour} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-gray-50" />
        ))}
        {dayEvents.map((event) => {
          const { top, height } = eventPosition(event);
          return (
            <div key={event.id} className="absolute left-1 right-1" style={{ top, height }}>
              <EventCard event={event} compact onClick={() => onEventClick?.(event)} className="h-full" />
            </div>
          );
        })}
        {dayEvents.length === 0 && (
          <p className="absolute inset-x-0 top-4 text-center text-sm text-gray-400">Nothing scheduled today.</p>
        )}
      </div>
    </div>
  );
}

// Re-export for callers that only need the hour label formatting.
export { DAY_START_HOUR };
