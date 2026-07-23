# ProductContext.md

## Objetivo del documento

Este documento define el contexto funcional de BurgerWrapped para que la IA pueda disenar interfaces coherentes con el producto, el dominio social y las reglas existentes de la aplicacion.

## Dominio funcional

BurgerWrapped organiza la experiencia alrededor de hamburguesas registradas por usuarios. Cada entrada puede incluir foto, restaurante, burger, precio, nota, fecha, tipo de carne, visibilidad y actividad social.

El producto no trata solo de listar comida. Su valor esta en conectar:

- Memoria personal.
- Descubrimiento de restaurantes.
- Ranking y comparacion.
- Identidad del usuario.
- Grupos y actividad social.
- Wishlist privada de burgers para probar.

## Principios de producto

1. **Foto y burger primero**: el contenido principal debe ser visual y concreto.
2. **Registro rapido**: publicar una entrada no debe sentirse como un formulario administrativo.
3. **Valor acumulado**: cada post debe alimentar historial, estadisticas, calendario, rankings y descubrimiento.
4. **Privacidad clara**: el usuario debe entender quien puede ver sus posts y perfil.
5. **Social con control**: likes, comentarios, follows, guardados y grupos deben ser visibles, pero no invasivos.
6. **Descubrimiento accionable**: si una burger interesa, debe poder guardarse para probarla.
7. **Mobile-first real**: la navegacion y las acciones principales deben funcionar comodamente en movil.
8. **Consistencia visual**: usar los patrones existentes con prefijo `bw-`, CSS modular y Material UI Icons.

## Entidades funcionales principales

### Usuario

Persona que registra burgers, sigue perfiles, participa en grupos y gestiona su identidad.

Atributos funcionales relevantes:

- Email y sesion Supabase.
- Username.
- Display name.
- Bio.
- Avatar y marco equipado.
- Preferencias burger.
- Idioma y moneda.
- Privacidad de perfil.
- Permisos admin.

### Perfil

Vista publica o privada de la identidad burger de un usuario.

Debe mostrar:

- Identidad y avatar.
- Bio y preferencias.
- Contadores sociales.
- Posts visibles.
- Estado de seguimiento.
- Acceso a ajustes si es el perfil propio.

### Entrada o post

Registro de una experiencia con una burger o comida.

Atributos funcionales relevantes:

- Foto.
- Nombre de burger.
- Restaurante.
- Rating.
- Precio y moneda.
- Fecha.
- Tipo de carne.
- Origen de burger.
- Visibilidad.
- Likes, comentarios, guardados y reportes.
- Estado de borrado logico.

### Restaurante

Lugar asociado a burgers registradas.

Debe permitir:

- Buscar restaurantes.
- Ver posts asociados.
- Diferenciar burgers pendientes o probadas por el usuario.
- Crear o confirmar nuevos restaurantes desde el flujo de alta.

### Burger

Entidad asociada a un restaurante y a uno o varios posts.

Debe permitir:

- Agrupar experiencias repetidas.
- Calcular ranking personal.
- Guardar en wishlist.
- Marcar como probada de forma privada.

### Feed

Listado social de posts.

Tipos relevantes:

- Global.
- Following.
- Usuario.
- Grupo.
- Guardados.
- Restaurante.

Debe soportar filtros por mes, precio y tipo de carne, paginacion por cursor y actualizaciones Realtime.

### Grupo

Espacio social privado o semiprivado donde varios usuarios comparan actividad.

Incluye:

- Miembros.
- Invitaciones.
- Feed de grupo.
- Ranking o estadisticas de grupo.
- Gestion de permisos segun rol.

### Wishlist de burgers

Lista privada de burgers que el usuario quiere probar.

Reglas clave:

- Guardar una burger en wishlist no crea un post.
- Marcarla como probada desde este flujo no afecta estadisticas basadas en posts.
- Puede guardar foto y nota privada.

### Notificacion

Aviso derivado de actividad social, invitaciones, comentarios, likes, follows o campanas administrativas.

Debe indicar:

- Que paso.
- Quien lo hizo.
- A que contenido lleva.
- Si requiere accion.

### Campana administrativa

Aviso push creado por un administrador.

Puede ser:

- Previsualizado en el dispositivo del admin.
- Enviado inmediatamente con confirmacion.
- Programado por zona horaria local.
- Cancelado o editado antes del envio.

## Casos de uso principales

### Primer acceso y autenticacion

El usuario debe entender que puede explorar parte del producto y que ciertas zonas requieren iniciar sesion.

### Configuracion inicial de username

Usuarios OAuth, especialmente Google, pueden necesitar confirmar un username propio antes de usar la app completa.

### Crear entrada

El usuario registra una burger con foto, datos basicos, rating y visibilidad.

### Revisar dashboard personal

El usuario ve estadisticas del ano activo, filtros, resumen anual, calendario y accesos a herramientas personales.

### Navegar por feed

El usuario descubre posts, interactua, guarda, comenta, reporta o abre perfiles.

### Buscar usuarios y restaurantes

La busqueda debe resolver dos necesidades: encontrar personas y encontrar lugares.

### Gestionar perfil

El usuario edita identidad, bio, avatar, privacidad, idioma, moneda y preferencias burger.

### Participar en grupos

El usuario crea grupos, invita amigos, acepta invitaciones y compara actividad.

### Consultar My Top Burgers

El usuario revisa sus mejores burgers de restaurante agrupadas por burger y restaurante.

### Usar Burgers para probar

El usuario guarda burgers descubiertas en posts ajenos y las marca como probadas de forma privada.

### Revisar notificaciones

El usuario consulta avisos y activa push tras una accion explicita.

### Moderar contenido

El administrador revisa feed, usuarios, reportes y campanas push.

## Reglas funcionales para la IA

- No disenar flujos que dependan solo de ocultar botones para seguridad; Supabase RLS debe ser la barrera real.
- No mezclar acciones publicas y privadas sin explicar el impacto.
- No convertir la wishlist privada en posts o estadisticas publicas.
- No asumir que todos los perfiles son publicos.
- No hacer depender la navegacion principal de herramientas secundarias; usar `/more` para agruparlas.
- No inventar tablas, endpoints o RPC sin marcarlos como dependencia tecnica.
- No introducir Bootstrap.
- No proponer componentes visuales que rompan el prefijo y estilo `bw-`.

## Lenguaje funcional recomendado

Preferir:

- "Anade una burger".
- "Guarda para probar".
- "Ya la probe".
- "Ver posts".
- "Tu ranking personal".
- "Actividad del grupo".
- "Solo tu puedes ver esta nota".
- "Inicia sesion para guardar esta burger".

Evitar:

- "Registrar entidad gastronomica".
- "Persistir item".
- "Payload".
- "Estado interno".
- "No autorizado" sin explicacion de recuperacion.
- "Error inesperado" como unico mensaje.
