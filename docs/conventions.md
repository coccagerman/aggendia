# Conventions — turnosapp

Este documento define convenciones de arquitectura, estructura y estilo para construir features de forma consistente, segura y mantenible.

---

## 1) Objetivos de arquitectura

-   **Separación clara de responsabilidades:**  
    `api` (transporte) ≠ `domain` (reglas) ≠ `data` (persistencia).
-   **Multi-tenant seguro:** todo dato está aislado por `business_id`.
-   **Consistencia fuerte:** evitar double-booking (DB + validación).
-   **DX alta y código predecible:** tipado fuerte, validaciones y errores uniformes.
-   **Evolución simple:** permitir separar backend en el futuro sin reescribir dominio.
-   **MVP con catálogo real:** servicios y recursos existen por separado y se **mapean** explícitamente (Service ↔ Resource).
-   **Modelo de turnos simple:** la agenda se organiza en **slots discretos** definidos por la periodicidad de cada servicio.

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

### Reglas base

Los **Route Handlers** (src/app/api/...) solo hacen:

1.  auth + tenant resolution

2.  parseo y validación de input (DTO)

3.  llamada a servicios de domain

4.  mapeo de errores a HTTP


Reglas estrictas:

*   domain/ **no importa** Next.js ni Prisma.

*   data/ **no contiene reglas de negocio**, solo persistencia.


3) Convención REST (endpoints, routes y DTOs)
---------------------------------------------

### Base

*   Prefijo: /api/v1

*   JSON siempre (Content-Type: application/json)

*   Paginación y filtros por query params

*   IDs siempre UUID (excepto slug en endpoints públicos)


### Recursos principales

#### Businesses

*   GET /api/v1/businesses

*   POST /api/v1/businesses

*   GET /api/v1/businesses/:businessId

*   PATCH /api/v1/businesses/:businessId


#### Resources (Recurso)

*   GET /api/v1/businesses/:businessId/resources

*   POST /api/v1/businesses/:businessId/resources

*   GET /api/v1/businesses/:businessId/resources/:resourceId

*   PATCH /api/v1/businesses/:businessId/resources/:resourceId

*   DELETE /api/v1/businesses/:businessId/resources/:resourceId (soft delete)


#### Services (Servicio)

*   GET /api/v1/businesses/:businessId/services

*   POST /api/v1/businesses/:businessId/services

*   PATCH /api/v1/businesses/:businessId/services/:serviceId

*   DELETE /api/v1/businesses/:businessId/services/:serviceId


Los servicios definen:

*   duración del turno

*   periodicidad de turnos (intervalo entre inicios)

*   precio opcional


### Mapping Service ↔ Resource (MVP)

Objetivo:un servicio puede ofrecerse por uno o varios recursos, y un recurso puede ofrecer varios servicios.

*   GET /api/v1/businesses/:businessId/services/:serviceId/resources

*   PUT /api/v1/businesses/:businessId/services/:serviceId/resources

    *   body: { resourceIds: string\[\] }

    *   reemplaza el set completo (idempotente)


Opcional (si simplifica UI):

*   GET /api/v1/businesses/:businessId/resources/:resourceId/services

*   PUT /api/v1/businesses/:businessId/resources/:resourceId/services


**Regla de dominio:**al crear turnos o calcular slots con (serviceId, resourceId), validar siempre que exista el mapping.

### Availability

*   GET /api/v1/businesses/:businessId/resources/:resourceId/availability

*   PUT /api/v1/businesses/:businessId/resources/:resourceId/availability

*   POST /api/v1/businesses/:businessId/resources/:resourceId/blocks

*   DELETE /api/v1/businesses/:businessId/resources/:resourceId/blocks/:blockId


### Appointments

*   GET /api/v1/businesses/:businessId/appointments?date=YYYY-MM-DD&resourceId=...

*   POST /api/v1/businesses/:businessId/appointments

*   POST /api/v1/public/appointments

*   PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/cancel

*   PATCH /api/v1/businesses/:businessId/appointments/:appointmentId/reschedule


