-- CreateIndex
CREATE UNIQUE INDEX "CalendarAccount_householdId_ownerId_provider_key" ON "CalendarAccount"("householdId", "ownerId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Event_calendarAccountId_sourceEventId_key" ON "Event"("calendarAccountId", "sourceEventId");

