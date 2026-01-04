# Burger Wrapped

Mini app para llevar el control de tus comidas (especialmente hamburguesas) durante 2026. Permite crear, editar y borrar entradas con foto, restaurante, burger, tipo de carne, valoración (incluye medias estrellas) y precio. Incluye login/registro con tema claro/oscuro y un diseño estilo hoja inferior para añadir entradas.

## Requisitos
- Node 18+ recomendado.
- Variables de entorno Supabase en `.env.local`:
  ```
  VITE_SUPABASE_URL=...
  VITE_SUPABASE_ANON_KEY=...
  ```

## Scripts
- `npm install` — instala dependencias (incluye MUI e iconos).
- `npm run dev` — arranca Vite en modo desarrollo.
- `npm run build` — compila el proyecto.
- `npm run preview` — sirve el build estático.

## Uso rápido
1) Copia `.env.local` con tus claves de Supabase.
2) `npm install` y `npm run dev`.
3) Abre `http://localhost:5173`.
4) Regístrate (usuario, email, contraseña) y añade entradas desde el botón flotante “Añadir”.

## Funcionalidades clave
- **Hoja de nueva entrada**: fecha/hora, restaurante (con creación rápida), hamburguesa con tipo (ternera/pollo/vegana), precio, rating con medias estrellas y foto opcional subida a `food-photos`.
- **Historial**: cards con foto expandible a pantalla completa, emojis según tipo de carne, rating, precio y acciones de editar/borrar (confirmación con modal).
- **Tema claro/oscuro**: toggle en el header; aplica a modal y dashboard.
- **Login/Registro**: campo de usuario obligatorio, mostrar/ocultar contraseña con iconos MUI y logo sin fondo.

## Notas
- El logo se lee desde `public/logo.png` y se usa como favicon y en el header/auth.
- El bucket de fotos esperado es `food-photos`; asegúrate de tener las políticas RLS para escritura/lectura pública adecuada.
