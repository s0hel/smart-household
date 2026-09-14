-- CreateEnum
CREATE TYPE "VocabLevel" AS ENUM ('JUNIOR', 'ISEE');

-- CreateTable
CREATE TABLE "VocabWord" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "level" "VocabLevel" NOT NULL,
    "partOfSpeech" TEXT NOT NULL,
    "kidDefinition" TEXT NOT NULL,
    "simpleDefinition" TEXT NOT NULL,
    "synonyms" TEXT[],
    "exampleSentence" TEXT NOT NULL,
    "quizQuestion" TEXT NOT NULL,
    "quizChoices" TEXT[],
    "quizAnswerIndex" INTEGER NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "generatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabReview" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quizAttempts" INTEGER NOT NULL DEFAULT 0,
    "quizCorrectAt" TIMESTAMP(3),
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VocabReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VocabWord_householdId_level_createdAt_idx" ON "VocabWord"("householdId", "level", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VocabWord_householdId_level_scheduledFor_key" ON "VocabWord"("householdId", "level", "scheduledFor");

-- CreateIndex
CREATE INDEX "VocabReview_userId_idx" ON "VocabReview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VocabReview_wordId_userId_key" ON "VocabReview"("wordId", "userId");

-- AddForeignKey
ALTER TABLE "VocabWord" ADD CONSTRAINT "VocabWord_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabReview" ADD CONSTRAINT "VocabReview_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "VocabWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VocabReview" ADD CONSTRAINT "VocabReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
