import * as React from "react";
import { addDays, endOfMonth, format, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { cn } from "../../cn";
import type { EventView } from "../../types";
import { eventsOnDay } from "./calendarMath";

export function MonthView({
  monthOf,
  events,
  onEventClick,
  onDayClick,
}: {
  monthOf: Date;
  events: EventView[];
  onEventClick?: (event: EventView) => void;
  onDayClick?: (day: Date) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(monthOf), { weekStartsOn: 1 });
  const monthEnd = endOfMonth(monthOf);
  const totalDays = Math.ceil((monthEnd.getTime() - gridStart.getTime()) / 86_400_000 / 7) * 7 + 7;
  const days = Array.from({ length: Math.max(totalDays, 42) }, (_, i) => addDays(gridStart, i)).slice(0, 42);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="grid grid-cols-7 border-b border-gray-100 text-center text-xs font-medium uppercase text-gray-400">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsOnDay(events, day);
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;
          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => onDayClick?.(day)}
              className={cn(
                "flex min-h-[6rem] flex-col gap-1 border-b border-l border-gray-100 p-1.5 text-left align-top",
                !isSameMonth(day, monthOf) && "bg-gray-50 text-gray-300",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  isToday(day) && "bg-blue-600 text-white",
                )}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5">
                {visible.map((event) => (
                  <span
                    key={event.id}
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                    className="truncate rounded px-1 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: event.colorHex }}
                  >
                    {event.title}
                  </span>
                ))}
                {overflow > 0 && <span className="text-[11px] text-gray-400">+{overflow} more</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
