# Project Guidelines

## 0. Sistema de diseno para IA: lectura obligatoria antes de disenar

Antes de crear cualquier pantalla, componente nuevo o tarea de diseno para BurgerWrapped, leer los archivos del sistema de diseno para IA ubicados en esta carpeta:

| Archivo | Cuando leerlo |
|---|---|
| `00-START-HERE.md` | Siempre, como punto de entrada. |
| `01-README.md` | Cuando necesites contexto de producto o usuarios. |
| `02-ProductContext.md` | Cuando disenes entidades, estados o flujos funcionales. |
| `03-ProductRoadmap.md` | Cuando toques evolucion, dashboard, social, grupos o herramientas. |
| `04-InformationArchitecture.md` | Cuando disenes navegacion, estructura de pagina o jerarquia de acciones. |
| `05-DesignSystem.md` | Siempre que generes UI: colores, tipografia, componentes, Do/Don't. |
| `06-UserExperience.md` | Siempre que generes UI: tono, microcopy, privacidad y checklist UX. |
| `07-FrontendGuidelines.md` | Cuando generes codigo React/TypeScript. |
| `08-Accessibility.md` | Siempre que generes UI: contraste, labels, teclado, estados. |
| `09-RealtimeAndAsyncEvents.md` | Cuando disenes feed, notificaciones, push, storage, guardado o realtime. |
| `10-AIInstructions.md` | Siempre: contiene orden de trabajo, guardrails y formato de respuesta. |

Regla: no modificar estos archivos salvo que el usuario lo pida expresamente.

## 1. Purpose

Este sistema guia a la IA para generar nuevas pantallas, componentes y layouts fieles a BurgerWrapped.

Objetivo:

- Mantener coherencia visual.
- Mantener coherencia de producto.
- Respetar la arquitectura actual.
- Evitar propuestas que no puedan trasladarse al repositorio.

## 2. Technology Stack

### Core

- React 19.
- TypeScript.
- Vite 7.
- React Router DOM 6.
- Supabase JS 2.

### Styling

- CSS modular por componente.
- Estilos compartidos en `src/styles`.
- Variables globales `--bw-*`.
- Prefijo de clases `bw-`.
- No Bootstrap.
- No Tailwind como base nueva.

### UI e iconos

- Material UI Icons (`@mui/icons-material`).
- Algunos paquetes MUI disponibles, pero la app usa principalmente iconos y CSS propio.
- No introducir Radix/shadcn.
- No mezclar librerias de iconos.

### Backend y datos

- Supabase Auth.
- Supabase PostgREST.
- Supabase Realtime.
- Supabase Storage.
- Supabase Edge Functions para Web Push.

### Internationalization

- i18next / react-i18next.
- Idiomas: `es`, `en`, `fr`, `de`, `it`, `th`, `ja`.
- Todo texto visible nuevo debe tener traducciones.

## 3. Project Structure

Estructura relevante:

