# Log de cambios

## v0.15.0 - 2026-07-22

- Añadido el primer bloque del nuevo sistema de itemización para armas.
- Registradas 20 categorías de armas alineadas con las 20 filas del spritesheet `resources/armas1.png`.
- Los objetos de tipo arma ahora reciben categoría, fila y columna de icono; la columna avanza hacia la derecha según rareza y poder.
- El inventario y los avisos de botín dibujan las armas desde el spritesheet y mantienen el icono procedural como reserva para el resto de objetos.
- Actualizada la versión de la app a `v0.15 ARMAS` y la versión del paquete a `0.15.0`.

## v0.14.0 - 2026-07-22

- Reestructurada la aplicación monolítica HTML en una app estática modular preparada para Vercel.
- Creado `index.html` como punto de entrada principal de la aplicación.
- Extraídos los estilos embebidos a `src/styles.css`.
- Extraída la lógica JavaScript embebida a `src/game.js`.
- Añadida configuración mínima de proyecto con `package.json` y script de despliegue.
- Añadido `vercel.json` para configuración de despliegue estático.
- Actualizada la versión visible de la app a `v0.14 ESTRUCTURA` y la versión del paquete a `0.14.0`.
