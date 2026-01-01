# ADR-0001 — Stack tecnológico del MVP

**Estado:** Aprobado  
**Fecha:** 2026-01-01

## Contexto

Construimos una app de turnos/reservas multi-tenant con:

-   UI pública (clientes) + dashboard (negocios)
-   Recursos reservables (persona/activo)
-   Disponibilidad semanal, bloqueos, turnos
-   Anti double-booking y notificaciones por email (MVP)

Prioridades:

-   simplicidad operativa
-   bajo costo
-   velocidad de desarrollo
-   base escalable sin reescrituras grandes

## Decisión (stack)

### App

-   **Next.js full stack**
    -   UI + API REST (Route Handlers) en el mismo repo
-   **TypeScript** en todo el proyecto

### UI

-   **Tailwind CSS**
-   **shadcn/ui**

### API

-   **REST JSON**
-   Convención de errores consistente: `{ error: { code, message, details? } }`

### Requests HTTP desde UI

-   **Axios**
    -   Interceptors, timeouts, manejo uniforme de errores

### Base de datos

-   **Postgres en Supabase** (hosting/managed)

### ORM

-   **Prisma** (migrations + cliente tipado)
-   Constraints avanzadas (anti double-booking) via **SQL en migrations** si aplica

### Auth

-   **Supabase Auth** (usuarios del negocio)
-   Clientes reservan sin cuenta (MVP) con nombre + email/teléfono

### Autorización / Multi-tenant

-   `business_members` con roles `OWNER|ADMIN|STAFF`
-   Todas las entidades incluyen `business_id`
-   Backend filtra/valida `business_id` según usuario
-   (Opcional) RLS en Supabase como capa extra

## Consecuencias

### Positivas

-   Menos piezas: un repo/deploy para UI+API.
-   DX alto: TS end-to-end, Prisma, componentes rápidos.
-   Supabase Auth reduce riesgo y tiempo en seguridad.

### Trade-offs

-   Jobs/recordatorios requieren estrategia (cron/worker).
-   Cuidar conexiones y performance DB con serverless.

## Alternativas consideradas

1. Backend separado (Express/Nest): más control, pero más complejidad y costo operativo.
2. Usar PostgREST de Supabase como API principal: rápido, pero reglas de dominio y control más difíciles.
3. tRPC: gran DX, pero REST es más universal para integraciones futuras.

## Pendientes (ADR futuros)

-   Hosting de Next (p.ej. Vercel) y estrategia de deploy.
-   Proveedor de email (Resend/SendGrid/etc.).
-   Estrategia de jobs (cron) e idempotencia de notificaciones.
-   Implementación exacta del anti-overlap (EXCLUDE constraint) y fallback en app.
