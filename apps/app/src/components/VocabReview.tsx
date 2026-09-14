"use client";

import * as React from "react";
import { can, type Role } from "@household/domain";
import { VocabReviewCard, type VocabReviewFeedback, type VocabReviewQuestionView } from "@household/ui";
import { trpc } from "@/lib/trpc";

/**
 * A spaced-repetition review session.
 *
 * Words enter the queue once their first quiz is passed and come back on an
 * expanding schedule (see packages/domain/src/spacedRepetition.ts). The queue
 * is fetched once per session and then walked locally — refetching between
 * cards would reshuffle the batch underfoot, and answering a card removes it
 * from the server's due set anyway.
 */
export function VocabReview({
  hideWhenEmpty = false,
  className,
}: {
  /** Dashboard use: render nothing at all when the queue is empty, rather
   * than spending a card on "nothing due". The dedicated page wants the
   * opposite — it should explain that reviews exist even on a quiet day. */
  hideWhenEmpty?: boolean;
  className?: string;
}) {
  const utils = trpc.useUtils();
  const meQuery = trpc.household.me.useQuery();
  const dueQuery = trpc.vocab.due.useQuery(undefined, { refetchOnWindowFocus: false });

  const [index, setIndex] = React.useState(0);
  const [feedback, setFeedback] = React.useState<Record<string, VocabReviewFeedback>>({});
  const [finished, setFinished] = React.useState(false);

  const answer = trpc.vocab.answerReview.useMutation({
    onSuccess: (data, variables) => {
      setFeedback((prev) => ({
        ...prev,
        [variables.reviewId]: {
          correct: data.correct,
          correctWordId: data.correctWordId,
          correctWord: data.correctWord,
          pointsAwarded: data.pointsAwarded,
          intervalDays: data.intervalDays,
          atDailyCap: data.atDailyCap,
        },
      }));
      // Points land in the shared wallet, and the stats tiles count what's
      // left due — both are stale the moment a card is graded.
      void utils.rewardRedemption.balances.invalidate();
      void utils.vocab.stats.invalidate();
    },
  });

  const questions = (dueQuery.data ?? []) as VocabReviewQuestionView[];
  const current = questions[index];
  const answeredCount = Object.keys(feedback).length;
  const correctCount = Object.values(feedback).filter((f) => f.correct).length;

  function handleNext() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
    } else {
      setFinished(true);
      // Only now refetch: the queue this session worked through is spent, and
      // anything still due (a card skipped for want of distractors) should
      // reappear on the next pass.
      void utils.vocab.due.invalidate();
    }
  }

  function startAgain() {
    setIndex(0);
    setFeedback({});
    setFinished(false);
    void utils.vocab.due.refetch();
  }

  // Roles that may look but not earn have nothing to do here.
  if (!can((meQuery.data?.role ?? "READONLY") as Role, "vocabWord", "complete")) return null;

  if (dueQuery.isPending) {
    return (
      <div className={className}>
        <div className="animate-pulse rounded-2xl border border-ink-200 bg-surface p-5">
          <div className="h-3 w-24 rounded bg-ink-200" />
          <div className="mt-4 h-3 w-3/4 rounded bg-ink-200" />
          <div className="mt-4 h-9 w-full rounded bg-ink-100" />
          <div className="mt-2 h-9 w-full rounded bg-ink-100" />
        </div>
      </div>
    );
  }

  if (finished || questions.length === 0) {
    // Nothing due is the good outcome, not an empty state to apologise for —
    // it means every word in rotation is still inside its interval.
    const nothingDue = questions.length === 0;
    if (nothingDue && hideWhenEmpty) return null;
    return (
      <div className={className}>
        <div className="rounded-2xl border border-ink-200 bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-gold-700">🔁 Review</p>
          {nothingDue ? (
            <p className="mt-2 text-sm text-ink-500">
              Nothing due right now — every word you&apos;ve learned is still fresh. New ones join the
              review schedule once you pass their quiz.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm font-semibold text-ink-800">
                🎉 Review done — {correctCount} of {answeredCount} right.
              </p>
              <p className="mt-1 text-sm text-ink-500">
                Each word you remembered comes back a little later next time.
              </p>
              <button
                type="button"
                onClick={startAgain}
                className="mt-3 text-xs font-medium text-sapphire-600 hover:underline"
              >
                Check for more →
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className={className}>
      <VocabReviewCard
        question={current}
        position={index + 1}
        total={questions.length}
        feedback={feedback[current.reviewId] ?? null}
        onAnswer={(chosenWordId) => answer.mutate({ reviewId: current.reviewId, chosenWordId })}
        onNext={handleNext}
        isSubmitting={answer.isPending}
        isLast={index + 1 === questions.length}
      />
      {answer.error && <p className="mt-2 text-xs font-medium text-ink-500">{answer.error.message}</p>}
    </div>
  );
}
