# Modelo de datos (base del producto)

## Objetivos del modelo

- Multi-tenant estricto por `business_id`.
- Entidad genérica **Recurso** (persona o activo) con agenda propia.
- Catálogo de **Servicios** (duración, periodicidad de turnos y precio).
- **Relación explícita Service ↔ Resource** desde el inicio.
- Disponibilidad semanal + bloqueos puntuales por recurso.
- Turnos con **anti double-booking** fuerte (idealmente a nivel DB).
- Soporte para operación diaria completa: estados de turno, agenda flexible y creación interna.
- Notificaciones multi-canal con idempotencia para confirmaciones y recordatorios.

---

## Convenciones

- IDs: `uuid`
- Timestamps: `timestamptz`
- Fechas guardadas en UTC. `business.timezone` define cómo se calculan y muestran los horarios.
- Soft delete preferido (timestamp) para preservar historial.

---

## Entidades

### `profiles`

Usuario autenticado de la app (vinculado a Supabase Auth).

- `id` (uuid, PK) — coincide con `auth.users.id`
- `email` (text)
- `full_name` (text, nullable)
- `created_at` (timestamptz)

---

### `businesses`

Configuración global del negocio (tenant).

- `id` (uuid, PK)
- `name` (text, required)
- `slug` (text, unique) — URL pública
- `timezone` (text, required)
- `resource_label` (text, default "Recurso")
- `address` (text, nullable)
- `cancellation_policy` (text, nullable)
- `reminders_enabled` (bool, default true)
- `reminder_offsets_minutes` (int[], default `{1440,120}`)
- `created_at`
- `updated_at`
- `email_notifications_enabled` (bool, default true)
- `whatsapp_notifications_enabled` (bool, default false)

---

### `business_members`

- `id` (uuid, PK)
- `business_id` (uuid, FK → businesses.id)
- `user_id` (uuid) — profiles.id
- `role` (enum: `OWNER | ADMIN | STAFF`)
- unique `(business_id, user_id)`
- `created_at`

---

### `resources`

- `id` (uuid, PK)
- `business_id` (uuid, FK → businesses.id)
- `name` (text, required)
- `type` (enum nullable: `PERSON | ASSET`)
- `status` (enum: `ACTIVE | INACTIVE`)
- `deleted_at` (timestamptz, nullable)
- unique `(business_id, name)`
- `created_at`
- `updated_at`

> Nota: recursos eliminados (`deleted_at != null`) no deben aparecer en UI ni usarse para nuevas reservas.

---

### `services`

Define qué se puede reservar y cómo se organiza la agenda.

- `id` (uuid, PK)
- `business_id` (uuid, FK → businesses.id)
- `name` (text, required)
- `duration_minutes` (int, required > 0)
- `slot_interval_minutes` (int, required > 0)
- `price_cents` (int, nullable)
- `currency` (text, nullable)
- `status` (enum: `ACTIVE | INACTIVE`, default `ACTIVE`)
- `deleted_at` (timestamptz, nullable)
- `min_booking_notice_minutes` (int, default 0) — anticipación mínima para reservar
- unique `(business_id, name)`
- `created_at`
- `updated_at`

> Nota: `min_booking_notice_minutes` se aplica tanto al cálculo de slots como a la validación de creación del turno.

**Reglas:**

- `slot_interval_minutes >= duration_minutes`
- Por defecto: `slot_interval_minutes = duration_minutes`
- Servicios pueden desactivarse o eliminarse (soft delete).
- Cambios afectan solo a turnos futuros.

---

### `service_resources`

Relación many-to-many obligatoria en el modelo.

- `id` (uuid, PK)
- `business_id` (uuid, FK → businesses.id)
- `service_id` (uuid, FK → services.id)
- `resource_id` (uuid, FK → resources.id)
- unique `(service_id, resource_id)`
- índices:
    - `(business_id, service_id)`
    - `(business_id, resource_id)`

**Reglas:**

- Un servicio es reservable si:
    - está `ACTIVE` y no eliminado
    - tiene al menos un recurso `ACTIVE` asignado

- Validar siempre coherencia de `business_id` entre las tres entidades.

---

### `availability_rules`

