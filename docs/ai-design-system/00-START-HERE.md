# BurgerWrapped Design System para IA

## Objetivo

Este sistema de diseno para IA define el contexto que la IA debe usar para crear, evaluar o iterar interfaces de **BurgerWrapped**, una aplicacion web social para registrar hamburguesas, guardar fotos y precios, consultar estadisticas personales, seguir usuarios, crear grupos y explorar rankings.

El objetivo es que la IA pueda generar propuestas de interfaz sin desviarse del producto, del tono, del diseno visual, de la arquitectura frontend ni de los criterios de experiencia existentes en el proyecto.

## Como debe usarse este sistema

La IA debe leer los documentos en este orden:

1. `01-README.md`
2. `02-ProductContext.md`
3. `03-ProductRoadmap.md`
4. `04-InformationArchitecture.md`
5. `05-DesignSystem.md`
6. `06-UserExperience.md`
7. `07-FrontendGuidelines.md`
8. `08-Accessibility.md`
9. `09-RealtimeAndAsyncEvents.md`
10. `10-AIInstructions.md`

`Guidelines.md` resume las reglas operativas para generar pantallas, componentes o codigo manteniendo coherencia con el repositorio.

## Principio rector

BurgerWrapped debe sentirse como una app social mobile-first para amantes de las hamburguesas: rapida para registrar una burger, visual en el feed, clara en estadisticas personales y suficientemente ordenada para crecer en grupos, rankings, wishlist, restaurantes y moderacion.

No debe disenarse como un SaaS corporativo, una app generica de restaurantes ni una herramienta de tracking fria. La experiencia debe combinar diversion, identidad personal, descubrimiento social y control de privacidad.

## Resultado esperado de la IA

Cuando la IA genere una pantalla o flujo, debe entregar:

- Objetivo funcional de la pantalla.
- Usuario objetivo.
- Estructura de la interfaz.
- Componentes principales.
- Reglas UX aplicadas.
- Microcopy propuesto en espanol claro.
- Estados de carga, error, exito, vacio y sin permisos.
- Consideraciones responsive.
- Consideraciones de accesibilidad.
- Consideraciones frontend para React, TypeScript, Supabase e i18n.
- Riesgos o supuestos detectados.
- Revision contra los guardrails del sistema de diseno para IA.

## Archivos incluidos

| Archivo | Proposito |
|---|---|
| `01-README.md` | Contexto ejecutivo de BurgerWrapped y del sistema. |
| `02-ProductContext.md` | Dominio funcional, usuarios, entidades y casos de uso. |
| `03-ProductRoadmap.md` | Evolucion funcional recomendada del producto. |
| `04-InformationArchitecture.md` | Navegacion, estructura de paginas y jerarquia de acciones. |
| `05-DesignSystem.md` | Reglas visuales y UI para mantener consistencia. |
| `06-UserExperience.md` | Reglas UX, tono, flujos sociales y privacidad. |
| `07-FrontendGuidelines.md` | Restricciones React/TypeScript/Supabase para propuestas trasladables a codigo. |
| `08-Accessibility.md` | Reglas de accesibilidad y usabilidad. |
| `09-RealtimeAndAsyncEvents.md` | Contexto de Realtime, push, cache y procesos asincronos. |
| `10-AIInstructions.md` | Instrucciones operativas para la IA. |
| `Guidelines.md` | Guia condensada para usar el sistema en tareas de diseno o codigo. |

## Fuentes base utilizadas

- `README.md` del repositorio.
- `CHANGELOG.md` del repositorio.
- `supabase/README.md`.
- Componentes y estilos existentes en `src/App.tsx`, `src/index.css`, `src/styles/shared.css`, `src/styles/layout.css`, `src/components/common` y `src/components/BottomNav`.
