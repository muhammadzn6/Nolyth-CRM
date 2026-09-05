ALTER TABLE "duplicate_reviews"
  ADD COLUMN "overdue_at" TIMESTAMPTZ(6);

DROP INDEX IF EXISTS "duplicate_reviews_status_expires_at_idx";
CREATE INDEX "duplicate_reviews_status_expires_at_overdue_at_idx"
  ON "duplicate_reviews"("status", "expires_at", "overdue_at");