```text
src/
|-- App.tsx
|-- main.tsx
|-- components/
|   |-- common/
|   |-- AddEntryModal/
|   |-- Dashboard/
|   |-- FeedTabs/
|   |-- FeedPage/
|   |-- SearchPage/
|   |-- MorePage/
|   |-- ProfilePage/
|   |-- UserDashboardPage/
|   |-- GroupsPage/
|   |-- GroupPage/
|   |-- BurgerWishlistPage/
|   |-- MyTopBurgersPage/
|   |-- BurgerCalendarPage/
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

- Crear nuevos componentes dentro de la feature afectada.
- Usar `components/common` solo para piezas realmente reutilizables.
- Mantener CSS junto al componente si es especifico.
- Reutilizar componentes comunes antes de crear variantes.
- No crear wrappers genericos nuevos si ya existe patron local.

## 4. Design System Guidelines

### Variables principales

```css
--bw-mobile-shell-max: 430px;
--bw-desktop-shell-max: 1120px;
--bw-desktop-nav-width: 220px;
--bw-bg: #f3f3f7;
--bw-card-bg: #f7f7fb;
--bw-surface: #ffffff;
--bw-text: #111111;
--bw-text-muted: #666666;
--bw-accent: #ff3b8d;
--bw-accent-soft: #ff3b8d22;
```

### Layout

- `AppShell` envuelve paginas principales.
- `PageHeader` da titulo, subtitulo, icono/avatar y acciones.
- `BottomNav` es navegacion fija en movil y sidebar en escritorio.
- `bw-main` contiene el cuerpo de la pagina.

### Componentes

Usar patrones existentes:

- `.bw-card`
- `.bw-btn`
- `.bw-btn-primary`
- `.bw-btn-ghost`
- `.bw-icon-button`
- `.bw-input`
- `.bw-select`
- `.bw-textarea`
- `.bw-modal`
- `.bw-confirm-modal`
- `.bw-avatar`

### Responsive

- Mobile-first.
- Shell maximo de 430px en movil.
- Sidebar y shell ampliado desde 900px.
- Bottom sheets en movil, modales centrados en escritorio.

## 5. Information Architecture

Bottom nav principal:

- Home.
- Feed.
- Search.
- More.
- Profile.

Reglas:

- No anadir secciones a la bottom nav sin redisenar la arquitectura de informacion.
- Las herramientas secundarias van en `/more`.
- Perfil y ajustes estan separados: `/profile` y `/profile/settings`.
- Rutas admin solo en modo admin.
- Guest states deben usar bloqueos o previews coherentes.

## 6. UX Patterns

### Crear entrada

- Foto protagonista.
- Validaciones claras.
- Guardado con estado.
- Error recuperable.
- Visibilidad comprensible.

### Feed

- Foto, usuario, burger y restaurante claros.
- Acciones sociales agrupadas.
- Guardar para probar cuando aplique.
- Reportar sin competir con acciones principales.

### Perfil

- Identidad primero.
- Preferencias burger.
- Follows y actividad visible.
- Acceso a ajustes solo para perfil propio.

### Wishlist

- Privada.
- Diferenciar pendiente y probada.
- Aclarar que probar desde wishlist no crea post publico.

### Admin

- Sobrio, denso y claro.
- Confirmaciones en acciones sensibles.
- Estados de reportes y campanas visibles.

## 7. i18n Guidelines

Reglas:

- No hardcodear textos visibles nuevos.
- Crear claves en todos los idiomas soportados.
- Usar `defaultValue` solo como fallback.
- Evitar textos largos en botones y tabs.
- Mantener namespaces por feature.

## 8. Accessibility Guidelines

Reglas minimas:

- Labels visibles.
- Contraste suficiente en light y dark.
- Botones reales para acciones.
- `aria-label` en icon buttons sin texto.
- Estados no comunicados solo por color.
- Focus visible.
- Fotos con contexto textual o fallback.
- Modales cerrables y navegables.

## 9. Realtime and Async Guidelines

Procesos relevantes:

- Subida de fotos.
- Guardado de posts.
- Cambios de feed.
- Likes, comentarios y bookmarks.
- Invitaciones de grupo.
- Notificaciones in-app.
- Web Push.
- Campanas admin.

Reglas:

- Mostrar carga, guardando, exito y error.
- Deshabilitar doble envio.
- Limpiar suscripciones Realtime.
- Mantener filtros y posicion cuando se refresca.
- No usar cache como seguridad.

## 10. Do and Don't

### Do

- Usar patrones `bw-`.
- Usar Material UI Icons.
- Reutilizar componentes existentes.
- Disenar mobile-first.
- Dar protagonismo a fotos.
- Explicar privacidad.
- Incluir estados de interfaz.
- Preparar i18n.
- Documentar dependencias backend si existen.

### Don't

- No usar Bootstrap.
- No introducir Tailwind, Radix o shadcn.
- No inventar endpoints, tablas o RPC.
- No anadir rutas sin encaje en la arquitectura de informacion.
- No crear dashboards corporativos.
- No usar decoracion que compita con las fotos.
- No ocultar errores o permisos.
- No tratar wishlist privada como post publico.

## 11. Required Response Shape

Para pantallas:

```markdown
# [Nombre]

## Objetivo funcional
## Usuario objetivo
## Estructura
## Componentes
## Estados
## Microcopy
## Responsive
## Accesibilidad
## Frontend
## Supuestos
## Riesgos
## Revision contra guardrails
```

Para flujos:

```markdown
# [Nombre]

## Objetivo
## Pasos
## Decisiones
## Estados y validaciones
## Mensajes
## Salida esperada
## Errores y recuperacion
## Componentes afectados
## Supuestos
## Revision contra guardrails
```
