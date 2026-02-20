-- Add account timezone to subscription profile-level settings
ALTER TABLE "Subscription"
ADD COLUMN "accountTimezone" TEXT;

CREATE INDEX "Subscription_accountTimezone_idx" ON "Subscription"("accountTimezone");
