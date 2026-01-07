-- Enable btree_gist extension (for future use with EXCLUDE constraints if needed)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- NOTE: EXCLUDE constraint with tstzrange is not compatible with TIMESTAMP(3) due to immutability.
-- Overlap prevention for ResourceBlock is enforced at the application level.
-- We add a simple index for query performance instead.
CREATE INDEX IF NOT EXISTS "ResourceBlock_resourceId_startAt_idx" 
  ON "ResourceBlock" ("resourceId", "startAt");
