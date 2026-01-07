-- Add unique constraint for (businessId, email) on Customer
-- Uses a partial index to only enforce uniqueness when email is NOT NULL
-- This prevents duplicate customers with the same email within a business

CREATE UNIQUE INDEX "Customer_businessId_email_unique" ON "Customer"("businessId", "email") WHERE "email" IS NOT NULL;
