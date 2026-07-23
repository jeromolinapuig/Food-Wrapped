# DesignSystem.md

## Objetivo del documento

Definir las reglas visuales y de UI que la IA debe respetar al generar pantallas de BurgerWrapped.

Este documento sintetiza los estilos reales del proyecto: variables CSS globales, primitivas `bw-`, layout responsive y uso de Material UI Icons.

## Identidad visual

BurgerWrapped debe verse como una app social moderna, visual y cercana.

La interfaz debe comunicar:

- Energia.
- Apetito visual.
- Diversion controlada.
- Claridad.
- Cercania.
- Personalidad.
- Confianza en privacidad.

## Estilo general

- Mobile-first con shell centrado.
- Fondo claro por defecto y soporte dark mode.
- Cards redondeadas.
- Acento rosa intenso.
- Fotografias de burgers como activo visual principal.
- Iconografia de Material UI Icons.
- Animaciones suaves y funcionales.
- Navegacion inferior en movil y sidebar en escritorio.
- CSS propio por componente, no Bootstrap.

## Tokens principales

Variables base en `src/index.css`:

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

Dark mode:

```css
--bw-bg: #050509;
--bw-card-bg: #0e0e15;
--bw-surface: #181824;
--bw-text: #f5f5ff;
--bw-text-muted: #a0a0b5;
--bw-accent: #ff3b8d;
--bw-accent-soft: #ff3b8d33;
```

## Color

### Acento principal

`#ff3b8d`

Uso:

- Botones primarios.
- Estado activo de navegacion.
- Enlaces.
- Focus.
- Badges.
- Elementos de identidad visual.

Regla:

- El acento debe destacar acciones y estados, no convertirse en fondo dominante de toda la pantalla.

### Superficies

Usar:

- `--bw-bg` para fondo exterior.
- `--bw-card-bg` para shell y fondos de pagina.
- `--bw-surface` para cards, modales y campos.

### Colores semanticos

Usar colores semanticos solo para estados:

- Error o peligro: rojo, como `#d7264d`.
- Exito: verde.
- Warning: ambar.
- Info: azul.

No depender solo del color; incluir texto o icono accesible.

## Tipografia

Fuente global:

```css
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Reglas:

- Titulos cortos y directos.
- No usar mayusculas sostenidas en botones.
- Mantener botones y labels compactos.
- Evitar textos largos dentro de cards de feed.
- No escalar fuentes con viewport width.
- Letter spacing normal.

## Layout

### Shell

Mobile:

- Ancho maximo: `430px`.
- Padding: `16px`.
- Bottom navigation fija.

Desktop:

- Ancho maximo: `1120px`.
- Sidebar de `220px`.
- Shell con border radius `28px`.
- Contenido mas ancho y menos dependencia de scroll interno.

### PageHeader

Usar `PageHeader` para pantallas con estructura app.

Incluye:

- Leading opcional.
- Logo o avatar.
- Titulo.
- Subtitulo.
- Acciones.

Reglas:

- Mantener titulo claro.
- No convertir el header en hero salvo en landing.
- Usar back button en flujos secundarios.

## Componentes base

### Cards

Clase base:

```css
.bw-card
```

Uso:

- Resumenes.
- Bloques de dashboard.
- Herramientas de `/more`.
- Estados vacios.
- Contenido repetido no fotografico.

Reglas:

- No meter cards dentro de cards sin necesidad.
- Mantener radio consistente.
- Usar sombras sutiles.

### Botones

Clases base:

- `.bw-btn`
- `.bw-btn-primary`
- `.bw-btn-ghost`
- `.bw-btn-danger`
- `.bw-btn-danger-outline`
- `.bw-link-button`
- `.bw-icon-button`

Reglas:

- Usar `.bw-btn-primary` para la accion principal.
- Usar icon buttons con Material UI Icons para acciones compactas.
- Deshabilitar botones durante guardado o envio.
- Acciones destructivas deben tener confirmacion.

### Inputs y formularios

Clases base:

- `.bw-input`
- `.bw-select`
- `.bw-textarea`
- `.bw-label`
- `.bw-field`

Reglas:

- Labels visibles.
- Focus con `--bw-accent`.
- Validaciones cerca del campo.
- Formularios largos en secciones o pasos.

### Modales

Clases base:

- `.bw-modal-backdrop`
- `.bw-modal`
- `.bw-modal-header`
- `.bw-modal-actions`
- `.bw-confirm-modal`

Patron:

- En movil, bottom sheet.
- En escritorio, modal centrado.
- Acciones sticky al fondo.
- `z-index` de modales: 100.
- Confirmaciones: 110.
- Photo viewer: 120.

### Avatares

Clases base:

- `.bw-avatar`
- `.bw-avatar-wrap`
- `.bw-avatar-image`
- `.bw-avatar-placeholder`
- `.bw-avatar-frame`

Reglas:

- Soportar forma circular o corazon mediante feature flag.
- Mantener marcos gold, silver, bronze cuando aplique.
- Usar inicial si no hay imagen.

### Navegacion

Bottom nav:

- Movil: fija abajo, 5 columnas.
- Escritorio: sidebar vertical.

Items principales:

- Home.
- Feed.
- Search.
- More.
- Profile.

Reglas:

- Estado activo con `--bw-accent`.
- Etiquetas cortas.
- Perfil muestra avatar si hay sesion.

### Feed cards

Reglas:

- Foto protagonista.
- Acciones sociales visibles pero compactas.
- Informacion de burger y restaurante legible.
- Diferenciar estados guardado, wishlist y probado.
- Evitar saturar con metricas.

## Iconografia

Usar Material UI Icons, coherente con el codigo actual.

Ejemplos existentes:

- `Home`
- `DynamicFeed`
- `Search`
- `MoreHoriz`
- `PersonOutline`
- `Groups`
- `EmojiEvents`
- `NotificationsActive`

No introducir Lucide ni otra libreria para nuevas propuestas salvo decision expresa.

## Responsive

Reglas:

- Disenar primero para 320-430px.
- Asegurar que botones, labels y cards no desbordan.
- En escritorio, expandir layout y mostrar mas densidad, no crear una app distinta.
- Bottom sheets pasan a modales centrados.
- La foto mantiene protagonismo en ambos formatos.

## Estados visuales obligatorios

Cada pantalla o componente relevante debe contemplar:

- Carga.
- Error.
- Vacio.
- Exito.
- Sin permisos.
- Deshabilitado.
- Seleccionado.
- Guardando.
- Refrescando silenciosamente.

## Do

- Usar CSS existente y prefijo `bw-`.
- Usar Material UI Icons.
- Usar `AppShell`, `PageHeader`, `Avatar`, `ModalBase`, `ConfirmDialog` y componentes comunes cuando existan.
- Mantener mobile-first.
- Respetar light/dark theme.
- Dar protagonismo a fotos reales.
- Preparar textos para i18n.

## Don't

- No usar Bootstrap.
- No introducir Tailwind como base de nuevas pantallas.
- No introducir shadcn/Radix.
- No crear una paleta nueva sin razon fuerte.
- No disenar como SaaS corporativo.
- No tapar fotos con overlays pesados.
- No usar orbes, bokeh o decoracion abstracta dominante.
- No crear interfaces de admin con lenguaje visual demasiado jugueton.

## Nota de consistencia

Ante la duda, la IA debe priorizar consistencia con las pantallas existentes frente a creatividad visual aislada.
