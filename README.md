# Burger Wrapped

Registro de tus comidas (enfocado a hamburguesas) durante 2026. Puedes crear, editar y borrar entradas con:
- Fecha/hora acotada a 2026 y sin futuros.
- Restaurante (creación rápida si no existe).
- Hamburguesa con tipo (ternera, pollo, vegana) y rating con medias estrellas.
- Precio por persona.
- Foto opcional comprimida antes de subirla al bucket `food-photos`.

Incluye login/registro con usuario, tema claro/oscuro, hoja inferior animada para añadir entradas, historial con cards (foto ampliable), estadísticos y botón flotante para nuevas entradas.
Scripts: `npm install`, `npm run dev`, `npm run build`, `npm run preview`. Configura `.env.local` con tus claves de Supabase (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
