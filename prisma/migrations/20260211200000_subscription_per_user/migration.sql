-- Subscription per-user migration
-- Changes subscription ownership from business-level to user-level.
-- A user pays once and manages all their businesses.

-- ============================================================================
-- 1. Subscription: businessId → userId
-- ============================================================================

-- Add userId column (nullable first for backfill)
ALTER TABLE "Subscription" ADD COLUMN "userId" TEXT;

-- Backfill: get OWNER userId from BusinessMember
UPDATE "Subscription" s
SET "userId" = bm."userId"
FROM "BusinessMember" bm
WHERE bm."businessId" = s."businessId" AND bm."role" = 'OWNER';

-- If multiple subscriptions would map to the same userId (user has >1 business),
-- keep only the one with the latest trialEndsAt and delete the rest
DELETE FROM "Subscription" s
USING (
    SELECT "userId", MAX("trialEndsAt") as max_trial
    FROM "Subscription"
    WHERE "userId" IS NOT NULL
    GROUP BY "userId"
    HAVING COUNT(*) > 1
) dup
WHERE s."userId" = dup."userId"
AND s."trialEndsAt" < dup.max_trial;

-- Make userId NOT NULL
ALTER TABLE "Subscription" ALTER COLUMN "userId" SET NOT NULL;

-- Add unique constraint on userId
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_key" UNIQUE ("userId");

-- Drop old businessId FK and unique constraint
ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_businessId_fkey";
DROP INDEX IF EXISTS "Subscription_businessId_key";

-- Drop businessId column
ALTER TABLE "Subscription" DROP COLUMN "businessId";

-- ============================================================================
-- 2. PaymentTransaction: remove businessId
-- ============================================================================

ALTER TABLE "PaymentTransaction" DROP CONSTRAINT IF EXISTS "PaymentTransaction_businessId_fkey";
DROP INDEX IF EXISTS "PaymentTransaction_businessId_idx";
ALTER TABLE "PaymentTransaction" DROP COLUMN "businessId";

-- ============================================================================
-- 3. TrialLinkUsage: businessId → userId
-- ============================================================================

ALTER TABLE "TrialLinkUsage" ADD COLUMN "userId" TEXT;

UPDATE "TrialLinkUsage" tlu
SET "userId" = bm."userId"
FROM "BusinessMember" bm
WHERE bm."businessId" = tlu."businessId" AND bm."role" = 'OWNER';

-- For any orphaned records without an OWNER, try any member
UPDATE "TrialLinkUsage" tlu
SET "userId" = bm."userId"
FROM "BusinessMember" bm
WHERE bm."businessId" = tlu."businessId" AND tlu."userId" IS NULL;

-- Delete truly orphaned records (no member at all)
DELETE FROM "TrialLinkUsage" WHERE "userId" IS NULL;

ALTER TABLE "TrialLinkUsage" ALTER COLUMN "userId" SET NOT NULL;

-- Drop old constraints and column
ALTER TABLE "TrialLinkUsage" DROP CONSTRAINT IF EXISTS "TrialLinkUsage_businessId_fkey";
DROP INDEX IF EXISTS "TrialLinkUsage_trialLinkId_businessId_key";
ALTER TABLE "TrialLinkUsage" DROP COLUMN "businessId";

-- Add new unique constraint
ALTER TABLE "TrialLinkUsage" ADD CONSTRAINT "TrialLinkUsage_trialLinkId_userId_key" UNIQUE ("trialLinkId", "userId");

-- ============================================================================
-- 4. SubscriptionNotification: businessId → userId
-- ============================================================================

ALTER TABLE "SubscriptionNotification" ADD COLUMN "userId" TEXT;

UPDATE "SubscriptionNotification" sn
SET "userId" = sub."userId"
FROM "Subscription" sub
WHERE sub."id" = sn."subscriptionId";

-- Delete orphaned records
DELETE FROM "SubscriptionNotification" WHERE "userId" IS NULL;

ALTER TABLE "SubscriptionNotification" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "SubscriptionNotification" DROP CONSTRAINT IF EXISTS "SubscriptionNotification_businessId_fkey";
DROP INDEX IF EXISTS "SubscriptionNotification_businessId_idx";
ALTER TABLE "SubscriptionNotification" DROP COLUMN "businessId";

-- Add new index
CREATE INDEX "SubscriptionNotification_userId_idx" ON "SubscriptionNotification"("userId");
