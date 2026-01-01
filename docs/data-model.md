# Modelo de datos inicial (MVP)

## Objetivos del modelo

-   Multi-tenant por `business_id`.
-   Entidad genérica “Recurso” (persona o activo).
-   Disponibilidad semanal + bloqueos puntuales.
-   Turnos con **anti double-booking** fuerte (ideal: constraint en DB).
-   Notificaciones para confirmaciones/recordatorios con idempotencia.

## Convenciones

-   IDs: `uuid`
-   Timestamps: `timestamptz`
-   Fechas guardadas en UTC. `business.timezone` define cómo se muestran/calculan slots.
-   Soft delete preferido (status/flags) en entidades operativas.

---

## Entidades

### `profiles`

Representa el usuario app (vinculado a Supabase Auth).

-   `id` (uuid, PK) — coincide con `auth.users.id`
-   `email` (text)
-   `full_name` (text, nullable)
-   `created_at` (timestamptz)

### `businesses`

-   `id` (uuid, PK)
-   `name` (text, required)
-   `slug` (text, unique) — URL pública
-   `timezone` (text, required)
-   `resource_label` (text, default "Recurso")
-   `address` (text, nullable)
-   `cancellation_policy` (text, nullable)
-   `reminders_enabled` (bool, default true)
-   `reminder_offsets_minutes` (int[], default `{1440,120}`)
-   `created_at`, `updated_at`

### `business_members`

-   `id` (uuid, PK)
-   `business_id` (uuid, FK -> businesses.id)
-   `user_id` (uuid) — profiles.id (o auth user id)
-   `role` (enum: `OWNER | ADMIN | STAFF`)
-   unique `(business_id, user_id)`
-   `created_at`

### `resources`

-   `id` (uuid, PK)
-   `business_id` (uuid, FK -> businesses.id)
-   `name` (text, required)
-   `type` (enum nullable: `PERSON | ASSET`)
-   `status` (enum: `ACTIVE | INACTIVE | DELETED`)
-   unique `(business_id, name)`
-   `created_at`, `updated_at`

### `services`

-   `id` (uuid, PK)
-   `business_id` (uuid, FK -> businesses.id)
-   `name` (text, required)
-   `duration_minutes` (int, required > 0)
-   `buffer_minutes` (int, default 0, >= 0)
-   `price_cents` (int, nullable)
-   `currency` (text, nullable)
-   `active` (bool, default true)
-   (opcional) unique `(business_id, name)`
-   `created_at`, `updated_at`

### `resource_services` (opcional)

Si no todos los recursos ofrecen todos los servicios.

-   `resource_id` (uuid, FK -> resources.id)
-   `service_id` (uuid, FK -> services.id)
-   PK `(resource_id, service_id)`

### `availability_rules`

Disponibilidad semanal por recurso.

-   `id` (uuid, PK)
-   `resource_id` (uuid, FK -> resources.id)
-   `day_of_week` (smallint, 0-6) — definir convención en código
-   `start_time` (time)
-   `end_time` (time)
-   `active` (bool, default true)
-   checks: `day_of_week in 0..6`, `start_time < end_time`

### `resource_blocks`

Bloqueos puntuales (excepciones).

-   `id` (uuid, PK)
-   `resource_id` (uuid, FK -> resources.id)
-   `start_at` (timestamptz)
-   `end_at` (timestamptz)
-   `reason` (text, nullable)
-   check: `start_at < end_at`
-   `created_at`

### `customers`

Clientes del negocio.

-   `id` (uuid, PK)
-   `business_id` (uuid, FK -> businesses.id)
-   `full_name` (text, required)
-   `email` (text, nullable)
-   `phone` (text, nullable)
-   check: al menos uno `email` o `phone` (si esa es la regla)
-   índices: `(business_id, email)`, `(business_id, phone)`
-   `created_at`

### `appointments`

Turnos.

-   `id` (uuid, PK)
-   `business_id` (uuid, FK -> businesses.id)
-   `resource_id` (uuid, FK -> resources.id)
-   `service_id` (uuid, FK -> services.id)
-   `customer_id` (uuid, FK -> customers.id)
-   `status` (enum: `SCHEDULED | CANCELLED | RESCHEDULED | COMPLETED`)
-   `start_at` (timestamptz)
-   `end_at` (timestamptz) — start + duration
-   `occupied_end_at` (timestamptz) — end + buffer
-   `notes` (text, nullable)
-   `cancellation_reason` (text, nullable)
-   `created_by_user_id` (uuid, nullable)
-   `rescheduled_from_id` (uuid, nullable, FK -> appointments.id)
-   checks: `start_at < end_at`, `end_at <= occupied_end_at`
-   índices: `(business_id, start_at)`, `(resource_id, start_at)`, `(customer_id, start_at)`
-   Nota: para anti-overlap, se considera “ocupado” hasta `occupied_end_at`.

### `notifications`

Confirmaciones y recordatorios.

-   `id` (uuid, PK)
-   `business_id` (uuid, FK -> businesses.id)
-   `appointment_id` (uuid, FK -> appointments.id)
-   `channel` (enum: `EMAIL`)
-   `type` (enum: `CONFIRMATION | REMINDER_24H | REMINDER_2H | CANCELLATION | RESCHEDULED`)
-   `to` (text)
-   `status` (enum: `PENDING | SENT | FAILED`)
-   `scheduled_for` (timestamptz)
-   `sent_at` (timestamptz, nullable)
-   `error` (text, nullable)
-   idempotencia: unique `(appointment_id, type)` (o `(appointment_id, type, scheduled_for)`)
-   `created_at`

---

## Relaciones (resumen)

-   business 1—N resources/services/customers/appointments/notifications
-   resource 1—N availability_rules/resource_blocks/appointments
-   service 1—N appointments
-   customer 1—N appointments
-   appointment 1—N notifications
-   profile N—N business vía business_members

---

## Restricción crítica: anti double-booking (DB-level)

Objetivo: impedir reservas solapadas para el mismo `resource_id`, considerando `occupied_end_at`.

Estrategia recomendada (Postgres):

-   Crear constraint **EXCLUDE** usando un rango `tstzrange(start_at, occupied_end_at, '[)')`
-   Aplicarlo solo a estados “activos” (ej: `SCHEDULED`, `RESCHEDULED`), para que `CANCELLED` no bloquee.

Nota: Esto suele implementarse con SQL en migración (no siempre es expresable en Prisma schema).

---

## Multi-tenant enforcement

Mínimo:

-   Todas las tablas operativas tienen `business_id`.
-   Backend filtra por `business_id` según el usuario autenticado (via business_members).
    Opcional:
-   RLS en Supabase como capa extra de seguridad.
