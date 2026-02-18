-- DropIndex
DROP INDEX "ResourceBlock_resourceId_startAt_idx";

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "secretToken" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "Notification_appointmentId_channel_type_scheduledFor_recipient_" RENAME TO "Notification_appointmentId_channel_type_scheduledFor_recipi_key";
