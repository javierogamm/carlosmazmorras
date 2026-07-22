# Log de cambios

## v0.31.0 - 2026-07-22

- Añadidos controles de zoom in/out en el visor de imagen cargada para recortar iconos de Items y Clases sin alterar el tamaño original del recurso.
- Añadida herramienta Magic eraser en ambos visores para convertir a transparente el color seleccionado y colores similares.
- Añadido slider de sutileza del pixel para ajustar la tolerancia de borrado de fondos antes de consolidar el icono 50x50 px.
- Actualizada la versión de la app y del paquete a `0.31.0` y la versión visible a `v0.31.0`.

## v0.30.5 - 2026-07-22

- Añadido un editor de zoom directamente en la pantalla de juego para elegir cuántas casillas visibles muestra la zona jugable.
- Permitido ajustar la vista entre 5x5 y 12x12 casillas, guardando la preferencia en el navegador y redibujando el canvas al instante.
- Actualizada la versión de la app y del paquete a `0.30.5` y la versión visible a `v0.30.5 EDITOR ZOOM`.

## v0.30.4 - 2026-07-22

- Aumentado mucho el zoom del área jugable reduciendo la vista del tablero de 10x10 a 8x8 casillas.
- Ajustado el canvas del juego a 512x512 px internos y escalado visual máximo a 640 px para que cada casilla y personaje se vea más grande y definido.
- Actualizada la versión de la app y del paquete a `0.30.4` y la versión visible a `v0.30.4 ZOOM TABLERO`.

## v0.30.3 - 2026-07-22

- Añadido autoencuadre de los iconos personalizados de clase al dibujarlos, recortando bordes transparentes para que el personaje ocupe mejor el espacio disponible.
- Aumentado el tamaño de render del personaje personalizado en el tablero, previsualización de clase y muñeco de equipo para que el protagonista sea más visible.
- Actualizada la versión de la app y del paquete a `0.30.3` y la versión visible a `v0.30.3 PERSONAJE VISIBLE`.

## v0.30.2 - 2026-07-22

- Igualado el editor de iconos de Clases al de Items: carga la imagen a tamaño original, permite dibujar un cuadrado nuevo o arrastrar el existente y redimensiona el recorte a 50x50 px.
- Añadido canvas de recorte específico para el icono de personaje en la pestaña Clases, manteniendo rollback al sprite pixel original.
- Actualizada la versión de la app y del paquete a `0.30.2` y la versión visible a `v0.30.2 CONFIG CLASES`.

## v0.30.1 - 2026-07-22

- Cambiado el editor de Clases para que el selector salga de las clases existentes en el juego, no solo de filas ya presentes en `config_class`.
- Al guardar una clase se crea o actualiza su fila en `config_class` asociándola por `class_json.classId`; desde ese momento el juego usa el icono guardado para esa clase.
- Añadido botón de rollback al original para vaciar el icono guardado de la clase y volver al sprite pixel por defecto.
- Ampliada la API `/api/config-class` con creación (`POST`) además de lectura y actualización.
- Actualizada la versión de la app y del paquete a `0.30.1` y la versión visible a `v0.30.1 CONFIG CLASES`.

## v0.30.0 - 2026-07-22

- Añadidas pestañas al modo configuración para separar el editor de Items y el nuevo editor de Clases.
- Añadida API `/api/config-class` para leer y actualizar la tabla `config_class` en Supabase.
- Añadido selector de clases existentes y edición del icono de personaje, guardando el icono en `icon` y `class_json.icon`.
- El juego carga los iconos de clase configurados y los usa en selección de clase, sprite del héroe y muñeco de equipo; si una clase no tiene icono subido, conserva los pixels por defecto.
- Actualizada la versión de la app y del paquete a `0.30.0` y la versión visible a `v0.30.0 CONFIG TABS`.

## v0.29.1 - 2026-07-22

- Corregida la edición de objetos configurados para renderizar en la previsualización el icono hexadecimal ya guardado en `item_json.icon` o en la columna `icon`.
- Añadido limpiado explícito de la previsualización al crear un nuevo objeto desde el modo configuración.
- Actualizada la versión de la app a `0.29.1` y la versión visible a `v0.29.1 CONFIG ITEMS`.

