# User Stories + Criterios de Aceptación (MVP)

## Convenciones

-   “Recurso” = entidad reservable (persona o activo).
-   “Servicio” = lo que el cliente reserva (duración/buffer/precio).
-   “Negocio” = tenant.
-   Estados de turno mínimos: `SCHEDULED`, `CANCELLED`, `RESCHEDULED` (opcional `COMPLETED`).

---

## Épica 1 — Cuenta y negocio

### US-1.1 Registro/Login

**Como** admin  
**Quiero** registrarme/iniciar sesión  
**Para** administrar mi negocio.

**Aceptación**

-   Auth con Supabase.
-   Usuario no autenticado no accede a dashboard ni APIs privadas.
-   Errores de login con mensajes claros.

### US-1.2 Crear negocio

**Como** admin  
**Quiero** crear mi negocio  
**Para** publicar turnos.

**Aceptación**

-   Campos: nombre (req), timezone (req), dirección (opt), ciudad/zona (opt).
-   Crea negocio asociado al usuario y lo muestra en dashboard.

### US-1.3 Configurar etiqueta visible de “Recurso”

**Como** admin  
**Quiero** definir cómo se llamarán mis recursos (ej: Cancha/Profesional)  
**Para** que la UI sea acorde a mi rubro.

**Aceptación**

-   Campo `resource_label` (default “Recurso”).
-   Se refleja en dashboard y página pública.

### US-1.4 Link público

**Como** admin  
**Quiero** un link público del negocio  
**Para** compartirlo con clientes.

**Aceptación**

-   URL pública única por negocio (slug).
-   Si no hay servicios activos, muestra mensaje de estado vacío.

---

## Épica 2 — Recursos

### US-2.1 Crear recurso

**Como** admin  
**Quiero** crear recursos  
**Para** asignarles disponibilidad y recibir reservas.

**Aceptación**

-   Campos: nombre (req), tipo (opt PERSON/ASSET), estado (ACTIVE/INACTIVE).
-   Aparece en listado del negocio.
-   Recursos INACTIVE no aparecen al cliente.

### US-2.2 Editar/Desactivar recurso

**Como** admin  
**Quiero** editar/desactivar recursos  
**Para** mantenerlos actualizados.

**Aceptación**

-   Cambiar nombre y estado.
-   Desactivar no borra turnos futuros; solo deja de ofrecerse al cliente.

### US-2.3 Eliminar recurso (soft delete)

**Como** admin  
**Quiero** eliminar un recurso  
**Para** limpiar recursos obsoletos.

**Aceptación**

-   Si hay turnos futuros: no permite eliminar; sugiere desactivar.
-   Si no hay turnos futuros: soft delete y desaparece del listado.

---

## Épica 3 — Servicios

### US-3.1 Crear servicio

**Como** admin  
**Quiero** crear servicios  
**Para** que el cliente elija qué reservar.

**Aceptación**

-   Campos: nombre (req), duración min (req > 0), buffer (>=0), precio (opt).
-   Servicio activo se ve en página pública.
-   Validación: duración múltiplo de 5 o 10 (definir regla y aplicar).

### US-3.2 Editar servicio

**Como** admin  
**Quiero** editar servicio  
**Para** ajustar duración/precio/buffer.

**Aceptación**

-   Cambios afectan slots ofrecidos hacia adelante.
-   Turnos ya creados no se “recalculan” retroactivamente.

### US-3.3 Desactivar servicio

**Como** admin  
**Quiero** desactivar servicio  
**Para** que no se pueda reservar más.

**Aceptación**

-   Servicio desactivado no aparece públicamente.
-   Turnos existentes se mantienen visibles en agenda.

### US-3.4 Asignar recursos a un servicio (Service ↔ Resource)

**Como** admin  
**Quiero** asignar qué recursos atienden cada servicio  
**Para** controlar con quién/dónde se puede reservar ese servicio.

**Aceptación**

-   Desde el detalle o listado de servicios, puedo definir el set de recursos asignados (multi-select).
-   Solo permite asignar recursos del mismo negocio y en estado `ACTIVE` (y no deleted).
-   La asignación es idempotente (reemplaza el set completo).
-   Si un servicio `ACTIVE` queda sin recursos asignados:
    -   En la UI pública no debe permitir avanzar a reserva (estado vacío o mensaje “no hay recursos disponibles para este servicio”).
-   Cambios impactan solo a futuro (no alteran turnos ya creados).

---

## Épica 4 — Disponibilidad por recurso

### US-4.1 Disponibilidad semanal

**Como** admin  
**Quiero** definir disponibilidad semanal por recurso  
**Para** controlar cuándo se puede reservar.

**Aceptación**

-   Múltiples rangos por día.
-   Validaciones: inicio < fin, día válido.
-   Si un recurso no tiene disponibilidad, no ofrece slots.

### US-4.2 Bloqueos puntuales (opcional V1)

**Como** admin  
**Quiero** bloquear rangos específicos  
**Para** cubrir feriados/mantenimiento.

**Aceptación**

-   Bloqueo con inicio/fin (timestamptz), motivo opcional.
-   Impide ofrecer slots en ese rango.

---

## Épica 5 — Reserva (cliente)

