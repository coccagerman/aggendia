# Modelo de datos inicial (MVP)

## Objetivos del modelo

-   Multi-tenant por `business_id`.
-   Entidad genérica “Recurso” (persona o activo).
-   Catálogo de **Servicios** (duración, periodicidad de turnos y precio).
-   **Relación explícita Service ↔ Resource** desde el inicio (qué recursos ofrecen qué servicios).
-   Disponibilidad semanal + bloqueos puntuales por recurso.
-   Turnos con **anti double-booking** fuerte (ideal: constraint en DB).
-   Notificaciones para confirmaciones y recordatorios con idempotencia.

## Convenciones

-   IDs: `uuid`
-   Timestamps: `timestamptz`
-   Fechas guardadas en UTC. `business.timezone` define cómo se muestran y calculan los slots.
-   Soft delete preferido (timestamp/flags) en entidades operativas.

---

## Entidades

### `profiles`

Representa el usuario de la app (vinculado a Supabase Auth).

-   `id` (uuid, PK) — coincide con `auth.users.id`
-   `email` (text)
-   `full_name` (text, nullable)
-   `created_at` (timestamptz)

---

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
-   `created_at`
-   `updated_at`

---

### `business_members`

-   `id` (uuid, PK)
-   `business_id` (uuid, FK -> businesses.id)
-   `user_id` (uuid) — profiles.id (o auth user id)
-   `role` (enum: `OWNER | ADMIN | STAFF`)
-   unique `(business_id, user_id)`
-   `created_at`

---

### `resources`

-   `id` (uuid, PK)
-   `business_id` (uuid, FK -> businesses.id)
-   `name` (text, required)
-   `type` (enum nullable: `PERSON | ASSET`)
-   `status` (enum: `ACTIVE | INACTIVE`)
-   `deleted_at` (timestamptz, nullable) — soft delete
-   unique `(business_id, name)`
-   `created_at`
-   `updated_at`

> Nota: `deleted_at != null` implica que no debe aparecer en listados (admin por default) ni en la UI pública.

---

### `services`

Define qué se puede reservar y cómo se organiza la agenda.

-   `id` (uuid, PK)
-   `business_id` (uuid, FK -> businesses.id)
-   `name` (text, required)
-   `duration_minutes` (int, required > 0)
-   `slot_interval_minutes` (int, required > 0)
-   `price_cents` (int, nullable)
-   `currency` (text, nullable)
-   `status` (enum: `ACTIVE | INACTIVE`, default `ACTIVE`)
-   `deleted_at` (timestamptz, nullable) — soft delete (opcional V1, recomendado por consistencia)
-   unique `(business_id, name)`
-   `created_at`
-   `updated_at`

**Reglas:**

-   `slot_interval_minutes >= duration_minutes`
-   Por defecto, `slot_interval_minutes = duration_minutes`
-   Cambios en duración o periodicidad afectan solo a turnos futuros.

---

### `service_resources` (OBLIGATORIO en MVP)

Define qué recursos ofrecen qué servicios (many-to-many).

-   `id` (uuid, PK) _(opcional; también puede ser PK compuesta)_
-   `business_id` (uuid, FK -> businesses.id)
-   `service_id` (uuid, FK -> services.id)
-   `resource_id` (uuid, FK -> resources.id)
-   unique `(service_id, resource_id)`
-   índices:
    -   `(business_id, service_id)`
    -   `(business_id, resource_id)`

**Reglas:**

-   Un servicio es “reservable” públicamente si:
    -   `services.status = ACTIVE` y `deleted_at is null`
    -   existe al menos un vínculo en `service_resources`
    -   y al menos un recurso vinculado está `ACTIVE` y `deleted_at is null`
-   Validación multi-tenant:
    -   En dominio, garantizar que  
        `service.business_id = resource.business_id = service_resources.business_id`
    -   (Opcional futuro) reforzar a nivel DB con constraints o triggers.

---

### `availability_rules`

Disponibilidad semanal por recurso (múltiples rangos por día).

