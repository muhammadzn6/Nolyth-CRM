CREATE TYPE "DuplicateClassification" AS ENUM ('NONE', 'LIKELY', 'CONFIRMED');
CREATE TYPE "DuplicateReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "PerformanceFollowUpStatus" AS ENUM ('OPEN', 'COMPLETED', 'NEEDS_REASSIGNMENT', 'ADMIN_REASSIGNMENT_OVERDUE');

CREATE TABLE "performance_rule_sets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "effective_from" TIMESTAMPTZ(6) NOT NULL,
  "effective_to" TIMESTAMPTZ(6),
  "default_daily_target" INTEGER NOT NULL DEFAULT 70,
  "follow_up_sla_business_hours" INTEGER NOT NULL DEFAULT 48,
  "admin_reassignment_sla_business_hours" INTEGER NOT NULL DEFAULT 2,
  "maturity_window_days" INTEGER NOT NULL DEFAULT 21,
  "duplicate_lookback_months" INTEGER NOT NULL DEFAULT 6,
  "application_weight_percent" DECIMAL(5, 2) NOT NULL DEFAULT 45,
  "follow_up_weight_percent" DECIMAL(5, 2) NOT NULL DEFAULT 25,
  "outcome_weight_percent" DECIMAL(5, 2) NOT NULL DEFAULT 30,
  "positive_reply_points" INTEGER NOT NULL DEFAULT 1,
  "screening_points" INTEGER NOT NULL DEFAULT 2,
  "interview_points" INTEGER NOT NULL DEFAULT 3,
  "offer_points" INTEGER NOT NULL DEFAULT 5,
  "slowdown_threshold_percent" DECIMAL(6, 2) NOT NULL DEFAULT 120,
  "slowdown_multiplier_percent" DECIMAL(5, 2) NOT NULL DEFAULT 25,
  "created_by_id" UUID NOT NULL,
  "audit_metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "performance_rule_sets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_rule_sets_effective_period_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "performance_rule_sets_weights_check" CHECK ("application_weight_percent" + "follow_up_weight_percent" + "outcome_weight_percent" = 100)
);

CREATE TABLE "performance_working_days" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "rule_set_id" UUID NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "is_working" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "performance_working_days_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_working_days_day_of_week_check" CHECK ("day_of_week" BETWEEN 0 AND 6)
);

CREATE TABLE "bd_target_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bd_id" UUID NOT NULL,
  "daily_target" INTEGER NOT NULL DEFAULT 70,
  "effective_from" TIMESTAMPTZ(6) NOT NULL,
  "effective_to" TIMESTAMPTZ(6),
  "created_by_id" UUID NOT NULL,
  "audit_metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "bd_target_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bd_target_schedules_target_check" CHECK ("daily_target" > 0),
  CONSTRAINT "bd_target_schedules_effective_period_check" CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from")
);

CREATE TABLE "performance_holidays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "holiday_date" DATE NOT NULL,
  "name" TEXT NOT NULL,
  "created_by_id" UUID NOT NULL,
  "audit_metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "performance_holidays_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_approved_leaves" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bd_id" UUID NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "reason" TEXT,
  "approved_by_id" UUID NOT NULL,
  "approved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "audit_metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "performance_approved_leaves_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_approved_leaves_period_check" CHECK ("ends_at" > "starts_at")
);

CREATE TABLE "duplicate_reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lead_id" UUID NOT NULL,
  "classification" "DuplicateClassification" NOT NULL DEFAULT 'LIKELY',
  "status" "DuplicateReviewStatus" NOT NULL DEFAULT 'PENDING',
  "override_reason" TEXT NOT NULL,
  "reviewer_id" UUID,
  "review_reason" TEXT,
  "reviewed_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6),
  "provisional_credit_granted" BOOLEAN NOT NULL DEFAULT true,
  "provisional_credit_resolved_at" TIMESTAMPTZ(6),
  "created_by_id" UUID NOT NULL,
  "audit_metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "duplicate_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "duplicate_reviews_likely_only_check" CHECK ("classification" = 'LIKELY')
);

