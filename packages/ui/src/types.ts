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
  icon?: string | null;
  points: number;
  dueAt?: Date | null;
  assignee?: FamilyMemberView | null;
  completedToday: boolean;
  dueToday: boolean;
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

export interface VocabWordView {
  id: string;
  word: string;
  level: "JUNIOR" | "ISEE";
  partOfSpeech: string;
  /** Written for a ~10-year-old. */
  kidDefinition: string;
  /** The same meaning retold for a ~6-year-old. */
  simpleDefinition: string;
  synonyms: string[];
  exampleSentence: string;
  quizQuestion: string;
  quizChoices: string[];
  /** Absent by design — the answer key never leaves the server until an
   * attempt has been submitted (see routers/vocab.ts). */
}

export interface VocabReviewView {
  quizAttempts: number;
  quizCorrectAt: Date | null;
  pointsAwarded: number;
}

/** Outcome of one submitted quiz attempt, as returned by the server. */
export interface VocabQuizFeedback {
  correct: boolean;
  /** Revealed once the attempt is spent — null while it would still give the
   * answer away. */
  correctIndex: number | null;
  pointsAwarded: number;
  /** True when the answer was right but the daily points cap had been hit. */
  atDailyCap: boolean;
}
