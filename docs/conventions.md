# Conventions — turnosapp

Este documento define convenciones de arquitectura, estructura y estilo para construir features de forma consistente, segura y mantenible.

---

## 1) Objetivos de arquitectura

-   **Separación clara de responsabilidades:** `api` (transporte) ≠ `domain` (reglas) ≠ `data` (persistencia).
-   **Multi-tenant seguro:** todo dato está aislado por `business_id`.
-   **Consistencia fuerte:** evitar double-booking (DB + validación).
-   **DX alta y código predecible:** tipado fuerte, validaciones y errores uniformes.
-   **Evolución simple:** permitir separar backend en el futuro sin reescribir dominio.
-   **MVP con catálogo real:** servicios y recursos existen por separado y se **mapean** (Service ↔ Resource).

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
        service-resources/    # mapping Service ↔ Resource (admin)
        availability/
        appointments/
        customers/
        notifications/
  domain/
    businesses/
      business.types.ts
      business.service.ts
    resources/
      resource.types.ts
      resource.service.ts
    services/
      service.types.ts
      service.service.ts
    serviceResources/
      serviceResources.types.ts
      serviceResources.service.ts   # reglas de mapeo
    availability/
      availability.types.ts
      availability.service.ts       # cálculo de slots
    appointments/
      appointment.types.ts
      appointment.service.ts
      appointment.policy.ts
    common/
      errors.ts
      result.ts
      time.ts
  data/
    prisma/
      prisma.ts
      repositories/
        business.repo.ts
        resource.repo.ts
        service.repo.ts
        serviceResources.repo.ts     # mapping Service ↔ Resource
        availability.repo.ts
        appointment.repo.ts
        customer.repo.ts
        notification.repo.ts
  lib/
    http.ts
    supabase/
      client.ts
      server.ts
    env.ts
  components/
    ui/
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
Reglas base
Route Handlers (src/app/api/...) solo hacen:

auth + tenant resolution

parse/validate input (DTO)

llamar servicios de domain

mapear errores a HTTP

domain/ no importa Next ni Prisma.
data/ no contiene reglas de negocio; solo persistencia.

3) Convención REST (endpoints, routes y DTOs)
Base
Prefijo: /api/v1

JSON siempre (Content-Type: application/json)

Paginación y filtros por query params

IDs siempre UUID (excepto slug en público)

Recursos principales
Businesses
GET /api/v1/businesses (lista negocios del usuario)

POST /api/v1/businesses

GET /api/v1/businesses/:businessId

PATCH /api/v1/businesses/:businessId

Resources (Recurso)
GET /api/v1/businesses/:businessId/resources

POST /api/v1/businesses/:businessId/resources

GET /api/v1/businesses/:businessId/resources/:resourceId

PATCH /api/v1/businesses/:businessId/resources/:resourceId

DELETE /api/v1/businesses/:businessId/resources/:resourceId (soft delete)

Services (Servicio)
GET /api/v1/businesses/:businessId/services

POST /api/v1/businesses/:businessId/services

PATCH /api/v1/businesses/:businessId/services/:serviceId

DELETE /api/v1/businesses/:businessId/services/:serviceId (soft deactivate/delete)

Mapping Service ↔ Resource (MVP: explícito desde el inicio)
Objetivo: un servicio puede ofrecerse por uno o varios recursos, y un recurso puede ofrecer varios servicios.

GET /api/v1/businesses/:businessId/services/:serviceId/resources

lista recursos asignados a ese servicio (admin)

PUT /api/v1/businesses/:businessId/services/:serviceId/resources

reemplaza el set completo (idempotente)

body: { resourceIds: string[] }

Opcional (si resulta más cómodo para UI):

GET /api/v1/businesses/:businessId/resources/:resourceId/services

PUT /api/v1/businesses/:businessId/resources/:resourceId/services con { serviceIds: string[] }

Regla de dominio: al crear turnos/slots públicos con serviceId + resourceId, validar siempre que ese recurso ofrezca ese servicio.

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

GET /api/v1/public/businesses/:slug/services (solo ACTIVE)

GET /api/v1/public/businesses/:slug/resources?serviceId=...

devuelve recursos activos que ofrecen ese servicio (y no deleted)

GET /api/v1/public/slots?slug=...&serviceId=...&resourceId=...&from=...&to=...

debe validar: servicio activo + recurso activo + mapping existe

Nota: en UI pública se recomienda usar slug y no exponer businessId si no hace falta.

4) DTOs (Data Transfer Objects)
Los DTOs son contratos de API, distintos a los modelos de DB.

Validación en la frontera con Zod.

Convención:

src/domain/<feature>/<feature>.types.ts → tipos de dominio

src/app/api/v1/.../dto.ts (o src/types/dto/...) → DTOs de API

Ejemplos:

CreateServiceRequestDTO

