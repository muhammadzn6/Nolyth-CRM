CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BD', 'CLOSER');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "display_name" TEXT NOT NULL,
  "email" CITEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'BD',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "session_token" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "token" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "consumed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "email" CITEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "candidate_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_bd_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profile_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "assigned_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "profile_bd_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_closer_eligibility" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profile_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "set_by_id" UUID NOT NULL,
  "is_eligible" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "profile_closer_eligibility_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_leads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profile_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "current_owner_id" UUID NOT NULL,
  "company_name" TEXT NOT NULL,
  "job_title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "compensation_amount" DECIMAL(14,2),
  "compensation_currency" VARCHAR(3),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "job_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_ownership_transfers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lead_id" UUID NOT NULL,
  "from_owner_id" UUID,
  "to_owner_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "reason" TEXT,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_ownership_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_closer_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lead_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "assigned_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "lead_closer_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_status_transitions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lead_id" UUID NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "reason" TEXT,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_status_transitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "activity_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_id" UUID,
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "payload" JSONB,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "aggregate_type" TEXT NOT NULL,
  "aggregate_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ(6),
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "user_sessions_session_token_key" ON "user_sessions"("session_token");
CREATE UNIQUE INDEX "auth_tokens_token_key" ON "auth_tokens"("token");
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");
CREATE UNIQUE INDEX "profiles_candidate_id_key" ON "profiles"("candidate_id");
CREATE UNIQUE INDEX "profile_bd_assignments_profile_id_key" ON "profile_bd_assignments"("profile_id");
CREATE UNIQUE INDEX "profile_closer_eligibility_profile_id_user_id_key" ON "profile_closer_eligibility"("profile_id", "user_id");
CREATE UNIQUE INDEX "lead_closer_assignments_lead_id_key" ON "lead_closer_assignments"("lead_id");

CREATE INDEX "user_sessions_user_id_expires_at_idx" ON "user_sessions"("user_id", "expires_at");
CREATE INDEX "auth_tokens_user_id_expires_at_idx" ON "auth_tokens"("user_id", "expires_at");
CREATE INDEX "profiles_created_by_id_idx" ON "profiles"("created_by_id");
CREATE INDEX "profile_bd_assignments_user_id_idx" ON "profile_bd_assignments"("user_id");
CREATE INDEX "profile_closer_eligibility_user_id_idx" ON "profile_closer_eligibility"("user_id");
CREATE INDEX "job_leads_profile_id_status_idx" ON "job_leads"("profile_id", "status");
CREATE INDEX "job_leads_current_owner_id_idx" ON "job_leads"("current_owner_id");
CREATE INDEX "lead_ownership_transfers_lead_id_occurred_at_idx" ON "lead_ownership_transfers"("lead_id", "occurred_at");
CREATE INDEX "lead_closer_assignments_user_id_idx" ON "lead_closer_assignments"("user_id");
CREATE INDEX "lead_status_transitions_lead_id_occurred_at_idx" ON "lead_status_transitions"("lead_id", "occurred_at");
CREATE INDEX "activity_events_entity_type_entity_id_occurred_at_idx" ON "activity_events"("entity_type", "entity_id", "occurred_at");
CREATE INDEX "activity_events_actor_id_occurred_at_idx" ON "activity_events"("actor_id", "occurred_at");
CREATE INDEX "outbox_events_published_at_occurred_at_idx" ON "outbox_events"("published_at", "occurred_at");
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_occurred_at_idx" ON "outbox_events"("aggregate_type", "aggregate_id", "occurred_at");

ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "profile_bd_assignments" ADD CONSTRAINT "profile_bd_assignments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_bd_assignments" ADD CONSTRAINT "profile_bd_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "profile_bd_assignments" ADD CONSTRAINT "profile_bd_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "profile_closer_eligibility" ADD CONSTRAINT "profile_closer_eligibility_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_closer_eligibility" ADD CONSTRAINT "profile_closer_eligibility_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "profile_closer_eligibility" ADD CONSTRAINT "profile_closer_eligibility_set_by_id_fkey" FOREIGN KEY ("set_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_leads" ADD CONSTRAINT "job_leads_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_leads" ADD CONSTRAINT "job_leads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_leads" ADD CONSTRAINT "job_leads_current_owner_id_fkey" FOREIGN KEY ("current_owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_ownership_transfers" ADD CONSTRAINT "lead_ownership_transfers_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_ownership_transfers" ADD CONSTRAINT "lead_ownership_transfers_from_owner_id_fkey" FOREIGN KEY ("from_owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_ownership_transfers" ADD CONSTRAINT "lead_ownership_transfers_to_owner_id_fkey" FOREIGN KEY ("to_owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_ownership_transfers" ADD CONSTRAINT "lead_ownership_transfers_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_closer_assignments" ADD CONSTRAINT "lead_closer_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_closer_assignments" ADD CONSTRAINT "lead_closer_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_closer_assignments" ADD CONSTRAINT "lead_closer_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_status_transitions" ADD CONSTRAINT "lead_status_transitions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_status_transitions" ADD CONSTRAINT "lead_status_transitions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
