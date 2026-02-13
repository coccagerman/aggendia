-- Seed default subscription plans for user-level billing
-- Slugs are used by checkout mapping:
-- - base -> STRIPE_PRICE_ID_BASE
-- - premium -> STRIPE_PRICE_ID_PREMIUM

INSERT INTO "SubscriptionPlan" (
    "id",
    "name",
    "slug",
    "priceCents",
    "currency",
    "intervalMonths",
    "isActive",
    "updatedAt"
)
VALUES
    ('a1111111-1111-4111-8111-111111111111', 'Base', 'base', 900, 'USD', 1, true, NOW()),
    ('b2222222-2222-4222-8222-222222222222', 'Premium', 'premium', 1400, 'USD', 1, true, NOW())
ON CONFLICT ("slug")
DO UPDATE SET
    "name" = EXCLUDED."name",
    "priceCents" = EXCLUDED."priceCents",
    "currency" = EXCLUDED."currency",
    "intervalMonths" = EXCLUDED."intervalMonths",
    "isActive" = true,
    "updatedAt" = NOW();
