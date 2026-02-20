-- Enable btree_gist extension (for future use with EXCLUDE constraints if needed)
-- Some managed Postgres environments can reject extension creation during migrations.
-- We intentionally continue when extension creation is not permitted.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gist;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping btree_gist extension creation: %', SQLERRM;
END $$;

-- NOTE: EXCLUDE constraint with tstzrange is not compatible with TIMESTAMP(3) due to immutability.
-- Overlap prevention for ResourceBlock is enforced at the application level.
-- We add a simple index for query performance instead.
CREATE INDEX IF NOT EXISTS "ResourceBlock_resourceId_startAt_idx" 
  ON "ResourceBlock" ("resourceId", "startAt");
