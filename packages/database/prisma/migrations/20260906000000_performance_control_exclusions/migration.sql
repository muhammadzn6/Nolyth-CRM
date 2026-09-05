CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "performance_approved_leaves"
  ADD CONSTRAINT "performance_approved_leaves_bd_period_excl"
  EXCLUDE USING GIST (
    "bd_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  );

ALTER TABLE "performance_leaderboard_exceptions"
  ADD CONSTRAINT "performance_leaderboard_exceptions_bd_period_excl"
  EXCLUDE USING GIST (
    "bd_id" WITH =,
    tstzrange("effective_from", "expires_at", '[)') WITH &&
  ) WHERE ("revoked_at" IS NULL);
