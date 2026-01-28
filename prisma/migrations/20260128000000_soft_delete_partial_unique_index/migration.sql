-- ============================================================================
-- Migration: soft_delete_partial_unique_index
-- Description: Replace unique constraints on Service and Resource with
--              partial unique indexes that exclude DELETED records.
--              This allows reusing names after soft delete.
-- ============================================================================

-- Drop existing unique indexes (created as indexes, not constraints)
DROP INDEX IF EXISTS "Service_businessId_name_key";
DROP INDEX IF EXISTS "Resource_businessId_name_key";

-- Create partial unique indexes that exclude DELETED records
-- This allows creating a new service/resource with the same name after deletion
-- Note: status is an enum, so we compare using the enum value directly
CREATE UNIQUE INDEX "Service_businessId_name_not_deleted_key" 
ON "Service"("businessId", "name") 
WHERE status <> 'DELETED'::"ServiceStatus";

CREATE UNIQUE INDEX "Resource_businessId_name_not_deleted_key" 
ON "Resource"("businessId", "name") 
WHERE status <> 'DELETED'::"ResourceStatus";