## v0.29.0 - 2026-07-22

- Añadidas acciones en modo configuración para editar objetos existentes, duplicarlos y borrarlos desde la lista guardada.
- Añadido selector múltiple de habilidades en el editor para asignar al objeto cualquier habilidad del set completo.
- Los objetos configurados guardan `skillIds` en `item_json`, muestran las habilidades asignadas en su ficha y las enseñan al equiparse.
- Ampliada la API `/api/config-items` con actualización (`PUT`) y borrado (`DELETE`) por `id`.
- Actualizada la versión de la app a `0.29.0` y la versión visible a `v0.29.0 CONFIG ITEMS`.

## v0.28.4 - 2026-07-22

- Añadido selector de tirada de daño para objetos configurados de tipo arma (`1d4`, `1d6`, `1d8`, `1d10`, `2d6`, etc.).
- El daño configurado del arma se guarda en `item_json.damageDice`, se muestra en la ficha del objeto y se usa como tirada del ataque básico al equiparla.
- Actualizada la versión de la app a `0.28.4` y la versión visible a `v0.28.4 CONFIG ITEMS`.

## v0.28.3 - 2026-07-22

- Ajustado el recorte del modo edición para dibujar cuadrados nuevos de tamaño variable y redimensionar el área seleccionada al icono final de 50x50 px.
- Corregido el movimiento del cuadro para que el icono se genere siempre desde la posición actual sobre la imagen original, evitando usar un canvas ya sombreado o alterado.
- Actualizada la versión de la app a `0.28.3` y la versión visible a `v0.28.3 CONFIG ITEMS`.

## v0.28.2 - 2026-07-22

- Corregido el atajo global de teclado para que la tecla `a` y el resto de teclas no intercepten la escritura dentro del modo edición.
- Añadida una lista directa de bonos disponibles en el editor de stats para insertar claves como `damage:+1`, `armor:+1` o `critChance:+1`.
- Actualizada la versión de la app a `0.28.2` y la versión visible a `v0.28.2 CONFIG ITEMS`.

## v0.28.1 - 2026-07-22

- Ajustado el editor de iconos para mantener la imagen subida a tamaño original dentro del canvas, sin redimensionarla ni alterarla.
- Cambiado el selector de recorte a un cuadro fijo de 50x50 px que copia exactamente esa zona como icono hexadecimal.
- Actualizada la versión de la app a `0.28.1` y la versión visible a `v0.28.1 CONFIG ITEMS`.

## v0.28.0 - 2026-07-22

- Añadido un landing inicial con las opciones Configurar y Jugar.
- Añadido modo configuración para crear objetos con nombre, slot, tier, iLvl, stats e icono recortado a 50x50 px guardado como hexadecimal.
- Añadida API `/api/config-items` para listar y guardar objetos en Supabase en la tabla `config_items`, incluyendo `item_json`.
- Añadida exportación de un objeto a JSON e importación múltiple de JSON para guardar varios objetos configurados.
- El generador de botín carga los objetos de `config_items` y los incorpora al loot del juego.
- Añadido el tier Artefacto y colores de rareza para los objetos configurables.
- Actualizada la versión de la app a `0.28.0` y la versión visible a `v0.28.0 CONFIG ITEMS`.

## v0.27.1 - 2026-07-22

