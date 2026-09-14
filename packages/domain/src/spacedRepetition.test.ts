import { describe, expect, it } from "vitest";
import {
  INITIAL_REVIEW_SCHEDULE,
  MAX_INTERVAL_DAYS,
  MIN_EASE_FACTOR,
  qualityForAttempt,
  REVIEW_QUALITY,
  scheduleNextReview,
  type ReviewSchedule,
} from "./spacedRepetition";

/** Runs a card through a sequence of graded recalls, as a real reviewer would. */
function replay(grades: number[], from: ReviewSchedule = INITIAL_REVIEW_SCHEDULE) {
  return grades.reduce(
    (schedule, quality) => scheduleNextReview(schedule, quality as never),
    from,
  );
}

/** The gaps a card would actually be reviewed at, in order. */
function intervals(grades: number[], from: ReviewSchedule = INITIAL_REVIEW_SCHEDULE) {
  const out: number[] = [];
  let schedule = from;
  for (const quality of grades) {
    schedule = scheduleNextReview(schedule, quality as never);
    out.push(schedule.intervalDays);
  }
  return out;
}

const { PERFECT, HESITANT, STRUGGLED, FAILED } = REVIEW_QUALITY;

describe("qualityForAttempt", () => {
  it("grades a first-try recall as perfect", () => {
    expect(qualityForAttempt(true, 1)).toBe(PERFECT);
  });

  it("grades a recall after one wrong guess as hesitant", () => {
    expect(qualityForAttempt(true, 2)).toBe(HESITANT);
  });

  it("grades any later recall as a struggle, however many attempts it took", () => {
    expect(qualityForAttempt(true, 3)).toBe(STRUGGLED);
    expect(qualityForAttempt(true, 9)).toBe(STRUGGLED);
  });

  it("grades a miss as failed regardless of attempt number", () => {
    expect(qualityForAttempt(false, 1)).toBe(FAILED);
    expect(qualityForAttempt(false, 4)).toBe(FAILED);
  });

  // The single property the whole algorithm pivots on: SM-2 treats >= 3 as a
  // pass and < 3 as a lapse. If a "correct" answer ever graded below 3, every
  // successful recall would reset its own schedule.
  it("keeps every correct grade at or above SM-2's pass threshold, and every miss below it", () => {
    for (const attempt of [1, 2, 3, 10]) {
      expect(qualityForAttempt(true, attempt)).toBeGreaterThanOrEqual(3);
      expect(qualityForAttempt(false, attempt)).toBeLessThan(3);
    }
  });
});

describe("scheduleNextReview — the success ladder", () => {
  it("brings a newly learned word back tomorrow", () => {
    const next = scheduleNextReview(INITIAL_REVIEW_SCHEDULE, PERFECT);
    expect(next.intervalDays).toBe(1);
    expect(next.repetitions).toBe(1);
  });

  it("jumps to next week after a second success, without consulting the ease factor", () => {
    // SM-2 fixes the first two gaps; a card with an unusually high or low ease
    // still gets 1 then 6, because two data points aren't enough to trust.
    const easy = replay([PERFECT], { ...INITIAL_REVIEW_SCHEDULE, easeFactor: 4 });
    const hard = replay([PERFECT], { ...INITIAL_REVIEW_SCHEDULE, easeFactor: MIN_EASE_FACTOR });
    expect(scheduleNextReview(easy, PERFECT).intervalDays).toBe(6);
    expect(scheduleNextReview(hard, PERFECT).intervalDays).toBe(6);
  });

  it("multiplies the previous gap by the ease factor from the third success on", () => {
    const after2 = replay([PERFECT, PERFECT]);
    expect(after2.intervalDays).toBe(6);

    const after3 = scheduleNextReview(after2, PERFECT);
    // 6 days at the ease accumulated over two perfect recalls (2.5 -> 2.7).
    expect(after3.intervalDays).toBe(Math.round(6 * after2.easeFactor));
    expect(after3.intervalDays).toBe(16);
  });

  it("produces an expanding curve across a run of perfect recalls", () => {
    expect(intervals(Array(5).fill(PERFECT))).toEqual([1, 6, 16, 45, 131]);
  });

  it("counts consecutive successes", () => {
    expect(replay([PERFECT, PERFECT, PERFECT]).repetitions).toBe(3);
  });
});

