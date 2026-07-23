# Accessibility.md

## Objetivo del documento

Definir reglas minimas de accesibilidad y usabilidad que la IA debe respetar al disenar interfaces para BurgerWrapped.

La accesibilidad forma parte de la claridad del producto. BurgerWrapped es una app visual y social, pero no debe depender solo de color, foto o icono para comunicar informacion critica.

## Principios

1. La interfaz debe ser legible en light y dark mode.
2. Las acciones deben ser identificables.
3. Las fotos deben tener contexto textual suficiente.
4. Los formularios deben ser comprensibles.
5. Los errores deben poder corregirse facilmente.
6. La navegacion debe funcionar con teclado.
7. No se debe depender solo del color para comunicar estados.
8. El diseno movil debe mantener toda la funcionalidad critica.

## Contraste

Reglas:

- Usar `--bw-text` sobre `--bw-bg`, `--bw-card-bg` o `--bw-surface`.
- Usar `--bw-text-muted` solo para informacion secundaria.
- Verificar contraste del rosa `--bw-accent` cuando se use como texto.
- Evitar texto claro sobre fotos si no hay overlay suficiente.
- No usar colores semanticos suaves como unico indicador.

## Labels y formularios

Reglas:

- Todo campo debe tener label visible.
- El placeholder no sustituye al label.
- Los campos obligatorios deben identificarse claramente.
- Los errores deben mostrarse cerca del campo.
- El mensaje de error debe explicar como corregir.
- Ayudas contextuales deben estar proximas al campo.
- En flujos de imagen, indicar requisitos de foto si bloquean el guardado.

## Navegacion por teclado

Reglas:

- Usar botones reales para acciones.
- No crear `div` clicables sin semantica.
- Mantener foco visible.
- Permitir cerrar modales con patrones estandar.
- Orden de tabulacion logico.
- La bottom nav y sidebar deben exponer `aria-label` de navegacion.

## Iconos

Reglas:

- Iconos decorativos deben ser ignorables por lectores de pantalla.
- Iconos funcionales deben tener `aria-label` si no tienen texto visible.
- No comunicar guardado, favorito, probado, privado o reportado solo con icono.
- Mantener tamanos tactiles suficientes.

## Fotos y contenido visual

Reglas:

- Las fotos de posts deben tener alt descriptivo cuando sea posible.
- Si la foto no carga, mostrar fallback o estado comprensible.
- No superponer texto critico sobre imagenes con bajo contraste.
- El visor de foto debe tener boton de cierre accesible.
- El cropper debe explicar la accion principal.

## Mensajes y estados

Reglas:

- Errores claros y accionables.
- Estados vacios con siguiente accion.
- Loading states que indiquen que la app sigue trabajando.
- Avisos importantes visibles sin depender solo del color.
- Estados sin permisos con explicacion y ruta de recuperacion.

## Modales y bottom sheets

Reglas:

- Titulo claro.
- Accion primaria y cancelacion visibles.
- Confirmaciones para acciones destructivas.
- No ocultar contenido importante bajo la barra de acciones sticky.
- En movil, asegurar que el bottom sheet puede desplazarse.

## Listados y feed

Reglas:

- Cards con estructura repetible.
- Acciones con labels comprensibles.
- Estados de post con texto, no solo color.
- En escritorio, no perder orden de lectura.
- En movil, mantener areas tactiles comodas.

## TamaÃ±os interactivos

Reglas:

- Botones e icon buttons deben ser suficientemente grandes en movil.
- Espaciado suficiente entre acciones para evitar pulsaciones erroneas.
- No usar menus o iconos pequenos como unica via de una accion importante.

## Lenguaje accesible

Reglas:

- Frases cortas.
- Evitar jerga tecnica.
- Explicar restricciones de privacidad de forma directa.
- No usar mensajes ambiguos.
- No usar humor en errores que bloquean al usuario.

## Checklist de accesibilidad

Antes de aceptar una pantalla:

- Todos los campos tienen label?
- Los errores explican como corregir?
- La pantalla puede entenderse sin depender del color?
- La accion principal es clara?
- El foco visible esta respetado?
- La pantalla funciona en movil?
- Los textos caben en botones y cards?
- Los estados vacios y de carga estan definidos?
- La privacidad no depende solo de iconos?
