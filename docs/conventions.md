# Conventions — turnosapp

Este documento define convenciones de arquitectura, estructura y estilo para construir features de forma consistente, segura y mantenible.

---

## 1) Objetivos de arquitectura

- **Separación clara de responsabilidades:**
  `api` (transporte) ≠ `domain` (reglas) ≠ `data` (persistencia).
- **Multi-tenant seguro:** todo dato está aislado por `business_id`.
- **Consistencia fuerte:** evitar double-booking y duplicación de notificaciones (DB + validación de dominio).
- **DX alta y código predecible:** tipado fuerte, validaciones y errores uniformes.
- **Evolución simple:** permitir separar backend en el futuro sin reescribir reglas de negocio.
- **Modelo explícito:** servicios y recursos existen por separado y se **mapean** explícitamente (Service ↔ Resource).
- **Agenda basada en slots discretos:** definidos por la periodicidad de cada servicio, con vistas flexibles.

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
        service-resources/    # mapping Service ↔ Resource
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
      serviceResources.service.ts
    availability/
      availability.types.ts
      availability.service.ts   # cálculo de slots
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
        serviceResources.repo.ts
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
```

Nota sobre notificaciones:

- `domain/notifications` contiene reglas de negocio (cuándo crear una notificación).
- `data/repositories/notification.repo.ts` solo persiste y consulta notificaciones.
- El envío efectivo (email / WhatsApp) se implementa en servicios de infraestructura o jobs,
  nunca directamente en los Route Handlers.

### Reglas base

Los **Route Handlers** (`src/app/api/...`) solo hacen:

1. autenticación + resolución de tenant
2. parseo y validación de input (DTO)
3. llamada a servicios de dominio
4. mapeo de errores a HTTP

Reglas estrictas:

- `domain/` **no importa** Next.js ni Prisma.
- `data/` **no contiene reglas de negocio**, solo persistencia.

---

## 3) Convención REST (endpoints, routes y DTOs)

### Base

- Prefijo: `/api/v1`
- JSON siempre (`Content-Type: application/json`)
- Paginación y filtros por query params
- IDs siempre UUID (excepto `slug` en endpoints públicos)

---

### Recursos principales

#### Businesses

- GET `/api/v1/businesses`
- POST `/api/v1/businesses`
- GET `/api/v1/businesses/:businessId`
- PATCH `/api/v1/businesses/:businessId`

> Incluye configuraciones globales del negocio (timezone, políticas, anticipación mínima).

---

#### Resources (Recurso)

- GET `/api/v1/businesses/:businessId/resources`
- POST `/api/v1/businesses/:businessId/resources`
- GET `/api/v1/businesses/:businessId/resources/:resourceId`
- PATCH `/api/v1/businesses/:businessId/resources/:resourceId`
- DELETE `/api/v1/businesses/:businessId/resources/:resourceId` (soft delete)

---

#### Services (Servicio)

- GET `/api/v1/businesses/:businessId/services`
- POST `/api/v1/businesses/:businessId/services`
- PATCH `/api/v1/businesses/:businessId/services/:serviceId`
- DELETE `/api/v1/businesses/:businessId/services/:serviceId` (soft delete)

Los servicios definen:

- duración del turno
- periodicidad de turnos (intervalo entre inicios)
- precio opcional

Reglas:

- Servicios pueden **desactivarse** o **eliminarse** (soft delete).
- Servicios eliminados no aparecen en listados ni pueden usarse para nuevas reservas.

---

### Mapping Service ↔ Resource

Objetivo: un servicio puede ofrecerse por uno o varios recursos, y un recurso puede ofrecer varios servicios.

- GET `/api/v1/businesses/:businessId/services/:serviceId/resources`
- PUT `/api/v1/businesses/:businessId/services/:serviceId/resources`
    - body: `{ resourceIds: string[] }`
    - reemplaza el set completo (idempotente)

Opcional:

- GET `/api/v1/businesses/:businessId/resources/:resourceId/services`
- PUT `/api/v1/businesses/:businessId/resources/:resourceId/services`

**Regla de dominio:**

- Al calcular slots o crear turnos con `(serviceId, resourceId)` siempre debe existir el mapping.

---

### Availability

- GET `/api/v1/businesses/:businessId/resources/:resourceId/availability`
- PUT `/api/v1/businesses/:businessId/resources/:resourceId/availability`
- POST `/api/v1/businesses/:businessId/resources/:resourceId/blocks`
- DELETE `/api/v1/businesses/:businessId/resources/:resourceId/blocks/:blockId`

---

### Appointments

- GET `/api/v1/businesses/:businessId/appointments?from=...&to=...&resourceId=...&status=...`
- POST `/api/v1/businesses/:businessId/appointments`
  (creación manual por el negocio)
- POST `/api/v1/public/appointments`
  (creación pública por clientes)
- PATCH `/api/v1/businesses/:businessId/appointments/:appointmentId/cancel`
- PATCH `/api/v1/businesses/:businessId/appointments/:appointmentId/reschedule`
- PATCH `/api/v1/businesses/:businessId/appointments/:appointmentId/complete`

Notas:

- Ambos flujos (público y dashboard) usan el **mismo servicio de dominio**.
- La agenda admite filtros por rango de fechas y estado.

---

#### Notifications (interno)

- GET `/api/v1/businesses/:businessId/notifications`
    - filtros: `status`, `channel`, `type`, `appointmentId`
- (opcional futuro) POST manual para reintentos controlados

Notas:

- No existen endpoints públicos de notificaciones.
- Las notificaciones se crean automáticamente desde eventos de dominio.

---

### Public (cliente)

- GET `/api/v1/public/businesses/:slug`
- GET `/api/v1/public/businesses/:slug/services`
- GET `/api/v1/public/businesses/:slug/resources?serviceId=...`
- GET `/api/v1/public/slots?slug=...&serviceId=...&resourceId=...&from=...&to=...`

Validaciones obligatorias:

- servicio ACTIVE
- recurso ACTIVE
- mapping Service ↔ Resource existente
- respeto de anticipación mínima del negocio

---

## 4) DTOs (Data Transfer Objects)

Los DTOs son contratos de API, distintos a los modelos de DB.

- Validación en frontera con **Zod**.
- Conversión DTO → dominio explícita.

Convención:

- `src/domain/**.types.ts` → tipos de dominio
- `src/app/api/v1/**/dto.ts` → DTOs de API

---

## 5) Respuestas: forma estándar

### Éxito

- 200 OK → `{ data: ... }`
- 201 Created → `{ data: ... }`

### Listas

```json
{ "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 120 } }
```

---

## 6) Autenticación, autorización y multi-tenant

- Auth: Supabase Auth (usuarios internos).
- Nunca confiar en `businessId` enviado por el cliente.
- Validar siempre pertenencia en `business_members`.

Funciones sugeridas:

- `requireUser()`
- `requireBusinessAccess(userId, businessId)`

---

## 7) Convención de errores y códigos

Errores de negocio relevantes:

- `SERVICE_RESOURCE_NOT_LINKED`
- `APPOINTMENT_SLOT_TAKEN`
- `APPOINTMENT_OUTSIDE_AVAILABILITY`
- `APPOINTMENT_TOO_SOON`
- `SERVICE_DELETED`
- `NOTIFICATION_ALREADY_EXISTS`
- `NOTIFICATION_CHANNEL_DISABLED`

Los conflictos de agenda devuelven **409**.

---

## 8) Timezone policy (crítica)

- Guardar timestamps en UTC (`timestamptz`).
- Calcular slots en timezone del negocio.
- Convertir a UTC antes de persistir.
- Usar librería con soporte TZ (Luxon / date-fns-tz).

---

## 9) Reglas de consistencia (double-booking)

Requisito:

- Prohibir solapamientos por `resource_id` considerando el **intervalo ocupado del turno**.

Estrategia:

- `occupied_end_at = start_at + slot_interval_minutes`
- Constraint **EXCLUDE** en DB sobre `(resource_id, tstzrange(start_at, occupied_end_at))`
- Solo aplica a estados activos del turno.

---

## 10) Seguridad y PII

- Minimizar PII (nombre + email/teléfono).
- No loguear datos sensibles ni contenidos de mensajes.
- Los números de teléfono se consideran PII sensible.
- Rate limiting futuro en endpoints públicos.

---

## 11) Performance y buenas prácticas

- Limitar rango de slots ofrecidos (ej: máximo 30–60 días).
- Evitar N+1 en repositorios.
- Índices clave en `appointments` y `service_resources`.
- Queries de agenda siempre por rango (`from` / `to`).

---

## 12) Estilo de código y calidad

- TypeScript estricto.
- Zod para DTOs y env.
- Enums centralizados.
- Nombres consistentes:
  `businessId`, `resourceId`, `serviceId`, `appointmentId`, `startAt`, `endAt`, `occupiedEndAt`.

---

## 13) Convención de commits y ramas

- `feat:` nueva funcionalidad
- `fix:` corrección
- `chore:` tareas internas
- `docs:` documentación

PRs pequeños y coherentes.

---

## 14) Checklist para nuevas features

- DTO validado con Zod
- Auth + tenant check aplicado
- Reglas de dominio reutilizadas
- Anticipación mínima validada si aplica
- Errores mapeados a códigos estándar
- Timezone correcto
- Conflictos (409) contemplados
- UI maneja loading / error / empty
- Notificaciones creadas de forma asincrónica
- Idempotencia garantizada por dominio
- En reservas públicas:
    - service ACTIVE
    - resource ACTIVE
    - mapping Service ↔ Resource válido

## 15) Testing

- Se implementan tests unitarios y e2e para testear cada feature y flujo en totalidad.
- NO se hace skip de tests nunca. Si se necesita recrear una situación específica para testear un flujo, se hace dentro del test mismo.
