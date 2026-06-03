# Burger Wrapped

Burger Wrapped es una aplicacion web social para registrar hamburguesas, guardar fotos y precios, consultar estadisticas personales, seguir usuarios, crear grupos y explorar rankings.

Este README esta escrito como documentacion tecnica del proyecto. No incluye credenciales, URLs reales ni claves privadas porque el repositorio puede ser publico.

## Stack

- React 19 con TypeScript.
- Vite 7 para desarrollo, build y Vitest.
- React Router con `BrowserRouter`.
- Supabase como backend: Auth, PostgREST, Realtime y Storage.
- i18next/react-i18next para traducciones.
- Material UI Icons para iconografia.
- CSS modular por componente mas estilos compartidos en `src/styles`.
- Vercel Analytics.
- Service Worker servido desde `public/sw.js`.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
npm run test
npm run test:watch
npm run lint
```

Notas:

- `npm run build` ejecuta `tsc -b` y despues `vite build`.
- `npm run test` ejecuta Vitest con `--maxWorkers 1`.
- `npm run lint` analiza todo el repo salvo `dist`.

## Variables De Entorno

Crear un `.env.local` local, sin subirlo al repositorio:

```env
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=PUBLIC_SUPABASE_ANON_KEY
VITE_HEART_AVATAR=false
```

Variables usadas:

- `VITE_SUPABASE_URL`: URL publica del proyecto Supabase.
- `VITE_SUPABASE_ANON_KEY`: clave anon/public de Supabase. Es publica en frontend, por lo que la seguridad debe vivir en RLS y policies.
- `VITE_HEART_AVATAR`: feature flag opcional. Si es `true`, cambia la forma del avatar a corazon.

Seguridad:

- No usar `service_role` en Vite ni en ningun archivo del cliente.
- No commitear `.env.local`.
- No documentar URLs reales de proyectos privados si no quieres asociarlas al repo publico.
- Asumir que cualquier variable `VITE_*` queda visible en el bundle final.

## Arranque De La App

Entrada principal:

- `src/main.tsx`

Responsabilidades:

- Importa CSS global.
- Inicializa i18n.
- Lee `VITE_HEART_AVATAR`.
- Monta `App` dentro de `BrowserRouter` y `PreferencesProvider`.
- Activa Vercel Analytics.
- Registra `/sw.js` al cargar la pagina.

Cliente Supabase:

- `src/lib/supabaseClient.ts`

```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

## Rutas

Definidas en `src/App.tsx`.

| Ruta | Pantalla | Acceso esperado |
| --- | --- | --- |
| `/` | Dashboard si hay sesion, landing si no | Mixto |
| `/home` | Alias/navegacion hacia inicio | Mixto |
| `/feed` | Feed social y busqueda de usuarios | Mixto |
| `/profile` | Perfil propio | Autenticado |
| `/groups` | Listado y gestion de grupos | Autenticado |
| `/ranking` | Ranking global | Mixto |
| `/groups/:groupId` | Detalle de grupo | Autenticado/miembro segun logica |
| `/users/:userId` | Dashboard publico de usuario | Mixto con privacidad |
| `/posts/:entryId` | Detalle de post | Mixto segun visibilidad |
| `/saved` | Posts guardados | Autenticado |
| `/restaurants` | Busqueda/listado de restaurantes | Mixto |
| `/my-top-burgers` | Ranking personal de hamburguesas | Autenticado |
| `/login` | Login/signup/OAuth | Publico |
| `/privacy` | Privacidad | Publico |
| `/setup-username` | Configuracion inicial de username | Autenticado |
| `/reset-password` | Reset de password | Publico/con sesion de reset |
| `/admin/feed` | Moderacion feed | Admin |
| `/admin/users` | Gestion de usuarios | Admin |
| `/admin/reports` | Reportes | Admin |
| `*` | Redireccion a `/` | Publico |

## Modulos Principales

### `App.tsx`

Orquesta:

- Sesion Supabase (`auth.getSession`, `auth.onAuthStateChange`).
- Redirecciones de auth, setup de username y reset password.
- Rutas principales.
- Layouts bloqueados para usuarios no autenticados.
- Acceso admin mediante flags/perfil.

### Dashboard

Archivos:

- `src/components/Dashboard/Dashboard.tsx`
- `src/components/Dashboard/Dashboard.css`

Responsabilidades:

- Cargar entradas del usuario del ano activo.
- Calcular estadisticas anuales.
- Mostrar filtros por mes, precio y tipo de carne.
- Mostrar historial mediante `FeedTabs`.
- Gestionar add/edit/delete de entradas.
- Cargar invitaciones, grupos, notificaciones y datos del perfil.
- Mostrar recordatorio para completar la personalizacion del perfil si falta foto, bio o preferencias burger.

