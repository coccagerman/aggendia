-- US-10.1: Add notification channel configuration to Business
-- This migration adds fields to enable/disable email and WhatsApp notification channels

-- Add WHATSAPP to NotificationChannel enum
ALTER TYPE "NotificationChannel" ADD VALUE 'WHATSAPP';

-- Add channel configuration fields to Business
ALTER TABLE "Business" ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Business" ADD COLUMN "whatsappNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Drop old unique constraint (appointmentId, type, scheduledFor)
-- and create new one with channel included for multi-channel idempotency
DROP INDEX IF EXISTS "Notification_appointmentId_type_scheduledFor_key";

-- Create new unique constraint including channel
-- This allows the same appointment to have notifications in different channels
CREATE UNIQUE INDEX "Notification_appointmentId_channel_type_scheduledFor_key" 
ON "Notification"("appointmentId", "channel", "type", "scheduledFor");

-- Add index on channel for query optimization
CREATE INDEX IF NOT EXISTS "Notification_channel_idx" ON "Notification"("channel");
