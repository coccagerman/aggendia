# Flujos principales (MVP)

## Flujo 1 — Onboarding del negocio

**Admin**

1. Registrarse/Login (Supabase Auth)
2. Crear negocio (nombre, timezone, resource_label)
3. Dashboard muestra checklist: recursos → servicios → disponibilidad
   **Resultado:** negocio listo para publicar turnos.

---

## Flujo 2 — Crear recursos

**Admin**

1. Ir a “Recursos”
2. Crear recurso (nombre, tipo opcional, estado ACTIVE)
3. Repetir (Cancha 1, Cancha 2 / Peluquero 1, etc.)
   **Resultado:** recursos disponibles para agenda y reservas.

---

## Flujo 3 — Crear servicios

**Admin**

1. Ir a “Servicios”
2. Crear servicio (duración, buffer opcional, precio opcional)
3. Servicio queda visible en página pública si `active=true`
   **Resultado:** cliente puede elegir qué reservar.

---

## Flujo 4 — Definir disponibilidad semanal por recurso

**Admin**

1. Entrar a un recurso → “Disponibilidad”
2. Elegir día de semana
3. Agregar rangos (inicio/fin) (múltiples por día)
4. Guardar
   **Resultado:** el sistema puede calcular slots ofrecibles.

---

## Flujo 5 — Reserva de turno (cliente)

**Cliente**

1. Abrir link público `/b/{slug}`
2. Elegir servicio
3. Si hay >1 recurso activo: elegir recurso (usa `resource_label`)
4. Ver slots disponibles
    - disponibilidad semanal
    - menos bloqueos puntuales
    - menos turnos existentes (considera `occupied_end_at`)
5. Elegir fecha/hora
6. Completar datos (nombre + email/teléfono)
7. Confirmar reserva
   **Sistema**

-   Crea/Upsert customer
-   Crea appointment `SCHEDULED`
-   DB rechaza si hay solapamiento (anti double-booking)
-   Crea notification de confirmación y envía email
    **Resultado:** turno confirmado sin doble reserva.

---

## Flujo 6 — Ver agenda (negocio)

**Admin/Staff**

1. Entrar a “Agenda”
2. Elegir día (hoy default)
3. Filtrar por recurso o “Todos”
4. Ver lista ordenada por hora con estado y detalles
   **Resultado:** operación diaria organizada.

---

## Flujo 7 — Cancelar turno

**Admin/Staff**

1. Abrir turno `SCHEDULED`
2. Cancelar (motivo opcional)
   **Sistema**

-   Actualiza estado a `CANCELLED`
-   Envia email cancelación
-   Slot vuelve a estar disponible
    **Resultado:** turno cancelado + cliente notificado.

---

## Flujo 8 — Reprogramar turno

**Admin/Staff**

1. Abrir turno `SCHEDULED`
2. Reprogramar → elegir nuevo slot válido
   **Sistema**

-   Crea turno nuevo o actualiza (recomendado: crear nuevo + `rescheduled_from_id`)
-   DB impide solapamiento en el slot nuevo
-   Envia email con nuevo horario
    **Resultado:** turno movido + trazabilidad.

---

## Flujo 9 — Bloqueo puntual (excepción)

**Admin**

1. Recurso → “Bloqueos”
2. Crear bloqueo (start_at/end_at)
   **Sistema**

-   Evita ofrecer slots en ese rango
    **Resultado:** feriados/mantenimiento cubiertos.

---

## Flujo 10 — Recordatorios automáticos (job)

**Sistema**

1. Job corre cada X minutos
2. Busca turnos `SCHEDULED` próximos según offsets del negocio (24h/2h)
3. Crea notifications PENDING si no existían (idempotencia)
4. Envía email → marca SENT/FAILED
   **Resultado:** recordatorios enviados sin duplicados.

---

## Diagrama (Mermaid) — Reserva de turno

```mermaid
flowchart TD
  A[Cliente abre link del negocio] --> B[Selecciona servicio]
  B --> C{¿Hay >1 recurso activo?}
  C -- No --> D[Recurso auto-seleccionado]
  C -- Sí --> E[Cliente elige recurso]
  D --> F[Mostrar slots disponibles]
  E --> F
  F --> G[Cliente elige fecha/hora]
  G --> H[Cliente ingresa datos]
  H --> I[Confirmar]
  I --> J{DB permite? (anti-overlap)}
  J -- Sí --> K[Crear Appointment SCHEDULED]
  K --> L[Crear/Enviar Notification CONFIRMATION]
  L --> M[Mostrar confirmación]
  J -- No --> N[Error: horario no disponible]
  N --> F
```
