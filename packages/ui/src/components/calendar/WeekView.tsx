import * as React from "react";
import { addDays, format, startOfWeek } from "date-fns";
import type { EventView } from "../../types";
import { HOUR_HEIGHT_PX, eventsOnDay, hoursOfDay, layoutDayEvents } from "./calendarMath";
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
    <div className="overflow-auto rounded-2xl border border-ink-200 bg-white">
      <div className="grid grid-cols-[4rem_repeat(7,minmax(9rem,1fr))]">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="border-b border-l border-ink-100 px-2 py-2 text-center">
            <p className="text-xs font-medium uppercase text-ink-400">{format(day, "EEE")}</p>
            <p className="text-sm font-semibold text-ink-900">{format(day, "d")}</p>
          </div>
        ))}

        <div className="col-span-full grid grid-cols-[4rem_repeat(7,minmax(9rem,1fr))]">
          <div>
            {hoursOfDay().map((hour) => (
              <div key={hour} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-ink-50 pr-2 text-right text-xs text-ink-400">
                {hour % 12 === 0 ? 12 : hour % 12}
                {hour < 12 ? "am" : "pm"}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const dayEvents = eventsOnDay(events, day);
            const positions = layoutDayEvents(dayEvents);
            return (
              <div key={day.toISOString()} className="relative border-l border-ink-100">
                {hoursOfDay().map((hour) => (
                  <div key={hour} style={{ height: HOUR_HEIGHT_PX }} className="border-b border-ink-50" />
                ))}
                {dayEvents.map((event) => {
                  const { top, height, left, width } = positions.get(event.id)!;
                  return (
                    <div
                      key={event.id}
                      className="absolute"
                      style={{
                        top,
                        height,
                        left: `calc(${left * 100}% + 2px)`,
                        width: `calc(${width * 100}% - 4px)`,
                      }}
                    >
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
