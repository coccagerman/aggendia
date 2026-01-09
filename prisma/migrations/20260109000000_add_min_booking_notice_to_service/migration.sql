-- US-7.1: Add minimum booking notice to Service
-- This field allows admins to define how far in advance customers must book
-- Each service can have its own notice requirement (e.g., 60 minutes, 24 hours)

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "minBookingNoticeMinutes" INTEGER NOT NULL DEFAULT 0;
