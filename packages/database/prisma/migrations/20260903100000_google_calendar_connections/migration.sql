CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE');
CREATE TYPE "GoogleCalendarConnectionStatus" AS ENUM ('CONNECTED', 'EXPIRED', 'SYNCING');

CREATE TABLE "google_calendar_connections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "provider" "CalendarProvider" NOT NULL,
  "account_email" CITEXT NOT NULL,
  "calendar_id" TEXT NOT NULL,
  "calendar_name" TEXT NOT NULL,
  "encrypted_refresh_token" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "last_synced_at" TIMESTAMPTZ(6),
  "status" "GoogleCalendarConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "google_calendar_connections_user_id_provider_key" UNIQUE ("user_id", "provider")
);

ALTER TABLE "google_calendar_connections"
  ADD CONSTRAINT "google_calendar_connections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
