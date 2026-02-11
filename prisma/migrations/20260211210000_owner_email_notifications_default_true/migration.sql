-- Change default for ownerEmailNotificationsEnabled to true
ALTER TABLE "Business" ALTER COLUMN "ownerEmailNotificationsEnabled" SET DEFAULT true;

-- Enable for all existing businesses that have an ownerEmail set
UPDATE "Business" SET "ownerEmailNotificationsEnabled" = true WHERE "ownerEmail" IS NOT NULL;
