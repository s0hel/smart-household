import { differenceInCalendarDays, startOfDay } from "date-fns";
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

/**
 * All-day events store startAt/endAt as UTC midnight representing a bare calendar
 * date (see syncGoogleCalendar's `toDate`), with no meaningful time-of-day. Reading
 * that instant with local Date getters shifts it by the viewer's UTC offset — a US
 * Central browser would show a UTC-midnight "Sept 4" event as "Sept 3, 7pm". Anchoring
 * to a local Date built from the UTC year/month/day instead gives a Date that every
 * other local-time helper here (isToday, format, isSameCalendarDay, ...) reads as the
 * correct calendar date, regardless of the viewer's timezone.
 */
export function allDayAnchor(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** The calendar day an event should be considered to fall/start on, timezone-safe for all-day events. */
export function eventDisplayDate(event: Pick<EventView, "startAt" | "allDay">): Date {
  return event.allDay ? allDayAnchor(event.startAt) : event.startAt;
}

export function eventsOnDay(events: EventView[], day: Date): EventView[] {
  return events
    .filter((e) => isSameCalendarDay(eventDisplayDate(e), day))
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/** All-day events whose span covers `day`, regardless of which day they started on. */
export function allDayEventsOnDay(events: EventView[], day: Date): EventView[] {
  const dayStart = startOfDay(day);
  return events.filter((e) => e.allDay && dayStart >= allDayAnchor(e.startAt) && dayStart <= allDayLastDay(e));
}

export interface LayoutPosition {
  top: number;
  height: number;
  /** Fraction of the row's width, 0..1. */
  left: number;
  /** Fraction of the row's width, 0..1. */
  width: number;
}

/** An indicator for events beyond MAX_VISIBLE_COLUMNS that got folded away instead of rendered. */
export interface OverflowChip {
  top: number;
  height: number;
  count: number;
}

export interface DayLayout {
  positions: Map<string, LayoutPosition>;
  overflow: OverflowChip[];
}

/**
 * Beyond this many side-by-side columns, additional simultaneous events get
 * folded into a single "+N more" chip instead of shrinking every column
 * further — a 4th or 5th sliver stops being readable long before it stops
 * being narrow.
 */
export const MAX_VISIBLE_COLUMNS = 2;

/**
 * Assigns each event a side-by-side column within its cluster of
 * time-overlapping events, so simultaneous events (e.g. two kids' lessons at
 * the same hour) render next to each other instead of stacked on top of one
 * another. `dayEvents` must already be sorted by start time (eventsOnDay
 * does this).
 */
export function layoutDayEvents(dayEvents: EventView[]): DayLayout {
  const items = dayEvents.map((event) => {
    const { top, height } = eventPosition(event);
    return { event, start: top, end: top + height, col: -1, clusterId: -1 };
  });

  let clusterId = -1;
  let clusterEnd = -Infinity;
  for (const item of items) {
    if (item.start >= clusterEnd) clusterId++;
    item.clusterId = clusterId;
    clusterEnd = Math.max(clusterEnd, item.end);
  }

  const clusterBounds = new Map<number, { top: number; bottom: number }>();
  for (const item of items) {
    const bounds = clusterBounds.get(item.clusterId) ?? { top: item.start, bottom: item.end };
    bounds.top = Math.min(bounds.top, item.start);
    bounds.bottom = Math.max(bounds.bottom, item.end);
    clusterBounds.set(item.clusterId, bounds);
  }

  const clusterColumnEnds = new Map<number, number[]>();
  const clusterMaxCols = new Map<number, number>();
  for (const item of items) {
    const columnEnds = clusterColumnEnds.get(item.clusterId) ?? [];
    const openColumn = columnEnds.findIndex((end) => end <= item.start);
    item.col = openColumn === -1 ? columnEnds.length : openColumn;
    columnEnds[item.col] = item.end;
    clusterColumnEnds.set(item.clusterId, columnEnds);
    clusterMaxCols.set(item.clusterId, Math.max(clusterMaxCols.get(item.clusterId) ?? 0, columnEnds.length));
  }

  const positions = new Map<string, LayoutPosition>();
  const hiddenCountByCluster = new Map<number, number>();
  for (const item of items) {
    const cols = Math.min(clusterMaxCols.get(item.clusterId) ?? 1, MAX_VISIBLE_COLUMNS);
    if (item.col >= MAX_VISIBLE_COLUMNS) {
      hiddenCountByCluster.set(item.clusterId, (hiddenCountByCluster.get(item.clusterId) ?? 0) + 1);
      continue;
    }
    positions.set(item.event.id, {
      top: item.start,
      height: item.end - item.start,
      left: item.col / cols,
      width: 1 / cols,
    });
  }

  // Anchored to the bottom of the cluster's time range, where dense cards
  // (vertically centered content) tend to have empty padding, so the chip
  // doesn't sit on top of a visible card's title/avatar.
  const CHIP_HEIGHT = 16;
  const overflow: OverflowChip[] = [];
  for (const [id, count] of hiddenCountByCluster) {
    const bounds = clusterBounds.get(id)!;
    overflow.push({ top: Math.max(bounds.top, bounds.bottom - CHIP_HEIGHT), height: CHIP_HEIGHT, count });
  }

  return { positions, overflow };
}

/** Beyond this many stacked all-day bars in a week row, extra events fold into "+N more". */
export const MAX_VISIBLE_ALLDAY_ROWS = 2;

/**
 * The last calendar day an all-day event covers, inclusive. All-day events store `endAt`
 * as an exclusive boundary (the day after the event ends — see syncGoogleCalendar's `toDate`),
 * so a one-day event has `endAt` equal to `startAt` plus one day.
 */
export function allDayLastDay(event: EventView): Date {
  const start = allDayAnchor(event.startAt);
  const last = allDayAnchor(new Date(event.endAt.getTime() - 1));
  return last < start ? start : last;
}

export interface AllDayBarItem {
  event: EventView;
  /** Day offset from `rangeStart`, clipped to the visible range. */
  startIdx: number;
  /** Inclusive day offset from `rangeStart`, clipped to the visible range. */
  endIdx: number;
  /** Vertical slot, kept constant across every week/row the event spans. */
  track: number;
}

/**
 * Lays out all-day events as horizontal bars across a date range (a week row, or a whole
 * month grid) instead of confining each one to its start day. Every event gets a `track`
 * (vertical slot) that stays constant across the full range, so a multi-week trip renders in
 * the same row every week rather than jumping between tracks.
 */
export function layoutAllDayBars(events: EventView[], rangeStart: Date, rangeDays: number): AllDayBarItem[] {
  const items = events
    .filter((e) => e.allDay)
    .map((event) => ({
      event,
      startIdx: differenceInCalendarDays(allDayAnchor(event.startAt), rangeStart),
      endIdx: differenceInCalendarDays(allDayLastDay(event), rangeStart),
    }))
    .filter((item) => item.endIdx >= 0 && item.startIdx < rangeDays)
    .map((item) => ({
      ...item,
      startIdx: Math.max(item.startIdx, 0),
      endIdx: Math.min(item.endIdx, rangeDays - 1),
    }))
    .sort((a, b) => a.startIdx - b.startIdx || b.endIdx - b.startIdx - (a.endIdx - a.startIdx));

  const trackEnds: number[] = [];
  const result: AllDayBarItem[] = [];
  for (const item of items) {
    let track = trackEnds.findIndex((end) => end < item.startIdx);
    if (track === -1) track = trackEnds.length;
    trackEnds[track] = item.endIdx;
    result.push({ ...item, track });
  }
  return result;
}
