ALTER TABLE "performance_holidays"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "performance_approved_leaves"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TYPE "PerformanceLeaderboardExceptionType" AS ENUM ('EXCLUDE', 'PROVISIONAL');

CREATE TABLE "performance_leaderboard_exceptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bd_id" UUID NOT NULL,
  "type" "PerformanceLeaderboardExceptionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "effective_from" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_by_id" UUID NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "revoked_by_id" UUID,
  "revocation_reason" TEXT,
  "audit_metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "performance_leaderboard_exceptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_leaderboard_exceptions_period_check" CHECK ("expires_at" > "effective_from"),
  CONSTRAINT "performance_leaderboard_exceptions_revocation_check" CHECK (
    ("revoked_at" IS NULL AND "revoked_by_id" IS NULL AND "revocation_reason" IS NULL)
    OR ("revoked_at" IS NOT NULL AND "revoked_by_id" IS NOT NULL AND "revocation_reason" IS NOT NULL)
  )
);

CREATE INDEX "performance_leaderboard_exceptions_bd_id_effective_from_expires_at_idx"
  ON "performance_leaderboard_exceptions"("bd_id", "effective_from", "expires_at");
CREATE INDEX "performance_leaderboard_exceptions_expires_at_revoked_at_idx"
  ON "performance_leaderboard_exceptions"("expires_at", "revoked_at");

ALTER TABLE "performance_leaderboard_exceptions"
  ADD CONSTRAINT "performance_leaderboard_exceptions_bd_id_fkey"
  FOREIGN KEY ("bd_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_leaderboard_exceptions"
  ADD CONSTRAINT "performance_leaderboard_exceptions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_leaderboard_exceptions"
  ADD CONSTRAINT "performance_leaderboard_exceptions_revoked_by_id_fkey"
  FOREIGN KEY ("revoked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
