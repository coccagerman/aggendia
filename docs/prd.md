# PRD — App de turnos simple y barata

> Nota: En algunas conversaciones lo llamamos “PDR”, pero el nombre estándar es **PRD** (Product Requirements Document).

## 1. Resumen

Aplicación web de turnos/reservas **para cualquier rubro**, enfocada en **simplicidad**, **velocidad de uso** y **bajo costo**.

El producto permite que un negocio configure su catálogo de servicios, defina qué recursos los atienden, publique disponibilidad y gestione su agenda diaria, mientras que los clientes pueden reservar turnos online sin fricción. Incluye control operativo básico, creación manual de turnos y recordatorios automáticos por email y WhatsApp.

---

## 2. Problema

Pequeños y medianos negocios suelen coordinar turnos por WhatsApp, llamadas o redes sociales, lo que genera:

- Desorden operativo (papel, mensajes dispersos, agendas informales).
- Mucho ida y vuelta para consultar disponibilidad.
- Reservas de último momento difíciles de gestionar.
- No-shows por olvidos o cancelaciones tardías.
- Herramientas existentes caras o demasiado complejas para el uso diario.

---

## 3. Usuario objetivo

### Admin / Dueño

- No técnico, quiere algo que “funcione ya”.
- Necesita control sobre su agenda sin complejidad.
- Prioriza costo bajo y reglas claras.

### Staff / Operador

- Gestiona la agenda día a día.
- Necesita ver turnos por distintos rangos de tiempo.
- Requiere filtrar y actualizar estados rápidamente.

### Cliente final

- Quiere reservar rápido (idealmente en menos de un minuto).
- Necesita ver horarios reales y confiables.
- Espera confirmación y recordatorios automáticos.

---

## 4. Conceptos clave: Servicio y Recurso

### Servicio

Lo que el cliente elige reservar. Define:

- **duración del turno**
- **periodicidad de turnos** (cada cuánto se ofrece un nuevo inicio)
- precio (opcional)

Por defecto, la periodicidad es igual a la duración, aunque puede configurarse de forma independiente.

Ejemplos: “Corte”, “Consulta”, “Cambio de aceite”.

Este modelo refleja cómo los negocios organizan su agenda en la práctica:

> “Atiendo turnos cada 30 / 45 / 60 minutos”.

### Recurso

Entidad reservable con agenda propia (persona o activo).

Ejemplos:

- Peluquería: “Peluquero 1”, “Peluquero 2”
- Canchas: “Cancha 1”, “Cancha 2”
- Consultorio: “Consultorio 3”

Cada negocio define el **nombre visible** del recurso (Profesional, Cancha, Box, etc.).

### Relación Servicio ↔ Recurso

Desde el inicio, el negocio define qué recursos ofrecen qué servicios.

- Un servicio puede ser atendido por uno o varios recursos.
- Un recurso puede ofrecer uno o varios servicios.

Regla: un servicio solo se ofrece públicamente si está activo **y** tiene al menos un recurso activo asignado.

---

## 5. Propuesta de valor

- Reservas simples: servicio → recurso (si aplica) → fecha/hora → confirmar.
- Link público compartible por negocio.
- Agenda clara y flexible (día / semana / mes).
- Reglas simples y comprensibles:
    - duración del turno
    - periodicidad de turnos
    - anticipación mínima para reservar

- Control operativo desde el dashboard:
    - crear, cancelar, reprogramar y completar turnos
    - filtrar agenda por estado y recurso

- Recordatorios automáticos por email y WhatsApp.

---

## 6. Objetivos del producto

1. Que un negocio configure y gestione turnos sin ayuda técnica.
2. Que un cliente pueda reservar online de forma rápida y confiable.
3. Evitar **double-booking** en todos los escenarios.
4. Dar al negocio control real de su agenda diaria.
5. Mantener una UX clara y usable desde el celular.

---

## 7. Alcance funcional (V1)

### A) Cuenta y negocio

- Registro / login.
- Crear negocio: nombre, timezone, etiqueta de recurso.
- Configuración básica:
    - anticipación mínima para reservas
    - recordatorios (on/off y offsets)

- Link público del negocio.

### B) Recursos

- Crear, editar y desactivar recursos.
- Eliminación (soft delete) solo si no hay turnos futuros.

### C) Servicios

- Crear, editar y desactivar servicios.
- Eliminación (soft delete) con preservación de historial.
- Configuración de duración y periodicidad.

### D) Asignación Servicio ↔ Recurso

- UI simple para asignar recursos a servicios.
- Validaciones:
    - mismo negocio
    - solo recursos activos

- Impacto directo en la reserva pública.

### E) Disponibilidad

- Disponibilidad semanal por recurso.
- Bloqueos puntuales (feriados, licencias, mantenimiento).

### F) Reservas (cliente)

- Flujo público guiado y simple.
- Horarios ofrecidos respetan:
    - disponibilidad
    - duración y periodicidad del servicio
    - anticipación mínima del negocio

- Datos mínimos: nombre + email o teléfono.
- Confirmación automática por email y WhatsApp.

### G) Agenda y gestión (negocio)

- Agenda con vistas:
    - día
    - semana
    - mes

- Navegación temporal (anterior / siguiente).
- Filtros por:
    - recurso
    - estado del turno

- Acciones:
    - crear turno manualmente
    - cancelar
    - reprogramar
    - marcar como completado

### H) Notificaciones

- Confirmación de turno por email y WhatsApp.
- Recordatorios configurables (24h y 2h antes) por email y WhatsApp.
- Notificaciones de cancelación y reprogramación.

---

## 8. Fuera de alcance (por ahora)

- Pagos online / señas.
- App móvil nativa.
- Integración bidireccional con calendarios externos.
- Marketplace de negocios.
- Multi-sucursal compleja.
- Clases grupales con cupos.
- Automatizaciones avanzadas (penalizaciones, scoring de clientes).
- Automatizaciones avanzadas sobre WhatsApp (respuestas bidireccionales, bots, flujos conversacionales).

---

## 9. Requisitos no funcionales

- Mobile-first.
- Confiable: anti double-booking fuerte.
- Seguro: aislamiento multi-tenant.
- Performance predecible en vistas de agenda amplias.
- Observabilidad básica (logging y errores).
- Tolerancia a fallos de proveedores externos de notificaciones.

---

## 10. Métricas de éxito

- Tiempo a primer turno.
- Conversión del link público a reserva.
- Uso de creación manual de turnos.
- No-show rate.
- Retención mensual de negocios.
- Fricción en onboarding (consultas, errores).
- Tasa de entrega de notificaciones (email / WhatsApp).