- Corregida la API de dungeons para leer la URL desde `SUPABASE_URL`, que es la variable configurada en Vercel, manteniendo `SUPABASE_ANON_KEY` como clave.
- Actualizado el mensaje de error del cliente para indicar `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
- Actualizada la versión de la app a `0.27.1` y la versión visible a `v0.27.1 SUPABASE DUNGEONS`.

## v0.27.0 - 2026-07-22

- Añadida pantalla previa obligatoria para seleccionar o crear dungeon antes de la creación de personaje.
- Añadido guardado de mundos en Supabase mediante la tabla `dungeon_world`, usando exclusivamente `SUPABASE_KEY` para la URL y `SUPABASE_ANON_KEY` para la clave.
- Añadida API `/api/dungeon-worlds` para listar y crear mundos desde Vercel sin exponer variables sensibles en el cliente.
- Al crear una dungeon se calculan y serializan 20 pisos con diseño de niveles, enemigos, cofres, puertas, llaves, salas seguras, jefes y evento preasignado por piso en `world_json`.
- La partida guarda el ID y nombre del mundo seleccionado y carga pisos desde el JSON precomputado cuando existe.
- Actualizada la versión de la app a `0.27.0` y la versión visible a `v0.27 SUPABASE DUNGEONS`.

## v0.26.0 - 2026-07-22

- Cambiada la integración para usar directamente el spritesheet transparente `weapons/espadas/espadas.png` sin generar ni versionar nuevos PNG binarios.
- Añadido recorte en tiempo de ejecución con margen de 15 px, separación de 15 px e iconos fuente de 50x50 px.
- Actualizada la asignación de familias de espadas para que cada categoría use una fila propia del spritesheet.
- Actualizada la versión de la app a `0.26.0`.

## v0.25.0 - 2026-07-22

- Reubicada la carga de iconos de espadas para que use la nueva carpeta por tipo `weapons/espadas/`.
- Las filas de armas identificadas como espadas conservan sus nombres y progresión, pero cargan archivos `icon_r01_cXX.png` dentro de `weapons/espadas/`.
- Añadidos metadatos de fila de recurso para separar la fila lógica del arma de la fila física usada por los nuevos packs por tipo.
- Ajustado el render del arma equipada para ampliar los iconos fuente de 100x100 px al mostrarlos sobre el personaje.
- Actualizada la versión visible de la app a `v0.25 ESPADAS` y la versión del paquete a `0.25.0`.

## v0.24.0 - 2026-07-22

- Añadido el catálogo completo de 200 armaduras para iconos individuales desde la carpeta `armors/`, organizado en 20 filas de menor a mayor poder.
- Los objetos de pecho ahora reciben metadatos `armorCategory`, `armorIconRow`, `armorIconCol` y `armorIconPath`, con nombre tomado de la celda exacta de la lista solicitada.
- El inventario, botín y equipo pueden dibujar armaduras desde `armors/icon_rXX_cYY.png`, manteniendo el icono procedural como reserva.
- Los iconos individuales de armas equipadas se renderizan sobre el personaje en la mano; si la imagen aún no está cargada, se conserva el arma pixel-art procedural como fallback.
- Actualizada la versión de la app a `v0.24 ARMADURAS` y la versión del paquete a `0.24.0`.

## v0.23.0 - 2026-07-22

- Añadido el segundo set completo de 200 armas ciberpunk steampunk desde la carpeta `weaponsCP/`.
- Reemplazada la itemización de las 20 filas de armas por las categorías y nombres solicitados para el set CP.
- Ajustada la carga de iconos para priorizar `weaponsCP/` y mantener `weapons/` y `resources/weapons/` como rutas de compatibilidad.
- Rebalanceada la selección de filas de armas por rareza y nivel para evitar reliquias, artefactos y armas míticas en niveles tempranos, manteniendo coherencia con el set normal.
- Actualizada la versión de la app a `v0.23 ARMAS CP` y la versión del paquete a `0.23.0`.

## v0.22.0 - 2026-07-22

- Corregida la ruta principal de los iconos de armas para cargar desde la carpeta raíz `weapons/`.
- Conservada compatibilidad de carga con la ruta anterior `resources/weapons/` como reserva para partidas o despliegues antiguos.
- Los metadatos y descripciones de armas iniciales apuntan ahora a la ruta consolidada `weapons/`.
- Actualizada la versión de la app a `v0.22 RUTA ARMAS` y la versión del paquete a `0.22.0`.

## v0.21.0 - 2026-07-22

- Corregida la carga de iconos individualizados de armas para probar varias rutas reales por icono.
- El cargador intenta `icon_rXX_cYY.png`, el nombre sin extensión, `webp` y `PNG` antes de usar el fallback procedural.
- La ruta del arma se actualiza con la variante cargada para que los detalles del objeto apunten al recurso correcto.
- Actualizada la versión de la app a `v0.21 ICONOS ARMAS` y la versión del paquete a `0.21.0`.

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
