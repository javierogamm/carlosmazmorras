# Registro de cambios

## 2.0.1 — 2026-09-03

- Sustitución del recurso PNG versionado por una representación Base64 de texto para que el cambio sea admitido en pull requests sin soporte para archivos binarios.
- Incorporación de `GET /api/logo`, que reconstruye y entrega el logotipo original como `image/png` con caché inmutable.
- Actualización del logotipo, favicon y Apple Touch Icon para utilizar el nuevo endpoint.
- Inclusión explícita del recurso de texto del logotipo en el bundle serverless de Vercel.

## 2.0.0 — 2026-09-03

- Reconstrucción de la interfaz pública con la identidad visual de MetalWinds.
- Incorporación de `metalwindslogo.png` como logotipo principal, favicon y Apple Touch Icon.
- Eliminación de los placeholders, cifras inventadas, textos ficticios de comunidad y reviews de demostración de la interfaz.
- Creación de estados reales de carga, error y colecciones vacías.
- Integración de la portada con las tablas `public.users`, `public.discos` y `public.reviews` mediante una función de Vercel conectada a Supabase.
- Exclusión deliberada del campo `pass` en la consulta y respuesta de usuarios.
- Adaptación responsive de navegación, discos, reviews y miembros para móvil, tableta y escritorio.
- Retirada de las funciones serverless de la aplicación anterior para mantener únicamente el endpoint utilizado por MetalWinds.
