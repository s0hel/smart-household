/**
 * Scoring rules for the "word of the day" feature. Kept here (rather than in
 * the router) so the server awards points and the client explains them from
 * one source — a card that promises "+5" and then banks 2 is worse than no
 * points at all to the kid looking at it.
 */

export type VocabLevel = "JUNIOR" | "ISEE";

export const VOCAB_LEVELS: VocabLevel[] = ["JUNIOR", "ISEE"];

export const VOCAB_LEVEL_LABELS: Record<VocabLevel, string> = {
  JUNIOR: "Junior",
  ISEE: "ISEE",
};

export const VOCAB_LEVEL_DESCRIPTIONS: Record<VocabLevel, string> = {
  JUNIOR: "Around 1st grade",
  ISEE: "ISEE vocabulary, around 6th grade",
};

/** Credit for opening a card and reading it through. Deliberately small: the
 * quiz is where the learning is, reading is just the ante. */
export const VOCAB_READ_POINTS = 2;

/** Getting the comprehension check right the first time. */
export const VOCAB_QUIZ_POINTS_FIRST_TRY = 5;

/** Getting there after a wrong guess. Still positive — a kid who works out
 * the right answer on the second try has learned the word, and zeroing them
 * out teaches them to stop trying. */
export const VOCAB_QUIZ_POINTS_RETRY = 2;

/**
 * Ceiling on points a single person can bank from vocabulary in one day.
 * Bonus words are generated on demand and are effectively unlimited, so
 * without a cap a kid could out-earn every chore in the house by tapping
 * "another word" for ten minutes. Words past the cap still generate, still
 * get reviewed, and still count as learned — they just stop paying.
 */
export const VOCAB_DAILY_POINT_CAP = 20;

/** Ceiling on *generations* per person per day. Each one is a real LLM call,
 * so this bounds token spend independently of the points cap. */
export const VOCAB_DAILY_GENERATION_CAP = 12;

export function quizPointsFor(attemptNumber: number): number {
  return attemptNumber <= 1 ? VOCAB_QUIZ_POINTS_FIRST_TRY : VOCAB_QUIZ_POINTS_RETRY;
}

/**
 * Clamps a prospective award to whatever room is left under the daily cap.
 * Returns 0 once the cap is reached rather than refusing the action, so the
 * review itself always succeeds.
 */
export function applyDailyCap(pointsAlreadyEarnedToday: number, wantedPoints: number): number {
  const remaining = Math.max(0, VOCAB_DAILY_POINT_CAP - pointsAlreadyEarnedToday);
  return Math.min(remaining, wantedPoints);
}
