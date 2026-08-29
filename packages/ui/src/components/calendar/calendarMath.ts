import type { EventView } from "../../types";

export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 22;
export const HOUR_HEIGHT_PX = 56;

export function hoursOfDay(): number[] {
  const hours: number[] = [];
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) hours.push(h);
  return hours;
}

/** Vertical position/height (px) for an event within the DAY_START_HOUR..DAY_END_HOUR grid. */
export function eventPosition(event: EventView) {
  const dayStartMinutes = DAY_START_HOUR * 60;
  const dayEndMinutes = DAY_END_HOUR * 60;
  const startMinutes = Math.min(
    Math.max(event.startAt.getHours() * 60 + event.startAt.getMinutes(), dayStartMinutes),
    dayEndMinutes,
  );
  const endMinutes = Math.min(
    Math.max(event.endAt.getHours() * 60 + event.endAt.getMinutes(), startMinutes + 15),
    dayEndMinutes,
  );

  const top = ((startMinutes - dayStartMinutes) / 60) * HOUR_HEIGHT_PX;
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT_PX, 24);
  return { top, height };
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function eventsOnDay(events: EventView[], day: Date): EventView[] {
  return events
    .filter((e) => isSameCalendarDay(e.startAt, day))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
