-- AlterTable: add secretToken to Appointment for customer self-service
-- Default gen_random_uuid() ensures all existing appointments get a token
ALTER TABLE "Appointment" ADD COLUMN "secretToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- CreateIndex: unique constraint on secretToken for fast lookup
CREATE UNIQUE INDEX "Appointment_secretToken_key" ON "Appointment"("secretToken");
