-- Auth tokens are only meaningful when attached to an account.
DELETE FROM "auth_tokens" WHERE "user_id" IS NULL;

ALTER TABLE "auth_tokens"
  ALTER COLUMN "user_id" SET NOT NULL;