describe("scheduleNextReview — lapses", () => {
  it("brings a missed word back tomorrow", () => {
    const mature = replay([PERFECT, PERFECT, PERFECT]);
    expect(mature.intervalDays).toBe(16);
    expect(scheduleNextReview(mature, FAILED).intervalDays).toBe(1);
  });

  it("resets the success streak", () => {
    const lapsed = scheduleNextReview(replay([PERFECT, PERFECT, PERFECT]), FAILED);
    expect(lapsed.repetitions).toBe(0);
  });

  // The deliberate deviation from "start over": a word known for months and
  // slipped on once is not as hard as a brand new one, so it keeps its ease
  // (minus SM-2's penalty) and re-climbs the ladder faster than a fresh card.
  it("carries the accumulated ease forward, less the penalty, rather than resetting it", () => {
    const mature = replay([PERFECT, PERFECT, PERFECT]);
    const lapsed = scheduleNextReview(mature, FAILED);
    expect(lapsed.easeFactor).toBeCloseTo(mature.easeFactor - 0.32, 5);
  });

  // Note the threshold: three perfect recalls only reach ease 2.8, so one
  // lapse (-0.32) lands at 2.48 — marginally *below* a fresh card. The "knows
  // it, slipped once" advantage only exists once a card has built up real
  // ease, which is the case the design is actually about.
  it("re-climbs faster than a fresh card once the word is well established", () => {
    const established = Array(6).fill(PERFECT);
    const relearned = replay([...established, FAILED, PERFECT, PERFECT, PERFECT]);
    const fresh = replay([PERFECT, PERFECT, PERFECT]);
    expect(relearned.intervalDays).toBeGreaterThan(fresh.intervalDays);
  });
});

describe("scheduleNextReview — ease factor movement", () => {
  it("rises on perfect recall", () => {
    const next = scheduleNextReview(INITIAL_REVIEW_SCHEDULE, PERFECT);
    expect(next.easeFactor).toBeCloseTo(2.6, 5);
  });

  // Non-obvious and worth pinning: SM-2's adjustment for quality 4 is exactly
  // zero, so getting there after one wrong guess is treated as neither
  // evidence that the word is easier nor that it is harder.
  it("leaves ease untouched on a hesitant recall", () => {
    const next = scheduleNextReview(INITIAL_REVIEW_SCHEDULE, HESITANT);
    expect(next.easeFactor).toBeCloseTo(INITIAL_REVIEW_SCHEDULE.easeFactor, 5);
  });

  it("falls on a struggled recall", () => {
    const next = scheduleNextReview(INITIAL_REVIEW_SCHEDULE, STRUGGLED);
    expect(next.easeFactor).toBeCloseTo(2.36, 5);
  });

  it("falls hardest on a miss", () => {
    const next = scheduleNextReview(INITIAL_REVIEW_SCHEDULE, FAILED);
    expect(next.easeFactor).toBeCloseTo(2.18, 5);
  });

  // Without the floor, a word someone keeps failing drives its ease toward
  // zero and then schedules itself into a same-day loop that jams the queue.
  it("never falls below the floor, however often the word is missed", () => {
    const hopeless = replay(Array(30).fill(FAILED));
    expect(hopeless.easeFactor).toBe(MIN_EASE_FACTOR);
  });
});

describe("scheduleNextReview — bounds", () => {
  it("caps the gap so a well-known word stays in rotation", () => {
    const veteran = replay(Array(12).fill(PERFECT));
    expect(veteran.intervalDays).toBe(MAX_INTERVAL_DAYS);
  });

  it("never schedules a review sooner than tomorrow", () => {
    const grades = [PERFECT, FAILED, STRUGGLED, HESITANT, FAILED, FAILED, PERFECT];
    let schedule = INITIAL_REVIEW_SCHEDULE;
    for (const quality of grades) {
      schedule = scheduleNextReview(schedule, quality as never);
      expect(schedule.intervalDays).toBeGreaterThanOrEqual(1);
      expect(schedule.intervalDays).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
    }
  });

  it("always returns whole days", () => {
    for (const days of intervals(Array(8).fill(PERFECT))) {
      expect(Number.isInteger(days)).toBe(true);
    }
  });
});

describe("scheduleNextReview — purity", () => {
  // The router spreads the result straight into a Prisma update, so a mutated
  // input would quietly corrupt the row it was read from.
  it("does not mutate the schedule it is given", () => {
    const current: ReviewSchedule = { easeFactor: 2.5, intervalDays: 6, repetitions: 2 };
    const snapshot = { ...current };
    scheduleNextReview(current, PERFECT);
    expect(current).toEqual(snapshot);
  });

  it("leaves the exported initial schedule untouched", () => {
    const snapshot = { ...INITIAL_REVIEW_SCHEDULE };
    replay(Array(5).fill(PERFECT));
    expect(INITIAL_REVIEW_SCHEDULE).toEqual(snapshot);
  });
});

describe("scheduleNextReview — driven by real quiz outcomes", () => {
  it("spaces a first-try correct answer further than one that took three tries", () => {
    const clean = replay([qualityForAttempt(true, 1), qualityForAttempt(true, 1), qualityForAttempt(true, 1)]);
    const messy = replay([qualityForAttempt(true, 3), qualityForAttempt(true, 3), qualityForAttempt(true, 3)]);
    expect(clean.intervalDays).toBeGreaterThan(messy.intervalDays);
  });

  it("treats a missed review as a lapse when graded through qualityForAttempt", () => {
    const mature = replay([PERFECT, PERFECT, PERFECT]);
    const missed = scheduleNextReview(mature, qualityForAttempt(false, 1));
    expect(missed.repetitions).toBe(0);
    expect(missed.intervalDays).toBe(1);
  });
});