Disponibilidad semanal por recurso.

- `id` (uuid, PK)
- `resource_id` (uuid, FK → resources.id)
- `day_of_week` (smallint, 0–6)
- `start_time` (time)
- `end_time` (time)
- `active` (bool, default true)
- checks:
    - `day_of_week in 0..6`
    - `start_time < end_time`

---

### `resource_blocks`

Bloqueos puntuales de disponibilidad.

- `id` (uuid, PK)
- `resource_id` (uuid, FK → resources.id)
- `start_at` (timestamptz)
- `end_at` (timestamptz)
- `reason` (text, nullable)
- check: `start_at < end_at`
- `created_at`

---

### `customers`

- `id` (uuid, PK)
- `business_id` (uuid, FK → businesses.id)
- `full_name` (text, required)
- `email` (text, nullable)
- `phone` (text, nullable)
- `phone_e164` (text, nullable) — número normalizado para WhatsApp
- check: al menos uno entre `email` o `phone`
- índices:
    - `(business_id, email)`
    - `(business_id, phone)`

- `created_at`

---

### `appointments`

Turnos reservados (creados por clientes o por el negocio).

- `id` (uuid, PK)
- `business_id` (uuid, FK → businesses.id)
- `resource_id` (uuid, FK → resources.id)
- `service_id` (uuid, FK → services.id)
- `customer_id` (uuid, FK → customers.id)
- `status` (enum: `SCHEDULED | CANCELLED | RESCHEDULED | COMPLETED`)
- `start_at` (timestamptz)
- `end_at` (timestamptz)
- `occupied_end_at` (timestamptz)
- `notes` (text, nullable)
- `cancellation_reason` (text, nullable)
- `created_by_user_id` (uuid, nullable) — null si fue creado por cliente
- `rescheduled_from_id` (uuid, nullable, FK → appointments.id)
- checks:
    - `start_at < end_at`
    - `end_at <= occupied_end_at`

- índices:
    - `(business_id, start_at)`
    - `(resource_id, start_at)`
    - `(customer_id, start_at)`

**Reglas clave:**

- Validar Service ↔ Resource existente y entidades activas.
- Respetar `min_booking_notice_minutes` del negocio.
- Turnos existentes no se recalculan ante cambios de servicio.

---

### `notifications`

- `id` (uuid, PK)
- `business_id` (uuid, FK → businesses.id)
- `appointment_id` (uuid, FK → appointments.id)
- `channel` (enum: `EMAIL | WHATSAPP`)
- `type` (enum: `CONFIRMATION | REMINDER | CANCELLATION | RESCHEDULED`)
- `to` (text) — email o phone_e164 según canal
- `status` (enum: `PENDING | SENT | FAILED`)
- `scheduled_for` (timestamptz)
- `sent_at` (timestamptz, nullable)
- `error` (text, nullable)
- idempotencia:
- unique `(appointment_id, channel, type, scheduled_for)`
- `provider_message_id` (text, nullable) — id devuelto por proveedor externo

- `created_at`

---

## Relaciones (resumen)

- business 1—N resources, services, customers, appointments, notifications
- resource 1—N availability_rules, resource_blocks, appointments
- service 1—N appointments
- customer 1—N appointments
- appointment 1—N notifications (por canal y tipo)
- profile N—N business vía business_members
- service N—N resource vía service_resources

---

## Restricción crítica: anti double-booking (DB-level)

Objetivo: impedir reservas solapadas para el mismo `resource_id`, considerando `occupied_end_at`.

Estrategia recomendada (Postgres):

- Constraint **EXCLUDE** usando `tstzrange(start_at, occupied_end_at, '[)')`
- Aplicar solo a estados activos (`SCHEDULED`, `RESCHEDULED`).

---

## Multi-tenant enforcement

- Todas las tablas operativas incluyen `business_id` cuando aporta integridad.
- Backend filtra siempre por `business_id` según `business_members`.
- `service_resources` incluye `business_id` para enforcement y queries.
- (Opcional) RLS en Supabase como capa adicional.

Nota sobre PII:

- Los números de teléfono (`phone`, `phone_e164`) se consideran PII sensible.
- No deben incluirse en logs ni en mensajes de error persistidos
