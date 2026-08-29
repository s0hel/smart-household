/** View-model types for shared UI components — deliberately decoupled from Prisma so this package has no DB dependency. */

export interface FamilyMemberView {
  id: string;
  name: string;
  colorHex: string;
  avatarUrl?: string | null;
  role: "ADMIN" | "PARENT" | "CHILD" | "GUEST" | "READONLY";
}

export interface EventChecklistItemView {
  id: string;
  label: string;
  checked: boolean;
}

export interface EventView {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location?: string | null;
  colorHex: string;
  travelTimeMinutes?: number | null;
  assignees: FamilyMemberView[];
  checklist: EventChecklistItemView[];
}

export interface TaskView {
  id: string;
  title: string;
  type: "ONE_TIME" | "RECURRING" | "CHORE" | "ROUTINE";
  points: number;
  dueAt?: Date | null;
  assignee?: FamilyMemberView | null;
  completedToday: boolean;
}

export interface ListItemView {
  id: string;
  label: string;
  quantity?: string | null;
  category?: string | null;
  checked: boolean;
}

export interface ListView {
  id: string;
  name: string;
  type: "GROCERY" | "CUSTOM";
  items: ListItemView[];
}
