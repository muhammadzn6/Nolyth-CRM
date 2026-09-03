ALTER TABLE "google_calendar_connections"
  ADD COLUMN "profile_id" UUID;

ALTER TABLE "google_calendar_connections"
  ADD CONSTRAINT "google_calendar_connections_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "google_calendar_connections_profile_id_provider_key"
  ON "google_calendar_connections"("profile_id", "provider");

CREATE INDEX "google_calendar_connections_profile_id_provider_idx"
  ON "google_calendar_connections"("profile_id", "provider");
