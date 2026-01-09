# ADR-0001 — Stack tecnológico y modelo base de turnos del MVP

**Estado:** Aprobado
**Fecha:** 2026-01-01

## Contexto

Construimos una aplicación web de turnos/reservas **multi-tenant**, orientada a pequeños y medianos negocios, con:

-   UI pública (clientes) + dashboard privado (negocios)
-   **Servicios** (catálogo: duración, periodicidad de turnos y precio)
-   **Recursos reservables** (persona o activo)
-   **Relación Service ↔ Resource**
    (un servicio puede ser ofrecido por uno o varios recursos; y un recurso puede ofrecer varios servicios)
-   Disponibilidad semanal por recurso, bloqueos puntuales y turnos/reservas
-   Prevención de double-booking y notificaciones por email

Los **servicios** definen:

-   la **duración efectiva** del turno
-   la **periodicidad de turnos**, es decir, cada cuánto tiempo se ofrece un nuevo inicio de turno

Este enfoque prioriza un modelo operativo **simple, explícito y predecible**, evitando configuraciones técnicas difíciles de razonar para los negocios.

Con la evolución del producto, el sistema incorpora además reglas y capacidades necesarias para una **operación diaria realista**, manteniendo el mismo modelo mental:

-   reglas de anticipación mínima para reservas
-   gestión completa del ciclo de vida de servicios
-   estados de turno visibles y filtrables
-   creación de turnos tanto por clientes como por el negocio
-   visualización flexible de la agenda

Prioridades:

-   simplicidad operativa
-   bajo costo
-   velocidad de desarrollo
-   base escalable sin reescrituras grandes

---

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

-   **Prisma**

    -   Migrations + cliente tipado

-   Constraints avanzadas (anti double-booking) via **SQL en migrations** si aplica

### Auth

-   **Supabase Auth** (usuarios del negocio)
-   Clientes reservan sin cuenta (MVP) con nombre + email/teléfono

### Autorización / Multi-tenant

-   `business_members` con roles `OWNER | ADMIN | STAFF`
-   Todas las entidades incluyen `business_id` (incluyendo servicios, recursos y sus relaciones)
-   Backend filtra/valida `business_id` según usuario
-   (Opcional) RLS en Supabase como capa extra

---

## Decisiones de dominio relevantes

### Modelo de turnos basado en slots discretos

-   Cada servicio define:

    -   `duration_minutes`
    -   `slot_interval_minutes`

-   Los horarios disponibles se generan avanzando de a `slot_interval_minutes`.
-   Un turno ocupa el rango `[start_at, occupied_end_at)`.

Este modelo se mantiene como base porque permite:

-   cálculo de disponibilidad simple
-   visualización clara de agenda
-   prevención fuerte de solapamientos

---

### Anticipación mínima para reservar

-   Cada negocio puede definir un **tiempo mínimo de anticipación** con el que un cliente puede reservar un turno.
-   La regla se aplica:

    -   al calcular slots ofrecidos públicamente
    -   al validar la creación de un turno

La anticipación mínima se modela como un valor en minutos y es **global al negocio**, no por servicio, para mantener reglas simples y consistentes.

---

### Gestión de servicios: activar, desactivar y eliminar

Los servicios soportan tres estados operativos:

-   **Activo**: visible y reservable (si tiene recursos asignados)
-   **Inactivo**: no reservable, pero conserva historial
-   **Eliminado** (soft delete): solo permitido si no existen turnos futuros

La eliminación no borra datos históricos y evita inconsistencias en reportes o auditoría.

---

### Estados de turnos y operación diaria

Los turnos manejan estados explícitos:

-   `SCHEDULED`

-   `CANCELLED`

-   `RESCHEDULED`

-   `COMPLETED`

-   Solo los estados activos bloquean disponibilidad.

-   La agenda del negocio permite **filtrar turnos por estado**, facilitando la operación y el control diario.

---

### Creación de turnos por el negocio

Además de la reserva pública, el sistema permite que el negocio cree turnos desde el dashboard.

-   Se utiliza la **misma lógica de dominio** que en la reserva del cliente.
-   La diferencia es el origen del turno y quién provee los datos del cliente.

Esto garantiza consistencia en validaciones, reglas de disponibilidad y anti double-booking.

---

### Agenda con múltiples granularidades

La agenda del negocio soporta distintas vistas:

-   día
-   semana
-   mes

Incluye:

-   selector de fecha base
-   navegación temporal hacia adelante y atrás

Estas variaciones son **solo de presentación**. El modelo de turnos y las APIs trabajan siempre con rangos de fechas.

---

## Consecuencias

### Positivas

-   Modelo mental consistente para el negocio.
-   Reglas explícitas y centralizadas en el dominio.
-   Agenda flexible sin complejizar el modelo de datos.
-   Base sólida para reporting y automatizaciones futuras.

### Trade-offs

-   Mayor cantidad de reglas de validación.
-   Consultas de agenda más amplias en vistas semanales/mensuales.
-   Necesidad de UX clara para comunicar anticipación mínima y estados.

---

## Alternativas consideradas

-   Anticipación mínima por servicio (descartado por complejidad).
-   Hard delete de servicios (descartado por impacto histórico).
-   Agenda basada en eventos libres sin slots (descartado por romper el modelo).

---

## Pendientes (ADR futuros)

-   Estrategia de jobs y notificaciones.
-   Métricas y reporting.
-   Integraciones externas (calendarios, pagos).
-   Reglas avanzadas de no-show y penalizaciones.
