ALTER TABLE "performance_rule_sets"
  ADD COLUMN "business_calendar_time_zone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
  ADD COLUMN "workday_start_hour" INTEGER NOT NULL DEFAULT 9,
  ADD COLUMN "workday_end_hour" INTEGER NOT NULL DEFAULT 17;

ALTER TABLE "performance_rule_sets"
  ADD CONSTRAINT "performance_rule_sets_workday_window_check"
  CHECK (
    "workday_start_hour" >= 0
    AND "workday_start_hour" < "workday_end_hour"
    AND "workday_end_hour" <= 24
  );

ALTER TABLE "performance_rule_sets"
  ADD CONSTRAINT "performance_rule_sets_outcome_points_check"
  CHECK (
    "positive_reply_points" > 0
    AND "positive_reply_points" <= "screening_points"
    AND "screening_points" <= "interview_points"
    AND "interview_points" <= "offer_points"
  );