Llamadas Supabase relevantes:

- `entries`: lectura, insercion indirecta via modal, soft delete.
- `groups`: conteo y metadata de grupos.
- `group_members`: membresia de grupos.
- `group_invitations`: invitaciones pendientes.
- `profiles`: username/display name.
- `entry_bookmarks`: deteccion de guardados.

### Feed

Archivos:

- `src/components/FeedTabs/useFeedEntries.ts`
- `src/components/FeedTabs/FeedTabs.tsx`
- `src/components/FeedTabs/FeedEntryCard.tsx`
- `src/components/FeedPage/FeedPage.tsx`

Responsabilidades:

- Cargar feed global, following, feed de usuario, grupos, guardados o filtros de restaurante.
- Aplicar privacidad de perfiles.
- Aplicar filtros de mes, precio y tipo de carne.
- Paginacion con cursor `datetime + id`.
- Realtime de `entries`.
- Likes, guardados, comentarios, reportes y compartir posts.

Tablas:

- `entries`
- `profiles`
- `follows`
- `entry_likes`
- `entry_bookmarks`
- `entry_reports` desde el flujo de reportar post

Notas de privacidad:

- Perfiles privados se filtran en cliente, pero esto no sustituye RLS.
- RLS debe impedir lectura de entradas privadas o perfiles no autorizados aunque alguien llame directamente a Supabase.

### Entradas

Archivo principal:

- `src/components/AddEntryModal/AddEntryModal.tsx`

Responsabilidades:

- Crear entradas.
- Validar formulario con schema local.
- Comprimir/cropear imagenes.
- Subir foto a Supabase Storage.
- Insertar registro en `entries`.

Storage:

- Bucket `food-photos`.
- Se usa `supabase.storage.from('food-photos').upload(...)`.
- Se obtiene URL con `getPublicUrl(...)`.

Seguridad recomendada:

- Limitar tipos MIME en policies o validaciones backend si existen.
- Limitar tamano de archivo.
- Evitar buckets publicos si el producto requiere privacidad real de imagenes.
- Si el bucket es publico, cualquier URL publicada puede ser compartida.

### Perfil

Archivo:

- `src/components/ProfilePage/ProfilePage.tsx`

Responsabilidades:

- Editar username, display name, bio, avatar y preferencias burger.
- Mostrar progreso de personalizacion del perfil.
- Generar una frase de burger ideal desde claves traducibles, sin persistir texto localizado.
- Cambiar password via `supabase.auth.updateUser`.
- Refrescar sesion.
- Logout.
- Gestionar marcos/avatar frame.

Storage:

- Bucket `avatars`.
- Sube avatar con `upsert: true`.
- Elimina avatar anterior cuando detecta path previo en URL publica.

Tablas:

- `profiles`
- `entries` para datos auxiliares de perfil y frames.

### Grupos

Archivos:

- `src/components/GroupsPage/GroupsPage.tsx`
- `src/components/GroupPage/GroupPage.tsx`
- `src/components/CreateGroupModal/CreateGroupModal.tsx`
- `src/components/GroupManageModal/GroupManageModal.tsx`
- `src/components/GroupInvitesModal/GroupInvitesModal.tsx`
- `src/repos/groupRepository.ts`
- `src/usecases/useGroups.ts`

Responsabilidades:

- Crear grupos.
- Invitar amigos mutuos.
- Aceptar/rechazar invitaciones.
- Gestionar miembros.
- Mostrar feed y ranking/estadisticas de grupo.

Tablas:

- `groups`
- `group_members`
- `group_invitations`
- `profiles`
- `follows`
- `entries`

Reglas de negocio visibles:

- Solo se invitan usuarios relacionados por follows segun flujo actual.
- Hay limite de grupos (`MAX_GROUPS` en componentes/usecases).
- El frontend detecta errores de limite por texto, pero la restriccion debe estar reforzada en base de datos.

### My Top Burgers

Archivos:

- `src/components/MyTopBurgersPage/MyTopBurgersPage.tsx`
- `src/components/MyTopBurgersPage/MyTopBurgersPage.css`

Responsabilidades:

- Cargar entradas del usuario que sean hamburguesas de restaurante.
- Agrupar por restaurante y nombre de hamburguesa.
- Calcular rating medio.
- Mostrar precio:
  - Si solo hay una entrada: `Precio`.
  - Si hay varias entradas: `Mayor precio registrado`.
- Ordenar por nota o precio.
- Abrir modal con los posts de una burger.
- Abrir visor de foto desde el modal.

Query base:

- Tabla `entries`.
- Filtros:
  - `user_id = session.user.id`
  - `is_burger = true`
  - `burger_origin = restaurant`
  - `restaurant_id is not null`
  - `deleted_at is null` mediante `whereNotDeleted`
