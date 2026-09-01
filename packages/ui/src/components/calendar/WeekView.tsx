import * as React from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { colorBackground, eventAccentColors } from "../../colorUtils";
import type { EventView } from "../../types";
import { HOUR_HEIGHT_PX, MAX_VISIBLE_ALLDAY_ROWS, eventsOnDay, hoursOfDay, layoutAllDayBars, layoutDayEvents } from "./calendarMath";
import { EventCard } from "../EventCard";

const ALLDAY_ROW_HEIGHT = 22;

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
  const allDayItems = layoutAllDayBars(events, start, 7);
  const visibleTracks = Math.min(
    allDayItems.reduce((max, item) => Math.max(max, item.track + 1), 0),
    MAX_VISIBLE_ALLDAY_ROWS,
  );
  const hiddenAllDayByDay = new Map<number, number>();
  for (const item of allDayItems) {
    if (item.track < MAX_VISIBLE_ALLDAY_ROWS) continue;
    for (let idx = item.startIdx; idx <= item.endIdx; idx++) {
      hiddenAllDayByDay.set(idx, (hiddenAllDayByDay.get(idx) ?? 0) + 1);
    }
  }

  return (
    <div className="overflow-auto rounded-2xl border border-ink-200 bg-surface">
      <div className="grid grid-cols-[4rem_repeat(7,minmax(9rem,1fr))]">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="border-b border-l border-ink-100 px-2 py-2 text-center">
            <p className="text-xs font-medium uppercase text-ink-400">{format(day, "EEE")}</p>
            <p className="text-sm font-semibold text-ink-900">{format(day, "d")}</p>
          </div>
        ))}

        {(visibleTracks > 0 || hiddenAllDayByDay.size > 0) && (
          <>
            <div className="border-l border-ink-100" />
            <div
              className="relative col-span-7 grid grid-cols-7 gap-y-0.5 border-b border-l border-ink-100 py-1"
              style={{ minHeight: (visibleTracks || 1) * ALLDAY_ROW_HEIGHT }}
            >
              {allDayItems
                .filter((item) => item.track < MAX_VISIBLE_ALLDAY_ROWS)
                .map((item) => (
                  <button
                    type="button"
                    key={item.event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(item.event);
                    }}
                    className="truncate rounded px-1.5 text-left text-[11px] font-medium text-white"
                    style={{
                      gridColumn: `${item.startIdx + 1} / ${item.endIdx + 2}`,
                      gridRow: item.track + 1,
                      height: ALLDAY_ROW_HEIGHT - 4,
                      lineHeight: `${ALLDAY_ROW_HEIGHT - 4}px`,
                      background: colorBackground(eventAccentColors(item.event)),
                    }}
                  >
                    {item.event.title}
                  </button>
                ))}
              {days.map((_, dayIdx) => {
                const hidden = hiddenAllDayByDay.get(dayIdx);
                if (!hidden) return <div key={dayIdx} />;
                return (
                  <div
                    key={dayIdx}
                    className="truncate px-1.5 text-[11px] text-ink-400"
                    style={{ gridColumn: dayIdx + 1, gridRow: MAX_VISIBLE_ALLDAY_ROWS + 1 }}
                  >
                    +{hidden} more
                  </div>
                );
              })}
            </div>
          </>
        )}

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
            const dayEvents = eventsOnDay(events, day).filter((e) => !e.allDay);
            const { positions, overflow } = layoutDayEvents(dayEvents);
            return (
              <div key={day.toISOString()} className="relative border-l border-ink-100">
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
                        left: `calc(${left * 100}% + 2px)`,
                        width: `calc(${width * 100}% - 4px)`,
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
                    className="absolute inset-x-0.5 flex items-center justify-center rounded bg-ink-700/85 text-[10px] font-medium text-white"
                    style={{ top: chip.top, height: chip.height }}
                  >
                    +{chip.count} more
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
