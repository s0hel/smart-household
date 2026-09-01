import * as React from "react";
import { addDays, endOfMonth, format, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { cn } from "../../cn";
import { colorBackground, eventAccentColors } from "../../colorUtils";
import type { EventView } from "../../types";
import { MAX_VISIBLE_ALLDAY_ROWS, eventsOnDay, layoutAllDayBars } from "./calendarMath";

const ALLDAY_ROW_HEIGHT = 20;
/** Where the all-day bar overlay starts within a day cell: below the padding + date circle. */
const ALLDAY_OVERLAY_TOP = 32;
const MAX_VISIBLE_TIMED = 3;

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
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  const allDayItems = layoutAllDayBars(events, gridStart, days.length);

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-surface">
      <div className="grid grid-cols-7 border-b border-ink-100 text-center text-xs font-medium uppercase text-ink-400">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((weekDays, weekIndex) => {
        const weekStartIdx = weekIndex * 7;
        const weekEndIdx = weekStartIdx + 6;
        const weekItems = allDayItems.filter((item) => item.endIdx >= weekStartIdx && item.startIdx <= weekEndIdx);
        const visibleTracks = Math.min(
          weekItems.reduce((max, item) => Math.max(max, item.track + 1), 0),
          MAX_VISIBLE_ALLDAY_ROWS,
        );
        const hiddenAllDayByDay = new Map<number, number>();
        for (const item of weekItems) {
          if (item.track < MAX_VISIBLE_ALLDAY_ROWS) continue;
          for (let idx = Math.max(item.startIdx, weekStartIdx); idx <= Math.min(item.endIdx, weekEndIdx); idx++) {
            hiddenAllDayByDay.set(idx, (hiddenAllDayByDay.get(idx) ?? 0) + 1);
          }
        }

        return (
          <div key={weekIndex} className="relative grid grid-cols-7">
            {weekDays.map((day, dayIndex) => {
              const dayIdx = weekStartIdx + dayIndex;
              const dayEvents = eventsOnDay(events, day).filter((e) => !e.allDay);
              const visible = dayEvents.slice(0, MAX_VISIBLE_TIMED);
              const overflow = dayEvents.length - visible.length + (hiddenAllDayByDay.get(dayIdx) ?? 0);
              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  onClick={() => onDayClick?.(day)}
                  className={cn(
                    "flex min-h-[6rem] flex-col gap-0.5 border-b border-l border-ink-100 p-1.5 text-left align-top",
                    !isSameMonth(day, monthOf) && "bg-ink-50 text-ink-300",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday(day) && "bg-sapphire-600 text-white",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div style={{ height: visibleTracks * ALLDAY_ROW_HEIGHT }} />
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
                        style={{ background: colorBackground(eventAccentColors(event)) }}
                      >
                        {event.title}
                      </span>
                    ))}
                    {overflow > 0 && <span className="text-[11px] text-ink-400">+{overflow} more</span>}
                  </div>
                </button>
              );
            })}
            {visibleTracks > 0 && (
              <div className="pointer-events-none absolute inset-x-0" style={{ top: ALLDAY_OVERLAY_TOP }}>
                {weekItems
                  .filter((item) => item.track < MAX_VISIBLE_ALLDAY_ROWS)
                  .map((item) => {
                    const startCol = Math.max(item.startIdx, weekStartIdx) - weekStartIdx;
                    const endCol = Math.min(item.endIdx, weekEndIdx) - weekStartIdx;
                    const continuesBefore = item.startIdx < weekStartIdx;
                    const continuesAfter = item.endIdx > weekEndIdx;
                    const leftPad = continuesBefore ? 0 : 2;
                    const rightPad = continuesAfter ? 0 : 2;
                    return (
                      <button
                        type="button"
                        key={`${item.event.id}-${weekIndex}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick?.(item.event);
                        }}
                        className={cn(
                          "pointer-events-auto absolute flex items-center truncate px-1.5 text-[11px] font-medium text-white",
                          !continuesBefore && "rounded-l",
                          !continuesAfter && "rounded-r",
                        )}
                        style={{
                          top: item.track * ALLDAY_ROW_HEIGHT,
                          height: ALLDAY_ROW_HEIGHT - 4,
                          left: `calc(${(startCol / 7) * 100}% + ${leftPad}px)`,
                          width: `calc(${((endCol - startCol + 1) / 7) * 100}% - ${leftPad + rightPad}px)`,
                          background: colorBackground(eventAccentColors(item.event)),
                        }}
                      >
                        {item.event.title}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
