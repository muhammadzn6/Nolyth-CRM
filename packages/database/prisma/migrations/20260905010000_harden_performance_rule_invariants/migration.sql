CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "performance_rule_sets"
  ADD CONSTRAINT "performance_rule_sets_effective_period_excl"
  EXCLUDE USING GIST (tstzrange("effective_from", "effective_to", '[)') WITH &&);

ALTER TABLE "bd_target_schedules"
  ADD CONSTRAINT "bd_target_schedules_bd_effective_period_excl"
  EXCLUDE USING GIST (
    "bd_id" WITH =,
    tstzrange("effective_from", "effective_to", '[)') WITH &&
  );

CREATE FUNCTION "performance_working_days_are_valid"(days INTEGER[])
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
STRICT
AS $$
  SELECT cardinality(days) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(days) AS day_of_week
      WHERE day_of_week < 0 OR day_of_week > 6
    )
    AND cardinality(days) = (
      SELECT count(DISTINCT day_of_week)
      FROM unnest(days) AS day_of_week
    );
$$;

ALTER TABLE "performance_rule_sets"
  ADD COLUMN "working_days" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5];

UPDATE "performance_rule_sets" AS rule_set
SET "working_days" = COALESCE(
  (
    SELECT array_agg(working_day."day_of_week" ORDER BY working_day."day_of_week")
    FROM "performance_working_days" AS working_day
    WHERE working_day."rule_set_id" = rule_set."id"
      AND working_day."is_working"
  ),
  ARRAY[1, 2, 3, 4, 5]
);

ALTER TABLE "performance_rule_sets"
  ADD CONSTRAINT "performance_rule_sets_working_days_check"
  CHECK ("performance_working_days_are_valid"("working_days"));

DROP TABLE "performance_working_days";

ALTER TABLE "duplicate_reviews"
  DROP CONSTRAINT "duplicate_reviews_likely_only_check";

ALTER TYPE "DuplicateClassification" RENAME TO "DuplicateClassification_old";
CREATE TYPE "DuplicateClassification" AS ENUM ('LIKELY');

ALTER TABLE "duplicate_reviews"
  ALTER COLUMN "classification" DROP DEFAULT,
  ALTER COLUMN "classification" TYPE "DuplicateClassification"
    USING "classification"::text::"DuplicateClassification",
  ALTER COLUMN "classification" SET DEFAULT 'LIKELY';

DROP TYPE "DuplicateClassification_old";
