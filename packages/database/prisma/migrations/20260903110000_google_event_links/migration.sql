CREATE TYPE "GoogleCalendarSyncStatus" AS ENUM ('SYNCED', 'FAILED', 'CANCELLED');

ALTER TABLE "interview_rounds"
  ADD COLUMN "google_event_id" TEXT,
  ADD COLUMN "google_sync_status" "GoogleCalendarSyncStatus",
  ADD COLUMN "google_last_synced_at" TIMESTAMPTZ(6);

CREATE INDEX "interview_rounds_google_event_id_idx" ON "interview_rounds"("google_event_id");
