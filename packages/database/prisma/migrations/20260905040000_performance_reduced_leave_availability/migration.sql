ALTER TABLE "performance_approved_leaves"
  ADD COLUMN "available_start_hour" INTEGER,
  ADD COLUMN "available_end_hour" INTEGER,
  ADD CONSTRAINT "performance_approved_leaves_available_window_check"
  CHECK (
    ("available_start_hour" IS NULL AND "available_end_hour" IS NULL)
    OR (
      "available_start_hour" >= 0
      AND "available_start_hour" < "available_end_hour"
      AND "available_end_hour" <= 24
    )
  );