- Relaciones:
  - `restaurants(name)`
  - `burgers(name)`

### Restaurantes

Archivo:

- `src/components/RestaurantSearchPage/RestaurantSearchPage.tsx`

Responsabilidades:

- Buscar/seleccionar restaurantes.
- Mostrar posts asociados.
- Navegar a detalle de post.

Tablas esperadas:

- `entries`
- Relaciones de `restaurants` y `burgers` segun selects de entradas.

### Rankings

Archivo:

- `src/components/GlobalRankingPage/GlobalRankingPage.tsx`

Responsabilidades:

- Mostrar ranking global.
- Navegar a perfiles de usuario.
- Calcular metricas a partir de entradas.

Tablas:

- `entries`
- `profiles`

### Notificaciones

Archivo:

- `src/components/NotificationsDrawer/NotificationsDrawer.tsx`

Responsabilidades:

- Mostrar notificaciones derivadas de likes, comentarios, follows, grupos o contexto de entradas.
- Resolver nombres de usuarios y grupos.

Tablas:

- `profiles`
- `groups`
- Otras tablas de interacciones segun el flujo que genere notificaciones.

## Supabase: Tablas Usadas Por El Cliente

El cliente referencia estas tablas directamente:

- `entries`
- `entry_bookmarks`
- `entry_likes`
- `exchange_rates`
- `follows`
- `group_invitations`
- `group_members`
- `groups`
- `profiles`

Tambien se usan tablas relacionadas en selects embebidos:

- `restaurants`
- `burgers`

Y hay flujo de reportes usando:

- `entry_reports`

Si estas tablas existen en Supabase, sus policies deben considerarse parte critica de la seguridad.

## Supabase Auth

Flujos usados:

- `auth.getSession()`: recuperar sesion inicial.
- `auth.onAuthStateChange(...)`: reaccionar a login/logout/reset.
- `auth.signUp(...)`: registro con email/password.
- `auth.signInWithPassword(...)`: login email/password.
- `auth.signInWithOAuth(...)`: OAuth.
- `auth.resetPasswordForEmail(...)`: envio de reset.
- `auth.updateUser(...)`: actualizar password y metadata.
- `auth.refreshSession()`: refrescar datos de sesion.
- `auth.signOut()`: logout.
- `auth.getUser()`: validacion puntual del usuario autenticado.

Seguridad:

- No confiar en `user_metadata` para permisos sensibles.
- La UI puede ocultar admin, pero las policies/RPC/backend deben hacer cumplir permisos.
- Configurar redirects permitidos en Supabase Auth para dominios de produccion y desarrollo.
- Revisar expiracion de sesiones y proveedores OAuth desde Supabase Dashboard.

## Supabase Storage

Buckets usados:

- `food-photos`: fotos de entradas.
- `avatars`: avatares de usuario.

Operaciones:

- `upload(...)`
- `getPublicUrl(...)`
- `remove(...)` en avatar anterior

Recomendaciones para repo publico:

- Documentar nombres de buckets esta bien; no documentar URLs privadas ni tokens.
- Si los buckets son publicos, no subir contenido sensible.
- Si se requiere privacidad, usar buckets privados y URLs firmadas.
- Las policies de Storage deben impedir que un usuario sobrescriba o borre archivos de otro usuario.
- Usar paths que incluyan `user.id` y validar en policies.

## Realtime

El feed y dashboard usan canales Supabase:

- `supabase.channel(...)`
- `postgres_changes` sobre `entries`

Uso:

- Refrescar feed cuando cambian entradas.
- Evitar refrescos excesivos con throttling local.

Seguridad:

- Realtime tambien depende de RLS.
- No exponer canales que permitan inferir actividad privada.

## Caché En Cliente

Se usa `sessionStorage` para mejorar navegacion:

- Entradas del feed.
- Opciones de meses del feed.
- Entradas del dashboard.
- Follows del feed.
- Algunos datos de perfil/grupos segun modulo.

Implicaciones:

- El cache vive en el navegador del usuario.
- No guardar secretos en `sessionStorage` o `localStorage`.
- Al cambiar policies o datos sensibles, considerar invalidar claves de cache.
- El cache no sustituye controles de acceso.

## Internacionalizacion

Configuracion:

- `src/lib/i18n.ts`

Locales:

- `src/locales/es`
- `src/locales/en`
- `src/locales/fr`
- `src/locales/de`
- `src/locales/it`
- `src/locales/th`

Cuando se anade texto visible:

- Crear la key en todos los idiomas.
- Usar `defaultValue` solo como fallback, no como unica fuente.
- Mantener nombres de namespace consistentes con el componente.

