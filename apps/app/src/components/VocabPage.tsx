"use client";

import * as React from "react";
import { VOCAB_LEVEL_DESCRIPTIONS, VOCAB_LEVEL_LABELS, type VocabLevel } from "@household/domain";
import { Card, cn } from "@household/ui";
import { trpc } from "@/lib/trpc";
import { ProfileSwitcher } from "@/components/ProfileSwitcher";
import { ConnectedVocabCard, WordOfTheDay, type VocabCard } from "@/components/WordOfTheDay";

const LEVELS: VocabLevel[] = ["JUNIOR", "ISEE"];

function StatTile({ value, label, tone = "default" }: { value: string; label: string; tone?: "default" | "gold" }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "gold" ? "border-gold-200 bg-gold-50" : "border-ink-200 bg-surface",
      )}
    >
      <p
        className={cn(
          "font-display text-3xl italic tabular-nums",
          tone === "gold" ? "text-gold-700" : "text-sapphire-800",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
    </div>
  );
}

/**
 * One entry in the word bank. Collapsed to a single line until opened, so a
 * household with fifty banked words still scans in one screen — and only the
 * opened one mounts a full interactive card, which keeps the quiz state of
 * every other entry out of the tree.
 */
function WordBankEntry({ entry, onReviewChange }: { entry: VocabCard; onReviewChange: (review: VocabCard["review"]) => void }) {
  const [open, setOpen] = React.useState(false);
  const solved = Boolean(entry.review?.quizCorrectAt);

  if (open) {
    return (
      <div>
        <ConnectedVocabCard card={entry} onReviewChange={onReviewChange} eyebrow="Bonus word" compact />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-1.5 text-xs font-medium text-sapphire-600 hover:underline"
        >
          ↑ Collapse
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex w-full items-center gap-3 rounded-2xl border border-ink-200 bg-surface px-4 py-3 text-left transition-colors hover:border-sapphire-300"
    >
      <span className="font-display text-lg italic text-sapphire-800">{entry.word.word}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink-500">{entry.word.kidDefinition}</span>
      {solved ? (
        <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">✓</span>
      ) : entry.review ? (
        <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500">read</span>
      ) : (
        <span className="shrink-0 rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-bold text-gold-700">new</span>
      )}
    </button>
  );
}

function WordBank() {
  const [level, setLevel] = React.useState<VocabLevel>("JUNIOR");
  const utils = trpc.useUtils();
  const bonusQuery = trpc.vocab.bonus.useQuery({ level, limit: 25 });
  const entries = (bonusQuery.data ?? []) as VocabCard[];

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Word bank</h2>
          <p className="text-xs text-ink-400">Every extra word your family has pulled. Open one to review it.</p>
        </div>
        <div className="flex shrink-0 rounded-full bg-ink-100 p-0.5">
          {LEVELS.map((option) => (
            <button
              key={option}
              type="button"
              title={VOCAB_LEVEL_DESCRIPTIONS[option]}
              onClick={() => setLevel(option)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                level === option ? "bg-sapphire-600 text-white shadow-sm" : "text-ink-500 hover:text-ink-700",
              )}
            >
              {VOCAB_LEVEL_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {bonusQuery.isPending ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink-400">
          No extra words yet at this level. Hit <span className="font-semibold">Another word</span> above when
          you&apos;re on a roll.
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <WordBankEntry
              key={entry.word.id}
              entry={entry}
              onReviewChange={() => void utils.vocab.bonus.invalidate()}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export function VocabPage() {
  const statsQuery = trpc.vocab.stats.useQuery();
  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl italic text-sapphire-800">Word of the Day</h1>
          <p className="text-sm text-ink-500">Read it, quiz yourself, earn points.</p>
        </div>
        <ProfileSwitcher variant="pill" dropDirection="down" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value={String(stats?.wordsRead ?? 0)} label="Words read" />
        <StatTile value={String(stats?.quizzesPassed ?? 0)} label="Quizzes passed" />
        <StatTile value={String(stats?.pointsToday ?? 0)} label="Points today" tone="gold" />
        <StatTile
          value={String(stats?.pointsRemainingToday ?? 0)}
          label={`Left of ${stats?.dailyCap ?? 0}`}
        />
      </div>

      <WordOfTheDay />

      <WordBank />
    </div>
  );
}
