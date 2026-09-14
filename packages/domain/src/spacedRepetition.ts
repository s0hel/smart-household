/**
 * SM-2 scheduling for vocabulary review.
 *
 * A word that is quizzed once and never seen again is forgotten within a week,
 * which makes a word-of-the-day feature a word *generator* rather than
 * something that teaches. SM-2 is the classic SuperMemo-2 algorithm: each time
 * a word is recalled successfully the gap before its next review grows, scaled
 * by a per-word "ease factor" that tracks how hard that particular word has
 * been for that particular person. Getting it wrong collapses the gap back to
 * a day.
 *
 * Kept as pure functions with no clock and no timezone so the scheduling rules
 * can be reasoned about (and tested) on their own; the caller turns
 * `intervalDays` into a real date.
 */

export interface ReviewSchedule {
  /** How readily this person recalls this word. Higher = longer gaps. */
  easeFactor: number;
  /** Gap, in days, that produced the review just graded. */
  intervalDays: number;
  /** Consecutive successful recalls. Reset to 0 by any failure. */
  repetitions: number;
}

/** A fresh card, before its first successful recall. */
export const INITIAL_REVIEW_SCHEDULE: ReviewSchedule = {
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
};

/**
 * SM-2's floor on the ease factor. Without it a word someone keeps failing
 * spirals toward a zero-day interval and jams the review queue forever.
 */
export const MIN_EASE_FACTOR = 1.3;

/**
 * Ceiling on the gap between reviews. Pure SM-2 will happily schedule a
 * well-known word years out; for a kid working toward a test that is the same
 * as dropping it. Six months keeps everything in rotation.
 */
export const MAX_INTERVAL_DAYS = 180;

/**
 * Recall quality, 0-5 in SM-2's terms. Only the values this app can actually
 * observe are named — the quiz is multiple choice, so there is no way to tell
 * "recalled with difficulty" from "recalled easily" beyond how many attempts
 * it took.
 */
export const REVIEW_QUALITY = {
  /** Right on the first attempt. */
  PERFECT: 5,
  /** Right, but only after a wrong guess. */
  HESITANT: 4,
  /** Right after more than one wrong guess. */
  STRUGGLED: 3,
  /** Wrong. Below SM-2's passing threshold of 3, so the schedule resets. */
  FAILED: 2,
} as const;

export type ReviewQuality = (typeof REVIEW_QUALITY)[keyof typeof REVIEW_QUALITY];

/** Maps a graded attempt onto SM-2's quality scale. */
export function qualityForAttempt(correct: boolean, attemptNumber: number): ReviewQuality {
  if (!correct) return REVIEW_QUALITY.FAILED;
  if (attemptNumber <= 1) return REVIEW_QUALITY.PERFECT;
  if (attemptNumber === 2) return REVIEW_QUALITY.HESITANT;
  return REVIEW_QUALITY.STRUGGLED;
}

/**
 * Advances a card's schedule after one graded recall.
 *
 * Returns the next schedule; the caller converts `intervalDays` into a
 * calendar date. A failure (`quality < 3`) resets the streak and brings the
 * word back tomorrow, but deliberately keeps the accumulated ease factor
 * (minus SM-2's penalty) rather than resetting it — a word someone has known
 * for months and slipped on once is not as hard as a brand new one.
 */
export function scheduleNextReview(current: ReviewSchedule, quality: ReviewQuality): ReviewSchedule {
  const passed = quality >= 3;

  let intervalDays: number;
  let repetitions: number;

  if (!passed) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = current.repetitions + 1;
    if (current.repetitions === 0) {
      intervalDays = 1;
    } else if (current.repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(current.intervalDays * current.easeFactor);
    }
  }

  // SM-2's ease adjustment, applied on every grade including failures.
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const easeFactor = Math.max(MIN_EASE_FACTOR, current.easeFactor + delta);

  return {
    easeFactor,
    intervalDays: Math.min(MAX_INTERVAL_DAYS, Math.max(1, intervalDays)),
    repetitions,
  };
}
