import * as React from "react";
import { addDays, format, startOfWeek } from "date-fns";
import type { EventView } from "../../types";
import { HOUR_HEIGHT_PX, eventPosition, eventsOnDay, hoursOfDay } from "./calendarMath";
import { EventCard } from "../EventCard";

export function WeekView({
  weekOf,
  events,
  onEventClick,
}: {
  weekOf: Date;
  events: EventView[];
  onEventClick?: (event: EventView) => void;
}) {
  const start = startOfWeek(weekOf, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="overflow-auto rounded-2xl border border-gray-200 bg-white">
      <div className="grid grid-cols-[4rem_repeat(7,minmax(9rem,1fr))]">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="border-b border-l border-gray-100 px-2 py-2 text-center">
            <p className="text-xs font-medium uppercase text-gray-400">{format(day, "EEE")}</p>
            <p className="text-sm font-semibold text-gray-900">{format(day, "d")}</p>
          </div>
        ))}

        <div className="col-span-full grid grid-cols-[4rem_repeat(7,minmax(9rem,1fr))]">
          <div>
            {hoursOfDay().map((hour) => (
              <div key={hour} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-gray-50 pr-2 text-right text-xs text-gray-400">
                {hour % 12 === 0 ? 12 : hour % 12}
                {hour < 12 ? "am" : "pm"}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const dayEvents = eventsOnDay(events, day);
            return (
              <div key={day.toISOString()} className="relative border-l border-gray-100">
                {hoursOfDay().map((hour) => (
                  <div key={hour} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-gray-50" />
                ))}
                {dayEvents.map((event) => {
                  const { top, height } = eventPosition(event);
                  return (
                    <div key={event.id} className="absolute left-0.5 right-0.5" style={{ top, height }}>
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
