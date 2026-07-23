# InformationArchitecture.md

## Objetivo del documento

Definir una arquitectura de informacion base para BurgerWrapped que permita disenar interfaces consistentes, orientadas a mobile-first y preparadas para crecer sin saturar la navegacion principal.

## Principios de arquitectura de informacion

1. **Burger como unidad central**: posts, restaurantes, wishlist y rankings deben girar alrededor de experiencias burger concretas.
2. **Navegacion corta**: las secciones principales deben caber en la bottom nav.
3. **Herramientas agrupadas**: funcionalidades secundarias viven en `/more`.
4. **Contexto visible**: cada pantalla debe aclarar si muestra datos propios, globales, de un grupo, de un usuario o de un restaurante.
5. **Privacidad visible**: distinguir contenido publico, privado, de grupo o solo propio.
6. **Accion principal persistente**: anadir post debe ser facil de encontrar en los contextos principales.
7. **Estados claros**: carga, vacio, error, bloqueado y sin permisos deben estar definidos.

## Navegacion principal actual

### Home

Ruta: `/`

Si hay sesion, muestra el dashboard personal. Si no hay sesion, muestra landing.

Objetivo UX:

- Que el usuario vea su actividad, resumen anual, filtros e historial.
- Que el usuario pueda anadir entradas o navegar a herramientas personales.

### Feed

Ruta: `/feed`

Objetivo UX:

- Descubrir posts.
- Interactuar con likes, comentarios, guardados y perfiles.
- Alternar entre feed global, following u otros contextos si aplica.

### Search

Ruta: `/search`

Objetivo UX:

- Buscar usuarios y restaurantes desde un unico punto.
- Abrir perfiles, posts o vistas de restaurante.

### More

Ruta: `/more`

Objetivo UX:

- Agrupar herramientas que no caben en la navegacion principal: grupos, ranking, guardados, wishlist, calendario, My Top Burgers y otras futuras.
- Mostrar invitaciones pendientes o novedades con un solo badge `new` cuando aplique.

### Profile

Ruta: `/profile`

Objetivo UX:

- Ver la identidad burger propia.
- Acceder a ajustes.
- Revisar informacion personal, preferencias y actividad visible.

## Rutas funcionales relevantes

| Ruta | Proposito |
|---|---|
| `/login` | Login, registro y OAuth. |
| `/setup-username` | Configuracion inicial de username. |
| `/profile/settings` | Ajustes de cuenta, perfil, privacidad, idioma, moneda y preferencias. |
| `/users/:userId` | Dashboard publico o privado de otro usuario. |
| `/posts/:entryId` | Detalle de post. |
| `/groups` | Listado y gestion de grupos. |
| `/groups/:groupId` | Feed, ranking o detalle de grupo. |
| `/ranking` | Ranking global. |
| `/saved` | Posts guardados. |
| `/burger-wishlist` | Burgers privadas para probar. |
| `/burger-calendar` | Calendario de actividad burger. |
| `/my-top-burgers` | Ranking personal de burgers de restaurante. |
| `/restaurants` | Ruta legacy redirigida a `/search`. |
| `/admin/feed` | Moderacion de posts y comentarios. |
| `/admin/users` | Gestion de usuarios. |
| `/admin/reports` | Revision de reportes. |
| `/admin/notifications` | Campanas push administrativas. |

## Estructura recomendada de una pantalla app

```text
AppShell
|-- PageHeader
|   |-- leading, si hay vuelta o contexto
|   |-- logo/avatar/contexto visual
|   |-- titulo
|   |-- subtitulo opcional
|   `-- acciones opcionales
`-- main.bw-main
    |-- contenido principal
    |-- filtros o tabs, si aplican
    |-- listado/cards/feed
    `-- estados de carga, vacio o error
BottomNav
```

## Estructura por post

Un post debe priorizar:

1. Foto.
2. Usuario y fecha.
3. Burger y restaurante.
4. Rating, precio y metadatos utiles.
5. Acciones sociales.
6. Comentarios o preview.
7. Estados privados del viewer, si aplican.

## Estructura por perfil

Un perfil debe separar:

- Identidad.
- Relacion social: seguir, seguidores, siguiendo.
- Preferencias burger.
- Privacidad.
- Posts visibles.
- Acciones propias si es el perfil del usuario.
- Acciones admin si se entra en modo admin.

## Estructura por grupo

Un grupo debe separar:

- Identidad del grupo.
- Miembros e invitaciones.
- Feed de grupo.
- Estadisticas o ranking.
- Gestion solo para usuarios con permisos.

## Estructura de `/more`

`/more` debe organizar herramientas por bloques:

- Actividad personal.
- Social y rankings.
- Utilidades o configuraciones relacionadas.
- Admin solo si corresponde y no se esta ya en modo admin.

Regla de badge:

- Si se anade una herramienta nueva en `/more`, marcarla con `badge: 'new'`.
- Retirar el badge anterior en el mismo cambio.
- Solo debe haber una opcion con `Nuevo`.

## Jerarquia de acciones

### Accion primaria

La accion que permite avanzar o completar el objetivo de la pantalla.

Ejemplos:

- Anadir burger.
- Guardar.
- Publicar.
- Crear grupo.
- Aceptar invitacion.
- Activar notificaciones.
- Enviar prueba.

### Accion secundaria

Accion util pero no principal.

Ejemplos:

- Ver detalle.
- Volver.
- Compartir.
- Guardar para probar.
- Editar.
- Filtrar.

### Accion destructiva o sensible

Debe requerir confirmacion clara.

Ejemplos:

- Eliminar post.
- Quitar burger de wishlist.
- Ocultar contenido como admin.
- Cancelar campana push.
- Cerrar sesion.

## Listados

Los listados deben ayudar a localizar, comparar y actuar.

Reglas:

- En movil, usar cards o feed items.
- En escritorio, permitir mas densidad sin perder jerarquia.
- Mostrar estado y accion contextual.
- Evitar tablas si el contenido es visual.
- Usar buscador y filtros cuando el volumen pueda crecer.

## Guardrails

La IA debe evitar:

- Crear mas items en la bottom nav sin justificar una reorganizacion completa.
- Ocultar acciones frecuentes dentro de menus profundos.
- Mezclar feed global, feed de usuario y feed de grupo sin titulo o contexto.
- Presentar contenido privado como si fuera publico.
- Hacer pantallas de admin con estetica de feed social.
