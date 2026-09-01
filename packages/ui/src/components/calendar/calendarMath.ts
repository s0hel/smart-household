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
