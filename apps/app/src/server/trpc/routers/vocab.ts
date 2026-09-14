import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateVocabWord } from "@household/ai";
import {
  addDaysInTimezone,
  applyDailyCap,
  INITIAL_REVIEW_SCHEDULE,
  qualityForAttempt,
  quizPointsFor,
  scheduleNextReview,
  startOfDayInTimezone,
  vocabReviewAnswerInputSchema,
  VOCAB_REVIEW_POINTS,
  vocabLevelSchema,
  vocabQuizAnswerInputSchema,
  VOCAB_DAILY_GENERATION_CAP,
  VOCAB_DAILY_POINT_CAP,
  VOCAB_READ_POINTS,
  type ReviewSchedule,
  type VocabLevel,
} from "@household/domain";
import type { Prisma, VocabWord } from "@household/db";
import { router, capabilityProcedure } from "../trpc";
import { logAudit } from "../../audit";
import type { Context } from "../context";

type Tx = Prisma.TransactionClient;

/** How many past words to hand the generator as a do-not-repeat list. */
const EXCLUDE_WINDOW = 60;

/** A model handed a long exclude list still repeats itself sometimes, and a
 * structured-output call occasionally comes back malformed. Either way,
 * regenerate rather than persist junk — but bounded, since every attempt is a
 * real LLM round trip. */
const GENERATION_RETRIES = 2;

/**
 * The client never sees `quizAnswerIndex`. The word payload is fetched before
 * the quiz is answered, so shipping the answer key alongside the question
 * would put it one devtools panel away from any kid old enough to be in the
 * ISEE band — which is exactly the audience the quiz is for. The answer is
 * revealed by `answerQuiz`, after the attempt has been recorded.
 */
function toClientWord(word: VocabWord) {
  const { quizAnswerIndex: _answerKey, ...safe } = word;
  return safe;
}

/**
 * Points this person has banked from vocabulary today, used to clamp every
 * subsequent award against the daily cap.
 *
 * Summed from each row's per-day bucket rather than from `pointsAwarded`
 * filtered by `readAt`. The obvious version is wrong in a way that only shows
 * up once reviews exist: the shortest review interval is one day, so a card
 * being reviewed was always *read* on an earlier day, and keying the sum on
 * `readAt` attributes every review's points to a previous day — leaving review
 * earnings entirely uncapped.
 */
async function pointsEarnedToday(tx: Tx, userId: string, dayStart: Date): Promise<number> {
  const agg = await tx.vocabReview.aggregate({
    where: { userId, dailyPointsOn: dayStart },
    _sum: { dailyPoints: true },
  });
  return agg._sum.dailyPoints ?? 0;
}

/**
 * The write needed to bank `points` on a review row today.
 *
 * Rolls the per-day bucket over when the row last earned on an earlier day,
 * so `dailyPoints` always describes `dailyPointsOn` and never leaks yesterday's
 * earnings into today's cap.
 */
function awardPoints(review: { dailyPointsOn: Date | null }, dayStart: Date, points: number) {
  const sameDay = review.dailyPointsOn?.getTime() === dayStart.getTime();
  return {
    pointsAwarded: { increment: points },
    dailyPointsOn: dayStart,
    dailyPoints: sameDay ? { increment: points } : points,
  };
}

/**
 * Fetches this person's review row for a word, creating it with read credit
 * if it doesn't exist yet. Both `markRead` and `answerQuiz` funnel through
 * here so a kid who dives straight at the quiz still gets read credit, and so
 * the read award can only ever be granted once per card (enforced by the
 * `@@unique([wordId, userId])` index, not by checking-then-writing).
 */
