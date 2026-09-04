CREATE TYPE "AuthTokenPurpose" AS ENUM ('PASSWORD_RESET', 'USER_INVITATION');

ALTER TABLE "auth_tokens" RENAME COLUMN "type" TO "purpose";
ALTER TABLE "auth_tokens"
  ALTER COLUMN "purpose" TYPE "AuthTokenPurpose"
  USING (
    CASE "purpose"
      WHEN 'password_reset' THEN 'PASSWORD_RESET'
      WHEN 'PASSWORD_RESET' THEN 'PASSWORD_RESET'
      WHEN 'USER_INVITATION' THEN 'USER_INVITATION'
      ELSE "purpose"
    END
  )::"AuthTokenPurpose";

CREATE INDEX "auth_tokens_purpose_expires_at_idx" ON "auth_tokens"("purpose", "expires_at");
