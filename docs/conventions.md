# Conventions — turnosapp

Este documento define convenciones de arquitectura, estructura y estilo para construir features de forma consistente, segura y mantenible.

---

## 1) Objetivos de arquitectura

-   **Separación clara de responsabilidades:** `api` (transporte) ≠ `domain` (reglas) ≠ `data` (persistencia).
-   **Multi-tenant seguro:** todo dato está aislado por `business_id`.
-   **Consistencia fuerte:** evitar double-booking (DB + validación).
-   **DX alta y código predecible:** tipado fuerte, validaciones y errores uniformes.
-   **Evolución simple:** permitir separar backend en el futuro sin reescribir dominio.

---

## 2) Estructura de carpetas recomendada

> Basado en Next.js App Router con `src/`.

```txt
src/
  app/
    (public)/
      b/[slug]/               # Página pública del negocio (cliente)
    (dashboard)/
      dashboard/              # UI privada
    api/
      v1/
        businesses/
        resources/
        services/
        availability/
        appointments/
        customers/
        notifications/
  domain/
    businesses/
      business.types.ts
      business.service.ts      # reglas de negocio
    resources/
      resource.types.ts
      resource.service.ts
    services/
      service.types.ts
      service.service.ts
    availability/
      availability.types.ts
      availability.service.ts  # cálculo de slots
    appointments/
      appointment.types.ts
      appointment.service.ts   # create/cancel/reschedule
      appointment.policy.ts    # políticas (cancelación, buffers, etc.)
    common/
      errors.ts                # AppError + codes
      result.ts                # Result helpers (opcional)
      time.ts                  # helpers de timezone/UTC
  data/
    prisma/
      prisma.ts                # singleton Prisma client
      repositories/
        business.repo.ts
        resource.repo.ts
        service.repo.ts
        availability.repo.ts
        appointment.repo.ts
        customer.repo.ts
        notification.repo.ts
  lib/
    http.ts                    # axios instance
    supabase/
      client.ts
      server.ts
    env.ts                     # zod env validation (recomendado)
  components/
    ui/                        # shadcn/ui
    shared/
  styles/
  types/
docs/
  prd.md
  user-stories.md
  data-model.md
  flows.md
  adr-0001-stack.md
  conventions.md
Reglas
Route Handlers (src/app/api/...) solo hacen:

auth + tenant resolution

parse/validate input (DTO)

llamar servicios del domain

mapear errores a HTTP

domain/ no importa Next ni Prisma.

data/ no contiene reglas de negocio; solo persistencia.

3) Convención REST (endpoints, routes y DTOs)
Base
Prefijo: /api/v1

JSON siempre (Content-Type: application/json)

Paginación y filtros por query params

IDs siempre UUID

Recursos principales
Businesses

GET /api/v1/businesses (lista negocios del usuario)

POST /api/v1/businesses (crear)

GET /api/v1/businesses/:businessId

PATCH /api/v1/businesses/:businessId

Resources (Recurso)

GET /api/v1/businesses/:businessId/resources

POST /api/v1/businesses/:businessId/resources

GET /api/v1/businesses/:businessId/resources/:resourceId

PATCH /api/v1/businesses/:businessId/resources/:resourceId

DELETE /api/v1/businesses/:businessId/resources/:resourceId (soft delete)

Services

GET /api/v1/businesses/:businessId/services

POST /api/v1/businesses/:businessId/services

PATCH /api/v1/businesses/:businessId/services/:serviceId

DELETE /api/v1/businesses/:businessId/services/:serviceId (soft deactivate/delete)

Availability

GET /api/v1/businesses/:businessId/resources/:resourceId/availability

PUT /api/v1/businesses/:businessId/resources/:resourceId/availability (reemplaza set semanal)

POST /api/v1/businesses/:businessId/resources/:resourceId/blocks

DELETE /api/v1/businesses/:businessId/resources/:resourceId/blocks/:blockId

Appointments

GET /api/v1/businesses/:businessId/appointments?date=YYYY-MM-DD&resourceId=...

POST /api/v1/businesses/:businessId/appointments (crear desde dashboard)

POST /api/v1/public/appointments (crear desde página pública por slug)

PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/cancel

PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/reschedule

Public (cliente)

GET /api/v1/public/businesses/:slug (datos públicos)

GET /api/v1/public/businesses/:slug/services

GET /api/v1/public/businesses/:slug/resources

GET /api/v1/public/slots?slug=...&serviceId=...&resourceId=...&from=...&to=...

Nota: En UI pública se recomienda usar slug y no exponer businessId si no hace falta.

DTOs (Data Transfer Objects)
Los DTOs son contratos de API, distintos a los modelos de DB.

Validación en la frontera con Zod.

Convención:

src/domain/<feature>/<feature>.types.ts → tipos de dominio

src/app/api/v1/.../dto.ts o src/types/dto/... → DTOs de API

Ejemplo:

CreateServiceRequestDTO

CreateServiceResponseDTO

ErrorResponseDTO

Respuestas: forma estándar
Éxito:

200 OK con { data: ... }

201 Created con { data: ... }

Listas:

{ data: [...], meta: { page, pageSize, total } }

o cursor pagination { data: [...], meta: { nextCursor } }

Query params
page, pageSize (default 1/20)

sort (ej: startAt:asc)

Filtros: resourceId, serviceId, status, from, to

4) Autenticación, autorización y multi-tenant
Auth
Supabase Auth para usuarios internos (admin/staff).

En Route Handlers:

obtener usuario autenticado

si no hay usuario → 401 Unauthorized

Tenant resolution
Nunca confiar en businessId pasado por el cliente.

Regla: para rutas privadas, validar que el usuario tenga membresía en business_members.

Funciones sugeridas:

requireUser() → devuelve userId

requireBusinessAccess(userId, businessId) → devuelve rol y permite/niega

Roles
OWNER: todo

ADMIN: todo excepto acciones críticas (opcional)

STAFF: agenda + turnos (según definas)

5) Convención de errores y códigos
Respuesta de error (estándar)
Siempre:

json
Copy code
{
  "error": {
    "code": "APPOINTMENT_SLOT_TAKEN",
    "message": "Ese horario ya no está disponible.",
    "details": { "resourceId": "...", "startAt": "..." }
  }
}
AppError
Definir una clase AppError con:

code (string)

message (user-friendly)

httpStatus (number)

details? (object)

Códigos recomendados
Auth

AUTH_UNAUTHORIZED (401)

AUTH_FORBIDDEN (403)

Validation

VALIDATION_ERROR (400)

INVALID_QUERY (400)

Business/tenant

BUSINESS_NOT_FOUND (404)

BUSINESS_ACCESS_DENIED (403)

Resources/Services

RESOURCE_NOT_FOUND (404)

SERVICE_NOT_FOUND (404)

RESOURCE_INACTIVE (409)

Appointments

APPOINTMENT_NOT_FOUND (404)

APPOINTMENT_SLOT_TAKEN (409)

APPOINTMENT_INVALID_STATUS (409)

APPOINTMENT_OUTSIDE_AVAILABILITY (409)

System

INTERNAL_ERROR (500)

DB_ERROR (500)

HTTP mapping (regla)
400: input inválido (DTO)

401: no autenticado

403: autenticado sin permisos

404: entidad no existe o no accesible

409: conflicto de negocio (slot tomado, estado inválido)

500: error inesperado

Logging
Loguear code + details para diagnosticar (sin PII sensible).

Nunca loguear tokens/keys.

6) Timezone policy (crítica)
Principios
Guardar timestamps en UTC en DB (timestamptz).

Cada business tiene un timezone IANA (ej: America/Argentina/Buenos_Aires).

Mostrar horarios al usuario según:

UI pública: timezone del negocio (claro para clientes)

dashboard: timezone del negocio (consistente)

Input de fechas
Cuando el cliente elige “fecha/hora” en UI (local del negocio), el backend:

interpreta ese input en business.timezone

lo convierte a UTC (start_at, end_at, occupied_end_at)

guarda en DB

Output de fechas
API devuelve siempre timestamptz (ISO 8601).

UI convierte a timezone del negocio para renderizar.

Slots
El cálculo de slots debe hacerse en timezone del negocio:

construir intervalos de disponibilidad (día + start_time/end_time) en esa TZ

convertir a UTC para comparar con appointments y resource_blocks

Considerar cambios de DST: usar librería con timezone (no usar Date “a pelo”).

Recomendación:

usar date-fns-tz o luxon para conversiones.

evitar manejar horarios con strings sin validación.

7) Reglas de consistencia (double-booking)
Requisito
Prohibir turnos solapados para el mismo resource_id considerando buffer.

Estrategia recomendada
Validar en dominio:

slot dentro de disponibilidad

no cae en bloqueos

Proteger en DB:

constraint anti-overlap (EXCLUDE constraint por resource_id y rango start_at–occupied_end_at para estados activos)

Si DB rechaza:

mapear a 409 APPOINTMENT_SLOT_TAKEN

8) Seguridad y PII
Minimizar PII: cliente = nombre + email/teléfono.

Nunca exponer claves server-only en cliente.

Sanitizar logs.

Rate limiting (futuro): endpoints públicos de slots/reserva pueden requerir throttling.

9) Performance y buenas prácticas
Consultas siempre con índices:

appointments(resource_id, start_at)

appointments(business_id, start_at)

Paginación en listas.

No recalcular slots para rangos enormes: limitar from/to (ej: máximo 30 días).

Evitar N+1: usar queries adecuadas en repositorios.

10) Estilo de código y calidad
TypeScript estricto.

Zod para validar:

DTOs de entrada/salida

variables de entorno en src/lib/env.ts

Funciones puras en domain cuando sea posible.

“No magic strings”: enums centralizados.

Nombres:

businessId, resourceId, serviceId, appointmentId

startAt, endAt, occupiedEndAt

Tests (cuando empecemos):

unit tests para domain (cálculo de slots, reglas de conflicto)

integration tests para endpoints críticos (create appointment)

11) Convención de commits y ramas (recomendado)
Commits: feat: ..., fix: ..., chore: ..., docs: ...

PRs pequeños: una feature coherente por PR.

Cambios de API deben actualizar DTOs y docs relevantes.

12) Checklist para nuevas features (para Copilot y humanos)
 DTO validado con Zod

 Auth + tenant check aplicado

 Errores mapeados a códigos estándar

 No se filtra PII en logs

 Queries con filtros por business_id donde corresponda

 Timezone correcto (input/output)

 Caso de conflicto (409) contemplado en turnos

 UI maneja estados loading/error/empty
```