CREATE TABLE "performance_follow_ups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lead_id" UUID NOT NULL,
  "owner_id" UUID NOT NULL,
  "original_owner_id" UUID NOT NULL,
  "status" "PerformanceFollowUpStatus" NOT NULL DEFAULT 'OPEN',
  "recruiter_responded_at" TIMESTAMPTZ(6) NOT NULL,
  "sla_started_at" TIMESTAMPTZ(6) NOT NULL,
  "sla_paused_at" TIMESTAMPTZ(6),
  "sla_resumed_at" TIMESTAMPTZ(6),
  "sla_due_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "breached_at" TIMESTAMPTZ(6),
  "admin_reassignment_sla_started_at" TIMESTAMPTZ(6),
  "admin_reassignment_sla_due_at" TIMESTAMPTZ(6),
  "admin_reassignment_breached_at" TIMESTAMPTZ(6),
  "reassigned_at" TIMESTAMPTZ(6),
  "reassigned_by_id" UUID,
  "audit_metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "performance_follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "performance_working_days_rule_set_id_day_of_week_key" ON "performance_working_days"("rule_set_id", "day_of_week");
CREATE UNIQUE INDEX "performance_holidays_holiday_date_key" ON "performance_holidays"("holiday_date");
CREATE UNIQUE INDEX "duplicate_reviews_lead_id_key" ON "duplicate_reviews"("lead_id");
CREATE UNIQUE INDEX "performance_follow_ups_lead_id_key" ON "performance_follow_ups"("lead_id");

CREATE INDEX "job_leads_current_owner_id_applied_date_idx" ON "job_leads"("current_owner_id", "applied_date");
CREATE INDEX "performance_rule_sets_effective_from_effective_to_idx" ON "performance_rule_sets"("effective_from", "effective_to");
CREATE INDEX "performance_rule_sets_created_by_id_created_at_idx" ON "performance_rule_sets"("created_by_id", "created_at");
CREATE INDEX "performance_working_days_day_of_week_is_working_idx" ON "performance_working_days"("day_of_week", "is_working");
CREATE INDEX "bd_target_schedules_bd_id_effective_from_effective_to_idx" ON "bd_target_schedules"("bd_id", "effective_from", "effective_to");
CREATE INDEX "bd_target_schedules_effective_from_effective_to_idx" ON "bd_target_schedules"("effective_from", "effective_to");
CREATE INDEX "performance_holidays_created_by_id_holiday_date_idx" ON "performance_holidays"("created_by_id", "holiday_date");
CREATE INDEX "performance_approved_leaves_bd_id_starts_at_ends_at_idx" ON "performance_approved_leaves"("bd_id", "starts_at", "ends_at");
CREATE INDEX "performance_approved_leaves_starts_at_ends_at_idx" ON "performance_approved_leaves"("starts_at", "ends_at");
CREATE INDEX "duplicate_reviews_status_expires_at_idx" ON "duplicate_reviews"("status", "expires_at");
CREATE INDEX "duplicate_reviews_reviewer_id_status_idx" ON "duplicate_reviews"("reviewer_id", "status");
CREATE INDEX "performance_follow_ups_owner_id_status_sla_due_at_idx" ON "performance_follow_ups"("owner_id", "status", "sla_due_at");
CREATE INDEX "performance_follow_ups_status_admin_reassignment_sla_due_at_idx" ON "performance_follow_ups"("status", "admin_reassignment_sla_due_at");

ALTER TABLE "performance_rule_sets" ADD CONSTRAINT "performance_rule_sets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_working_days" ADD CONSTRAINT "performance_working_days_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "performance_rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bd_target_schedules" ADD CONSTRAINT "bd_target_schedules_bd_id_fkey" FOREIGN KEY ("bd_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bd_target_schedules" ADD CONSTRAINT "bd_target_schedules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_holidays" ADD CONSTRAINT "performance_holidays_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_approved_leaves" ADD CONSTRAINT "performance_approved_leaves_bd_id_fkey" FOREIGN KEY ("bd_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_approved_leaves" ADD CONSTRAINT "performance_approved_leaves_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "duplicate_reviews" ADD CONSTRAINT "duplicate_reviews_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "duplicate_reviews" ADD CONSTRAINT "duplicate_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "duplicate_reviews" ADD CONSTRAINT "duplicate_reviews_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_follow_ups" ADD CONSTRAINT "performance_follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "job_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "performance_follow_ups" ADD CONSTRAINT "performance_follow_ups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_follow_ups" ADD CONSTRAINT "performance_follow_ups_original_owner_id_fkey" FOREIGN KEY ("original_owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "performance_follow_ups" ADD CONSTRAINT "performance_follow_ups_reassigned_by_id_fkey" FOREIGN KEY ("reassigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
