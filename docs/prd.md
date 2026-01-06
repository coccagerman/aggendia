# PRD — App de turnos simple y barata (MVP)

> Nota: En algunas conversaciones lo llamamos “PDR”, pero el nombre estándar es **PRD** (Product Requirements Document).

## 1. Resumen

Aplicación web de turnos/reservas **para cualquier rubro**, enfocada en **simplicidad**, **velocidad de uso** y **bajo costo**.  
El MVP permite que un negocio configure su catálogo de servicios, asigne qué recursos los atienden, publique disponibilidad y que sus clientes reserven sin fricción, con control básico (cancelar/reprogramar) y recordatorios por email.

## 2. Problema

Pequeños negocios coordinan turnos por WhatsApp/llamadas/Instagram y sufren:

-   Desorden operativo (papel/notas/agenda informal).
-   Mucho ida y vuelta para consultar disponibilidad.
-   No-shows (olvidos/cancelaciones tarde).
-   Baja visibilidad de horarios disponibles.
-   Herramientas existentes caras o demasiado complejas para el día a día.

## 3. Usuario objetivo

### Admin / Dueño

-   No técnico, quiere algo que “funcione ya”.
-   Prioriza simpleza, control y costo bajo.

### Staff / Operador

-   Necesita ver y gestionar agenda de recursos asignados.

### Cliente final

-   Quiere reservar rápido (menos de 1 minuto).
-   Quiere confirmación y recordatorio.

## 4. Conceptos clave: Servicio y Recurso

### Servicio

Lo que el cliente “elige reservar”. Define:

-   duración
-   buffer (minutos entre turnos)
-   precio (opcional)

Ejemplos: “Corte”, “Color”, “Consulta”, “Cambio de aceite”.

### Recurso

Cualquier cosa “reservable” con agenda propia (persona o activo).
Ejemplos:

-   Peluquería: “Peluquero 1”, “Peluquero 2”
-   Canchas: “Cancha 1”, “Cancha 2”
-   Consultorio: “Consultorio 3”
-   Taller: “Box 1”, “Elevador 1”

UX: cada negocio define un **nombre visible** para “Recurso” (ej: “Profesional”, “Cancha”, “Consultorio”, “Box”).

### Relación Servicio ↔ Recurso (MVP)

Desde el MVP, el negocio define **qué recursos ofrecen qué servicios**.

-   Un servicio puede ser atendido por **uno o varios recursos**.
-   Un recurso puede ofrecer **uno o varios servicios**.

Regla: un servicio solo se ofrece públicamente si está activo **y** tiene al menos un recurso activo asignado.

## 5. Propuesta de valor

-   Reservas simples en pocos pasos: servicio → recurso (si aplica) → fecha/hora → confirmar.
-   Link público compartible del negocio.
-   Agenda clara por recurso (día/semana).
-   Reglas simples (duración/buffer/política de cancelación).
-   Recordatorios automáticos (MVP: email).
-   Configuración flexible sin complejidad: asignar servicios a recursos con un selector simple.

## 6. Objetivos del MVP

1. Un negocio configura y publica turnos sin ayuda técnica.
2. Un cliente reserva online simple y rápido.
3. Evitar **double-booking** (dos reservas para mismo recurso y horario).
4. El negocio puede cancelar/reprogramar y el cliente queda notificado.
5. Agenda usable desde el celular.

## 7. Alcance V1

### A) Cuenta y negocio

-   Registro/login (Supabase Auth).
-   Crear negocio: nombre, timezone, dirección opcional, etiqueta de “Recurso”.
-   Link público por negocio (slug).

### B) Recursos

-   CRUD de recursos (nombre, tipo opcional PERSON/ASSET, estado activo/inactivo).

### C) Servicios

-   CRUD de servicios (duración, buffer opcional, precio opcional).
-   Servicios activos visibles públicamente **solo si** tienen recursos activos asignados.

### D) Asignación Servicio ↔ Recurso (MVP)

-   UI simple para asignar recursos a un servicio (y/o servicios a un recurso).
-   Validaciones:
    -   solo recursos del mismo negocio
    -   no permitir asignar recursos INACTIVE
-   Impacto en el flujo público:
    -   al elegir servicio, la lista de recursos se filtra por los asignados a ese servicio.

### E) Disponibilidad por recurso

-   Disponibilidad semanal por recurso (rangos por día).
-   (Opcional V1 si no complica) Bloqueos puntuales de disponibilidad.

### F) Reservas (cliente)

-   Página pública: elegir servicio → recurso (si aplica) → slot → confirmar datos.
-   Reglas:
    -   recursos ofrecidos = activos y asignados al servicio elegido
    -   si hay 1 recurso disponible para ese servicio, se omite el paso (auto-selección)
-   Datos mínimos: nombre + email o teléfono (según regla).
-   Confirmación de reserva.

### G) Agenda (negocio)

-   Vista de agenda por día con filtro por recurso.
-   Acciones: cancelar, reprogramar (confirmar opcional).

### H) Notificaciones

-   Email de confirmación.
-   Recordatorios 24h/2h antes (config simple on/off y offsets).

## 8. Fuera de alcance (por ahora)

-   Pagos online / señas.
-   App móvil nativa.
-   Integración bidireccional con Google Calendar/Outlook.
-   Marketplace/descubrimiento de negocios.
-   Multi-sucursal compleja.
-   Clases grupales con cupos (capacidad > 1).
-   Automatizaciones avanzadas (cobro no-show, reglas por cliente).
-   WhatsApp automático si frena el MVP por costos/aprobaciones.
-   Reglas avanzadas de asignación (skills por recurso, precios distintos por recurso, etc.). _(Podría venir después, sobre la misma relación Service↔Resource.)_

## 9. Requisitos no funcionales

-   Mobile-first.
-   Confiable: impedir double-booking (idealmente a nivel DB).
-   Seguro: aislamiento multi-tenant por negocio.
-   Observabilidad mínima: logging + tracking de errores.

## 10. Métricas de éxito (MVP)

-   Tiempo a “primer turno” (desde registro hasta primera reserva).
-   Conversión del link público a reserva.
-   No-show rate.
-   Retención mensual de negocios.
-   Baja fricción en onboarding (pocas consultas/errores).
