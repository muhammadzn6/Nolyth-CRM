DELETE FROM "user_sessions";
DELETE FROM "auth_tokens";

ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
UPDATE "users"
SET
  "password_hash" = NULL,
  "password_changed_at" = NULL
WHERE "password_hash" IS NOT NULL
  AND "password_hash" NOT LIKE '$argon2id$%';

UPDATE "outbox_events"
SET
  "status" = 'PROCESSED',
  "processed_at" = COALESCE("processed_at", "published_at")
WHERE "published_at" IS NOT NULL;

WITH "ranked_active_assignments" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "lead_id"
      ORDER BY "created_at" DESC, "id" DESC
    ) AS "active_position"
  FROM "lead_closer_assignments"
  WHERE "ended_at" IS NULL
)
UPDATE "lead_closer_assignments" AS "assignment"
SET
  "ended_at" = CURRENT_TIMESTAMP,
  "ended_reason" = COALESCE(
    "assignment"."ended_reason",
    'migration: superseded duplicate active closer'
  ),
  "updated_at" = CURRENT_TIMESTAMP,
  "version" = "assignment"."version" + 1
FROM "ranked_active_assignments" AS "ranked"
WHERE "assignment"."id" = "ranked"."id"
  AND "ranked"."active_position" > 1;

DROP INDEX "lead_closer_assignments_active_lead_user_key";
CREATE UNIQUE INDEX "lead_closer_assignments_active_lead_key"
  ON "lead_closer_assignments"("lead_id")
  WHERE "ended_at" IS NULL;
