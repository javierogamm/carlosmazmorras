## v0.36.5 - 2026-07-24

- Añadida la opción `Aleatorio/Aleatoria` en la configuración manual de floors y familias enemigas por planta.
- La selección aleatoria queda como valor por defecto en cada piso manual para mantener el comportamiento existente de generación aleatoria cuando no se fija una opción concreta.
- Actualizada la versión de la app y del paquete a `0.36.5`.

## v0.36.4 - 2026-07-24

- Eliminado el límite práctico de importación masiva de objetos al guardar cada JSON de forma individual, evitando payloads grandes en una única petición.
- Añadida lectura de archivos ZIP en los importadores de objetos, floors y familias de enemigos, extrayendo automáticamente todos los `.json` contenidos.
- Actualizados los selectores de importación para aceptar `.zip` además de `.json`.
- Actualizada la versión de la app y del paquete a `0.36.4`.

## v0.36.3 - 2026-07-24

- Añadida comprobación de línea de visión para ataques y habilidades a distancia, bloqueada por muros y puertas cerradas.
- Los enemigos y acompañantes respetan la misma línea de visión en skills/proyectiles a distancia, evitando impactos a través de obstáculos.
- Actualizada la versión de la app y del paquete a `0.36.3`.

## v0.36.2 - 2026-07-24

- Añadido `reglas json pociones.md` con instrucciones completas para generar JSON de pociones, efectos excluyentes, payloads válidos y lista de skills disponibles para aprendizaje.
- Añadido `reglas json objetos.md` con reglas para generar JSON de objetos de equipo, slots, tiers, affixes, skills, pasivas y ejemplos de importación.
- Actualizada la versión de la app y del paquete a `0.36.2`.

## v0.36.1 - 2026-07-24

- Reestructurado el configurador de pociones para que los efectos sean excluyentes mediante un único selector.
- Cada efecto muestra solo sus características editables: recurso y modo numérico/porcentaje para curación, recurso/modo/turnos para regeneración, stat/valor/turnos para incrementos temporales, stat/valor para incrementos permanentes y habilidad para aprendizaje.
- Eliminado el campo visible de iLvl del editor de items; el nivel interno se deriva del Tier seleccionado para mantener compatibilidad con el loot existente.
- Adaptado el motor para soportar curación y regeneración de HP, maná o stamina en valores planos o porcentuales.
- Actualizada la versión de la app y del paquete a `0.36.1`.

## v0.36.0 - 2026-07-24

- Añadido el tipo de item `Poción` al configurador, con campos específicos para elegir efecto, potencia, duración, stat e habilidad aprendida.
- Las pociones configuradas se guardan como consumibles y aparecen agrupadas como Pociones en la lista de objetos guardados.
- La mochila permite usar pociones directamente y mantiene la equipación para objetos de equipo.
- El motor aplica cura, regeneración, recuperación de stamina/maná, mejoras temporales o permanentes de stats, aprendizaje de habilidad, teletransporte a sala segura o escalera, invulnerabilidad e invisibilidad.
- Añadido icono base de vial para pociones sin imagen personalizada.
- Actualizada la versión de la app y del paquete a `0.36.0`.

## v0.35.0 - 2026-07-24

- Añadida tabla de progresión de loot por mundo según el número de pisos configurado.
- La generación de mundos guarda `lootTable` con rarezas permitidas, pesos e intervalo de iLvl por piso.
- El primer piso queda limitado a Común, Infrecuente y Raro con peso dominante de Común.
- Las rarezas e iLvl ahora crecen por progreso de piso y nivel de personaje, reservando Artefacto para pisos y personajes avanzados.
- Los objetos configurados se filtran por la tabla de loot del piso y ajustan su iLvl al rango permitido.
- Actualizada la versión de la app a `0.35.0`.

## v0.34.5 - 2026-07-24

- Reducida un 50% la vida base general de los enemigos mediante un multiplicador global aplicado a enemigos configurados y enemigos escalados.
- La reducción de vida se aplica antes/después del escalado de mundo según la ruta de generación, manteniendo los sliders funcionales pero con una base mucho más baja.
- Actualizada la versión de la app y del paquete a `0.34.5`.

## v0.34.4 - 2026-07-24

- La generación de enemigos por piso usa exclusivamente familias consolidadas desde la tabla `enemy_family`; se elimina el fallback automático al catálogo legacy embebido.
- Marcado el modelo legacy `enemyFamilies` como obsoleto en el código para evitar que se use como fuente activa de generación.
- La creación de dungeons ahora se bloquea con un error claro si no existe al menos una familia válida en `enemy_family`.
- El selector de familias por piso se alimenta únicamente de filas consolidadas de `enemy_family`, garantizando que se carguen esos enemigos en el floor.
- Actualizada la versión de la app y del paquete a `0.34.4`.

## v0.34.3 - 2026-07-24