-   `id` (uuid, PK)
-   `resource_id` (uuid, FK -> resources.id)
-   `day_of_week` (smallint, 0–6) — convención definida en código
-   `start_time` (time)
-   `end_time` (time)
-   `active` (bool, default true)
-   checks:
    -   `day_of_week in 0..6`
    -   `start_time < end_time`

> Nota: si un recurso no tiene reglas activas, no ofrece slots.

---

### `resource_blocks`

Bloqueos puntuales (excepciones).

-   `id` (uuid, PK)
-   `resource_id` (uuid, FK -> resources.id)
-   `start_at` (timestamptz)
-   `end_at` (timestamptz)
-   `reason` (text, nullable)
-   check: `start_at < end_at`
-   `created_at`

---

### `customers`

Clientes del negocio.

-   `id` (uuid, PK)
-   `business_id` (uuid, FK -> businesses.id)
-   `full_name` (text, required)
-   `email` (text, nullable)
-   `phone` (text, nullable)
-   check: al menos uno entre `email` o `phone`
-   índices:
    -   `(business_id, email)`
    -   `(business_id, phone)`
-   `created_at`

---

### `appointments`

Turnos reservados.

-   `id` (uuid, PK)
-   `business_id` (uuid, FK -> businesses.id)
-   `resource_id` (uuid, FK -> resources.id)
-   `service_id` (uuid, FK -> services.id)
-   `customer_id` (uuid, FK -> customers.id)
-   `status` (enum: `SCHEDULED | CANCELLED | RESCHEDULED | COMPLETED`)
-   `start_at` (timestamptz)
-   `end_at` (timestamptz)  
    — `start_at + duration_minutes` al momento de crear
-   `occupied_end_at` (timestamptz)  
    — `start_at + slot_interval_minutes` al momento de crear
-   `notes` (text, nullable)
-   `cancellation_reason` (text, nullable)
-   `created_by_user_id` (uuid, nullable)
-   `rescheduled_from_id` (uuid, nullable, FK -> appointments.id)
-   checks:
    -   `start_at < end_at`
    -   `end_at <= occupied_end_at`
-   índices:
    -   `(business_id, start_at)`
    -   `(resource_id, start_at)`
    -   `(customer_id, start_at)`

**Reglas clave de dominio:**

-   Al crear un turno (dashboard o público):
    -   validar que existe relación en `service_resources`
    -   validar que `service` y `resource` están `ACTIVE` y no deleted
-   Los turnos ya creados **no se recalculan retroactivamente** si cambia el servicio:
    -   se mantienen `end_at` y `occupied_end_at` persistidos.

---

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
-   idempotencia:
    -   unique `(appointment_id, type)`
    -   o `(appointment_id, type, scheduled_for)`
-   `created_at`

---

## Relaciones (resumen)

-   business 1—N resources, services, customers, appointments, notifications
-   resource 1—N availability_rules, resource_blocks, appointments
-   service 1—N appointments
-   customer 1—N appointments
-   appointment 1—N notifications
-   profile N—N business vía business_members
-   **service N—N resource vía service_resources**

---

## Restricción crítica: anti double-booking (DB-level)

Objetivo: impedir reservas solapadas para el mismo `resource_id`, considerando `occupied_end_at`.

Estrategia recomendada (Postgres):

-   Crear constraint **EXCLUDE** usando  
    `tstzrange(start_at, occupied_end_at, '[)')`
-   Aplicarlo solo a estados “activos”  
    (ej: `SCHEDULED`, `RESCHEDULED`), para que `CANCELLED` no bloquee.

> Nota: suele implementarse con SQL en migraciones, no siempre expresable en Prisma schema.

---

## Multi-tenant enforcement

Mínimo:

-   Todas las tablas operativas incluyen `business_id` cuando aporta valor de integridad o consulta.
-   El backend filtra por `business_id` según el usuario autenticado (vía `business_members`).
-   `service_resources` incluye `business_id` para facilitar enforcement y queries.

Opcional:

-   RLS en Supabase como capa extra de seguridad.
