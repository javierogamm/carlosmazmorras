# Log de cambios

## v0.20.0 - 2026-07-22

- Sustituida la lectura del spritesheet por iconos individualizados en `resources/weapons`.
- Registrado el catálogo completo de 20 filas y 10 columnas con nombres concretos de armas para generar objetos acordes a cada icono.
- Los objetos de arma guardan ruta `weaponIconPath` con formato `icon_rXX_cYY.png` y usan esa imagen para inventario, botín y equipo.
- Añadida normalización de metadatos de armas para compatibilidad con partidas/objetos generados antes del cambio.
- Actualizada la versión de la app a `v0.20 ICONOS ARMAS` y la versión del paquete a `0.20.0`.

## v0.19.0 - 2026-07-22

- Reajustada la grilla de iconos de armas observando los márgenes reales del PNG.
- Añadidos offsets de recorte para evitar que un icono muestre fragmentos de la fila superior o inferior.
- El recorte usa 10 columnas y 20 filas dentro del área útil del spritesheet, descontando márgenes laterales y verticales.
- Actualizada la versión de la app a `v0.19 GRID ARMAS` y la versión del paquete a `0.19.0`.

## v0.18.0 - 2026-07-22

- Corregido el recorte de iconos de armas para usar las dimensiones reales del spritesheet `resources/armas1.png`.
- El cálculo de celda ahora divide la imagen en 10 columnas y 20 filas desde el tamaño natural del PNG, evitando asumir celdas de 30x30 cuando el recurso está escalado.
- Los iconos de armas equipadas, botín e inventario usan el recorte correcto de fila y columna.
- Actualizada la versión de la app a `v0.18 SPRITES ARMAS` y la versión del paquete a `0.18.0`.

## v0.17.0 - 2026-07-22

- Añadidos iconos visibles para todos los objetos equipados en la vista de equipo.
- Los iconos equipados son clicables y abren una ficha con descripción, categoría, rareza, nivel, poder, afijos, pasivas y efectos.
- La ficha de detalle reutiliza el render del spritesheet de armas y mantiene soporte para iconos procedurales en el resto de objetos.
- Actualizada la versión de la app a `v0.17 EQUIPO VISUAL` y la versión del paquete a `0.17.0`.

## v0.16.0 - 2026-07-22

- Añadida arma inicial básica equipada automáticamente al crear partida.
- Cada clase empieza con una categoría de arma coherente con su fantasía de juego.
- Las armas iniciales usan la primera columna del spritesheet `resources/armas1.png` y metadatos de categoría compatibles con el nuevo sistema de itemización.
- Actualizada la versión de la app a `v0.16 ARMAS INICIALES` y la versión del paquete a `0.16.0`.

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