### Public (cliente)

*   GET /api/v1/public/businesses/:slug

*   GET /api/v1/public/businesses/:slug/services

*   GET /api/v1/public/businesses/:slug/resources?serviceId=...

*   GET /api/v1/public/slots?slug=...&serviceId=...&resourceId=...&from=...&to=...


Validaciones obligatorias:

*   servicio ACTIVE

*   recurso ACTIVE

*   mapping Service ↔ Resource existente


4) DTOs (Data Transfer Objects)
-------------------------------

Los DTOs son contratos de API, distintos a los modelos de DB.

*   Validación en frontera con **Zod**.

*   Conversión DTO → dominio explícita.


Convención:

*   src/domain//.types.ts → tipos de dominio

*   src/app/api/v1/.../dto.ts → DTOs de API


5) Respuestas: forma estándar
-----------------------------

### Éxito

*   200 OK → { data: ... }

*   201 Created → { data: ... }


### Listas

Plain textANTLR4BashCC#CSSCoffeeScriptCMakeDartDjangoDockerEJSErlangGitGoGraphQLGroovyHTMLJavaJavaScriptJSONJSXKotlinLaTeXLessLuaMakefileMarkdownMATLABMarkupObjective-CPerlPHPPowerShell.propertiesProtocol BuffersPythonRRubySass (Sass)Sass (Scss)SchemeSQLShellSwiftSVGTSXTypeScriptWebAssemblyYAMLXML`   { "data": [...], "meta": { "page": 1, "pageSize": 20, "total": 120 } }   `

6) Autenticación, autorización y multi-tenant
---------------------------------------------

*   Auth: Supabase Auth (usuarios internos).

*   Nunca confiar en businessId enviado por el cliente.

*   Validar siempre pertenencia en business\_members.


Funciones sugeridas:

*   requireUser()

*   requireBusinessAccess(userId, businessId)


7) Convención de errores y códigos
----------------------------------

Errores de negocio relevantes:

*   SERVICE\_RESOURCE\_NOT\_LINKED

*   APPOINTMENT\_SLOT\_TAKEN

*   APPOINTMENT\_OUTSIDE\_AVAILABILITY


Los conflictos de agenda siempre devuelven **409**.

8) Timezone policy (crítica)
----------------------------

*   Guardar timestamps en UTC (timestamptz)

*   Calcular slots en timezone del negocio

*   Convertir a UTC antes de persistir

*   Usar librería con soporte TZ (Luxon / date-fns-tz)


9) Reglas de consistencia (double-booking)
------------------------------------------

Requisito:

*   Prohibir solapamientos por resource\_id considerando el **intervalo ocupado del turno**.


Estrategia:

*   occupied\_end\_at = start\_at + slot\_interval\_minutes

*   Constraint EXCLUDE en DB sobre (resource\_id, tstzrange(start\_at, occupied\_end\_at))


10) Seguridad y PII
-------------------

*   Minimizar PII (nombre + email/teléfono).

*   No loguear datos sensibles.

*   Rate limiting futuro en endpoints públicos.


11) Performance y buenas prácticas
----------------------------------

*   Limitar rango de slots (ej: máximo 30 días).

*   Evitar N+1 en repositorios.

*   Índices clave en appointments y service\_resources.


12) Estilo de código y calidad
------------------------------

*   TypeScript estricto.

*   Zod para DTOs y env.

*   Enums centralizados.

*   Nombres consistentes:businessId, resourceId, serviceId, appointmentId,startAt, endAt, occupiedEndAt.


13) Convención de commits y ramas
---------------------------------

*   feat:, fix:, chore:, docs:

*   PRs pequeños y coherentes.


14) Checklist para nuevas features
----------------------------------

*   DTO validado con Zod

*   Auth + tenant check aplicado

*   Errores mapeados a códigos estándar

*   Timezone correcto

*   Conflictos (409) contemplados

*   UI maneja loading / error / empty

*   En reservas públicas:

    *   service ACTIVE

    *   resource ACTIVE

    *   mapping Service ↔ Resource validado

```
