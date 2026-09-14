-- AlterTable
ALTER TABLE "CalendarAccount" ADD COLUMN     "channelExpiresAt" TIMESTAMP(3),
ADD COLUMN     "channelId" TEXT,
ADD COLUMN     "channelResourceId" TEXT,
ADD COLUMN     "channelToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CalendarAccount_channelId_key" ON "CalendarAccount"("channelId");
