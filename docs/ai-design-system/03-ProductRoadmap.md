# ProductRoadmap.md

## Objetivo del documento

Este documento resume una evolucion funcional coherente para BurgerWrapped. No representa compromisos cerrados de producto; sirve para que la IA disene pantallas que puedan crecer sin bloquear futuras funcionalidades.

## Estado actual del producto

BurgerWrapped ya incluye:

- Autenticacion con Supabase.
- Dashboard personal.
- Feed social.
- Busqueda unificada de usuarios y restaurantes.
- Perfil propio y perfiles publicos con privacidad.
- Ajustes de perfil.
- Grupos e invitaciones.
- Ranking global.
- Detalle de posts.
- Posts guardados.
- My Top Burgers.
- Burger Calendar.
- Burgers para probar.
- Likes, comentarios, guardados, compartir y reportes.
- Notificaciones in-app y Web Push.
- Modo administrador con feed, usuarios, reportes y avisos.

## Direccion recomendada

BurgerWrapped debe evolucionar como una app social de experiencias burger, no como una app de reviews generalista.

Las decisiones de diseno deben proteger estos pilares:

- Registro simple.
- Recuerdo personal.
- Descubrimiento social.
- Comparacion amistosa.
- Privacidad.
- Recompensa visual por actividad.

## Fase 1: Consolidacion de la experiencia actual

Objetivos:

- Reducir friccion al crear posts.
- Hacer mas visible el valor de las estadisticas personales.
- Mejorar la organizacion de `/more`.
- Reforzar estados vacios, carga y error.
- Aclarar privacidad en perfiles y posts.
- Mantener las traducciones completas en todos los idiomas soportados.

Capacidades relevantes:

- Mejoras en Add Entry.
- Mejoras en dashboard y summary anual.
- Mejoras en FeedTabs y tarjetas de post.
- Perfil y ajustes mas claros.
- Wishlist privada mas facil de entender.

## Fase 2: Descubrimiento y colecciones

Objetivos:

- Convertir los posts de otros usuarios en acciones futuras.
- Mejorar la exploracion de restaurantes y burgers.
- Dar mas valor a guardados, wishlist y top personal.

Ideas compatibles:

- Listas personales de burgers por probar.
- Colecciones de restaurantes favoritos.
- Comparativa de burgers repetidas.
- Filtros mas ricos por restaurante, carne, precio o nota.
- Recomendaciones basadas en actividad propia y social.

Guardrail:

- Cualquier recomendacion debe ser explicable y no sustituir el criterio del usuario.

## Fase 3: Grupos, retos y actividad social

Objetivos:

- Reforzar la motivacion social sin saturar el feed.
- Convertir grupos en espacios con actividad propia.
- Crear dinamicas ligeras de reto o temporada.

Ideas compatibles:

- Retos mensuales.
- Ranking por grupo y por periodo.
- Insignias o marcos temporales.
- Highlights de grupo.
- Resumen mensual compartible.

Guardrail:

- Evitar mecanicas agresivas o presion social excesiva. La comparacion debe sentirse amistosa.

## Fase 4: Wrapped avanzado

Objetivos:

- Convertir la actividad anual o mensual en una experiencia memorable.
- Dar protagonismo a visualizaciones, hitos y narrativa personal.

Ideas compatibles:

- Wrapped anual compartible.
- Ranking de restaurantes del ano.
- Mapa o calendario enriquecido si hay datos suficientes.
- Comparativas con anos anteriores.
- Resumen por moneda, precio medio, tipos de carne y mejores fotos.

Guardrail:

- El resumen debe construirse con datos reales del usuario. No inventar conclusiones si no hay suficiente actividad.

## Fase 5: Herramientas de confianza y administracion

Objetivos:

- Mantener la red sana.
- Permitir comunicacion administrativa clara.
- Reducir abuso, duplicados o datos de baja calidad.

Ideas compatibles:

- Mejoras de moderacion.
- Revision de restaurantes duplicados.
- Herramientas para reportes.
- Mensajes administrativos segmentados.
- Auditoria de acciones admin.

Guardrail:

- Las pantallas admin deben ser funcionales y sobrias, separadas del tono ludico de usuario final.

## Como debe influir esto en el diseno

Buenas decisiones:

- Usar patrones reutilizables para feed, posts, rankings, grupos y herramientas.
- Mantener `/more` como hub de herramientas secundarias.
- Separar lo publico de lo privado con labels claros.
- Disenar para movil primero y escritorio como expansion.
- Hacer que cada nueva feature alimente historial, descubrimiento o estadisticas.

Malas decisiones:

- Crear una navegacion principal con demasiadas secciones.
- Tratar restaurantes como un directorio empresarial complejo.
- Disenar formularios largos para una accion frecuente.
- Ocultar restricciones de privacidad.
- Crear metricas que no ayuden a decidir o recordar.

## Nota para la IA

Si se disena una funcionalidad futura, debe marcarse como propuesta o supuesto. No inventar backend, tablas, policies o automatizaciones como si ya existieran.
