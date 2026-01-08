-- US-5.5: Refactor buffer_minutes to slot_interval_minutes
-- Migration: Replace bufferMinutes with slotIntervalMinutes in Service table
-- Formula: slotIntervalMinutes = durationMinutes + bufferMinutes (for existing data)

-- Step 1: Add new column with default = durationMinutes + bufferMinutes
ALTER TABLE "Service" ADD COLUMN "slotIntervalMinutes" INTEGER;

-- Step 2: Populate new column for existing services
-- slot_interval = duration + buffer (preserves the same occupied_end_at behavior)
UPDATE "Service" SET "slotIntervalMinutes" = "durationMinutes" + "bufferMinutes";

-- Step 3: Make column NOT NULL after populating
ALTER TABLE "Service" ALTER COLUMN "slotIntervalMinutes" SET NOT NULL;

-- Step 4: Drop the old bufferMinutes column
ALTER TABLE "Service" DROP COLUMN "bufferMinutes";

-- Step 5: Add check constraint to ensure slotIntervalMinutes >= durationMinutes
ALTER TABLE "Service" ADD CONSTRAINT "Service_slotInterval_gte_duration" 
  CHECK ("slotIntervalMinutes" >= "durationMinutes");
