-- AlterTable
ALTER TABLE "VocabReview" ADD COLUMN     "dailyPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyPointsOn" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "VocabReview_userId_dailyPointsOn_idx" ON "VocabReview"("userId", "dailyPointsOn");
