-- CreateEnum
CREATE TYPE "NotificationRecipient" AS ENUM ('CUSTOMER', 'BUSINESS');

-- AlterTable: add owner notification fields to Business
ALTER TABLE "Business" ADD COLUMN "ownerEmail" TEXT;
ALTER TABLE "Business" ADD COLUMN "ownerPhoneE164" TEXT;
ALTER TABLE "Business" ADD COLUMN "ownerEmailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "ownerWhatsappNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: add recipient field to Notification
ALTER TABLE "Notification" ADD COLUMN "recipient" "NotificationRecipient" NOT NULL DEFAULT 'CUSTOMER';

-- DropIndex: old unique constraint without recipient
DROP INDEX IF EXISTS "Notification_appointmentId_channel_type_scheduledFor_key";

-- CreateIndex: new unique constraint including recipient for idempotency
CREATE UNIQUE INDEX "Notification_appointmentId_channel_type_scheduledFor_recipient_key"
    ON "Notification"("appointmentId", "channel", "type", "scheduledFor", "recipient");

-- CreateIndex: index on recipient for filtering
CREATE INDEX "Notification_recipient_idx" ON "Notification"("recipient");