- Rehecho el cálculo de daño recibido para normalizar cualquier fuente enemiga contra un presupuesto plano por piso/nivel antes de defensas, evitando golpes desproporcionados de enemigos configurados con ataque alto.
- El slider de % daño recibido deja de multiplicar directamente todo el modelo y pasa a aportar un ajuste plano acotado sobre el daño normalizado.
- Reducido de nuevo el multiplicador base de daño enemigo y bajada la CD defensiva para que los combates duren varias rondas y el héroe no muera en dos turnos.
- Añadido al log de combate el desglose `base → normalizado` para detectar rápidamente fuentes de daño infladas.
- Actualizada la versión de la app y del paquete a `0.34.3`.

## v0.34.2 - 2026-07-24

- Reducido el daño base efectivo de los enemigos para suavizar la dificultad general antes de aplicar defensas y multiplicadores de mundo.
- Convertidos los porcentajes de configuración de mundo a sliders con rango limitado de 25% a 500% y pasos de 5%.
- Añadida visualización en vivo del valor porcentual seleccionado en cada slider de dificultad.
- Actualizada la versión de la app y del paquete a `0.34.2`.

## v0.34.1 - 2026-07-24

- Cambiada la edición de parámetros de mundo para que esté colapsada en un acordeón principal y solo se muestre al desplegarlo.
- Separados los parámetros de creación de dungeon en dos acordeones internos: Dificultad para porcentajes y Historias para número de pisos y planificación por piso.
- Añadida selección por cada piso de un floor existente de `config_floor` y una familia existente de `enemy_family`, evitando introducir nombres manuales.
- El JSON del mundo guarda ahora un `floorPlan` por piso y la generación usa esa relación para elegir el floor visual y la familia enemiga correspondiente.
- Actualizada la versión de la app y del paquete a `0.34.1`.

## v0.34.0 - 2026-07-24

- Duplicado el impacto de Vitalidad sobre la vida máxima añadiendo un bonus directo de +2 HP por punto de VIT y aumentando a +5 HP por cada punto adicional de VIT obtenido con equipo o mejoras.
- El daño del jugador y de los enemigos ahora se modula por la stat principal más adecuada al tipo de daño: Fuerza/Agilidad para físico, Inteligencia/Sabiduría para mágico y Suerte/Sabiduría para utilidad ofensiva.
- Las skills enemigas incorporan su modificador de stat ofensiva, y los ataques del jugador aplican los nuevos multiplicadores globales de mundo.
- Añadidos parámetros editables al crear mundo: % daño recibido, % daño infligido, % vida enemiga, % XP recibida, número de floors y familias preferidas por piso.
- El JSON consolidado del mundo guarda los parámetros usados y genera tantos pisos como indique la configuración.
- Actualizada la versión de la app y del paquete a `0.34.0`.

# Log de cambios

## v0.33.8 - 2026-07-23

- La importación de familias de enemigos ahora crea también los enemigos individuales asociados en `enemy_detail`.
- Añadida normalización de enemigos importados para conservar familia, icono, clase, tipo, boss, tier, stats base, stats principales, arma y skills.
- Actualizada la versión de la app a `0.33.8`.

## v0.33.7 - 2026-07-23

- Reducido el tamaño del JSON de mundos precomputados al no duplicar los iconos hexadecimales de tilesets en cada floor, evitando el error `FUNCTION_PAYLOAD_TOO_LARGE` al crear mundos.
- Añadida rehidratación de iconos de tilesets desde `config_floor` al cargar un piso precomputado, manteniendo la apariencia visual sin inflar el payload.
- Actualizada la versión de la app a `0.33.7`.

## v0.33.6 - 2026-07-23

- Agrupados los enemigos individuales por familia en acordeones expandibles dentro del modo configuración.
- Cambiado el selector de skills enemigas para añadir cada selección a un pool visible del enemigo, con chips eliminables antes de guardar.
- Actualizada la versión de la app a `0.33.6`.

## v0.33.5 - 2026-07-23

- Corregida la API de enemigos individuales para ajustarse al schema real de `enemy_detail`, eliminando referencias a la columna inexistente `stats`.
- Las stats principales de enemigos se guardan ahora dentro del JSON de `stats_base` como `coreStats`, manteniendo compatibilidad con la edición y consolidación de familias.
- Actualizada la versión de la app a `0.33.5`.

## v0.33.4 - 2026-07-23

- Añadido importador JSON para floors desde la pestaña de tilesets, permitiendo cargar uno o varios archivos y consolidarlos en `config_floor`.
- Añadido borde interior negro de 2 px sobre los iconos personalizados de enemigos, siguiendo el contorno alfa de la imagen.
- Actualizada la versión de la app a `0.33.4`.

## v0.33.3 - 2026-07-23

