-- Enable btree_gist extension for EXCLUDE constraint with equality and range operators
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Add exclusion constraint to prevent overlapping blocks for the same resource
-- This ensures no two blocks for the same resource can have overlapping time ranges
ALTER TABLE "ResourceBlock" ADD CONSTRAINT "resource_block_no_overlap"
  EXCLUDE USING gist (
    "resourceId" WITH =,
    tstzrange("startAt", "endAt", '[)') WITH &&
  );
