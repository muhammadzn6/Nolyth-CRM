CREATE TYPE "CandidateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "ProfileStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "CompensationPeriod" AS ENUM ('HOURLY', 'YEARLY');

ALTER TABLE "candidates"
  ADD COLUMN "linked_user_id" UUID,
  ADD COLUMN "archived_by_id" UUID,
  ADD COLUMN "preferred_name" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN "location" TEXT,
  ADD COLUMN "internal_notes" TEXT,
  ADD COLUMN "status" "CandidateStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archived_at" TIMESTAMPTZ(6),
  ADD COLUMN "archive_reason" TEXT;

ALTER TABLE "candidates"
  ADD CONSTRAINT "candidates_linked_user_id_fkey"
    FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "candidates_archived_by_id_fkey"
    FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "candidates_archive_state_check" CHECK (
    ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL AND "archive_reason" IS NOT NULL)
    OR ("status" <> 'ARCHIVED' AND "archived_at" IS NULL)
  );

CREATE UNIQUE INDEX "candidates_linked_user_id_key" ON "candidates"("linked_user_id");
CREATE INDEX "candidates_status_archived_at_idx" ON "candidates"("status", "archived_at");
CREATE INDEX "candidates_archived_by_id_idx" ON "candidates"("archived_by_id");

ALTER TABLE "profiles"
  ADD COLUMN "archived_by_id" UUID,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "status" "ProfileStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "default_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN "target_compensation" DECIMAL(14,2),
  ADD COLUMN "compensation_period" "CompensationPeriod",
  ADD COLUMN "target_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "preferred_locations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "workplace_preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "job_type_preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "contract_preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "archived_at" TIMESTAMPTZ(6),
  ADD COLUMN "archive_reason" TEXT;

UPDATE "profiles"
SET
  "name" = 'Primary profile',
  "status" = CASE WHEN "is_active" THEN 'ACTIVE' ELSE 'PAUSED' END::"ProfileStatus";

ALTER TABLE "profiles"
  ALTER COLUMN "name" SET NOT NULL,
  DROP COLUMN "is_active";

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_archived_by_id_fkey"
    FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "profiles_default_currency_check" CHECK ("default_currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "profiles_archive_state_check" CHECK (
    ("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL AND "archive_reason" IS NOT NULL)
    OR ("status" <> 'ARCHIVED' AND "archived_at" IS NULL)
  );

DROP INDEX "profiles_candidate_id_idx";
CREATE INDEX "profiles_candidate_id_status_idx" ON "profiles"("candidate_id", "status");
CREATE INDEX "profiles_status_archived_at_idx" ON "profiles"("status", "archived_at");
CREATE INDEX "profiles_archived_by_id_idx" ON "profiles"("archived_by_id");
