-- Add persistent scheduled plan-change fields on Subscription
-- Used to show a durable "cambio programado" indicator in UI.

ALTER TABLE "Subscription"
ADD COLUMN "scheduledPlanId" TEXT,
ADD COLUMN "scheduledPlanEffectiveAt" TIMESTAMP(3);

ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_scheduledPlanId_fkey"
FOREIGN KEY ("scheduledPlanId") REFERENCES "SubscriptionPlan"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Subscription_scheduledPlanId_idx" ON "Subscription"("scheduledPlanId");
CREATE INDEX "Subscription_scheduledPlanEffectiveAt_idx" ON "Subscription"("scheduledPlanEffectiveAt");