### US-5.1 Ver servicios disponibles

**Como** cliente  
**Quiero** ver servicios activos  
**Para** elegir qué reservar.

**Aceptación**

-   Lista de servicios activos con nombre/duración/precio (si existe).
-   Estado vacío si no hay servicios activos.

> Nota: con mapping Service↔Resource, un servicio “reservable” debería tener al menos 1 recurso ACTIVE asignado.
> Si el producto decide mostrar servicios aunque no tengan recursos, entonces al entrar debe mostrar estado vacío al intentar avanzar.
> (Preferencia UX recomendada: no mostrar servicios sin recursos disponibles).

### US-5.2 Elegir recurso (refactor: filtrar por servicio)

**Como** cliente  
**Quiero** elegir un recurso disponible para el servicio elegido  
**Para** decidir con quién/dónde reservar.

**Aceptación**

-   La lista de recursos se filtra por:
    -   recursos `ACTIVE` y no deleted
    -   **asignados al servicio elegido (Service ↔ Resource)**
-   Si hay 1 recurso disponible para ese servicio: se omite el paso (auto-selección).
-   Si hay >1: se muestra listado usando `resource_label`.
-   Si hay 0 recursos disponibles: estado vacío claro (“No hay {resource_label} disponibles para este servicio”).

### US-5.3 Ver slots disponibles (service + resource)

**Como** cliente  
**Quiero** ver horarios disponibles reales  
**Para** reservar sin consultar manualmente.

**Aceptación**

-   Slots calculados para el par `(serviceId, resourceId)`:
    -   disponibilidad semanal del recurso
    -   menos bloqueos puntuales del recurso
    -   menos turnos ya ocupados (considera duración+buffer del servicio y `occupied_end_at`)
-   Si el recurso no ofrece el servicio (mapping inexistente): no devuelve slots (error controlado o lista vacía según convención).
-   Zona horaria consistente (del negocio) y visible.

### US-5.4 Confirmar reserva (crear turno)

**Como** cliente  
**Quiero** confirmar el turno con mis datos  
**Para** asegurar mi reserva.

**Aceptación**

-   Requiere nombre + (email o teléfono).
-   Valida antes de crear:
    -   `service` ACTIVE
    -   `resource` ACTIVE
    -   mapping Service ↔ Resource existe
    -   slot sigue libre
-   Crea `appointment` `SCHEDULED` si el slot sigue libre.
-   Si el slot se ocupó entre selección y confirmación: error “ya no disponible”.

### US-5.5 Confirmación por email

**Como** cliente  
**Quiero** recibir confirmación por email  
**Para** tener el turno registrado.

**Aceptación**

-   Email con resumen: negocio, servicio, recurso, fecha/hora, dirección/instrucciones.
-   Si falla envío: el turno queda creado, se registra error para reintento.

---

## Épica 6 — Agenda y gestión (negocio)

### US-6.1 Ver agenda por día y recurso

**Como** admin/staff  
**Quiero** ver agenda filtrable por recurso  
**Para** organizar el trabajo.

**Aceptación**

-   Vista día (hoy por defecto), filtro por recurso/todos.
-   Lista ordenada por hora con datos mínimos.
-   Solo muestra turnos del negocio.
-   Turnos existentes se muestran aunque el servicio o recurso se desactiven luego.

### US-6.2 Cancelar turno

**Como** admin/staff  
**Quiero** cancelar un turno  
**Para** liberar el horario.

**Aceptación**

-   Cambia estado a `CANCELLED` (con motivo opcional).
-   Envía email de cancelación.
-   Slot queda disponible nuevamente.

### US-6.3 Reprogramar turno

**Como** admin/staff  
**Quiero** reprogramar un turno  
**Para** moverlo a otro horario.

**Aceptación**

-   Selector de slots válidos (considerando service + resource).
-   DB impide double-booking en el nuevo slot.
-   Guarda referencia (ej: `rescheduled_from_id`).
-   Envía email con nuevo horario.

### US-6.4 Marcar completado (opcional V1)

**Como** admin/staff  
**Quiero** marcar turno completado  
**Para** control mínimo.

**Aceptación**

-   Cambia estado a `COMPLETED`.
-   No afecta disponibilidad.

---

## Épica 7 — Recordatorios

### US-7.1 Configurar recordatorios

**Como** admin  
**Quiero** activar/desactivar recordatorios y offsets  
**Para** reducir no-shows.

**Aceptación**

-   Toggle enabled.
-   Selección simple: 24h y/o 2h.

### US-7.2 Enviar recordatorios (sistema)

**Como** sistema  
**Quiero** enviar recordatorios automáticos  
**Para** reducir olvidos.

**Aceptación**

-   Solo a turnos `SCHEDULED`.
-   No duplicar envíos (idempotencia).
-   Registrar `SENT/FAILED` para monitoreo.

---

## Épica 8 — Multi-tenant y permisos

### US-8.1 Aislamiento por negocio

**Como** sistema  
**Quiero** que un negocio no acceda a datos de otro  
**Para** asegurar privacidad.

**Aceptación**

-   Backend valida `business_id` en todas las queries.
-   Accesos cruzados devuelven 403/404.
-   (Opcional) RLS en Supabase como capa adicional.
