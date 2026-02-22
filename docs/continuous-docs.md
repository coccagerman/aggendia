## 2026-02-20 — Timezone por país en onboarding

- Se elimina la selección manual de timezone al crear negocio.
- La timezone del negocio se deriva desde onboarding de cuenta (país + timezone) y no se puede editar luego.
- Países con timezone fija automática: `AR`, `UY`, `PE`, `CO`.
- Países con selección manual obligatoria: `CL`, `MX`, `OT`.
- En onboarding se muestra alerta de irreversibilidad para todos los países.

## 2026-02-22 — Suscripciones Mercado Pago (plan asociado) sin redirect

- Se migra el flujo de AR/Mercado Pago de `pending + init_point` a `authorized + card_token_id` para suscripciones con plan asociado.
- Frontend usa SDK oficial `https://sdk.mercadopago.com/js/v2` y tokeniza tarjeta en modal simple.
- Backend exige validación fuerte: si provider es `MERCADOPAGO` y falta `cardTokenId`, responde 400.
- Se elimina dependencia de `checkoutUrl` para Mercado Pago; Stripe mantiene el flujo redirect sin cambios.
- El estado local de suscripción no se activa por snapshot inmediato; se espera webhook para evitar desincronización.
- `sync-checkout` queda limitado a Stripe.