UpdateResourceRequestDTO

SetServiceResourcesRequestDTO

ErrorResponseDTO

5) Respuestas: forma estándar
Éxito
200 OK con { data: ... }

201 Created con { data: ... }

Listas
{ data: [...], meta: { page, pageSize, total } }

o cursor pagination { data: [...], meta: { nextCursor } }

Query params
page, pageSize (default 1/20)

sort (ej: startAt:asc)

filtros típicos: resourceId, serviceId, status, from, to

6) Autenticación, autorización y multi-tenant
Auth
Supabase Auth para usuarios internos (admin/staff).

En Route Handlers:

obtener usuario autenticado

si no hay usuario → 401 Unauthorized

Tenant resolution
Nunca confiar en businessId pasado por el cliente.

Regla: para rutas privadas, validar que el usuario tenga membresía en business_members.

Funciones sugeridas:

requireUser() -> userId

requireBusinessAccess(userId, businessId) -> role

Roles
OWNER: todo

ADMIN: todo excepto acciones críticas (opcional)

STAFF: agenda + turnos (según definas)

7) Convención de errores y códigos
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
AppError con:

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

SERVICE_INACTIVE (409)

SERVICE_RESOURCE_NOT_LINKED (409) ← resource no ofrece ese service

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

409: conflicto de negocio (slot tomado, estado inválido, mapping inexistente)

500: error inesperado

Logging
Loguear code + details para diagnosticar (sin PII sensible).

Nunca loguear tokens/keys.

8) Timezone policy (crítica)
Principios
Guardar timestamps en UTC en DB (timestamptz).

Cada business tiene un timezone IANA (ej: America/Argentina/Buenos_Aires).

Input de fechas
Cuando el cliente elige “fecha/hora” en UI (local del negocio), el backend:

interpreta ese input en business.timezone

lo convierte a UTC (start_at, end_at, occupied_end_at)

lo guarda en DB

Output de fechas
API devuelve siempre timestamptz (ISO 8601).

UI convierte a timezone del negocio para renderizar.

Slots
El cálculo de slots debe hacerse en timezone del negocio:

construir intervalos de disponibilidad (día + start_time/end_time) en esa TZ

convertir a UTC para comparar con appointments y blocks

considerar DST: usar librería con timezone (no usar Date “a pelo”)

Recomendación:

date-fns-tz o luxon.

9) Reglas de consistencia (double-booking)
Requisito
Prohibir turnos solapados para el mismo resource_id considerando buffer.

Estrategia recomendada
Validar en dominio:

slot dentro de disponibilidad

no cae en bloqueos

(y si aplica) resource ofrece service (SERVICE_RESOURCE_NOT_LINKED)

Proteger en DB:

constraint anti-overlap (EXCLUDE constraint por resource_id y rango start_at–occupied_end_at para estados activos)

Si DB rechaza:

mapear a 409 APPOINTMENT_SLOT_TAKEN

10) Seguridad y PII
Minimizar PII: cliente = nombre + email/teléfono.

Nunca exponer claves server-only en cliente.

Sanitizar logs.

Rate limiting (futuro): endpoints públicos de slots/reserva pueden requerir throttling.

11) Performance y buenas prácticas
Índices recomendados
appointments(resource_id, start_at)

appointments(business_id, start_at)

service_resources(service_id, resource_id) con unique (evitar duplicados)

(si se consulta mucho) service_resources(resource_id, service_id)

Otras buenas prácticas
Paginación en listas.

No recalcular slots para rangos enormes: limitar from/to (ej: máximo 30 días).

Evitar N+1: usar queries adecuadas en repositorios.

12) Estilo de código y calidad
TypeScript estricto.

Zod para validar:

DTOs de entrada/salida

variables de entorno en src/lib/env.ts

Funciones puras en domain cuando sea posible.

“No magic strings”: enums centralizados.

Nombres:

businessId, resourceId, serviceId, appointmentId

startAt, endAt, occupiedEndAt

Botones con cursor pointer: todos los botones (shadcn/ui Button y botones HTML nativos) deben incluir cursor-pointer en su className para indicar interactividad al hacer hover.

13) Convención de commits y ramas (recomendado)
Commits: feat: ..., fix: ..., chore: ..., docs: ...

PRs pequeños: una feature coherente por PR.

Cambios de API deben actualizar DTOs y docs relevantes.

14) Checklist para nuevas features (para Copilot y humanos)
 DTO validado con Zod

 Auth + tenant check aplicado

 Errores mapeados a códigos estándar

 No se filtra PII en logs

 Queries con filtros por business_id donde corresponda

 Timezone correcto (input/output)

 Caso de conflicto (409) contemplado

 UI maneja estados loading/error/empty

 Si aplica reserva pública: validar service ACTIVE, resource ACTIVE, y mapping Service↔Resource
```
