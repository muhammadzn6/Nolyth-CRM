ALTER TABLE "users"
  ADD COLUMN "password_hash" TEXT,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN "last_login_at" TIMESTAMPTZ(6),
  ADD COLUMN "password_changed_at" TIMESTAMPTZ(6),
  ADD COLUMN "created_by_user_id" UUID;

UPDATE "users"
SET "password_hash" = crypt('rotation-required', gen_salt('bf', 12))
WHERE "password_hash" IS NULL;

ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "users_created_by_user_id_idx" ON "users"("created_by_user_id");

ALTER TABLE "user_sessions" RENAME COLUMN "session_token" TO "session_token_hash";
ALTER INDEX "user_sessions_session_token_key" RENAME TO "user_sessions_session_token_hash_key";
ALTER TABLE "auth_tokens" RENAME COLUMN "token" TO "token_hash";
ALTER INDEX "auth_tokens_token_key" RENAME TO "auth_tokens_token_hash_key";

DROP INDEX "profiles_candidate_id_key";
CREATE INDEX "profiles_candidate_id_idx" ON "profiles"("candidate_id");

ALTER TABLE "profile_bd_assignments"
  ADD COLUMN "ended_at" TIMESTAMPTZ(6),
  ADD COLUMN "ended_reason" TEXT;
DROP INDEX "profile_bd_assignments_profile_id_key";
CREATE INDEX "profile_bd_assignments_profile_id_ended_at_idx" ON "profile_bd_assignments"("profile_id", "ended_at");
CREATE UNIQUE INDEX "profile_bd_assignments_active_profile_user_key" ON "profile_bd_assignments"("profile_id", "user_id") WHERE "ended_at" IS NULL;

ALTER TABLE "profile_closer_eligibility"
  ADD COLUMN "ended_at" TIMESTAMPTZ(6),
  ADD COLUMN "ended_reason" TEXT;
DROP INDEX "profile_closer_eligibility_profile_id_user_id_key";
CREATE INDEX "profile_closer_eligibility_profile_id_ended_at_idx" ON "profile_closer_eligibility"("profile_id", "ended_at");
CREATE UNIQUE INDEX "profile_closer_eligibility_active_profile_user_key" ON "profile_closer_eligibility"("profile_id", "user_id") WHERE "ended_at" IS NULL;

ALTER TABLE "job_leads"
  ADD COLUMN "responsible_closer_id" UUID,
  ADD COLUMN "archived_by_id" UUID,
  ADD COLUMN "closed_by_id" UUID,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "canonical_url" TEXT,
  ADD COLUMN "canonical_hash" TEXT,
  ADD COLUMN "archive_reason" TEXT,
  ADD COLUMN "archived_at" TIMESTAMPTZ(6),
  ADD COLUMN "closure_reason" TEXT,
  ADD COLUMN "closed_at" TIMESTAMPTZ(6),
  ADD COLUMN "placed_at" TIMESTAMPTZ(6),
  ADD COLUMN "start_date" DATE;
ALTER TABLE "job_leads" ADD CONSTRAINT "job_leads_responsible_closer_id_fkey" FOREIGN KEY ("responsible_closer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_leads" ADD CONSTRAINT "job_leads_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_leads" ADD CONSTRAINT "job_leads_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "job_leads_profile_id_canonical_hash_idx" ON "job_leads"("profile_id", "canonical_hash");
CREATE INDEX "job_leads_responsible_closer_id_idx" ON "job_leads"("responsible_closer_id");
CREATE UNIQUE INDEX "job_leads_active_profile_canonical_url_key" ON "job_leads"("profile_id", "canonical_url") WHERE "archived_at" IS NULL AND "canonical_url" IS NOT NULL;

ALTER TABLE "lead_closer_assignments"
  ADD COLUMN "ended_at" TIMESTAMPTZ(6),
  ADD COLUMN "ended_reason" TEXT;
DROP INDEX "lead_closer_assignments_lead_id_key";
CREATE INDEX "lead_closer_assignments_lead_id_ended_at_idx" ON "lead_closer_assignments"("lead_id", "ended_at");
CREATE UNIQUE INDEX "lead_closer_assignments_active_lead_user_key" ON "lead_closer_assignments"("lead_id", "user_id") WHERE "ended_at" IS NULL;

ALTER TABLE "activity_events"
  ADD COLUMN "actor_name_snapshot" TEXT,
  ADD COLUMN "actor_role_snapshot" "UserRole",
  ADD COLUMN "profile_id" UUID,
  ADD COLUMN "lead_id" UUID,
  ADD COLUMN "old_snapshot" JSONB,
  ADD COLUMN "new_snapshot" JSONB,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "request_id" TEXT;
CREATE INDEX "activity_events_profile_id_occurred_at_idx" ON "activity_events"("profile_id", "occurred_at");
CREATE INDEX "activity_events_lead_id_occurred_at_idx" ON "activity_events"("lead_id", "occurred_at");
CREATE INDEX "activity_events_request_id_occurred_at_idx" ON "activity_events"("request_id", "occurred_at");

CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
ALTER TABLE "outbox_events" RENAME COLUMN "occurred_at" TO "created_at";
ALTER TABLE "outbox_events"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_error" TEXT,
  ADD COLUMN "processed_at" TIMESTAMPTZ(6);
UPDATE "outbox_events" SET "idempotency_key" = "id"::text WHERE "idempotency_key" IS NULL;
ALTER TABLE "outbox_events" ALTER COLUMN "idempotency_key" SET NOT NULL;
CREATE UNIQUE INDEX "outbox_events_idempotency_key_key" ON "outbox_events"("idempotency_key");
DROP INDEX "outbox_events_published_at_occurred_at_idx";
DROP INDEX "outbox_events_aggregate_type_aggregate_id_occurred_at_idx";
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_created_at_idx" ON "outbox_events"("aggregate_type", "aggregate_id", "created_at");
