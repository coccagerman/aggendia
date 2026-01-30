-- AlterTable: Add reminders configuration to Business
ALTER TABLE "Business" ADD COLUMN "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "reminderOffsetsMinutes" INTEGER[] DEFAULT ARRAY[1440, 120]::INTEGER[];
