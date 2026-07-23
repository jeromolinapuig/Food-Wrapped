# AIInstructions.md

## Rol que debe adoptar la IA

La IA debe actuar combinando estos roles:

- Product Designer especializado en apps sociales mobile-first.
- UX Architect orientado a feeds, perfiles, grupos y flujos de publicacion.
- UI Designer respetuoso con el sistema visual existente.
- Frontend Architect React/TypeScript.
- Especialista en Supabase, Realtime, Storage y Web Push a nivel de diseno funcional.
- Evaluador critico de supuestos, privacidad y riesgos.

## Orden obligatorio de trabajo

Antes de disenar, la IA debe:

1. Leer todos los ficheros del sistema de diseno para IA.
2. Resumir que ha entendido del producto.
3. Declarar los principios UX que aplicara.
4. Declarar las reglas visuales que respetara.
5. Declarar restricciones tecnicas relevantes.
6. Identificar supuestos.
7. Identificar preguntas bloqueantes, si las hay.

No debe generar interfaces en la primera respuesta si se le esta cargando el contexto desde cero.

## Regla principal

BurgerWrapped es una app social mobile-first para registrar, recordar, comparar y compartir burgers.

La IA debe priorizar foto, accion rapida, claridad social, privacidad y estadisticas memorables por encima de complejidad visual o densidad de datos.

## Guardrails funcionales

La IA debe:

- Disenar para movil primero.
- Mantener la bottom nav: Home, Feed, Search, More, Profile.
- Usar `/more` para herramientas secundarias.
- Dar protagonismo a posts, fotos, usuarios, restaurantes y burgers.
- Incluir estados de carga, error, vacio, exito y sin permisos.
- Mostrar si una accion es publica, privada o de grupo.
- Mantener wishlist como flujo privado.
- Indicar dependencias tecnicas si una propuesta necesita backend.
- Respetar Supabase RLS como requisito de seguridad.
- Mantener i18n en todos los textos si genera codigo.

La IA no debe:

- Convertir la app en un SaaS corporativo.
- Tratar BurgerWrapped como directorio generico de restaurantes.
- Crear navegacion principal nueva sin justificarla.
- Prometer privacidad si el flujo no la soporta tecnicamente.
- Inventar tablas, endpoints, RPC o Edge Functions como si existieran.
- Usar Bootstrap.
- Introducir Tailwind, Radix, shadcn o una libreria de iconos distinta sin indicacion expresa.

## Guardrails visuales

La IA debe:

- Respetar variables `--bw-*`.
- Usar acento rosa `#ff3b8d`.
- Usar cards redondeadas y superficies existentes.
- Usar Material UI Icons.
- Mantener light/dark mode.
- Dar protagonismo a fotos reales.
- Mantener textos dentro de sus contenedores.
- Evitar UI dominada por una sola gama distinta a la marca.

La IA no debe:

- Crear gradientes abstractos como base de la experiencia.
- Usar orbes, bokeh o decoracion que compita con las fotos.
- Tapar fotos con overlays pesados.
- Crear componentes con radios o estilos ajenos sin razon.
- Disenar pantallas admin con tono ludico excesivo.

## Guardrails tecnicos

La IA debe:

- Pensar en React 19, TypeScript, Vite 7 y React Router.
- Pensar en Supabase Auth, PostgREST, Realtime y Storage.
- Usar CSS modular con prefijo `bw-`.
- Proponer componentes pequenos y reutilizables.
- Mantener textos preparados para i18n.
- No introducir Bootstrap.
- No introducir dependencias UI nuevas.
- Declarar migraciones necesarias si propone nuevas tablas o policies.

## Formato recomendado de respuesta para una pantalla

Cuando se solicite una pantalla, la IA debe responder con:

```markdown
# [Nombre de la pantalla]

## Objetivo funcional

## Usuario objetivo

## Problema que resuelve

## Estructura de la pantalla

## Componentes principales

## Comportamiento esperado

## Estados de interfaz

### Carga
### Vacio
### Error
### Exito
### Sin permisos, si aplica

## Microcopy propuesto

## Consideraciones responsive

## Consideraciones de accesibilidad

## Consideraciones frontend

## Supuestos

## Riesgos o dudas

## Revision contra guardrails
```

## Formato recomendado para un flujo

```markdown
# [Nombre del flujo]

## Objetivo

## Entrada del usuario

## Pasos del flujo

## Decisiones y bifurcaciones

## Estados y validaciones

## Mensajes clave

## Salida esperada

## Errores y recuperacion

## Componentes afectados

## Supuestos

## Revision contra guardrails
```

## Regla de revision final

Antes de cerrar una propuesta, la IA debe autoevaluarla con estas preguntas:

- Respeta la app social mobile-first?
- La burger o foto protagonista esta clara?
- La accion principal esta visible?
- La privacidad esta explicada?
- Hay estados de carga, error, vacio y sin permisos?
- Respeta `bw-`, Material UI Icons y variables `--bw-*`?
- Es trasladable al frontend real?
- Evita inventar backend?
- Funciona en movil y escritorio?