## Estilos

Estructura:

- `src/index.css`: tema global y variables CSS.
- `src/styles/shared.css`: primitivas compartidas, modales, skeletons, visor de foto.
- `src/styles/layout.css`: layout comun.
- CSS por componente en cada carpeta.

Convenciones:

- Prefijo `bw-` para clases.
- No usar Bootstrap.
- Reutilizar componentes comunes (`AppShell`, `PageHeader`, `ModalBase`, `ConfirmDialog`, `UserAvatar`, etc.).
- Los modales usan `.bw-modal-backdrop` con `z-index: 100`.
- El visor de foto usa `.bw-photo-viewer-backdrop` con `z-index: 120` para aparecer sobre modales.

## Tests

Stack:

- Vitest.
- Testing Library.
- jsdom.

Setup:

- `src/test/setup.ts`

Patrones:

- Mock de Supabase por test.
- Mock de iconos MUI cuando no son relevantes.
- Tests orientados a flujos funcionales.
- Tests unitarios en utilidades (`cropImage`, `image`, `datetime`, etc.).

Comandos:

```bash
npm run test
npm test -- MyTopBurgersPage
npm test -- FeedTabs
```

## Deploy

Configuracion Vercel:

- `vercel.json`

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

La rewrite permite que React Router maneje rutas profundas como `/posts/:entryId`.

Variables necesarias en produccion:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_HEART_AVATAR` si se quiere activar el flag

No configurar claves privadas en variables `VITE_*`.

## Seguridad Para Repositorio Publico

### Lo Que Puede Estar En El Repo

- Codigo frontend.
- Nombres de tablas y buckets.
- Variables de entorno sin valores.
- Documentacion de arquitectura.
- Clave anon solo si ya es publica y las policies estan bien configuradas, aunque es mejor no ponerla en docs.

### Lo Que No Debe Estar En El Repo

- `service_role` key.
- JWT secrets.
- Passwords.
- URLs internas privadas si no quieres divulgarlas.
- Dumps de base de datos con datos reales.
- Capturas con datos personales.
- `.env.local`.
- Logs con tokens o payloads de usuarios reales.

### Controles Que Deben Vivir En Supabase

Como el cliente es publico, cualquier usuario puede inspeccionar llamadas y replicarlas. Por eso:

- Activar RLS en tablas con datos de usuario.
- Definir policies por accion: `select`, `insert`, `update`, `delete`.
- Validar propiedad por `auth.uid()`.
- Validar roles admin en la base de datos, no solo en React.
- Impedir modificar `user_id` de entradas ajenas.
- Impedir borrar/actualizar grupos ajenos.
- Impedir aceptar invitaciones de otros usuarios.
- Impedir leer entradas privadas sin permiso.
- Impedir likes/bookmarks duplicados con constraints unicas.
- Usar soft delete (`deleted_at`) de forma consistente y reforzar visibilidad en policies o vistas.

### Ejemplos De Reglas Recomendadas

No son SQL final del proyecto, solo criterios que deberian existir:

- `entries.select`: publico solo si `visibility = 'public'` y `deleted_at is null`; propietario siempre puede leer sus entradas; amigos mutuos segun privacidad si aplica.
- `entries.insert`: `user_id = auth.uid()`.
- `entries.update/delete`: solo propietario o admin.
- `profiles.update`: solo `id = auth.uid()` para campos editables.
- `entry_likes` y `entry_bookmarks`: `user_id = auth.uid()`.
- `group_invitations`: invitado solo puede ver/aceptar sus invitaciones; owner/admin del grupo puede crear invitaciones.
- Storage `avatars`: usuario solo puede escribir en su prefijo.
- Storage `food-photos`: usuario solo puede subir fotos asociadas a sus propias entradas o a su prefijo.

## Checklist Antes De Publicar Cambios

- No hay secretos en `git diff`.
- No se ha tocado `package.json` ni version salvo peticion explicita.
- `CHANGELOG.md` tiene la entrada en `Unreleased`.
- Nuevos textos tienen traducciones.
- Nuevas llamadas Supabase dependen de RLS, no de ocultar botones.
- Tests focalizados pasan.
- Si se cambia flujo critico, correr `npm run test`.
- Si se cambia build/configuracion, correr `npm run build`.

## Convenciones Del Proyecto

- No usar Bootstrap.
- Seguir patrones existentes antes de crear abstracciones nuevas.
- Cada funcionalidad nueva debe documentarse en `CHANGELOG.md` bajo `Unreleased`.
- No crear subversion automaticamente.
- Solo cambiar version en `CHANGELOG.md` y `package.json` cuando se indique expresamente.
- Mantener buenas practicas y estructura coherente con ejemplos existentes.
