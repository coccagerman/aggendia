-- AlterTable: Add phoneE164 column to Customer for WhatsApp notifications
-- US-10.2: Normalized phone number in E.164 format
ALTER TABLE "Customer" ADD COLUMN "phoneE164" TEXT;
