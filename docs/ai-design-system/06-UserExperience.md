# UserExperience.md

## Objetivo del documento

Definir las reglas de experiencia de usuario que la IA debe aplicar en BurgerWrapped.

Este documento se centra en como debe sentirse, entenderse y usarse la aplicacion. Las reglas visuales concretas estan en `05-DesignSystem.md`.

## Principio principal: registrar sin friccion y volver con valor

BurgerWrapped debe hacer facil guardar una experiencia burger y debe recompensar al usuario cuando vuelve: feed, estadisticas, calendario, ranking, wishlist, grupos y recuerdos.

## Experiencia esperada

El usuario debe sentir que BurgerWrapped:

- Guarda sus burgers sin esfuerzo.
- Le ayuda a recordar donde comio y cuanto pago.
- Le permite comparar sus mejores burgers.
- Le descubre posts y restaurantes de otras personas.
- Respeta su privacidad.
- Le da una identidad personal dentro de la app.
- Hace que las estadisticas sean divertidas y utiles.

## Tono y lenguaje

### Voz

Cercana, directa, social y ligera.

### Estilo

- Frases cortas.
- Verbos de accion.
- Humor moderado si encaja con la pantalla.
- Claridad antes que ingenio.
- Espanol natural.

### Evitar

- Jerga tecnica.
- Tonos corporativos.
- Mensajes demasiado largos.
- Promesas absolutas.
- Culpar al usuario por errores.
- Bromas en errores criticos, privacidad o administracion.

## Microcopy recomendado

En vez de:

> No hay registros.

Usar:

> Aun no has subido ninguna burger.

En vez de:

> Error de validacion.

Usar:

> Revisa este campo. Falta un dato para guardar la burger.

En vez de:

> Item agregado correctamente.

Usar:

> Burger guardada para probar.

En vez de:

> Unauthorized.

Usar:

> Inicia sesion para ver esta seccion.

## Navegacion y orientacion

El usuario debe saber siempre:

1. En que seccion esta.
2. Si esta viendo datos propios, globales, de otra persona, de un restaurante o de un grupo.
3. Que accion principal puede realizar.
4. Como volver.
5. Que contenido es publico, privado o de grupo.

Reglas:

- Usar titulos descriptivos.
- Mantener bottom nav como orientacion principal.
- Usar back button en pantallas secundarias.
- No esconder la accion de publicar en contextos principales.
- Evitar menus profundos para acciones frecuentes.

## Crear entrada

Crear una entrada es un flujo critico.

Reglas UX:

- Pedir solo lo necesario para guardar bien una burger.
- La foto debe ser facil de subir, cropear y revisar.
- Restaurante y burger deben evitar duplicados sin bloquear de forma confusa.
- Los errores deben explicar como continuar.
- El usuario debe saber si la entrada sera publica, privada o visible en grupo.
- Durante subida y guardado, bloquear doble envio.

## Feed

El feed debe ser visual, social y escaneable.

Reglas UX:

- Foto protagonista.
- Usuario y fecha visibles.
- Burger y restaurante claros.
- Acciones sociales agrupadas.
- Comentarios accesibles sin invadir la tarjeta.
- Guardar para probar debe ser facil cuando aplica.
- Reportar debe estar disponible sin competir con acciones positivas.

## Dashboard personal

El dashboard no debe ser solo un listado de posts.

Debe ayudar a entender:

- Cuantas burgers lleva el usuario.
- Que meses o periodos destacan.
- Precio, carne y rating si aplican.
- Historial reciente.
- Accesos a calendario, top y herramientas personales.

Reglas:

- Priorizar estadisticas comprensibles.
- Evitar metricas decorativas sin accion.
- Mostrar skeletons mientras carga.
- Mantener filtros visibles y faciles.

## Perfil

El perfil es identidad, no solo configuracion.

Reglas:

- Avatar y nombre deben ser protagonistas.
- Bio y preferencias burger deben sentirse personales.
- Follows y listas deben ser claras.
- Si el perfil esta incompleto, sugerir completar sin bloquear.
- Ajustes deben vivir en `/profile/settings`.

## Privacidad

La privacidad debe ser visible y comprensible.

Reglas:

- Indicar cuando una accion crea contenido publico.
- Diferenciar notas privadas de posts publicos.
- No mostrar contenido privado en estados vacios o previews.
- En perfiles privados, explicar por que no se ve todo.
- Recordar que el cliente no sustituye RLS de Supabase.

## Grupos

Los grupos deben sentirse como espacios compartidos.

Reglas:

- Mostrar miembros, invitaciones y actividad.
- Aclarar quien puede invitar o gestionar.
- Indicar si el feed o ranking pertenece al grupo.
- Los estados vacios deben invitar a crear actividad o invitar miembros.

## Wishlist

La wishlist es privada y orientada a accion futura.

Reglas:

- Distinguir "pendiente" de "probada".
- Aclarar que marcar como probada no crea post publico.
- Permitir quitar o editar sin miedo.
- Mantener foto y restaurante como recuerdo visual.

## Notificaciones y push

Reglas UX:

- Pedir permiso push solo tras accion explicita.
- Explicar beneficio antes del dialogo nativo.
- En iPhone/iPad, guiar a instalar la PWA si es necesario.
- Permitir configurar tipos de push.
- No saturar con prompts repetidos.

## Administracion

El modo admin debe ser sobrio y funcional.

Reglas:

- Separar claramente modo admin de modo usuario.
- Mostrar estados de reportes y campanas.
- Confirmar acciones sensibles.
- Evitar lenguaje jugueton en moderacion, reportes o avisos masivos.

## Estados de sistema

### Exito

Debe confirmar la accion y, si aplica, indicar el siguiente paso.

Ejemplo:

> Burger publicada. Ya aparece en tu historial.

### Error

Debe explicar problema y recuperacion.

Ejemplo:

> No hemos podido subir la foto. Revisa tu conexion e intentalo de nuevo.

### Vacio

Debe explicar por que no hay datos y proponer accion.

Ejemplo:

> Aun no tienes burgers guardadas para probar. Guarda una desde el feed cuando encuentres algo que te apetezca.

### Carga

Debe indicar que el sistema sigue trabajando.

Ejemplo:

> Cargando posts...

## Checklist UX por pantalla

Antes de aceptar una pantalla, revisar:

- El usuario entiende que pantalla esta viendo?
- La accion principal esta clara?
- Hay estados de carga, vacio, error y sin permisos?
- La pantalla funciona en movil?
- La privacidad esta clara?
- El contenido visual tiene protagonismo?
- La propuesta respeta la bottom nav y `/more`?
- El microcopy es natural y no tecnico?
- La pantalla es trasladable al frontend real?
