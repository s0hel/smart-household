-- AlterTable
ALTER TABLE "VocabReview" ADD COLUMN     "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
ADD COLUMN     "intervalDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN     "nextReviewAt" TIMESTAMP(3),
ADD COLUMN     "repetitions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewsPassed" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "VocabReview_userId_nextReviewAt_idx" ON "VocabReview"("userId", "nextReviewAt");
