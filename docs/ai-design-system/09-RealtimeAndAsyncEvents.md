# RealtimeAndAsyncEvents.md

## Objetivo del documento

Definir como deben reflejarse en la experiencia de usuario los procesos asincronos y eventos en tiempo real de BurgerWrapped.

BurgerWrapped usa Supabase Realtime, Web Push, Service Worker, Edge Functions y cache en cliente. Las propuestas de la IA deben contemplar cambios de estado sin exigir recargas manuales innecesarias.

## Principio UX

Cuando una operacion tarda o depende de backend, el usuario debe saber que el sistema esta trabajando, que puede hacer mientras tanto y como recuperarse si falla.

## Procesos asincronos relevantes

### Crear entrada

Operaciones:

- Procesar imagen.
- Cropear o comprimir.
- Subir a Storage `food-photos`.
- Insertar en `entries`.
- Refrescar dashboard, feed o restaurante.

Experiencia esperada:

- Mostrar progreso o estado de guardado.
- Deshabilitar doble envio.
- Explicar errores de foto, red o validacion.
- Mantener datos del formulario si algo falla.

### Avatar de perfil

Operaciones:

- Subir a Storage `avatars`.
- Actualizar `profiles`.
- Eliminar avatar anterior si aplica.
- Refrescar avatar en bottom nav y perfil.

Experiencia esperada:

- Preview antes de guardar.
- Estado de guardado.
- Fallback con inicial.
- Evento local para refrescar avatar sin recargar.

### Feed y entradas

Realtime:

- Cambios en `entries`.
- Likes, bookmarks, comentarios y reports segun flujo.

Experiencia esperada:

- Actualizar listas sin perder posicion cuando sea posible.
- Mostrar nuevos datos de forma no intrusiva.
- No duplicar posts.
- Mantener filtros activos.

### Grupos e invitaciones

Realtime:

- `groups`.
- `group_members`.
- `group_invitations`.

Experiencia esperada:

- Refrescar invitaciones pendientes.
- Actualizar miembros o acceso al aceptar/rechazar.
- Mostrar estados de grupo vacio o sin permisos.

### Follows y perfiles

Realtime o refresco:

- `follows`.
- `profiles`.

Experiencia esperada:

- Actualizar contadores y estados de seguimiento.
- Evitar inconsistencias entre modal de perfiles y dashboard publico.

### Notificaciones in-app

Realtime:

- Inserciones en `notifications`.

Experiencia esperada:

- Actualizar indicador o bandeja.
- Permitir abrir deep links a posts, perfiles o grupos.
- Mostrar estado leido/no leido.

### Web Push

Elementos:

- `public/sw.js`.
- `src/lib/pushNotifications.ts`.
- `push_subscriptions`.
- Edge Function `send-push`.
- Edge Functions administrativas.

Experiencia esperada:

- Pedir permiso solo tras accion explicita.
- Mostrar explicacion propia antes del permiso nativo.
- Guiar iOS/iPadOS a instalar PWA cuando aplique.
- Permitir configurar preferencias de likes, comentarios, follows, invitaciones y avisos admin.
- Al pulsar push, abrir el deep link adecuado.

### Campanas push administrativas

Operaciones:

- Previsualizar en dispositivo administrador.
- Enviar ahora con confirmacion.
- Programar por hora local.
- Procesar entregas con Cron.
- Reintentar o marcar errores.

Experiencia esperada:

- Estados visibles de campana y entregas.
- Confirmacion antes de envio inmediato.
- Validacion de deep link.
- Cancelacion o edicion solo cuando el estado lo permite.

## Estados recomendados en UI

Para procesos asincronos:

- Pendiente.
- Preparando.
- Subiendo.
- Guardando.
- Enviando.
- Programado.
- En proceso.
- Completado.
- Error.
- Requiere reintento.
- Cancelado.

## Reglas de feedback

### Durante el proceso

Ejemplo:

> Guardando tu burger...

### Al completarse

Ejemplo:

> Burger publicada. Ya aparece en tu historial.

### Al fallar

Ejemplo:

> No hemos podido guardar la burger. Revisa tu conexion e intentalo de nuevo.

### Al no tener permisos

Ejemplo:

> No puedes ver este contenido. Puede ser privado o pertenecer a un grupo al que no estas unido.

## Cache en cliente

El proyecto usa `sessionStorage` para:

- Entradas del feed.
- Opciones de meses.
- Entradas del dashboard.
- Follows.
- Algunos datos de perfil o grupos.

Reglas:

- No mostrar cache obsoleto como verdad si la accion acaba de cambiar datos.
- Refrescar al volver al foco cuando sea necesario.
- No guardar secretos.
- No usar cache como autorizacion.

## Patrones UX recomendados

### Skeleton

Para feed, dashboard, estadisticas o cards repetidas.

### Estado inline

Para likes, comentarios, guardados, wishlist o entregas de campana.

### Snackbar o mensaje breve

Para confirmaciones no bloqueantes.

### Modal de confirmacion

Para eliminar, cancelar, ocultar, enviar ahora o cerrar sesion.

### Banner persistente

Para avisos que afectan a toda una pantalla o permiso push.

## Guardrails

La IA no debe disenar procesos asincronos como si siempre fueran instantaneos.

La IA debe incluir:

- Estado inicial.
- Estado en proceso.
- Estado completado.
- Estado de error.
- Accion de recuperacion.
- Comportamiento si el usuario no tiene sesion o permisos.