async function ensureReview(tx: Tx, wordId: string, userId: string, dayStart: Date) {
  const existing = await tx.vocabReview.findUnique({ where: { wordId_userId: { wordId, userId } } });
  if (existing) return { review: existing, awarded: 0 };

  const awarded = applyDailyCap(await pointsEarnedToday(tx, userId, dayStart), VOCAB_READ_POINTS);
  try {
    const review = await tx.vocabReview.create({
      data: { wordId, userId, pointsAwarded: awarded, dailyPoints: awarded, dailyPointsOn: dayStart },
    });
    return { review, awarded };
  } catch (error) {
    // Lost the race with a concurrent read/quiz on the same card (an
    // impatient double-tap is the realistic case). The unique index did its
    // job — take the row that won rather than surfacing a constraint error,
    // and award nothing, since the winner already banked the read credit.
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      const review = await tx.vocabReview.findUniqueOrThrow({
        where: { wordId_userId: { wordId, userId } },
      });
      return { review, awarded: 0 };
    }
    throw error;
  }
}

/**
 * Generates a word the household hasn't seen, and persists it.
 *
 * `scheduledFor` non-null marks it as that day's word of the day for its
 * level; null marks a bonus word. The unique index on
 * (householdId, level, scheduledFor) is what makes the scheduled path safe
 * when two devices load the dashboard at the same second — the loser of the
 * race catches P2002 and reads back the winner's row instead of writing a
 * second word for the same day.
 */
async function generateAndStore(
  prisma: Context["prisma"],
  householdId: string,
  level: VocabLevel,
  scheduledFor: Date | null,
): Promise<VocabWord> {
  const recent = await prisma.vocabWord.findMany({
    where: { householdId },
    select: { word: true },
    orderBy: { createdAt: "desc" },
    take: EXCLUDE_WINDOW,
  });
  const exclude = recent.map((r) => r.word);
  const seen = new Set(exclude.map((w) => w.toLowerCase()));

  let content: Awaited<ReturnType<typeof generateVocabWord>> | null = null;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= GENERATION_RETRIES; attempt++) {
    try {
      const candidate = await generateVocabWord({ level, exclude });
      if (!seen.has(candidate.word.toLowerCase())) {
        content = candidate;
        break;
      }
      // A repeat despite the exclude list — name it explicitly next pass.
      exclude.unshift(candidate.word);
    } catch (error) {
      // Generation is one LLM round trip against a schema, and a single
      // malformed response is a normal, transient outcome (a dropped field, a
      // synonym list that collapses to nothing after self-references are
      // filtered). Retry those rather than blanking the household's card.
      // A persistent failure — bad credentials, unreachable provider — still
      // surfaces, because the last error is rethrown once the budget is spent.
      lastError = error;
    }
  }

  if (!content) {
    if (lastError) throw lastError;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Couldn't come up with a new word right now. Try again in a moment.",
    });
  }

  // The model is asked to vary the answer position but tends to settle into
  // one; index 0 on every card teaches kids to tap the first option without
  // reading. Rotating here guarantees the spread regardless of the provider.
  const answer = content.quizChoices[content.quizAnswerIndex]!;
  const others = content.quizChoices.filter((_, i) => i !== content.quizAnswerIndex);
  const insertAt = Math.floor(Math.random() * content.quizChoices.length);
  const quizChoices = [...others.slice(0, insertAt), answer, ...others.slice(insertAt)];

  const data = {
    householdId,
    word: content.word,
    level,
    partOfSpeech: content.partOfSpeech,
    kidDefinition: content.kidDefinition,
    simpleDefinition: content.simpleDefinition,
    synonyms: content.synonyms,
    exampleSentence: content.exampleSentence,
    quizQuestion: content.quizQuestion,
    quizChoices,
    quizAnswerIndex: insertAt,
    scheduledFor,
    generatedBy: `${content.provider}:${content.model}`,
  };

  try {
    return await prisma.vocabWord.create({ data });
  } catch (error) {
    if (
      scheduledFor &&
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      // Another request won the race for today's slot — use its word.
      return await prisma.vocabWord.findFirstOrThrow({
        where: { householdId, level, scheduledFor },
      });
    }
    throw error;
  }
}

