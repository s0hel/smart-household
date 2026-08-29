import type { EventView, FamilyMemberView, ListView, TaskView } from "@household/ui";

interface RawUser {
  id: string;
  name: string;
  colorHex: string;
  avatarUrl?: string | null;
  role: string;
}

export function toFamilyMemberView(user: RawUser): FamilyMemberView {
  return {
    id: user.id,
    name: user.name,
    colorHex: user.colorHex,
    avatarUrl: user.avatarUrl,
    role: user.role as FamilyMemberView["role"],
  };
}

interface RawEvent {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location?: string | null;
  colorHex: string;
  travelTimeMinutes?: number | null;
  assignees: { user: RawUser }[];
  checklist: { id: string; label: string; checked: boolean }[];
}

export function toEventView(event: RawEvent): EventView {
  return {
    id: event.id,
    title: event.title,
    startAt: new Date(event.startAt),
    endAt: new Date(event.endAt),
    allDay: event.allDay,
    location: event.location,
    colorHex: event.colorHex,
    travelTimeMinutes: event.travelTimeMinutes,
    assignees: event.assignees.map((a) => toFamilyMemberView(a.user)),
    checklist: event.checklist,
  };
}

interface RawTask {
  id: string;
  title: string;
  type: string;
  points: number;
  dueAt?: Date | null;
  assignee?: RawUser | null;
  completions: unknown[];
}

export function toTaskView(task: RawTask): TaskView {
  return {
    id: task.id,
    title: task.title,
    type: task.type as TaskView["type"],
    points: task.points,
    dueAt: task.dueAt ? new Date(task.dueAt) : null,
    assignee: task.assignee ? toFamilyMemberView(task.assignee) : null,
    completedToday: task.completions.length > 0,
  };
}

interface RawList {
  id: string;
  name: string;
  type: string;
  items: { id: string; label: string; quantity?: string | null; category?: string | null; checked: boolean }[];
}

export function toListView(list: RawList): ListView {
  return {
    id: list.id,
    name: list.name,
    type: list.type as ListView["type"],
    items: list.items,
  };
}
