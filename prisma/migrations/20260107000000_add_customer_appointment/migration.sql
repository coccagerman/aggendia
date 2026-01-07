-- US-5.4: Add Customer and Appointment models with anti double-booking constraint

-- Enable btree_gist extension for EXCLUDE constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'RESCHEDULED', 'COMPLETED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "occupiedEndAt" TIMESTAMPTZ NOT NULL,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "rescheduledFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Customer indexes
CREATE INDEX "Customer_businessId_idx" ON "Customer"("businessId");
CREATE INDEX "Customer_businessId_email_idx" ON "Customer"("businessId", "email");
CREATE INDEX "Customer_businessId_phone_idx" ON "Customer"("businessId", "phone");

-- CreateIndex: Appointment indexes
CREATE INDEX "Appointment_businessId_startAt_idx" ON "Appointment"("businessId", "startAt");
CREATE INDEX "Appointment_resourceId_startAt_idx" ON "Appointment"("resourceId", "startAt");
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- AddForeignKey: Customer -> Business
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Appointment -> Business
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Appointment -> Resource
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Appointment -> Service
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Appointment -> Customer
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Appointment -> Appointment (rescheduled)
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Anti double-booking constraint: EXCLUDE overlapping appointments for same resource
-- Only applies to SCHEDULED and RESCHEDULED appointments (active bookings)
-- Using TIMESTAMPTZ columns directly with tstzrange
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_no_overlap"
    EXCLUDE USING gist (
        "resourceId" WITH =,
        tstzrange("startAt", "occupiedEndAt", '[)') WITH &&
    ) WHERE (status IN ('SCHEDULED', 'RESCHEDULED'));
