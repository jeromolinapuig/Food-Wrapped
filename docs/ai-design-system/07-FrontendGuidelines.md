# FrontendGuidelines.md

## Objetivo del documento

Definir criterios tecnicos para que las propuestas de la IA sean trasladables al frontend real de BurgerWrapped.

Este documento no sustituye al `README.md` tecnico ni a las guias del repositorio. Es una version operativa para diseno y generacion de propuestas.

## Stack frontend de referencia

- React 19.
- TypeScript.
- Vite 7.
- React Router DOM 6 con `BrowserRouter`.
- Supabase JS 2 para Auth, PostgREST, Realtime y Storage.
- i18next / react-i18next.
- Material UI Icons para iconografia.
- CSS modular por componente.
- Estilos compartidos en `src/styles`.
- Vitest, Testing Library y jsdom.
- Vercel Analytics.
- Service Worker en `public/sw.js`.
- Web Push con VAPID y Supabase Edge Functions.

## Arquitectura actual

Estructura relevante:

```text
src/
|-- App.tsx
|-- main.tsx
|-- components/
|   |-- common/
|   |-- Dashboard/
|   |-- FeedTabs/
|   |-- FeedPage/
|   |-- ProfilePage/
|   |-- UserDashboardPage/
|   |-- MorePage/
|   |-- GroupsPage/
|   |-- GroupPage/
|   |-- AddEntryModal/
|   `-- ...
|-- repos/
|-- usecases/
|-- lib/
|-- utils/
|-- constants/
|-- styles/
`-- locales/
```

Reglas:

- Revisar patrones existentes antes de crear componentes nuevos.
- Mantener componentes por feature cuando la logica sea especifica.
- Usar `components/common` solo para piezas realmente reutilizables.
- Usar `repos` y `usecases` cuando el flujo ya siga esa separacion.
- Mantener CSS junto a la feature cuando sea especifico.
- Usar `src/styles/shared.css` y `src/styles/layout.css` para primitivas comunes.

## Rutas

Las rutas estan definidas en `src/App.tsx`.

Reglas:

- No inventar rutas nuevas sin justificar su lugar en la arquitectura de informacion.
- Proteger pantallas autenticadas en el route element.
- Manejar estados guest con `LockedPage` o placeholders si el patron aplica.
- No confiar en rutas ocultas como seguridad; Supabase RLS debe proteger datos.

## Supabase

Tablas usadas por el cliente:

- `burger_wishlist`
- `burgers`
- `entries`
- `entry_bookmarks`
- `entry_comments`
- `entry_likes`
- `entry_reports`
- `exchange_rates`
- `follows`
- `group_invitations`
- `group_members`
- `groups`
- `monthly_frame_results`
- `profiles`
- `notifications`
- `notification_preferences`
- `push_subscriptions`
- `admin_notification_campaigns`
- `admin_notification_deliveries`
- `restaurants`
- `user_feature_announcements`

Reglas:

- No usar `service_role` en cliente.
- No documentar ni pegar credenciales reales.
- No asumir que filtrar en cliente sustituye RLS.
- Al proponer nuevas llamadas, indicar tabla, accion y policy esperada.
- Usar soft delete (`deleted_at`) de forma consistente donde ya exista.

## Storage

Buckets:

- `food-photos` para fotos de entradas.
- `avatars` para avatares.

Reglas:

- Las fotos deben validarse y comprimirse/cropearse segun flujo existente.
- Las policies de Storage deben impedir sobrescribir contenido de otros usuarios.
- No disenar experiencias que prometan privacidad real si el bucket es publico sin confirmarlo.

## i18n

Locales actuales:

- `es`
- `en`
- `fr`
- `de`
- `it`
- `th`
- `ja`

Reglas:

- Todo texto visible nuevo debe tener key en todos los idiomas.
- Usar `defaultValue` solo como fallback, no como unica fuente.
- Mantener namespaces consistentes con la feature.
- Evitar textos largos en botones.

## Estilos

Reglas:

- No usar Bootstrap.
- No introducir Tailwind como base nueva.
- Usar clases con prefijo `bw-`.
- Respetar variables CSS existentes.
- Crear CSS por componente si la feature lo requiere.
- Reutilizar `AppShell`, `PageHeader`, `Avatar`, `ModalBase`, `ConfirmDialog`, `UserAvatar` u otros comunes cuando existan.
- Mantener soporte dark mode si la pantalla usa colores propios.

## Iconos

Usar `@mui/icons-material`.

Reglas:

- Iconos funcionales deben tener label accesible si no hay texto.
- No mezclar librerias.
- No crear SVG manual si ya existe icono MUI.

## Formularios

Reglas tecnicas:

- Tipar estado y errores.
- Validar antes de enviar.
- Mostrar errores cerca del campo.
- Deshabilitar acciones durante guardado.
- Evitar doble submit.
- Usar schemas locales con Zod cuando el flujo ya lo use o la validacion lo justifique.

Reglas UX-tecnicas:

- Proteger datos ante navegacion accidental si el flujo es largo.
- Permitir recuperacion de errores.
- Separar subida de imagen, crop y guardado cuando aplique.

## Estados de datos

Cada pantalla debe contemplar:

- Loading.
- Success.
- Empty.
- Error.
- Forbidden o sin permisos.
- No content.
- Saving.
- Disabled.
- Refreshing silently.

## Realtime

El proyecto usa `supabase.channel(...)` y `postgres_changes`.

Reglas:

- Suscribirse solo a cambios necesarios.
- Limpiar suscripciones en `useEffect`.
- Evitar refrescos excesivos con throttling o debounce.
- No exponer actividad privada por canales mal filtrados.

## Cache en cliente

El proyecto usa `sessionStorage` para mejorar navegacion.

Reglas:

- No guardar secretos.
- Invalidar o refrescar cache cuando cambie visibilidad, follows, bookmarks o posts.
- No usar cache como fuente de seguridad.

## Testing

Comandos:

```bash
npm run test
npm run build
npm run lint
```

Reglas:

- Tests focalizados para cambios de comportamiento.
- Mock de Supabase por test.
- Tests de utilidades cuando se modifique logica compartida.
- Ejecutar build si se toca routing, tipos o configuracion.

## Calidad

Reglas:

- TypeScript estricto.
- Evitar `any`.
- Componentes pequenos.
- Logica de negocio fuera del JSX.
- Reutilizar patrones existentes.
- Accesibilidad obligatoria.
- Responsive obligatorio.
- No duplicar logica.
- Registrar cambios funcionales en `CHANGELOG.md` bajo `Unreleased`.

## Puntos a validar

Si una propuesta necesita backend nuevo, la IA debe declararlo como dependencia:

- Tabla o RPC necesaria.
- Policy RLS esperada.
- Storage bucket si aplica.
- Realtime si aplica.
- Edge Function si aplica.
- Migracion requerida.