- Corregida la creación de mundos con el nuevo sistema de enemigos para no serializar el icono hexadecimal completo en cada enemigo precomputado.
- Añadida rehidratación de iconos de enemigos precomputados desde la configuración activa al entrar en un piso.
- La familia de enemigos de cada floor ahora se elige aleatoriamente entre las familias existentes, incluyendo el primer piso.
- Mejorado el mensaje de error al crear dungeons cuando el backend devuelve texto no JSON.
- Actualizada la versión de la app a `0.33.3`.

## v0.33.2 - 2026-07-23

- Añadidas al editor de enemigos individuales las stats principales del juego: Fuerza, Vitalidad, Agilidad, Suerte, Inteligencia y Sabiduría.
- Las stats principales se normalizan antes de guardar y se persisten en la columna `stats` de `enemy_detail`, separadas de `stats_base`.
- El JSON consolidado de familia incluye ahora las stats principales normalizadas por enemigo, y el escalado usa esas stats para modular vida, daño y armadura.
- Actualizada la versión de la app a `0.33.2`.

## v0.33.1 - 2026-07-23

- Añadido un brillo interno y halo sutil a los iconos personalizados de enemigos para suavizar la pixelación y camuflar bordes claros o blancos.
- Actualizada la versión de la app a `0.33.1`.

## v0.33.0 - 2026-07-23

- Añadida API `/api/enemy-family` para crear, listar, actualizar, borrar e importar familias completas desde la tabla `enemy_family` con `family_json`.
- Añadida API `/api/enemy-detail` para administrar enemigos individuales desde la tabla `enemy_detail`.
- Añadida pestaña de configuración de Enemigos con editor de iconos, selección de tipo, boss, tier, arma, stats separadas y selector múltiple de skills enemigas.
- Añadida consolidación/exportación/importación de familias de enemigos en JSON incluyendo iconos hexadecimales.
- Cambiada la generación de dungeons para asignar una familia por piso, ponderar más los tiers I, II y III, generar pocos bosses en pisos no-jefe y escalar nivel/stats/skills por piso.
- Los bosses configurados se dibujan más grandes cuando usan icono personalizado.
- Actualizada la versión de la app a `0.33.0`.

## v0.32.2 - 2026-07-23

- Añadida edición individual de tiles dentro de un floor, cargando sus propiedades de tipo, dirección, colores, rotación e icono en el formulario.
- Añadido borrado de tiles de suelo, muro o puerta desde el floor actual antes de consolidarlo en `config_floor`.
- Añadidos botones para iniciar un tile nuevo y un floor nuevo sin perder la capacidad de editar floors existentes.
- Ajustado el estilo de los nuevos botones de edición del configurador.
- Actualizada la versión de la app a `0.32.2`.

## v0.32.1 - 2026-07-23

- Rehecha la persistencia de floors para usar la tabla `config_floor` con columnas `floor_name` y `floor_json`.
- Eliminada la API previa de `config_tilesets` y añadida `/api/config-floor` con lectura, creación, actualización y borrado.
- Ajustado el editor para consolidar un floor completo con sus tiles de suelo, muro y puerta dentro de `floor_json`, incluyendo las imágenes en `icon`.
- Añadida dirección de muro en el editor y selección de tiles de muro según dirección real del mapa: arriba, abajo, izquierda, derecha, vertical, horizontal o centro.
- Actualizada la versión de la app a `0.32.1`.

## v0.32.0 - 2026-07-23

- Añadida una pestaña de configuración de tilesets con editor de imagen, recorte y Magic eraser reutilizando el flujo visual del editor de items.
- Añadida la definición de tiles de suelo, tiles de muro con opción de rotación y tiles de puerta.
- Añadida la definición de `floors` como conjuntos de tiles de suelo, muro y puerta.
- Añadido almacenamiento API para `config_tilesets` en Supabase.
- Cambiado el motor visual de generación de pisos para escoger un floor aleatorio y guardar el recurso usado en la partida.
- Forzado el primer piso para usar siempre el floor `Caverna verdeante`.
- Actualizada la versión de la app a `0.32.0`.

## v0.31.2 - 2026-07-23

- Añadido selector de tipo de arma en el editor de objetos cuando el slot seleccionado es Arma.
- Los objetos configurados de tipo arma guardan `weaponType`, su `weaponCategory` asociada, metadatos de icono y stat defensivo del tipo elegido.
- La lista de configuración agrupa las armas dentro del slot Arma por tipo de arma, manteniendo el resto de slots como acordeones propios.
- Actualizada la versión de la app y del paquete a `0.31.2` y la versión visible a `v0.31.2 TIPOS DE ARMA`.

## v0.31.1 - 2026-07-23

- Cambiada la lista de objetos configurados para agrupar los objetos ya creados por slot.
- Añadido un acordeón desplegable por slot con contador de objetos y acciones existentes dentro de cada grupo.
- Actualizada la versión de la app y del paquete a `0.31.1` y la versión visible a `v0.31.1 CONFIG POR SLOT`.

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
