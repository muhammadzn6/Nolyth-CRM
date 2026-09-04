ALTER TABLE "google_calendar_connections"
  ADD COLUMN "company_id" UUID;

ALTER TABLE "google_calendar_connections"
  ADD CONSTRAINT "google_calendar_connections_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "google_calendar_connections_company_id_provider_idx"
  ON "google_calendar_connections"("company_id", "provider");
