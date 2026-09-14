"use client";

import * as React from "react";
import {
  can,
  VOCAB_QUIZ_POINTS_FIRST_TRY,
  VOCAB_READ_POINTS,
  type Role,
  type VocabLevel,
} from "@household/domain";
import { WordOfTheDayCard, type VocabQuizFeedback, type VocabWordView } from "@household/ui";
import { trpc } from "@/lib/trpc";

export interface VocabCard {
  word: VocabWordView;
  review: { quizAttempts: number; quizCorrectAt: Date | null; pointsAwarded: number } | null;
}

/**
 * One vocabulary card wired to the read/quiz mutations.
 *
 * Split out from `WordOfTheDay` so the same earning behaviour works for
 * today's word and for any card in the word bank — a bonus word a kid pulled
 * and didn't finish is still worth points when they come back to it.
 *
 * The card's review state is owned by the caller (`onReviewChange`) because
 * where it lives differs by caller: today's word comes from a tRPC query that
 * can simply be invalidated, while a freshly generated bonus word only exists
 * in React state until the next `bonus` refetch.
 */
export function ConnectedVocabCard({
  card,
  onReviewChange,
  level,
  onLevelChange,
  onAnotherWord,
  isGenerating,
  eyebrow,
  compact,
}: {
  card: VocabCard;
  onReviewChange: (review: VocabCard["review"]) => void;
  level?: VocabLevel;
  onLevelChange?: (level: VocabLevel) => void;
  onAnotherWord?: () => void;
  isGenerating?: boolean;
  eyebrow?: string;
  compact?: boolean;
}) {
  // Feedback is stored with the word it belongs to rather than cleared by an
  // effect when the word changes: a different word means a different question,
  // and feedback left over from the previous one would mark the wrong option
  // green for the render between the swap and the effect firing.
  const [feedback, setFeedback] = React.useState<{ wordId: string; result: VocabQuizFeedback } | null>(null);
  const activeFeedback = feedback?.wordId === card.word.id ? feedback.result : null;

  const utils = trpc.useUtils();
  const meQuery = trpc.household.me.useQuery();

  function afterEarning(review: VocabCard["review"]) {
    onReviewChange(review);
    // Vocabulary points land in the same wallet as chores, so every screen
    // showing a balance is now stale.
    void utils.rewardRedemption.balances.invalidate();
    void utils.vocab.stats.invalidate();
  }

  const markRead = trpc.vocab.markRead.useMutation({ onSuccess: (data) => afterEarning(data.review) });
  const answerQuiz = trpc.vocab.answerQuiz.useMutation({
    onSuccess: (data) => {
      setFeedback({
        wordId: card.word.id,
        result: {
          correct: data.correct,
          correctIndex: data.correctIndex,
          pointsAwarded: data.pointsAwarded,
          atDailyCap: data.atDailyCap,
        },
      });
      afterEarning(data.review);
    },
  });

  const role = (meQuery.data?.role ?? "READONLY") as Role;

  return (
    <WordOfTheDayCard
      word={card.word}
      review={card.review}
      level={level}
      onLevelChange={onLevelChange}
      onMarkRead={() => markRead.mutate({ wordId: card.word.id })}
      onAnswerQuiz={(choiceIndex) => answerQuiz.mutate({ wordId: card.word.id, choiceIndex })}
      onAnotherWord={onAnotherWord}
      quizFeedback={activeFeedback}
      readPoints={VOCAB_READ_POINTS}
      quizPoints={VOCAB_QUIZ_POINTS_FIRST_TRY}
      canEarn={can(role, "vocabWord", "complete")}
      isMarkingRead={markRead.isPending}
      isAnsweringQuiz={answerQuiz.isPending}
      isGenerating={isGenerating}
      eyebrow={eyebrow}
      compact={compact}
    />
  );
}

/**
 * Today's vocabulary card.
 *
 * Both levels run every day and the toggle is always available (a household
 * has kids at both ends), so this owns only which level is showing and which
 * card is on screen — today's scheduled word, or a bonus word pulled with
 * "Another word".
 */
export function WordOfTheDay({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [level, setLevel] = React.useState<VocabLevel>("JUNIOR");
  const [bonus, setBonus] = React.useState<VocabCard | null>(null);

  const utils = trpc.useUtils();
  const meQuery = trpc.household.me.useQuery();

  // Generating a word is an LLM round trip, so this deliberately does not
  // refetch on focus/mount churn — the word changes once a day, and the server
  // decides when. retry: false matches the morning digest: a provider that
  // isn't reachable should surface once, not storm.
  const todayQuery = trpc.vocab.today.useQuery(
    { level },
    { staleTime: 30 * 60 * 1000, retry: false, refetchOnWindowFocus: false },
  );

  const generate = trpc.vocab.generate.useMutation({
    onSuccess: (data) => {
      setBonus(data as VocabCard);
      void utils.vocab.bonus.invalidate();
    },
  });

  function handleLevelChange(next: VocabLevel) {
    setLevel(next);
    setBonus(null);
  }

  const canGenerate = can((meQuery.data?.role ?? "READONLY") as Role, "vocabWord", "create");
  const card: VocabCard | null = bonus ?? (todayQuery.data as VocabCard | undefined) ?? null;

  if (todayQuery.isPending && !bonus) {
    return (
      <div className={className}>
        <div className="animate-pulse rounded-2xl border border-ink-200 bg-surface p-5">
          <div className="h-3 w-28 rounded bg-ink-200" />
          <div className="mt-4 h-8 w-40 rounded bg-ink-200" />
          <div className="mt-4 h-3 w-full rounded bg-ink-200" />
          <div className="mt-2 h-3 w-4/5 rounded bg-ink-200" />
          <div className="mt-4 h-12 w-full rounded bg-ink-100" />
        </div>
      </div>
    );
  }

  if (!card) {
    // Something upstream failed — the model provider, the database, anything.
    // Deliberately does NOT name a cause: this card once told families their
    // "AI provider" was misconfigured when the real problem was an unmigrated
    // database, which sent the person reading it off in the wrong direction.
    // It also doesn't print the error: the server masks internal messages
    // (server/trpc/trpc.ts) and logs the real one, so there is nothing here
    // worth showing and plenty worth leaking.
    return (
      <div className={className}>
        <div className="rounded-2xl border border-ink-200 bg-surface p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-400">📖 Word of the day</p>
          <p className="mt-2 text-sm text-ink-500">
            Today&apos;s word isn&apos;t ready yet. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => void todayQuery.refetch()}
            disabled={todayQuery.isFetching}
            className="mt-3 text-xs font-medium text-sapphire-600 hover:underline disabled:opacity-60"
          >
            {todayQuery.isFetching ? "Trying…" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <ConnectedVocabCard
        card={card}
        onReviewChange={(review) => {
          if (bonus) setBonus({ ...bonus, review });
          else void utils.vocab.today.invalidate();
        }}
        level={level}
        onLevelChange={handleLevelChange}
        onAnotherWord={canGenerate ? () => generate.mutate({ level }) : undefined}
        isGenerating={generate.isPending}
        eyebrow={bonus ? "Bonus word" : "Word of the day"}
        compact={compact}
      />
      {generate.error && <p className="mt-2 text-xs font-medium text-ink-500">{generate.error.message}</p>}
      {bonus && (
        <button
          type="button"
          onClick={() => setBonus(null)}
          className="mt-2 text-xs font-medium text-sapphire-600 hover:underline"
        >
          ← Back to today&apos;s word
        </button>
      )}
    </div>
  );
}
