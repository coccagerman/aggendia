-- Add owner reminder configuration fields
ALTER TABLE "Business" ADD COLUMN "ownerRemindersEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "ownerReminderOffsetsMinutes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
