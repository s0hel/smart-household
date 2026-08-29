-- Backfill EventSourceLink rows for events that were synced before this
-- table existed (they only had Event.calendarAccountId/sourceEventId set
-- directly). Without this, a re-sync of any pre-existing connected calendar
-- fails: sync now looks up EventSourceLink first, finds nothing, and tries
-- to INSERT a new Event that collides with the still-present unique
-- constraint on (calendarAccountId, sourceEventId).
INSERT INTO "EventSourceLink" ("id", "eventId", "calendarAccountId", "sourceEventId", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text || "id"),
  "id",
  "calendarAccountId",
  "sourceEventId",
  now()
FROM "Event"
WHERE "calendarAccountId" IS NOT NULL AND "sourceEventId" IS NOT NULL;