/** How many review cards one session serves. A queue of forty is how a kid
 * decides never to open the app again; five is a two-minute warm-up. */
const REVIEW_BATCH_SIZE = 5;

/** A reverse-recall question needs the right word plus three wrong ones. */
const REVIEW_CHOICE_COUNT = 4;

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Applies one graded recall to a review row's schedule.
 *
 * `dayStart` is local midnight for the household, so `nextReviewAt` always
 * lands on a real local midnight and "due today" means the same thing here as
 * it does for chores.
 */
function advanceSchedule(current: ReviewSchedule, correct: boolean, attemptNumber: number, dayStart: Date, timeZone: string) {
  const next = scheduleNextReview(current, qualityForAttempt(correct, attemptNumber));
  return {
    easeFactor: next.easeFactor,
    intervalDays: next.intervalDays,
    repetitions: next.repetitions,
    nextReviewAt: addDaysInTimezone(dayStart, next.intervalDays, timeZone),
  };
}

export const vocabRouter = router({
  /**
   * Today's word for a level, generating it on first request of the day.
   *
   * This is a query that can write, which is unusual — but the dashboard card
   * has to populate on mount with no interaction, and the write is idempotent
   * per (household, level, day) by database constraint. The alternative (a
   * mutation the client fires on load) would be a side effect on every
   * dashboard render instead of one per day.
   */
  today: capabilityProcedure("vocabWord", "read")
    .input(z.object({ level: vocabLevelSchema }))
    .query(async ({ ctx, input }) => {
      const dayStart = startOfDayInTimezone(new Date(), ctx.timezone);

      let word = await ctx.prisma.vocabWord.findFirst({
        where: { householdId: ctx.householdId, level: input.level, scheduledFor: dayStart },
      });
      if (!word) {
        word = await generateAndStore(ctx.prisma, ctx.householdId, input.level, dayStart);
      }

      const review = await ctx.prisma.vocabReview.findUnique({
        where: { wordId_userId: { wordId: word.id, userId: ctx.actor.id } },
      });

      return { word: toClientWord(word), review };
    }),

  /** Every bonus word this household has pulled at a level, newest first,
   * with the acting profile's own review state attached. */
  bonus: capabilityProcedure("vocabWord", "read")
    .input(z.object({ level: vocabLevelSchema, limit: z.number().int().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const words = await ctx.prisma.vocabWord.findMany({
        where: { householdId: ctx.householdId, level: input.level, scheduledFor: null },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { reviews: { where: { userId: ctx.actor.id } } },
      });
      return words.map(({ reviews, ...word }) => ({
        word: toClientWord(word),
        review: reviews[0] ?? null,
      }));
    }),

  /**
   * "Give me another one." Generates an extra word at the same level, outside
   * the one-per-day schedule — the reward for a kid who is on a roll and
   * wants to keep going.
   */
  generate: capabilityProcedure("vocabWord", "create")
    .input(z.object({ level: vocabLevelSchema }))
    .mutation(async ({ ctx, input }) => {
      const dayStart = startOfDayInTimezone(new Date(), ctx.timezone);

      // Each generation is a real LLM call, so this is bounded per person per
      // day independently of the points cap — points stop at the cap but the
      // token spend wouldn't.
      const generatedToday = await ctx.prisma.vocabWord.count({
        where: { householdId: ctx.householdId, scheduledFor: null, createdAt: { gte: dayStart } },
      });
      if (generatedToday >= VOCAB_DAILY_GENERATION_CAP) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `That's ${VOCAB_DAILY_GENERATION_CAP} extra words today — nice work. More tomorrow!`,
        });
      }

      const word = await generateAndStore(ctx.prisma, ctx.householdId, input.level, null);
      await logAudit(ctx.prisma, {
        householdId: ctx.householdId,
        actorId: ctx.actor.id,
        action: "create",
        entityType: "vocabWord",
        entityId: word.id,
        metadata: { word: word.word, level: word.level, bonus: true },
      });
      return { word: toClientWord(word), review: null };
    }),

  /** Credit for reading a card through. Idempotent: re-reading an already
   * reviewed card returns the existing row and awards nothing. */
  markRead: capabilityProcedure("vocabWord", "complete")
    .input(z.object({ wordId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const dayStart = startOfDayInTimezone(new Date(), ctx.timezone);

      // Re-fetch scoped to the household so a word id from another tenant
      // can't be reviewed for points here.
      const word = await ctx.prisma.vocabWord.findFirstOrThrow({
        where: { id: input.wordId, householdId: ctx.householdId },
      });

      const { review, awarded } = await ctx.prisma.$transaction((tx) =>
        ensureReview(tx, word.id, ctx.actor.id, dayStart),
      );

      if (awarded > 0) {
        await logAudit(ctx.prisma, {
          householdId: ctx.householdId,
          actorId: ctx.actor.id,
          action: "complete",
          entityType: "vocabWord",
          entityId: word.id,
          metadata: { word: word.word, stage: "read", pointsAwarded: awarded },
        });
      }

      return { review, pointsAwarded: awarded, atDailyCap: awarded === 0 };
    }),

  /**
   * Scores a quiz attempt. The answer key lives only here — the word payload
   * the client holds has it stripped — so the attempt is recorded before the
   * correct index is ever disclosed.
   */
  answerQuiz: capabilityProcedure("vocabWord", "complete")
    .input(vocabQuizAnswerInputSchema)
    .mutation(async ({ ctx, input }) => {
      const dayStart = startOfDayInTimezone(new Date(), ctx.timezone);

      const word = await ctx.prisma.vocabWord.findFirstOrThrow({
        where: { id: input.wordId, householdId: ctx.householdId },
      });
      if (input.choiceIndex >= word.quizChoices.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That isn't one of the choices" });
      }

      const correct = input.choiceIndex === word.quizAnswerIndex;

      const result = await ctx.prisma.$transaction(async (tx) => {
        const { review } = await ensureReview(tx, word.id, ctx.actor.id, dayStart);

        // Already solved — replaying a solved card must not pay twice.
        if (review.quizCorrectAt) {
          return { review, quizPoints: 0, alreadySolved: true };
        }

        const attemptNumber = review.quizAttempts + 1;
        if (!correct) {
          const updated = await tx.vocabReview.update({
            where: { id: review.id },
            data: { quizAttempts: attemptNumber },
          });
          return { review: updated, quizPoints: 0, alreadySolved: false };
        }

        const quizPoints = applyDailyCap(
          await pointsEarnedToday(tx, ctx.actor.id, dayStart),
          quizPointsFor(attemptNumber),
        );

        // Passing the first quiz is what puts a word into the review
        // schedule. How cleanly it was passed seeds the ease factor, so a
        // word someone nailed immediately starts spacing out faster than one
        // they guessed their way to.
        const schedule = advanceSchedule(
          INITIAL_REVIEW_SCHEDULE,
          true,
          attemptNumber,
          dayStart,
          ctx.timezone,
        );

        const updated = await tx.vocabReview.update({
          where: { id: review.id },
          data: {
            quizAttempts: attemptNumber,
            quizCorrectAt: new Date(),
            ...awardPoints(review, dayStart, quizPoints),
            ...schedule,
          },
        });
        return { review: updated, quizPoints, alreadySolved: false };
      });

      if (result.quizPoints > 0) {
        await logAudit(ctx.prisma, {
          householdId: ctx.householdId,
          actorId: ctx.actor.id,
          action: "complete",
          entityType: "vocabWord",
          entityId: word.id,
          metadata: {
            word: word.word,
            stage: "quiz",
            attempts: result.review.quizAttempts,
            pointsAwarded: result.quizPoints,
          },
        });
      }

      return {
        correct,
        // Only disclosed once the attempt is spent, and only when it no longer
        // gives anything away — on a correct answer, or after enough wrong
        // ones that leaving a kid stuck is the worse outcome.
        correctIndex: correct || result.review.quizAttempts >= 2 ? word.quizAnswerIndex : null,
        review: result.review,
        pointsAwarded: result.quizPoints,
        atDailyCap: correct && !result.alreadySolved && result.quizPoints === 0,
      };
    }),

  /**
   * The review queue for the acting profile: words learned earlier whose next
   * scheduled review has come due.
   *
   * Reviews run in the *reverse* direction from the original quiz — "which of
   * these words means this?" rather than "what does this word mean?" — for two
   * reasons. It exercises recall rather than recognition, which is the harder
   * and more useful direction; and the distractors come from the household's
   * own word bank, so the question is freshly built every time instead of
   * re-showing four fixed options a kid can memorise by position.
   *
   * The response deliberately never says which choice is right: the card is
   * identified by its opaque `reviewId`, and the answer is graded server-side
   * in `answerReview`.
   */
  due: capabilityProcedure("vocabWord", "read")
    .input(z.object({ limit: z.number().int().min(1).max(20).default(REVIEW_BATCH_SIZE) }).optional())
    .query(async ({ ctx, input }) => {
      const dayStart = startOfDayInTimezone(new Date(), ctx.timezone);

      const dueReviews = await ctx.prisma.vocabReview.findMany({
        where: {
          userId: ctx.actor.id,
          nextReviewAt: { not: null, lte: dayStart },
          word: { householdId: ctx.householdId },
        },
        include: { word: true },
        orderBy: { nextReviewAt: "asc" },
        take: input?.limit ?? REVIEW_BATCH_SIZE,
      });

      if (dueReviews.length === 0) return [];

      // One pool for every question in the batch. Words are drawn as
      // distractors from the same level where possible, so the answer can't be
      // spotted just by picking the only hard-looking word in the list.
      const pool = await ctx.prisma.vocabWord.findMany({
        where: { householdId: ctx.householdId },
        select: { id: true, word: true, level: true },
        take: 300,
      });

      return dueReviews.flatMap((review) => {
        const sameLevel = pool.filter((w) => w.id !== review.wordId && w.level === review.word.level);
        const anyLevel = pool.filter((w) => w.id !== review.wordId && w.level !== review.word.level);
        const distractors = [...shuffle(sameLevel), ...shuffle(anyLevel)].slice(0, REVIEW_CHOICE_COUNT - 1);

        // Too few words in the bank to build a real multiple choice yet —
        // skip rather than ship a question with two options, which is a coin
        // flip dressed up as a quiz. The card stays due for next time.
        if (distractors.length < REVIEW_CHOICE_COUNT - 1) return [];

        return [
          {
            reviewId: review.id,
            level: review.word.level,
            prompt: review.word.kidDefinition,
            simplePrompt: review.word.simpleDefinition,
            choices: shuffle([
              { id: review.wordId, word: review.word.word },
              ...distractors.map((w) => ({ id: w.id, word: w.word })),
            ]),
          },
        ];
      });
    }),

  /**
   * Grades one scheduled review and moves the card along its schedule.
   *
   * Single attempt by design — a review is a test of whether the word stuck,
   * and letting someone retry until they hit it would make the interval data
   * meaningless. A miss is not punished beyond that: the word simply comes
   * back tomorrow.
   */
  answerReview: capabilityProcedure("vocabWord", "complete")
    .input(vocabReviewAnswerInputSchema)
    .mutation(async ({ ctx, input }) => {
      const dayStart = startOfDayInTimezone(new Date(), ctx.timezone);

      // Scoped to the acting profile *and* the household, so neither another
      // kid's review row nor another tenant's can be graded from here.
      const review = await ctx.prisma.vocabReview.findFirstOrThrow({
        where: { id: input.reviewId, userId: ctx.actor.id, word: { householdId: ctx.householdId } },
        include: { word: true },
      });

      // One review per card per day. Without this, replaying the same
      // reviewId is an unlimited points faucet — the daily cap bounds the
      // damage but the schedule would still be driven by repeated grading of
      // a card the reader has already seen the answer to.
      if (review.lastReviewedAt && review.lastReviewedAt >= dayStart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You've already reviewed this word today — it'll come back around.",
        });
      }

      const correct = input.chosenWordId === review.wordId;
      const schedule = advanceSchedule(review, correct, 1, dayStart, ctx.timezone);

      const points = correct
        ? applyDailyCap(
            await pointsEarnedToday(ctx.prisma, ctx.actor.id, dayStart),
            VOCAB_REVIEW_POINTS,
          )
        : 0;

      const updated = await ctx.prisma.vocabReview.update({
        where: { id: review.id },
        data: {
          ...schedule,
          lastReviewedAt: new Date(),
          reviewsPassed: correct ? { increment: 1 } : undefined,
          lapses: correct ? undefined : { increment: 1 },
          ...awardPoints(review, dayStart, points),
        },
      });

      if (points > 0) {
        await logAudit(ctx.prisma, {
          householdId: ctx.householdId,
          actorId: ctx.actor.id,
          action: "complete",
          entityType: "vocabWord",
          entityId: review.wordId,
          metadata: { word: review.word.word, stage: "review", pointsAwarded: points },
        });
      }

      return {
        correct,
        // Always disclosed: the attempt is spent, and a review whose answer
        // stays hidden teaches nothing on the one occasion it mattered most.
        correctWordId: review.wordId,
        correctWord: review.word.word,
        nextReviewAt: updated.nextReviewAt,
        intervalDays: updated.intervalDays,
        pointsAwarded: points,
        atDailyCap: correct && points === 0,
      };
    }),

  /** Progress summary for the acting profile: cards learned, today's earnings
   * and how much headroom is left under the cap. */
  stats: capabilityProcedure("vocabWord", "read").query(async ({ ctx }) => {
    const dayStart = startOfDayInTimezone(new Date(), ctx.timezone);

    const [reviewed, solved, earnedToday, dueNow, scheduled, mastered] = await Promise.all([
      ctx.prisma.vocabReview.count({ where: { userId: ctx.actor.id } }),
      ctx.prisma.vocabReview.count({ where: { userId: ctx.actor.id, quizCorrectAt: { not: null } } }),
      ctx.prisma.vocabReview.aggregate({
        where: { userId: ctx.actor.id, dailyPointsOn: dayStart },
        _sum: { dailyPoints: true },
      }),
      ctx.prisma.vocabReview.count({
        where: { userId: ctx.actor.id, nextReviewAt: { not: null, lte: dayStart } },
      }),
      ctx.prisma.vocabReview.count({ where: { userId: ctx.actor.id, nextReviewAt: { not: null } } }),
      // "Mastered" = survived enough spaced reviews that the gap is now
      // measured in months. Three consecutive passes puts a word past the
      // 16-day interval, which is where recall starts looking durable.
      ctx.prisma.vocabReview.count({ where: { userId: ctx.actor.id, repetitions: { gte: 4 } } }),
    ]);

    const pointsToday = earnedToday._sum.dailyPoints ?? 0;
    return {
      wordsRead: reviewed,
      quizzesPassed: solved,
      pointsToday,
      dailyCap: VOCAB_DAILY_POINT_CAP,
      pointsRemainingToday: Math.max(0, VOCAB_DAILY_POINT_CAP - pointsToday),
      reviewsDue: dueNow,
      wordsInRotation: scheduled,
      wordsMastered: mastered,
    };
  }),
});
