-- Add nullable country ISO code to subscriptions for provider routing (AR -> MercadoPago, others -> Stripe)
ALTER TABLE "Subscription"
ADD COLUMN "countryIso2" TEXT;

CREATE INDEX "Subscription_countryIso2_idx" ON "Subscription"("countryIso2");
