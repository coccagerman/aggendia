## 2026-02-20 — Timezone por país en onboarding

- Se elimina la selección manual de timezone al crear negocio.
- La timezone del negocio se deriva desde onboarding de cuenta (país + timezone) y no se puede editar luego.
- Países con timezone fija automática: `AR`, `UY`, `PE`, `CO`.
- Países con selección manual obligatoria: `CL`, `MX`, `OT`.
- En onboarding se muestra alerta de irreversibilidad para todos los países.

## 2026-02-22 — Suscripciones Mercado Pago (plan asociado) sin redirect

- Se migró el flujo de AR/Mercado Pago de `pending + init_point` a `authorized + card_token_id` para suscripciones con plan asociado.
- **DESCARTADO el 2026-02-23** — ver entrada siguiente.

## 2026-02-23 — Remoción de Mercado Pago como proveedor de pagos

- Se descartó Mercado Pago como proveedor de pagos debido a la complejidad innecesaria que sumaba al sistema (problemas recurrentes con webhooks, validación de firmas, credenciales de test/prod, y flujo de tokenización).
- El sistema ahora usa **exclusivamente Stripe** para todos los flujos de pago (checkout, suscripciones, webhooks).
- Se eliminó: cliente MP, provider MP, webhook handler MP, SDK frontend MP, modal de tarjeta MP, polling MP, tests MP.
- Se preservó la infraestructura de Strategy Pattern (`PaymentProvider` interface + factory) para facilitar re-integración futura si fuera necesario.
- El enum `MERCADOPAGO` se mantiene en el schema de Prisma para no romper registros existentes; no se usa en código nuevo.
- `resolvePaymentRouting()` ahora retorna siempre `STRIPE + USD` independientemente del país.

## 2026-03-06 — Modo "app deshabilitada" para producción

- Se incorpora un bloqueo global por entorno, activo únicamente cuando:
    - `APP_ENV="prod"`
    - `DISABLE_ENV="true"`
- En ese modo, solo quedan habilitadas las rutas públicas:
    - `/`
    - `/privacy`
    - `/terms`
    - `/maintenance`
- Cualquier otra ruta web redirige a `/maintenance`.
- Las APIs bajo `/api/v1/*` y `/api/cron/*` responden `503` con:
    - `code: "APP_DISABLED"`
- Se agrega página de mantenimiento informativa (sin CTA) con ilustración SVG inline, sin dependencias externas.
- En la landing, CTAs de login/signup quedan deshabilitados y muestran tooltip explicativo mientras el modo está activo.
