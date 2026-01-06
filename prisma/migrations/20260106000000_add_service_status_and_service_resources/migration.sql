-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');

-- AlterTable: Convert Service.active (Boolean) to Service.status (ServiceStatus)
-- Step 1: Add new status column with default
ALTER TABLE "Service" ADD COLUMN "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE';

-- Step 2: Migrate data - set status based on existing active boolean
UPDATE "Service" SET "status" = CASE WHEN "active" = true THEN 'ACTIVE'::"ServiceStatus" ELSE 'INACTIVE'::"ServiceStatus" END;

-- Step 3: Drop old active column
ALTER TABLE "Service" DROP COLUMN "active";

-- Drop old index and create new one
DROP INDEX IF EXISTS "Service_businessId_active_idx";
CREATE INDEX "Service_businessId_status_idx" ON "Service"("businessId", "status");

-- CreateTable
CREATE TABLE "ServiceResource" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceResource_serviceId_resourceId_key" ON "ServiceResource"("serviceId", "resourceId");

-- CreateIndex
CREATE INDEX "ServiceResource_businessId_serviceId_idx" ON "ServiceResource"("businessId", "serviceId");

-- CreateIndex
CREATE INDEX "ServiceResource_businessId_resourceId_idx" ON "ServiceResource"("businessId", "resourceId");

-- AddForeignKey
ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
