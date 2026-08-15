## v0.71.0 - Imágenes de assets y áreas persistentes animadas

- Corregida la carga de imágenes de los assets del mundo cuando el catálogo se había solicitado en modo mínimo: cada asset colocado recupera su icono completo bajo demanda y repinta el tablero al recibirlo, en lugar de quedarse como un rectángulo gris.
- Los efectos persistentes de área (zonas y tótems) mantienen resaltadas todas sus casillas durante sus turnos activos, incluido el radio mínimo de una casilla, con un pulso animado continuo que desaparece al finalizar el efecto.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.71.0`.

## v0.70.0 - Importación, exportación y guardado compatible de dungeons

- Consolidado el ciclo de exportar, importar y guardar dungeons: los archivos importados se tratan siempre como copias nuevas y nunca reutilizan por accidente el identificador de la fila exportada.
- Al guardar una dungeon importada se conserva su JSON completo, incluidos mapas y geometría pregenerada, actualizando únicamente los parámetros editables, historias, nombre y versión de la app en lugar de regenerarla.
- Ampliada la importación para reconocer tanto el formato exportado actual (`world_json`) como documentos raíz y envoltorios antiguos `world` o `dungeon`.
- Añadido un fallback en la API para editar dungeons antiguas en instalaciones de Supabase que todavía no dispongan de la RPC `patch_dungeon_world_json`; se relee la versión autoritativa y se aplican los cambios antes del `PATCH` REST.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.70.0`.

## v0.69.0 - Carga mínima de assets y guardado de bloqueos

- Reducida la carga inicial de Objetos del mundo en Configuración: el listado solicita únicamente metadatos y descarga la imagen pesada de cada objeto o asset solo al abrirlo para editar.
- Añadida consulta individual de objetos del mundo para completar sus datos bajo demanda sin volver a descargar el catálogo completo.
- Corregido exclusivamente el guardado `PUT` de bloqueos de unlock: ahora localiza la combinación raza/clase y clave, actualiza con `PATCH` si existe o crea con `POST` si falta, sin depender de una restricción única ausente en instalaciones antiguas.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.69.0`.

## v0.68.0 - Contrato de dungeons y exportación de ambientes

- Añadida una guía exhaustiva para generación de dungeons JSON mediante IA, con el contrato raíz, parámetros, todos los tipos de sala y piso, geometrías, objetivos, enemigos, loot, cofres, tilesets, assets, validaciones y prompt recomendado.
- Incorporada la exportación JSON individual de cada familia/ambiente de objetos del mundo y una exportación conjunta de todos los ambientes.
- La exportación omite las imágenes e incluye nombres, claves, dimensiones, número total de tiles, conteos bloqueados/transitables y matrices completas de colisión.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.68.0`.

## v0.67.1 - Guardado de iconos y costes de PA de invocaciones

- Corregido el guardado de imágenes de Objetos del mundo, salas, shards y assets: el editor termina ahora la conversión PNG a hexadecimal de forma síncrona antes de permitir que el botón de guardado lea el icono.
- Limitados preventivamente los iconos fijos a 256 px y los assets de decoración a 512 px en su lado mayor, conservando su proporción y evitando que una imagen original demasiado grande exceda el tamaño admitido por la petición o la base de datos.
- Ajustado el turno autónomo de las invocaciones para que cada casilla de movimiento consuma 5 PA y cada ataque, curación, buff o habilidad consuma 10 PA.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.67.1`.

## v0.67.0 - Invocaciones autónomas y control de PA

- Separadas las invocaciones temporales de los compañeros permanentes: las criaturas invocadas actúan de forma autónoma en el bando del personaje, eligen objetivos, atacan, curan o aplican su efecto configurado sin esperar órdenes.
- Cada invocación dispone ahora de su propia reserva de PA, calculada desde el valor configurado, y consume 10 PA por cada acción autónoma durante su turno.
- Los compañeros permanentes conservan su sistema de órdenes y reserva de recursos; las invocaciones temporales ya no se registran erróneamente como permanentes ni reservan recursos del personaje.
- Todas las habilidades, incluidas las raciales y las que requieren seleccionar objetivo, comprueban los PA antes de ejecutar cualquier efecto. Si faltan PA se muestra `No tienes PA suficientes.` y la habilidad no se lanza ni consume recursos.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.67.0`.

## v0.66.0 - Sesiones compatibles y más ligeras

- Añadido un botón **ELIMINAR** a cada partida guardada del jugador, con confirmación y refresco inmediato del listado tras borrar la fila de `dungeon_status` en Supabase.
- La muerte permanente elimina ahora siempre la fila de sesión en Supabase, tanto en partidas individuales como multijugador, evitando partidas huérfanas que ya no pueden retomarse.
- El snapshot de sesión guarda junto al piso el bundle actual del personaje, Soul Spikes, shards y objetos personalizados; al continuar se prioriza esta copia y se mantiene compatibilidad con sesiones antiguas que solo disponen de `user_pj`.
- Reducida la carga de Supabase durante las partidas individuales de dos escrituras por turno a una: `dungeon_status` pasa a ser la fuente autoritativa de la partida en curso y se elimina el `PATCH` duplicado por turno sobre `user_pj` y los recálculos de agregados que provocaba.
- La restauración conserva las nuevas propiedades de raza, sexo e icono al cargar el bundle exacto incluido en la sesión.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.66.0`.

## v0.65.2 - Umbrales definitivos de Soul Revive e iconos raciales

- Soul Revive requiere ahora al menos 20 Soul Spikes: con 0-19 se aplica muerte permanente sin mostrar la oferta de resurrección.
- Con 20-49 Soul Spikes se conserva 1 y el personaje vuelve al inicio del piso 1 con enemigos regenerados y loot/cofres preservados; con 50 o más se conservan 10 y revive en la misma casilla sin regenerar enemigos.
- La creación guarda en el propio personaje el icono exacto de la combinación raza/sexo elegida, evitando depender de una selección global o de una carga posterior del catálogo.
- Sustituidas las etiquetas de imagen directa de las miniaturas por canvases que decodifican el formato real de iconos del configurador; se corrigen así las imágenes rotas en la ficha y en el HUD.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.65.2`.

## v0.65.1 - Rutas de resurrección por saldo de souls

- Corregido el destino del Soul Revive: con 10-49 souls el personaje revive en la misma casilla y conserva 1; con 50 o más revive también en el mismo lugar y conserva 10, sin regenerar enemigos.
- Los personajes con 1-9 souls pueden ahora aceptar el modal: consumen todo el saldo, regresan al inicio del piso 1 y regeneran los enemigos de la mazmorra.
- El reinicio por saldo inferior a 10 conserva los cofres y su estado por piso para impedir que el loot se regenere o pueda volver a recogerse.
- Actualizados los textos del modal según la ruta real de resurrección y restaurado el estado de sus botones para usos posteriores.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.65.1`.

## v0.65.0 - Sistema de Soul Spikes y revivir

- Añadida la currency persistente **Soul Spikes** (`user_pj.souls`): cada enemigo concede 1 soul, los élites 2, los bosses 3 y los megabosses 5; el icono se puede editar desde Objetos del mundo.
- Incorporado el HUD de souls junto al nivel y la miniatura de raza/sexo tanto en el tablero como en la ficha del personaje.
- Al morir con al menos 10 souls se ofrece revivir: desde 10 hasta 49 el saldo baja a 1 y desde 50 baja a 10, con cuenta atrás animada. El personaje vuelve al inicio del piso 1, se regeneran los enemigos y se conservan los estados de cofres disponibles.
- Añadida la estancia **Mercader de Souls**, con suelo dorado e icono configurable; ofrece un objeto configurado no-poción por cada tier y aplica precios de 5/10/20/30/45 souls entre común y legendario.
- Añadido el efecto apilable **Revivir** para skills, items y pociones, configurable por porcentaje de vida, cooldown y coste opcional de souls. Se dispara automáticamente al morir; las pociones se consumen en lugar de entrar en cooldown.
- La subida de nivel muestra una animación de dos segundos antes del modal y exige confirmar la stat seleccionada.
- Incluida la migración `supabase/add_souls_to_user_pj.sql` y sincronizadas las versiones de runtime, paquete y cache-busting en `0.65.0`.
- Sin ejecución de tests, conforme a la instrucción del usuario.

## v0.64.4 - Razas configuradas y modos predeterminados

- Eliminado el catálogo racial legacy de la creación de personaje: las opciones proceden siempre de `config_razas` e incluyen la variante de icono correspondiente al sexo seleccionado.
- La creación carga explícitamente las razas configuradas, informa cuando el catálogo está vacío y bloquea la creación hasta seleccionar una raza válida de la base de datos.
- Marcados por defecto **Advanced Classes** y el modo de combate **Puntos de Acción (PA)**, conservando la posibilidad de elegir manualmente las alternativas.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.64.4`.

## v0.64.3 - Hotfix de inicio y guardado racial

- Corregido el fallo crítico de sintaxis introducido en `0.64.2` que detenía por completo la carga de JavaScript y, por tanto, impedía iniciar sesión.
- Retirada la compactación de iconos ya guardados durante la grabación de una raza: el payload vuelve a construirse directamente desde el estado del formulario, sin reescribir datos existentes antes del guardado.
- Conservado únicamente el límite preventivo al generar iconos raciales nuevos, evitando peticiones excesivas sin mutar las imágenes previamente persistidas.
- Rehecho el tratamiento del error original mediante una lectura segura de la respuesta HTTP, aislada del flujo de login y sin asumir que los rechazos de infraestructura contienen JSON.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.64.3`.

## v0.64.2 - Guardado de iconos raciales optimizado

- Limitada a 128 px la dimensión máxima de cada icono racial, incluyendo la compactación de iconos antiguos al volver a guardar, para evitar que dos imágenes de alta resolución superen el límite de la petición.
- Mejorado el manejo de respuestas no JSON al guardar razas, mostrando un error legible en lugar de `Unexpected token` cuando la infraestructura rechaza una petición.
- Igualado el acabado visual del botón Volver del asistente de creación con el botón Siguiente.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.64.2`.

## v0.64.1 - Iconos de raza por sexo

- Añadido al configurador de razas el selector completo de icono masculino y femenino, cada uno con carga, recorte, zoom, Magic eraser y previsualización independientes.
- Persistidos ambos iconos en la configuración de raza manteniendo compatibilidad con el campo de icono único anterior.
- La creación de personaje muestra en las tarjetas raciales el icono correspondiente al sexo elegido; si falta el femenino, reutiliza el masculino.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.64.1`.

## v0.64.0 - Sexo y creación de personaje por pasos

- Añadida la elección estética de sexo masculino o femenino al personaje y persistida en su estado, sin modificar estadísticas, habilidades ni reglas de juego.
- Ampliado el editor de clases de Configuración con un icono masculino y otro femenino; las configuraciones antiguas siguen usando su icono único y la variante femenina recurre al masculino cuando no existe.
- Reorganizada la creación en cuatro pantallas horizontales: modos de clase/combate, clase, raza/sexo y nombre con resumen final.
- Añadidos indicadores de progreso, navegación para volver a cualquier paso completado, transiciones laterales y un modal fijo sin scroll global; las listas extensas conservan desplazamiento interno.
- Mejorada la claridad de las tarjetas y del resumen para mostrar descripción, atributos, raza, sexo y modos escogidos antes de crear el personaje.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.64.0`.

## v0.63.1 - Invisibilidad y teletransporte raciales

- Corregido el orden del ciclo de invisibilidad apilable: sus turnos se consumen después de la respuesta enemiga, por lo que una invisibilidad propia de un turno evita correctamente una fase enemiga completa.
- Aplicado el mismo orden de consumo en combate clásico, modo PA y fase enemiga multijugador.
- Añadido Movimiento al selector de efectos apilables de las skills raciales, incluyendo Dash y Teletransporte con alcance configurable y selección de casilla.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.63.1`.

## v0.63.0 - Sistema integral de razas configurables

- Añadida la pestaña **Razas** a Configuración con alta, edición, borrado, importación y exportación JSON sobre la tabla `config_razas`.
- Organizado el editor en acordeones de identidad, bonus de stats/recursos/PA, skill racial de efectos apilables e icono recortable.
- El catálogo persistido alimenta la creación de personaje, el modo testing y la configuración de bloqueos mediante una clave racial estable.
- Las skills raciales se aprenden y equipan al crear personaje, usan el motor común de efectos y se distinguen con acabado dorado/blanco.
- Integrados los bonus raciales de PA y porcentaje de gasto de recursos junto a los atributos, regeneraciones y derivados ya existentes.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.63.0`.

## v0.62.1 - Bonus automático de skills

- Eliminada la configuración manual de categoría, atributo y coeficiente de scaling de las skills; también se retiraron esos controles del editor.
- El daño directo, DOT y la magnitud cuantitativa de debuffs reciben automáticamente el bonus general de INT, superpuesto a dados, potencia base y demás modificadores.
- Curaciones, HOT y magnitudes cuantitativas de utilidad reciben automáticamente el bonus general de SAB; se incluyen escudos, buffs, recursos restaurados, HP de invocaciones, transformaciones, ascensiones y revelado escalable.
- Los campos de scaling antiguos se aceptan en datos legacy pero se ignoran y no tienen efecto.
- El mismo cálculo automático utiliza los atributos consolidados del actor y se aplica a jugadores, enemigos, élites y bosses.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.62.1`.

## v0.62.0 - Consolidación del sistema de estadísticas

- Eliminados `physicalPower` y `magicPower` del sistema activo, las razas y los afijos; los campos legacy se ignoran al cargar.
- Consolidado `critDamage` con base 175 como multiplicador crítico real, crítico de SUE a 0,75 puntos por punto y cap de 75%, y bonus de SUE exclusivo para procs de armas (+0,5 puntos por punto, máximo +15).
- Actualizadas las derivadas: stamina `45 + FUE×4`, visión por INT, detección de trampas por SAB, HP `30 + VIT×6` y armadura `4 + floor(VIT/2)` más bonus directos.
- Añadidos slots activos por SAB (`3 + floor(SAB/10)`), conservando el ataque básico fuera del límite y recortando de forma segura los slots excedentes si SAB disminuye.
- Configurados los multiplicadores globales de skills ofensivas por INT y defensivas/utilidad por SAB, ambos con coeficiente explícito 0,01 por punto.
- Consolidado el scaling de skills en un único atributo y coeficiente explícitos; eliminado el fallback implícito de atributo principal más secundario y ampliado el editor con categoría y scaling configurables.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.62.0`.

## v0.61.2 - Pociones iniciales, curación y apuntado multihit

- Restaurado el cálculo del máximo efectivo de vida, maná y stamina cuando existen reservas de compañeros; las pociones de curación instantánea vuelven a modificar la vida, manteniendo los límites reservados.
- La creación de personaje espera a que estén cargados tanto el catálogo de pociones como la configuración de clases antes de resolver las pociones iniciales seleccionadas.
- Eliminado el límite silencioso de tres pociones iniciales: se entregan todas las seleccionadas en la clase, incluidas las ofensivas configuradas con DOT o trampas.
- Las habilidades multihit exigen siempre seleccionar explícitamente un enemigo, incluso si conservaban por error `targetMode: self` en su configuración.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.61.2`.

## v0.61.1 - Ataques sutiles y efectos temáticos de clase

- Reducido el tamaño, brillo, borde y duración de los indicadores de ataque básico para que acompañen al golpe sin tapar personajes ni tablero.
- Diferenciados visualmente los ataques básicos: el cuerpo a cuerpo usa un corte breve y el ataque a distancia un proyectil direccional discreto.
- Añadida una identidad visual GSAP propia para las 16 clases, con paletas, acentos, símbolos y geometrías temáticas aplicadas a daño, movimiento, DOT, curación, escudos y buffs de sus skills.
- Renombrado y tematizado el antiguo Guardián Bestial Aumentado como **Arquero de plasma**, de acuerdo con el listado consolidado de clases.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.61.1`.

## v0.61.0 - Companions, animación y navegación enemiga

- Corregido el error `clampCompanionReservedResources is not defined` al elegir habilidades de compañero y consolidado el ciclo completo de reserva, liberación, reactivación y límite efectivo de vida, maná o stamina.
- Optimizado el bucle visual con un único planificador basado en `requestAnimationFrame`, avance dependiente del tiempo transcurrido y prevención de frames duplicados.
- Integrado GSAP sin spritesheets mediante una capa de efectos DOM sobre el canvas para animar desplazamientos, ataques, habilidades y cada componente apilable de skill (daño, DOT, curación, buff, escudo y movimiento).
- Añadidas señales GSAP específicas para ticks de daño en el tiempo, golpes normales, ataques enemigos, proyectiles y desplazamientos de la IA.
- Sustituido el avance enemigo codicioso por búsqueda de ruta con colisiones, paredes, esquinas, zonas seguras y ocupación de entidades; las clases a distancia conservan una conducta defensiva de retirada y las clases de cuerpo a cuerpo buscan una ruta ofensiva hasta el objetivo.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.61.0`.

## v0.60.1 - Imágenes nítidas y recarga en el editor

- Los recortes de imágenes subidas conservan ahora la resolución completa del área seleccionada, en lugar de reducirse permanentemente a 50x50 px antes de guardarse.
- El escalado de canvases, iconos personalizados, miniaturas y sprites configurados usa interpolación suave de alta calidad y deja de forzar el renderizado pixelado del navegador.
- Al editar un objeto, poción, clase, skill, invocación, tile, enemigo, cofre, objeto del mundo o asset ya guardado, su imagen se decodifica y recarga en el visor de recorte; ya no aparece únicamente en la miniatura.
- El recorte inicial abarca la mayor región posible de la imagen respetando la proporción requerida, en vez de seleccionar automáticamente un cuadrado de solo 50 px.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.60.1`.

## v0.60.0 - Activables, procs y equipo pasivo

- Corregida la selección de objetivo de pociones con efectos dirigidos: daño y debuffs permiten escoger enemigo, mientras áreas, trampas, invocaciones, torretas y clones abren el apuntado al suelo y solo consumen una unidad después de resolver el efecto.
- Las invocaciones activadas sobre el suelo aparecen en la casilla elegida o en la alternativa libre más cercana, en vez de generarse siempre junto al personaje.
- Anillos, trinkets y colgantes con efectos se consolidan como objetos activables reutilizables con el cooldown configurado en cada objeto; al cambiar o retirar el objeto se limpia el cooldown propio del slot.
- Los efectos de armas se ejecutan exclusivamente como proc al golpear, incluida una daga equipada en la mano izquierda, respetando la probabilidad configurada de cada arma.
- Los buffs de cabeza, pecho, manos, piernas, botas y mano secundaria permanecen activos exactamente mientras la pieza esté equipada. Se excluyen las armas colocadas en la mano izquierda para que sus efectos no se conviertan accidentalmente en pasivos.
- Añadido un recuadro amarillo fino alrededor del personaje mientras exista al menos un buff permanente procedente del equipo, separado de los indicadores temporales de buff, escudo e invisibilidad.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.60.0`.

## v0.59.1 - Parches JSON de dungeons y contrato de pociones

- Las ediciones de dungeons existentes ya no regeneran, descargan ni reinsertan `world_json` completo: el cliente calcula exclusivamente las hojas modificadas y una función RPC aplica cada ruta mediante `jsonb_set` dentro de PostgreSQL, conservando intactos mapas, salas, enemigos y demás datos pesados. La creación inicial sigue consolidando el mundo completo una sola vez.
- Añadida `supabase/patch_dungeon_world_json.sql`, que debe ejecutarse una vez en Supabase para habilitar el parcheo granular y devuelve únicamente metadata ligera de la fila actualizada.
- Canonizado el contrato de pociones en la API de items: cualquier registro marcado como poción, consumible o `slot: consumable` se persiste siempre con `type: potion`, `slot: consumable` y `effects` como array.
- El importador de la pestaña Pociones normaliza también JSON antiguos o envueltos, y los catálogos de editor y loot comparten un único detector compatible con metadata legacy; así las pociones nuevas con efectos de daño u otros componentes vuelven a aparecer como pociones y a participar en el loot.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.59.1`.

## v0.59.0 - Editor integral de dungeons

- Añadida la pestaña **Dungeons** en Configuración con creación, edición y borrado de dungeons persistidas, organizada en acordeones de identidad/historia, dificultad/progresión, geometría/dimensiones y configuración individual de los seis pisos.
- Incorporados parámetros finos para daño, vida, experiencia, población enemiga, loot enemigo, loot por piso, modo PA, geometría, densidad, dimensiones, historia inicial, historia por piso, archetype y tileset por piso. Los archetypes seleccionados se aplican al pregenerar cada piso.
- Añadidas importación y exportación JSON tanto del borrador como de dungeons consolidadas.
- Añadida una vista previa simplificada y navegable piso a piso con mapa, salas, puertas, enemigos, cofres, entrada y salida.
- Ampliada la API de `dungeon_world` con actualización PATCH y borrado DELETE.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.59.0`.

## v0.58.1 - Cofres de poción aditivos y tier de consumible

- Corregido el incremento de cofres de poción para que sea aditivo: cada cofre de loot ya generado aporta una tirada independiente del 15% para añadir un cofre de poción extra, sin sustituir ni convertir cofres de equipo, armas o skills.
- Los drops de poción seleccionan siempre un consumible real de `config_items` del tier más alto permitido por la progresión actual; se reconocen tanto los registros `type: potion` como los consumibles declarados mediante `type` o `slot: consumable`, normalizándolos al contrato de poción al entregarlos.
- Los cofres de poción adicionales respetan el tier máximo del piso y solo retroceden a un tier inferior cuando no hay un cofre de poción configurado en el tier adecuado.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.58.1`.

## v0.58.0 - Loot de pociones consolidado y vitalidad

- El loot de pociones y las pociones iniciales se obtienen exclusivamente de filas de `config_items` cuyo JSON sea de tipo `potion` y slot `consumable`; se eliminó el catálogo procedural y, si no hay consumibles configurados, no se inventa ningún sustituto.
- Los cofres de tipo poción tienen un 15% más de peso relativo al seleccionar cofres configurados del mismo tier.
- Los enemigos mágicos o de apoyo (`caster`, invocador, clérigo y chamán) tienen un 15% más de peso relativo de drop de poción, conservando una única recompensa por tirada.
- Cada punto de Vitalidad aporta 1 HP adicional respecto al balance anterior: el aporte total pasa de 5 a 6 HP por punto, también para los puntos añadidos por equipo y efectos.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.58.0`.

## v0.57.1 - Selector táctil de recorte de iconos

- El selector de imagen del configurador permite ahora dibujar y mover el área de recorte arrastrando con un dedo. El gesto se mantiene activo mediante captura de puntero aunque los eventos táctiles no informen botones pulsados.
- Se bloquean el scroll, el zoom gestual y la selección de texto únicamente sobre el canvas mientras se manipula el recorte, evitando que el navegador móvil interrumpa el trazado del cuadrado.
- Se gestionan de forma segura la finalización y cancelación del toque para no dejar un arrastre residual. El cambio se aplica al editor compartido por objetos, pociones, clases, invocaciones, skills, tiles, enemigos, cofres y assets.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.57.1`.

## v0.57.0 - Dungeons de seis pisos y progresión por nivel

- Las dungeons pasan a tener siempre seis pisos: se elimina el selector de cantidad, se conservan las opciones visuales, de familia y ambiente por piso, y el sexto genera obligatoriamente un megaboss o una sucesión de jefes.
- El nivel del personaje al entrar en cada piso queda fijado como referencia de ese piso. A partir de él se determinan niveles y tiers enemigos, tiers de cofres y rareza/iLvl de todo el loot, sin bonificaciones por profundidad.
- El nivel 30 es el techo de progresión de tiers. Por encima, los tiers dejan de crecer, pero el nivel real de los enemigos y su población continúan escalando.
- Completar el sexto piso registra la dungeon y concede una pieza de equipo del tier máximo que permite el nivel con el que se inició el piso.
- Se registran en la columna JSON `user_pj.feats` las bajas de élites, jefes y megabosses, además de las dungeons completadas. La tabla de puntuaciones muestra los cuatro contadores y conserva compatibilidad con personajes anteriores inicializándolos a cero.
- Sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting en `0.57.0`.

## v0.56.2 - Compatibilidad del ID de personajes tras migrar Supabase
- Corregida la creación de personajes cuando la columna primaria `user_pj.id` existe como `int8 NOT NULL` pero el proyecto Supabase migrado no conserva su identity/default: la API intenta primero el insert normal y, únicamente si PostgreSQL devuelve que `id` no puede ser nulo, repite la operación con un identificador entero seguro generado criptográficamente.
- Se mantiene la compatibilidad con el esquema anterior y con columnas identity, que continúan generando el ID en base de datos sin recibir un valor explícito.
- Sincronizadas las versiones de runtime, paquete y cache-busting de `src/game.js` en `0.56.2`.
- No se ejecutaron tests, conforme a la instrucción del usuario.

## v0.56.1 - Catálogo de efectos inlinado en los 4 documentos de JSON
- Revisados los cuatro documentos de instrucciones de JSON (`skills-json-rules.md`, `reglas json objetos.md`, `reglas json pociones.md`, `INSTRUCCION_ITEMS_JSON.md`) contra el código actual, verificando el `switch` real de `applyEffectComponent` (27 `kind`, sin cambios desde la última consolidación) y los campos exactos que arma `currentConfigItemJson`/`currentConfigPotionJson`.
- `reglas json objetos.md` y `reglas json pociones.md` incorporan ahora una copia completa del catálogo de los 27 `kind` de `effects[]` (campos, valores por defecto, target admitidos y una nota de mecánica por kind), en vez de solo remitir a `skills-json-rules.md`; `INSTRUCCION_ITEMS_JSON.md` hace lo mismo dentro de su §6.1. `skills-json-rules.md` queda como fuente canónica (fórmulas de daño, coste AP e IA enemiga aparte) y ahora indica explícitamente que las otras tres guías llevan copias de su catálogo.
- Añadido el campo `hidden` (ausente en ambos documentos pese a ser un campo real y funcional) a `reglas json objetos.md` y `reglas json pociones.md`.
- Corregida en `reglas json objetos.md` la sección de `skillIds`: ya no describe el selector "Habilidades" del formulario de Items, que se eliminó por quedar redundante con los efectos apilables propios del objeto; ahora documenta que el campo es legado, se conserva al editar pero no es asignable desde la UI.
- Corregida en `reglas json pociones.md` una referencia obsoleta a "pestaña Items → tipo Poción" (la pestaña Pociones es independiente desde que se separaron los editores).
- Sin cambios funcionales en el motor ni en el editor; sin ejecución de tests, conforme a la instrucción del usuario. Sincronizadas las versiones de runtime, paquete y cache-busting de `src/game.js` en `0.56.1`.

## v0.56.0 - Auditoría e instrucción maestra de items y JSON
- Añadida `INSTRUCCION_ITEMS_JSON.md`, una guía operativa exhaustiva que traza el ciclo completo de equipo y pociones: formulario, objeto canónico, metadata de `config_items`, API, importación/exportación, normalización de loot, inventario y ejecución de efectos.
- Documentados los contratos campo por campo para equipo, armas, activables y pociones, junto con tiers, slots, tipos y alcances de arma, stats/affixes, iconos y efectos apilables.
- Documentado el procedimiento seguro para generar e importar JSON, sus formatos admitidos, la ausencia actual de validación de esquema, la escritura no atómica de lotes y una checklist de validación manual.
- Registrados los hallazgos de auditoría y riesgos conocidos: importadores sin discriminación por tipo, posible divergencia entre metadata e `item_json`, score desalineado tras el clamp de nivel, efectos inútiles según slot y alcance real de `hidden`.
- Incluidas reglas explícitas sobre habilidades del juego y sobre cuándo usar —o no usar— las skills disponibles del agente, incluida la generación de iconos con `imagegen`.
- Sin cambios funcionales en el sistema de items y sin ejecución de tests, conforme a la instrucción del usuario.
- Sincronizadas las versiones de runtime, paquete y cache-busting en `0.56.0`.

## v0.55.1 - Fiabilidad de la creación de personaje
- Corregidos varios huecos que podían dejar la creación de personaje "colgada" (pantalla en blanco tras elegir la primera habilidad, sin guardar el personaje en Supabase ni volver a single player): `updateUI()` calculaba incondicionalmente la etiqueta "Zona:" del HUD, que sin un piso/mazmorra activo todavía (normal durante la creación) lanzaba una excepción si `config_floor` no tenía filas, abortando en silencio el resto del flujo de elección de habilidad (incluido el guardado del personaje). También cubiertos: clases Advanced sin skills de tier I configuradas, una clase personalizada que aún no había terminado de cargar desde `config_class`, y una petición de elección de habilidad residual de un intento anterior en la misma pestaña.
- `finishCharacterCreation()` ahora muestra una confirmación explícita al guardar con éxito, y el error real de Supabase/PostgREST (antes solo se veía un mensaje genérico) si falla.
- Bump del cache-busting de `src/game.js` (`?v=`) para forzar que los navegadores recarguen el script tras estos cambios.
- Versión 0.55.1.

## v0.55.0 - Sistema de bloqueos (gates) de razas y clases por progreso de usuario
- Nuevas columnas de agregado en `user`: `max_pj_lv` (nivel más alto entre todos los personajes del usuario) y `accumulated_points` (suma de `pj_score` -el mismo valor de la tabla PUNTUACIONES- de todos sus personajes, vivos y muertos). Se recalculan desde cero (nunca de forma incremental) en tres momentos: **login** (`api/user.js` las recomputa desde `user_pj` antes de devolver la sesión, así que un usuario recién creado en Supabase o con datos desincronizados se autocorrige sin backfill manual), **al crear un personaje nuevo** (`finishCharacterCreation`, vía el POST a `api/user-pj.js`) y **al subir de nivel** (`grantXp` dispara un guardado inmediato del personaje en cuanto detecta `level>startLevel`, en vez de esperar al siguiente fin de turno). Todo guardado o lectura de `user_pj` (`updateUserAggregates` en `api/user-pj.js`) recalcula ambos campos desde cero sobre todas las filas de ese `nombre`.
- El login (`api/user.js`) devuelve ambos valores; al iniciar sesión se muestra un aviso "Nivel máximo de PJ: X · PUNTUACIÓN: Y" encima del menú principal. `refreshCurrentUserProgress()` en el cliente mantiene `window.currentUser` (y por tanto los gates de razas/clases) al día tras crear personaje o subir de nivel, sin necesidad de volver a iniciar sesión.
- Nueva pestaña **Bloqueos** en Configuración para fijar, por raza y por clase, el nivel de PJ y la puntuación mínimos necesarios para poder elegirla al crear personaje (0/0 = siempre desbloqueada). Se sirve desde `api/config-class.js?kind=gates` (tabla `config_unlock_gates`) para no superar el límite de 12 Serverless Functions del plan Hobby de Vercel, igual que ya hacía `config-floor.js?kind=object`.
- Nuevo icono configurable **"Bloqueos rewards"** (`reward_lock`) en Configuración → Objetos del mundo: si se sube un icono personalizado, se usa como candado sobre las razas/clases bloqueadas en la pantalla de creación de personaje; si no, se muestra un 🔒 de reserva.
- La creación de personaje bloquea (visual y funcionalmente) las razas/clases que no cumplen su gate para el usuario logueado, con aviso del requisito exacto.
- **Requiere crear manualmente la tabla `config_unlock_gates` en Supabase** (columnas `type` text, `key` text, `min_level` numeric default 0, `min_points` numeric default 0, constraint unique en `(type, key)`) y confirmar que `user.max_pj_lv`/`user.accumulated_points` existen como numeric.
- Versión 0.55.0.

## v0.54.0 - Sistema de crafteo por shards en la Sala del Creador
- Deshacer objetos ahora da entre 10 y 20 shards de tier fijos (antes escalaba con iLvl sin techo).
- Nuevo sistema de crafteo completo en las salas del Creador, con 4 acciones además de deshacer: crear objetos nuevos (40 shards del tier, slot y tier libres, stat principal a la base del tier: común +1, infrecuente +2, raro +4, épico +6, legendario +8, artefacto +10), mejorar tier de un objeto (20 shards del tier objetivo, convierte su stat principal a la base del nuevo tier), añadir una stat adicional (20 shards comunes, empieza en +1; raros/épicos 1 slot extra, legendarios 2, artefactos 3) y mejorar una stat existente (20 shards del tier correspondiente al nuevo valor: +2/+3 infrecuentes, +4/+5 raras, +6/+7 épicas, +8/+9 legendarias, +10 artefacto; el bonus nunca puede superar el máximo del tier del objeto).
- Los objetos creados/editados en el Altar del Creador son exclusivos del personaje (no se guardan en `config_items`) pero sí se pueden tradear en multijugador; se persisten en la nueva columna `custom_items` de `user_pj` (además de vivir en el inventario normal). **Requiere añadir manualmente la columna `custom_items` (jsonb, default `[]`) a la tabla `user_pj` en Supabase.**
- El generador de dungeons garantiza ahora al menos 2 salas de crafting (`creator`) por piso, salvo en los arquetipos de piso que ya excluían esas salas de su diseño (p. ej. `horda`).
- Versión 0.54.0.

## v0.53.0 - Action-point turn system + AGI->FUE weapon damage
- New AP turn mode: always on in multiplayer, opt-in per dungeon in single player (new world-creation checkbox, world param `apMode`). A turn is a pool of action points: base 30 + ceil(AGI/2). Costs: attack 10, skill 10, move/door 5. Actions no longer auto-pass the turn; only the PASAR TURNO button (former ESPERAR, now shows remaining PA) hands over to the other player / the enemies. AP pool refills at the start of each of your turns.
- Enemies get their own pool in AP mode: 20 + AGI, acting consecutively (in order) until each pool is spent; `enemyTurn` refactored into a per-decision function driven by an AP loop. Legacy mode keeps exactly one action per enemy.
- All weapon rows that scaled damage with AGI now scale with FUE (`stat:'agility'` -> `'strength'` in weaponRows, which drives both the attack stat bonus and the defense stat of those weapons).
- Version 0.53.0.

## v0.52.0 - Realtime visual actions: stream player/enemy actions instead of waiting for the turn commit
### Diagnosis (from the actual code, not assumptions)
The 2-5s freeze was not in per-move latency (a single move/attack/skill already broadcast its `turn` commit essentially synchronously - `move()`/`attack()`/`useSkill()` mutate state and call `playerFinished()` with no blocking `await` before `mpAdvanceTurn`/`mpPublishTurn`). The dominant, code-confirmed cause was the enemy phase: `playerFinishedMultiplayer()` ran `enemyTurn()` - a fully synchronous loop over every visible acting enemy (skills, ranged shots, melee hits, movement) - to completion, and only *after* the whole phase resolved did it call `mpAdvanceTurn(0)`, which is the only point that broadcasts anything. For any encounter with more than a couple of acting enemies, the other client saw zero network activity for the entire phase, then received the fully-resolved final state in one shot. A secondary, smaller gap: no visual ping existed for the *start* of an action (movement/attack/spell) distinct from the final confirmed `turn`, so remote clients never saw attack swings or sequential enemy actions, only the end result. A third, latent risk found during the audit: Realtime readiness was tracked as a single `rtReady` boolean with no richer state, so a flaky/degraded subscription silently fell back to the slow DB-checkpoint path with no visible indicator.

### Architecture (unchanged: seq/rev/CAS/ACK/resend/need-full/checkpoint)
Per the task's explicit constraints, nothing in the existing consistency machinery was removed or altered: the logical clock `seq`, the rev-guarded CAS writes, ACK+resend, `need`/`full` recovery, and periodic DB checkpoints all work exactly as before and remain the sole source of authoritative state. What's new sits strictly alongside it:
- **`action` (ephemeral, new)**: fire-and-forget Supabase Realtime broadcast on the same `ds-<sessionId>` channel, carrying only enough data to replay one visual (coordinates/ids/small numbers, never full arrays). Deduplicated by `eventId`, ordered best-effort per `(author, turnSeq)` with an 80ms stabilization buffer and a bounded reorder wait, never written to `dungeon_status`, never authoritative, and safe to lose, duplicate or delay.
- **`turn` (transport name kept, semantically `turn_commit`)**: unchanged in every mechanical respect (seq/CAS/ACK/resend/need-full/checkpoint); it now additionally carries `protocolVersion` and `type:'turn_commit'` for clarity and future-proofing, and is the *only* thing that ever moves HP, inventory, door/chest/trap/altar state, or the turn pointer.

### What changed
- **Enemy phase now streams.** `enemyTurn()`'s existing loop is untouched in its decision logic (no rebalancing, no restructuring into async/awaited steps - a deliberate, documented deviation from the prompt's illustrative `await executeEnemyDecisionLocally()` pattern, see below) but now fires one `sendMpAction('enemy_move'|'enemy_attack'|'enemy_spell'|'enemy_heal', ...)` per decision, bracketed by `enemy_phase_start`/`enemy_phase_end`. Because `sendMpAction` is fire-and-forget (never awaited), this adds negligible cost to the resolving client and turns "silence for N seconds, then a snapshot" into "a fast but visible burst of individual actions arriving as they happen" on the other client.
- **Player actions ping before/alongside resolving.** `move()` (movement + door-open), `attack()` (melee/ranged/skill hits - the single hook point since basic attacks, ranged attacks and all damage-dealing skills already route through it), `useSkill()`/`resolveTargetedSkill()` (self-casts and targeted skills), `checkTile()` (key pickup, floor transition start), `springTrap()`, `useAltar()`, `openChest()` (visual only - no inventory/economy data ever travels in an `action`), and `kill()` (death flash) all emit a small `action` at the point the local action is already validated, before/alongside local resolution - never after an awaited animation.
- **Reception**: `handleMpAction()` validates protocol version, session, floor, author (must be in the roster, never self), and action kind against a closed renderer map (`MP_ACTION_RENDERERS` - no `eval`, no dynamic dispatch from network strings) before deduplicating (`processedActionIds`, TTL+size capped) and queueing (`mpAuthorQueues`, keyed by `(author, turnSeq)` - see below) for ordered, buffered playback.
- **Minimal visual/logical split**: rather than introducing a parallel `game.visualState`/`game.logicalState` graph, the existing `prevX/prevY/animT` interpolation fields (already used for other players) are the visual layer, extended to enemies (`mpAnimateRemote` and `draw()` now interpolate enemy sprites too, and `mpApplyEnemyWire`'s turn-commit reconciliation now animates small corrections and snaps large ones, matching the existing player-reconciliation rule). Confirmed x/y/hp remain exclusively driven by `turn_commit`; no `action` ever writes them.
- **Explicit Realtime connection state**: `game.mpRealtimeStatus` (`idle|connecting|subscribed|degraded|error|closed`), `game.mpRealtimeReady`, `game.mpTransportMode` (`realtime|fallback`) are now tracked from the real Supabase subscribe callback (`SUBSCRIBED`/`CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED`), not inferred from the channel object merely existing. A discreet badge (`#mpConnBadge`, next to the equipment/skills/map buttons) shows "● TIEMPO REAL" or "○ MODO DEGRADADO" - existing fallback behavior (poll-based, unchanged) is preserved and now visible instead of silent.
- **Protocol versioning**: `MP_PROTOCOL_VERSION=2` on every new message; a message from an unknown *newer* version is logged and triggers a resync request rather than being silently misapplied, while messages without a version (or from v1/legacy) are still accepted, preserving compatibility with in-flight sessions.
- **Telemetry**: `mpDebugEvent(stage, data)` plus `mpTelemetryStart/Mark` track created/sent/received/applied/rendered timestamps, payload byte size (`new Blob([...]).size`), channel status and transport mode per event, gated behind `MP_DEBUG_LATENCY` (reads `localStorage.mpDebugLatency`, toggle from the console without a code change) so it costs nothing when off. Enemy-phase duration is measured with `performance.now()`.
- **Cleanup**: new `cleanupMultiplayerRuntime()` (idempotent) consolidates realtime disconnect, live-turn timers, trade polling, and the new action-queue/dedup state; wired into leaving the multiplayer screen and the lobby back button. Floor changes and resyncs (`floor_transition_start`, `mpApplyLiveTurn`/`mpApplyRemoteState`/`mpOnFull` handling a floor mismatch) reset the action queues so a stale visual action can never replay against a floor it no longer describes.
- **Error handling**: new `mpReportError(context, error, metadata)` replaces silent failure in the new code paths (visual render errors, protocol mismatches, send failures) with logged, non-fatal errors - a bad visual never interrupts the game; the next `turn_commit` reconciles regardless.

### Bug found and fixed during implementation (not in the original prompt)
The per-turn actionSeq numbering (1, 2, 3... restarting each turn, as specified) combined with a queue keyed only by `author` would have caused remote clients to stall forever after the first turn: a new turn's actionSeq=1 could never satisfy an `expected` counter left over at, say, 47 from a long previous turn. Fixed by scoping the reorder queue to `(author, turnSeq)` and pruning queues for turns already superseded by a `turn_commit` (`mpPruneActionQueuesUpTo`). Verified with a standalone Node simulation (dedup, reorder-then-correct-order, the turn-boundary case above, forced skip-ahead after the timeout, protocol/self/roster/floor/kind rejection) - all 9 cases pass.

### Deliberate deviations from the prompt
- Enemy actions are emitted inline within the existing synchronous `enemyTurn()` loop rather than restructuring it into the prompt's illustrative `async`/per-enemy-awaited pattern. Since every `sendMpAction` call is fire-and-forget, this achieves the same streaming outcome (the remote client starts receiving actions immediately instead of after the whole phase) with far less risk to existing combat balance/pacing, at the cost of the burst arriving slightly less evenly paced than a deliberately-throttled sender would produce. The receiver's queue buffer plus interpolated movement animation already spread the visible playback out.
- Companions (single-player-only summons) are not part of the synced entity model at all (pre-existing limitation) and are skipped when choosing an `action`'s target/attacker reference rather than partially plumbed through.
- The transport event name stays `turn` (not renamed to `turn_commit`) per the prompt's own fallback allowance; the semantic name is carried in a `type` field instead.

### Tests performed
- `node --check` on the full file after every edit batch (final state included).
- Standalone Node simulation of the queue/dedup/protocol-gating logic extracted from the real functions (not reimplemented) - 9 cases, all passing (see above).
- Live two-browser testing was **not** performed (no such environment available here) - this is a real gap; the queuing/dedup/protocol logic is verified in isolation, but end-to-end timing (P50/P95 receive latency, actual enemy-phase perceived duration) has not been measured against the target numbers in a real session.

### Risks / pending
- No live-session measurement yet; the concrete "hundreds of ms" target is an engineering goal here, not a verified number.
- The generic per-skill "spell" ping in `useSkill()`/`resolveTargetedSkill()` fires once per cast regardless of the many `applyCreativeClassEffect` branches (teleports, summons, exotic class effects) - those still resolve correctly via `turn_commit`, but don't get a bespoke visual per effect type, only a generic cast flash.
- The connection badge and `MP_DEBUG_LATENCY` telemetry are new, minimal-footprint UI/dev surfaces; they haven't been visually verified on a real phone screen (see the last two branches' mobile-crowding lesson) - the badge is a single small text span, but worth a real-device check.

## v0.51.0 - Mobile layout fix: compact vitals back on the board, tighter dpad and skill bar, no passive regen
Follow-up to v0.50.0 after seeing an actual mobile screenshot: the full-width vital bars, tall skill cards and padded dpad buttons together pushed the movement arrows off-screen and wasted most of the viewport on chrome instead of the map.
- Vital bars moved back onto the canvas, but compact: a small stacked overlay in the top-right quadrant of the board (`.vitalBars`, ~15px tall bars) instead of a giant full-width row above it. Still color-coded, still draining, just sized like an actual HUD element instead of a banner.
- Active buff badges moved to the top-left quadrant of the board so they no longer compete with the vitals for the same corner.
- Movement dpad drastically tightened on mobile: smaller padding/font per button and a narrower max-width, cutting its total footprint roughly in half so the arrows are visible without scrolling.
- Skill bar cards collapsed to a single compact row (hotkey + icon + short cost, e.g. `22⚡`) instead of stacking name, dice damage, range, defense stat and damage % as separate lines — that wall of text was the single biggest source of wasted vertical space. The full detail (exact dice, range, defense stat, damage%) is still available as a hover/long-press tooltip (`title` attribute), just not force-displayed.
- Header (title + version badge) tightened on mobile so the title no longer wraps to two lines and eats a row of its own.
- Removed passive stamina/mana regeneration entirely: it no longer refills automatically each turn in single player or multiplayer. Resources now only recover through safe-room rest, potions, or skills that explicitly restore them — makes stamina/mana a real resource to manage instead of a number that refills itself. (The regen-boosting item affixes, race trait and buff on the `resourceRegen` skill still exist in data but no longer have any effect now that nothing reads them per turn; flagging this as a known loose end rather than silently reworking item/race balance beyond what was asked.)
- App and package version bumped to `0.51.0`.

## v0.50.0 - Mobile-first game board layout, clean overlays, accessible vital bars
- Reworked the game board area, which used to stack a dense pile of absolutely-positioned overlays (zoom slider, floor-type banner, HP/XP/stamina/mana HUD, quick buttons) directly on top of the canvas — the main cause of it "looking terrible on mobile" since they fought for the same cramped space as the map itself.
- Zoom control moved out of the canvas and into a toolbar row above the board, next to the equipment/skills/minimap quick buttons (`.gameToolbar`). Nothing overlaps the map anymore for a static, always-visible control.
- Floor archetype/objective banner moved out of the canvas overlay and placed below the board, as a clean full-width rectangle directly above the skill bar (`.floorObjective` is now a static block, not an absolutely-positioned overlay).
- HP/XP/Stamina/Mana are now big, high-contrast, color-coded bars that visibly drain (`.vitalBars`), placed above the board next to the toolbar, each with a label, a live numeric readout and `role="progressbar"`/`aria-valuenow` for screen readers — replacing the old cramped icon+8px-text corner HUD. The redundant small HP/XP/Stamina/Mana bars in the side hero panel were removed (this is now the single source of truth for vitals), which also shortens that panel considerably on the stacked mobile layout.
- Enemy HP bars now render below the enemy sprite instead of above it, so they're no longer easy to miss or visually merge with the sprite's head/top edge.
- What still overlays the canvas is now limited to genuinely transient/contextual elements: the multiplayer turn banner, active buff badges, the minimap toggle, the inspect popup and the targeting crosshair hint — nothing that needs to be permanently visible.
- Removed the "Guardar JSON"/"Cargar JSON" buttons and their underlying manual export/import code entirely (character progress already persists automatically through the account system; this was a redundant, error-prone manual path).
- App and package version bumped to `0.50.0`.

## v0.49.0 - Multiplayer item trade
- New "Comercio" tab in the side panel, visible only in multiplayer. Lists the other living party members; pick one to propose a trade. Both sides then add/remove items from their own inventory into the deal and accept; once both have accepted, the swap executes automatically.
- Trade state lives in `dungeon_status.trade` (one active trade at a time per session, between exactly two players) and every mutation goes through the same rev-guarded CAS write already used for turns (`mpSaveSession`): a trade can only be proposed if none is open, and the item swap can only ever be applied once per side, because the write that records "I've applied my half" only succeeds if the trade is still the expected one, both sides are still accepted, and that side hadn't already applied. This is the same pattern that already keeps turns from crossing, reused here to make trading crossing-proof and duplication-proof.
- Items stay in each player's own inventory (and keep persisting normally through the regular character save) until the swap actually commits, so a reload or crash mid-trade never loses an item. While offered, an item is only soft-locked - it cannot be equipped, used (potions) or auto-sold (the `transmute` skill) until it's withdrawn from the offer; changing your own offer resets both sides' acceptance.
- Cancelling is safe at any point for either side: the write that cancels only succeeds if the trade is still the one both clients think it is, so a cancel racing against an in-flight apply can never half-execute a swap - verified with a standalone protocol simulation (propose/offer/accept/apply in any order, double-invoked applies, and cancel-immediately-before-apply all leave inventories exactly where they should be).
- Delivery is prompt without depending on the slow safety poll: a lightweight `trade` broadcast on the existing realtime channel tells peers to refetch trade state immediately, with a dedicated 1.5-2.5s poll as fallback while a session is active (independent of the turn-sync timers, since trading isn't gated by whose turn it is).
- A new trade proposal targeting you announces itself (banner + log) the moment it's seen, even if the Comercio tab isn't open.
- App and package version bumped to `0.49.0`.

## v0.48.0 - Floor archetypes + room typologies, shared XP and party-scaled enemy HP
### Multiplayer balance
- Experience is now split between the party: `gainXp` divides by the number of living participants, so a 2-player run no longer doubles total XP income.
- Enemy HP scales +25% per additional player (`partyHpMultiplier`). It is applied once when the floor is built, so the shared snapshot already carries the scaled values to every client and cannot be double-applied (`partyScaled` guard).

### Floor archetype system
Every floor now picks an archetype by weighted probability, gated by depth, the expected enemy tier for that depth, and which specials appeared recently (per-archetype cooldown, plus a hard rule that superboss/bossrush never chain back to back). Measured over 400 x 20-floor runs: standard 41.7%, laberinto 11.9%, horda 10.9%, tesoro 9.3%, elites 7.6%, supervivencia 6.4%, contrarreloj 5.4%, superboss 4.1%, bossrush 2.7% - the harder archetypes are the rarest and start deepest (superboss floor 8+, contrarreloj 7+, supervivencia 6+, bossrush 12+).
- **Estándar**: balanced reference floor, mixed rooms, boss on even floors.
- **Superjefe**: one boss 1-3 tiers above normal (extra hp/damage/armour/phases and re-rolled skills), few normal enemies, preparation rooms with altars before the boss room, exceptional rewards, announced on arrival. Never chains with another heavy floor.
- **Laberinto**: many small rooms, knots and dead ends, loops and shortcuts, low enemy density, the most traps, exit hard to locate. A connectivity spine guarantees a valid entry->exit route.
- **Horda**: large arenas, waves of individually weaker enemies (tierBias -1), exit sealed until every wave is cleared, elites appearing between waves, spawn cap to protect performance.
- **Élites**: lowest enemy count of all archetypes but a very high elite ratio, tier bias +1, miniboss, superior rewards.
- **Boss rush**: several boss arenas chained, minibosses plus a clearly stronger final boss, rest/altar rooms in between, the richest rewards.
- **Tesoro**: ~4x the chests of a normal floor, high rarity bonus, low initial resistance, plenty of traps and guard posts.
- **Supervivencia**: no exit at first - survive N turns against escalating reinforcements and the stairs appear.
- **Contrarreloj**: turn limit to reach the exit; running out makes the floor hostile (collapse damage and elite spawns) instead of an instant loss.

### Room typology system
14 room types (filler, combat, ambush, guard post, elite den, vault, arena, hub, trap room, shrine, dead end, corridor knot, boss arena, prep room), each defining size, shape, number of exits, enemy count/tier/composition, initial enemy placement (edges for ambushes), cover density, traps, interactive elements, chests and event chance. Archetypes and rooms are complementary: each archetype supplies its own room-type weights, so a laberinto is built mostly of knots and dead ends while a horda is built of arenas.
- Cover is real: pillars are carved as wall cells inside rooms, so they block movement and line of sight. They are never placed on a room's border ring or on the centre/spawn/stairs, which is what guarantees no room can be sealed off.
- New floor features: **traps** (hidden, revealed by an agility/luck check when adjacent, damage on trigger) and **altars** (heal, shield or damage/armour blessing, one use each), both rendered, inspectable and synced in multiplayer.
- Verified over 360 generated floors across all archetypes: zero unreachable stairs and zero unreachable bosses.

### Supporting changes
- `buildFloorPlan()` is now the single floor builder shared by the pre-generated world JSON and the live generator, so single player and multiplayer produce identical structures. World JSON is now `schemaVersion: 4` and carries archetype, objective, traps and altars; older v3 worlds still load and default to the standard archetype.
- Floor completion is driven by the objective (`stairs`, `bossKill`, `survive`, `waves`, `timed`) via `stairsBlockedReason()`, with objective ticking hooked into the single-player turn and the multiplayer enemy phase, and the state carried in the live turn payload and the snapshot.
- New objective HUD above the map showing the archetype and what is required, highlighted when time is running out.
- Archetype reward bonus feeds the loot rarity roll, so treasure/elite/boss floors really do drop better.
- App and package version bumped to `0.48.0`.

## v0.47.0 - Live turn sync over the channel; the DB becomes a checkpoint every 10 rounds
- Turn authority no longer requires a DB round trip. Every turn transition is published over the Supabase Realtime channel and applied directly, so both players see moves, attacks and the enemy phase at the same time (~0.1-0.2s, the websocket RTT) instead of waiting for write + read.
- Turns cannot cross, by construction. A logical clock `seq` orders every transition and a transition is only ever authored by the player who was active at the previous seq. A `turn` message is applied only when BOTH hold: (1) `msg.seq === localSeq + 1` — no replays, no gaps, no reordering; (2) `msg.author === turnOrder[localActiveIndex]` — only the active player may pass the turn. Exactly one client can satisfy (2) for a given seq, so two clients can never both hold the turn. Duplicates are dropped and re-acked; gaps are never applied out of order, they trigger a resync.
- Delivery is confirmed, not assumed: receivers `ack` each transition and the sender re-sends every 600ms until every peer acks (5 attempts). If a peer still never acks, the sender writes a DB checkpoint so the peer's poll recovers the state. A resync request (`need`) is answered by any peer holding a newer seq with a full live snapshot (`full`); if nobody answers within 900ms it falls back to the DB.
- The DB is written only as a checkpoint: every `MP_CHECKPOINT_EVERY` (10) completed rounds, on floor change, on death, on unconfirmed delivery, and best-effort on tab hide/close (keepalive + rev CAS). Checkpoints carry `seq`, and `mpApplyRemoteState` will never move the turn pointer backwards from a checkpoint older than the live clock — an old checkpoint may refresh the map but not the turn.
- Enemies now carry a stable `eid`, so live enemy updates are applied by identity (and enemies absent from the wire are treated as dead) instead of by array index, which broke whenever an enemy died.
- The DB safety poll drops to 6s while the channel is subscribed (400ms when it is not). Without Realtime the game degrades cleanly to the previous behaviour: one rev-guarded DB write per turn.
- App and package version bumped to `0.47.0`.

## v0.46.0 - Instant opponent-turn visuals (provisional act events) + config_items-only itemization
### Latency: the opponent's whole turn is now visible in ~0.2s
- The position ping grows into a full provisional `act` broadcast (~1.5KB) fired the instant an action or the enemy phase resolves locally, BEFORE the authoritative write: opponent position/facing/hp, per-enemy position+hp (aligned to the shared committed order, applied only when lengths match), damage floaters, doors opened, chests opened, keys taken and the combat log lines. Receivers render it immediately as display-only state.
- Turn safety is untouched: `act` events carry no rev/turnOrder/activePlayerIndex, are ignored while it's your own turn, are dropped if already superseded (`baseRev` < last applied rev), and the turn itself is still granted exclusively by the committed rev-guarded state. A lost, late or duplicated act cannot cross turns — worst case you see the result twice or 0.3s early.
- The enemy phase broadcasts its act right after resolving, so the other player watches enemy movement/damage ~0.2s after resolution instead of waiting for the write+state broadcast; log lines shown provisionally are deduped when the authoritative event replay arrives.
- Insurance: receiving an act schedules a quick resync 350ms later in case the state broadcast is lost, instead of waiting for the 1.2s safety poll.
### Itemization: config_items is the single source
- Loot from chests/bosses now always comes from `config_items` (rarity filtered by the floor's loot band, preferring rows whose base ilvl fits the band, level clamped as before). The old random item generator only remains as a fallback when the table is empty or has no eligible rows. Potion drops are unchanged.
- Enemy equipment draws from `config_items` weapons matching the class kind (ranged/magic/melee via weapon type, category, name or range), picking among the rarities allowed on that floor with ilvl closest to the enemy's level; range comes from the item (or its weapon-type preset) and the damage bonus scales with the item's rarity. Synthetic weapon names remain only as fallback.
- Starter weapons prefer the lowest-ilvl config weapon of the class's category (then any melee config weapon), falling back to the legacy starter.
- `config_items` is now loaded in every flow that needs it: single-player screen, session resume and multiplayer game entry.
- App and package version bumped to `0.46.0`.

## v0.45.0 - Turn sync tuning: instant position pings, no write echo, slimmer broadcasts
- Instant movement: the moment a player ends an action, a tiny display-only `pos` ping (position/facing/hp) is broadcast before the authoritative write, so the other player sees the move in ~0.2s. It touches no turn state, so a late or duplicated ping cannot cross turns.
- Writes no longer download their own echo: `dsPatch` uses `Prefer: return=minimal,count=exact` on the first (fast-path) attempt, detecting the rev CAS conflict via the Content-Range count instead of a ~50KB row representation. A missing header is treated as a conflict and the retry falls back to the representation path, so correctness is preserved.
- Slimmer `state` broadcasts: the static floor layout (map, rooms, safe rooms, tileset — ~15KB) is stripped from the wire copy; same-floor receivers never needed it and floor-change receivers now do one full fetch instead.
- Enemy phase: pre-resolution pause 120ms -> 60ms on the resolving client. Combined with the lighter write+broadcast, the enemy turn should land well under 2s (typically ~0.5-0.8s after the last player acts).
- Character saves (`user-pj` PUT) throttled in multiplayer to every 3rd turn, on floor change or when badly hurt — they fired on every single action and competed with turn sync on the uplink.
- Safety-net poll while realtime is subscribed tightened 2s -> 1.2s, so even with broadcasts failing the worst-case enemy turn stays around ~1.5s.
- App and package version bumped to `0.45.0`.

## v0.44.0 - Enemy classes with equipment + fix for the ~10s enemy-phase stall
### Multiplayer latency
- Fixed the ~10s enemy-turn delay: the multiplayer-screen presence timer (every 8s: heartbeat + online users + FULL session list with every session's complete dungeon_status JSON) kept running during lobby and gameplay, periodically saturating the connection right when turn sync needed it. It now stops on entering the lobby/game and restarts when returning to the multiplayer screen.
- New light session list (`GET /api/dungeon-status?light=1`): PostgREST JSON projections (multiplayer, started, hostUser, currentFloor, turn, roster) instead of full snapshots; used by the open-sessions list, MP continue list and single-player continue list.
- Enemy-phase pause on the resolving client reduced 220ms -> 120ms; same-floor writes merge dynamic state (enemies, doors, chests, keys, fog) over the stored static layout so the authoritative map can never be clobbered by a stale local copy.
### Enemy model (single + multiplayer)
- Every enemy now resolves to a class — rogue, warrior, tanque, arquero, francotirador, caster, invocador, clerigo, chaman — via its configured type or a legacy-type mapping (`enemyClassOf`).
- Enemies are equipped with a weapon when the dungeon is built (world creation, floor generation and hydration of older worlds): ranged classes get bows/crossbows/pistols/rifles/shotguns, magic classes get wands, melee classes get blades/heavy weapons from the existing weapon tables. Quality scales with enemy level and the floor's loot rarity table; the weapon adds proportional damage (+12%..+37% by rarity) and its data persists through world JSON, session snapshots and broadcasts.
- Combat AI honors equipment: ranged/magic enemies shoot or cast from weapon range with line of sight (bows 2-5, rifles 2-5, pistols 1-3, wands 1-4...), kite away from melee contact, and hold position while the target is in range; the old hardcoded liche/shaman magic branch only applies to un-equipped legacy enemies. Enemies now also path toward their chosen target (nearest player/companion) instead of always the local player.
- Class-appropriate skills: the enemy skill pool filters by class (casters get magic damage, clerics get heal/shield/buff and now heal wounded allies within 4 tiles, archers get ranged/multihit, rogues get dash/execute...). Caster-type classes always roll at least one skill.
- Inspect popup shows the enemy's class and weapon (name, rarity, range).
- App and package version bumped to `0.44.0`.

## v0.43.0 - Multiplayer latency: push over websocket + direct REST (target <=0.5s)
- Turn visibility latency drops from 3-10s to ~0.3-0.5s. The 3-10s range came from stacking: 400ms poll tick + light fetch + full fetch, each through a Vercel serverless function (cold starts were the multi-second outliers), plus a read-before-write round trip on every save.
- Push instead of poll: clients join a Supabase Realtime broadcast channel per session (`ds-<sessionId>`, supabase-js v2 via CDN). After every committed write, the writer broadcasts the full committed `dungeon_status` over the websocket; receivers apply it immediately through the same `mpApplyRemoteState` + `rev` guard as before, so late or out-of-order messages are still discarded and turns cannot cross. Polling remains as a safety net: 2s when the channel is subscribed, 400ms otherwise.
- Direct Supabase REST on the hot path: new `GET /api/rt-config` hands the browser the Supabase URL + anon key (the same key all /api proxies already use), and new helpers `dsGet/dsGetRev/dsPatch` hit PostgREST directly — no serverless hop, no cold starts — falling back to `/api/dungeon-status` if unavailable. The rev CAS (`dungeon_status->>rev=eq.N`) is enforced in the PATCH filter exactly like the API did.
- Faster writes: `mpSaveSession` now has a fast path that skips the pre-read by reusing the last applied state (`game.mpStatusMirror`, kept in sync by applies and own writes) when its rev matches; the CAS still rejects stale writes, which then fall back to the normal read-modify-retry loop. Saves one full round trip per turn.
- Realtime channel is connected already in the lobby, so joiners enter the game the instant the host starts (broadcast triggers the lobby refresh) instead of waiting for the 2s lobby poll; joiner floor-wait retry tightened 800ms -> 500ms.
- App and package version bumped to `0.43.0`.

## v0.42.0 - Multiplayer internals redesign (dungeon-first sessions, strict turn order, near-realtime sync)
- Dungeon is now created BEFORE the session starts: when the host presses "Iniciar partida", floor 1 (precomputed from `dungeon_world.world_json.floors` or generated) plus spawn positions for the WHOLE roster are written to `dungeon_status` in the same atomic write that sets `started:true`. Joiners always find a complete floor snapshot, fixing the bug where non-host players saw the wrong floor (only the enemy family was right). If a joiner still races the write, it retries up to ~6s before falling back to the world's precomputed floor.
- Strict turn order player 1 (host) → player 2 → ... → enemies: only the currently active player (verified against the freshly re-read `activePlayerIndex` inside the optimistic-lock write) may advance the turn pointer. Combined with a new stale-read guard — polls carry `rev` and any response with `rev <= last applied` is discarded — this removes the crossed-turns bug caused by in-flight old reads re-granting an already-passed turn.
- Near-realtime sync: clients poll a new lightweight endpoint (`GET /api/dungeon-status?id=X&light=1`, `rev` only via PostgREST JSON projection) every 400ms and fetch the full state only when `rev` changed. Remote player movement is now animated (interpolated) instead of teleporting, and combat log lines produced by the active client (attacks, damage, loot) are shipped as sequenced events in `dungeon_status.events` and replayed on the other clients, so player 2 sees moves and attacks almost synchronously.
- Floor descent moves the whole party: the descending player relocates every player to a free tile cluster around the new spawn in the same write that changes `currentFloor`, and other clients apply the full floor snapshot (map, doors, keys, chests, enemies, tileset) plus their own new position when they see the floor change.
- Dead players no longer block the game: death is persisted into the shared state (removed from `turnOrder`, hp 0 in `players`, `activePlayerIndex` re-pointed), both when dying on your own client and when killed during another client's enemy phase; the enemy-phase writer also prunes players with hp<=0 from the turn order.
- Random floor events are disabled in multiplayer (each client rolled them independently, desyncing enemies), fog-of-war is merged as a union across players, and only the current floor snapshot is stored (previous floors are static in the world JSON). Single-player "continuar sesión" no longer lists multiplayer sessions.
- `dungeon_status` JSON contract (rebuilt): `{multiplayer, started, host, hostUser, roster[], turnOrder[], activePlayerIndex, turn, currentFloor, floors:{<current>:snapshot}, players:{<pjId>:{x,y,floor,facing,hp,maxHp,cls,classIcon,name,nombre}}, rev, evSeq, events:[{i,m,c}]}`. No new tables/columns needed.
- App and package version bumped to `0.42.0`.

## v0.41.3 - Rediseño de la sincronización de turnos en multijugador
- Sustituido el guardado "leer-modificar-escribir a ciegas" de `dungeon_status` por un protocolo con concurrencia optimista: cada escritura añade un contador `rev` dentro del propio JSON y la API (`api/dungeon-status.js`) solo aplica el `PATCH` si `dungeon_status->>rev` sigue coincidiendo con el valor leído (si no, responde 409 y el cliente relee y reintenta). Esto elimina la clase de bug donde un cliente pisaba con una copia local desfasada el turno/posición que el otro acababa de guardar.
- Corregida la regresión de la v0.41.2 que dejaba la partida bloqueada en "esperando al jugador 1": el turno siguiente (`activePlayerIndex`) se calculaba antes en el cliente y se escribía tal cual, así que si el otro jugador publicaba su propia entrada (por ejemplo al entrar en la sala) con una copia de `activePlayerIndex` más antigua, revertía el turno recién avanzado. Ahora el avance de turno se calcula siempre dentro de la propia escritura, contra el `turnOrder`/`activePlayerIndex` recién releídos del servidor, nunca contra la copia local.
- El daño a otros jugadores resuelto en la fase de enemigos ya no sobrescribe su posición (que siempre se toma del estado fresco): solo aplica el delta de HP/HP máximo sobre la entrada más reciente, evitando que un jugador "salte" a una posición vieja por culpa de otro cliente.
- Secuencia de turnos estable y explícita: jugador 1 → jugador N → fase de enemigos → jugador 1, calculada siempre sobre el `turnOrder` fresco del servidor.
- Actualizada la versión de la app y del paquete a `0.41.3`.

## v0.41.2 - Corrige piso genérico y cruce de personajes en multijugador
- Corregido que el jugador no anfitrión viera un piso "genérico" (fuera de la niebla de guerra, en una casilla que no correspondía al piso compartido): quien se unía a la sala de espera antes de que el anfitrión pulsara "Iniciar partida" nunca quedaba registrado en `dungeon_status.players`, así que al entrar conservaba su última posición guardada (de otra partida u otro piso) en vez de aparecer en el piso realmente generado. Ahora cada jugador, al entrar en una partida ya iniciada, calcula su propia casilla libre junto al anfitrión (o el spawn del piso) si no hay una posición guardada, y publica de inmediato su posición/vida real en el estado compartido.
- Corregido el "cruce" de personajes tras 2-3 turnos: `mpPersistTurnState()` sobrescribía el estado compartido con la copia local (potencialmente desfasada) de la posición/vida de los demás jugadores, pudiendo revertir el daño o el movimiento que otro cliente acababa de guardar. Ahora se relee el estado más reciente antes de escribir y solo se actualizan los datos de otros jugadores cuando el cliente acaba de resolver el turno de los enemigos (el único momento en que es autoritativo sobre ellos); el resto de turnos solo publica la posición propia.
- Corregido que la vida perdida por ataques enemigos mientras no era tu turno no se reflejara en tu propio personaje hasta tu siguiente turno (y entonces se sobrescribía de vuelta a la vida anterior al persistir): ahora se sincroniza en cada sondeo.
- Sondeo de partida y de sala de espera más rápidos (1s → 800ms y 4s → 2s) para que las acciones del otro jugador se vean casi en tiempo real.
- Actualizada la versión de la app y del paquete a `0.41.2`.

## v0.41.1 - Correcciones de multijugador
- Corregidas las habilidades que quedaban en gris y no se podían lanzar aunque sí se pudiera mover: al recibir el turno se actualizaba `busy` pero no se re-renderizaba la barra de habilidades, que conservaba el atributo `disabled` del turno anterior. Ahora `mpSetMyTurn()` refresca la interfaz.
- Corregido el indicador de turno, que nombraba al jugador equivocado: el índice del jugador activo se actualizaba después de pintar el mensaje, por lo que mostraba al jugador que acababa de jugar en vez de al siguiente.
- Añadida fase explícita "Turno de los enemigos..." en el indicador, en lugar de anunciar ya al siguiente jugador mientras actúan los enemigos.
- Reducida drásticamente la espera entre turnos: el sondeo de estado compartido pasa de 3s a 1s y la pausa antes del turno enemigo de 500ms a 220ms.
- Reducido el tamaño del estado enviado en cada turno, que era la causa principal de la lentitud: la niebla de guerra se serializa de forma compacta y solo se guarda el piso actual en vez de acumular todos los pisos visitados en cada escritura.
- Corregido que un jugador no anfitrión cargara un piso aleatorio: ahora el anfitrión guarda el estado del piso nada más iniciar la partida, y quien se une carga ese piso exacto; si no hubiera estado guardado se recurre al piso precomputado del mundo en vez de generar uno nuevo, avisando con un error claro si tampoco existe.
- Corregido que el anfitrión pudiera borrar del estado compartido a un jugador recién unido si este entraba mientras el anfitrión tenía el turno.
- Las sesiones multijugador ya iniciadas vuelven a aparecer en la lista de sesiones a las que unirse (mostrando piso actual), ocultando las sesiones en las que ya participas.
- Actualizada la versión de la app y del paquete a `0.41.1`.

## v0.41.0 - Multijugador cooperativo
- Añadida presencia multijugador sobre la tabla `multi_session` (`api/multi-session.js`): login al entrar en MULTIPLAYER, heartbeat periódico (reutiliza `login_time` como último latido) y logout al salir; el panel MULTIPLAYER muestra en tiempo real los usuarios conectados (activos en los últimos 45s).
- El botón MULTIPLAYER deja de estar inactivo: abre el nuevo panel con sesiones abiertas para unirse, botón para crear sesión y botón "Continuar sesión" con tus propias partidas multijugador.
- Crear sesión reutiliza la selección/creación de personaje y de mundo existente; la sesión se guarda en `dungeon_status` con `dungeon_status.multiplayer:true` y `started:false` mientras está en sala de espera, visible para el resto de usuarios en "Sesiones abiertas".
- Cualquier usuario puede unirse a una sesión abierta seleccionando o creando personaje; el anfitrión ve la sala de espera con el roster y pulsa "Iniciar partida" para arrancar en el piso 1.
- Si un jugador se une a una partida ya iniciada, aparece directamente en el piso actual, en una casilla libre adyacente al personaje del anfitrión.
- Turnos por ronda: los jugadores humanos actúan en el orden en que se unieron (`turnOrder`/`activePlayerIndex` en `dungeon_status`); solo cuando todos han jugado su turno actúan los enemigos. Un indicador en el HUD muestra de quién es el turno y bloquea la entrada mientras no te toca.
- El estado del piso (mapa, tileset, familia de enemigos, enemigos vivos/muertos, cofres, puertas, llaves, niebla de guerra y posición de cada jugador) se sincroniza en `dungeon_status.dungeon_status` al final de cada turno; los clientes en espera hacen polling para reflejar los cambios sin recargar.
- Los enemigos ahora también pueden elegir como objetivo a otros jugadores humanos de la partida, no solo al jugador local ni a los compañeros invocados.
- Si un jugador muere en multijugador, se marca su personaje como `dead` y se le retira de la rotación de turnos, pero la sesión compartida sigue viva para el resto (a diferencia de un jugador en solitario, donde la sesión se elimina).
- Añadido renderizado de otros jugadores en el tablero (icono/sprite de clase, barra de vida y nombre) reutilizando el mismo sistema de dibujo del héroe.
- Actualizada la versión de la app y del paquete a `0.41.0`.

## v0.40.2 - Corrección de carga de piso al continuar sesión
- Cada piso guardado en `dungeon_status` ahora incluye su mapa, salas, escalera, tileset visual y familia de enemigos, no solo el estado mutable (antes dependía de recalcular el piso por índice contra el mundo precomputado, lo que podía fallar y cargar un piso incorrecto/aleatorio).
- "Continuar sesión" restaura el piso directamente desde ese snapshot autocontenido; si una sesión antigua no tiene snapshot completo, cae de forma segura al método anterior de regeneración por índice.
- Actualizada la versión de la app y del paquete a `0.40.2`.

## v0.40.1 - Mejoras en continuar sesión
- La lista de sesiones de "Continuar sesión" ahora muestra nombre del mundo, piso y turno en lugar de solo el id del mundo.
- El listado ligero de `dungeon_status` incluye el JSON de estado para poder mostrar piso/turno sin peticiones extra por sesión.
- Al reanudar una sesión también se restaura la niebla de guerra (zonas ya exploradas del piso), además del personaje, inventario, turno, posición y estado de enemigos/cofres/puertas.
- Actualizada la versión de la app y del paquete a `0.40.1`.

## v0.40.0 - Persistencia de personajes y mundos
- Añadidas tablas Supabase `user_pj` (personajes por usuario, vivos/muertos, con `pj_json` y `pj_score`) y `dungeon_status` (sesiones de mundo persistentes con turno, roster de jugadores y estado por piso) junto a sus endpoints `api/user-pj.js` y `api/dungeon-status.js`.
- Sustituido el menú admin de 2 botones por un menú de 4 botones tras login para todos los usuarios: PUNTUACIONES, SINGLE PLAYER, MULTIPLAYER (inactivo) y CONFIGURAR (restringido a admins).
- Añadida pantalla PUNTUACIONES con el ranking de todos los personajes (vivos y muertos) ordenado por `pj_score`, mostrando usuario, clase, raza, nivel y estado.
- Añadido submenú SINGLE PLAYER: `Seleccionar personaje` (personajes vivos propios → elegir/crear mundo → entra directo a jugar), `Nuevo personaje` (crea personaje con la skill de nivel 1 y vuelve al submenú) y `Continuar sesión` (retoma una sesión guardada en `dungeon_status` restaurando piso, posición, turno y estado de enemigos/cofres/puertas).
- El personaje (`pj_json`) y la sesión de mundo (`dungeon_status`) se guardan en Supabase al principio de cada turno del jugador.
- Al morir un personaje se marca como `dead` en `user_pj` con su estado final y se elimina la sesión asociada en `dungeon_status`.
- Puntuación de personaje calculada como nivel×100 + Σ ilvl equipado×5 + piso máximo alcanzado×50 + oro/10.
- Actualizada la versión de la app y del paquete a `0.40.0`.

## v0.39.2 - Corrección del sistema de loot
- Corregida la documentación de la tabla de pesos de rareza para que el peso de Raro coincida con la fórmula implementada `max(6, round(6 + ratio * 16))`.
- Añadida segunda pasiva de Artefacto con 75% de probabilidad, manteniendo su pasiva garantizada.
- Añadido cap del 65% a la probabilidad de skill desde cofre y al drop de objeto de enemigo normal.
- El forzado de rareza del primer objeto en eventos `reward` ahora filtra por rarezas permitidas por la progresión de piso/nivel.
- `weightedRarity()` ahora suma `lootLuck` temporal y usa Suerte final derivada.
- El drop de objeto de enemigo normal ahora usa Suerte final derivada para alinearse con la rareza del botín.
- Actualizada la versión de la app y del paquete a `0.39.2`.

## v0.39.1 - Documentación del loot
- Añadido `loot.md` con la descripción completa del sistema de loot: fuentes de botín, porcentajes, rarezas, Suerte, `rarityFind`, niveles de objeto, tiers, cofres, enemigos, eventos, pociones, objetos configurados, afijos, pasivas y habilidades como botín.
- Actualizada la versión de la app y del paquete a `0.39.1`.

## v0.39.0 - Motor de daño consolidado
- Unificada la ruta real de `execute`: `skillId: execute` queda como skill apuntada con umbral del 40% de vida, eliminando la rama legacy residual con umbral del 35%.
- Corregida la progresión del dado de ataque básico por alcance para que el EV no baje al aumentar el alcance máximo del arma.
- Rebalanceada la tabla de dados de skills para que física y magia genéricas compartan valores y todas las categorías dañinas superen al ataque básico por tier.
- Igualado el exponente de DC de defensa enemiga y defensa del jugador a 0.75.
- Documentada la conversión reforzada de armadura para Fuerza/Vitalidad como decisión intencional de builds tanque.
- Aclarado que el escalado de enemigos configurados y legacy no se acumula en la generación normal; `scaleEnemy()` solo se aplica a enemigos de evento legacy.
- Actualizada la versión de la app y del paquete a `0.39.0`.
## v0.37.2 - 2026-07-24

- Recuperado el modal de selección de skill para la creación de personaje y para hitos de subida de nivel.
- Revisado el pool de skills para usar directamente `classSkillTrees` por clase y tier, filtrando solo skills existentes en `skillDefs` y no aprendidas.
- Añadida una salvaguarda cada 2 turnos que compara nivel del personaje y número esperado de skills de clase; si falta alguna, abre el modal del tier correspondiente.
- Actualizada la versión visible y de paquete a `v0.37.2 SKILL GUARD`.

## v0.37.1 - 2026-07-24

- Eliminado el popup de selección de skill por hitos de nivel: ya no se renderiza ni se abre el modal de elección.
- Cambiada la progresión de habilidades de clase para aprender automáticamente una skill aleatoria disponible del tier correspondiente en los niveles indicados.
- La habilidad automática queda marcada como concedida para no repetirse al cargar partidas o al revisar hitos pendientes.
- Actualizada la versión visible y de paquete a `v0.37.1 AUTO SKILLS`.

## v0.37.0 - 2026-07-24

- Añadida landing de login contra la tabla Supabase `public.user`: el endpoint `/api/user` valida usuario/contraseña existentes y crea nuevos usuarios con `config: false` (admin false).
- El flujo de acceso redirige a usuarios no admin directamente a jugar y muestra a usuarios admin la selección Configurar/Jugar.
- Corregido el popup de selección de habilidad al subir de nivel para que use capa fija global con z-index superior y no quede tapado por otros overlays.
- Ajustado el orden del level up para resolver primero los puntos de stat y abrir después la selección de skill pendiente.

## v0.36.11 - 2026-07-24

- Añadido `reglas de combate.md` con una revisión completa del motor de daño: fuentes de daño, fórmulas de ataque básico, skills, defensa, críticos, modificadores, progresión y cálculo de daño enemigo.
- Documentadas las notas de balance detectadas durante la revisión, incluyendo normalización de daño recibido y derivados no consumidos directamente por la fórmula principal.
- Actualizada la versión de la app y del paquete a `0.36.11`.

## v0.36.10 - 2026-07-24

- Añadidos los hitos de selección de skill al subir a nivel 7, 25 y 50, manteniendo los ya existentes en 3, 5, 10, 15, 20, 30 y 40, además de la selección inicial de nivel 1.
- La progresión de skills de clase queda escalonada por tier: Tier I en niveles 1, 3, 5 y 7; Tier II en 10, 15, 20 y 25; Tier III en 30, 40 y 50.
- Cada popup muestra hasta 3 opciones aleatorias del pool de skills de la clase para el tier correspondiente, excluyendo skills ya aprendidas.
- Actualizada la versión de la app y del paquete a `0.36.10`.

## v0.36.9 - 2026-07-24

- Añadida referencia visual persistente en el tablero para habilidades que dejan entidades o efectos sobre el suelo: minas/trampas, zonas, tótems y señuelos.
- Las minas y trampas colocadas por skills permanecen visibles por turnos y explotan al detectar enemigos cercanos; las zonas y tótems aplican daño periódico mientras estén activos.
- Las invocaciones existentes se mantienen como acompañantes visibles y las partidas cargadas inicializan también la nueva colección de objetos de habilidad.
- Las partidas nuevas empiezan siempre con 2 unidades stackeadas de `Pocion de curacion comun #109`.
- Las pociones iguales se agrupan por efecto en la mochila, muestran su cantidad y consumir una unidad reduce el stack antes de eliminarlo.
- Actualizada la versión de la app y del paquete a `0.36.9`.

## v0.36.8 - 2026-07-24

- Añadidos `rangeMin` y `rangeMax` a las armas para definir el alcance mínimo y máximo del ataque normal.
- El ataque normal considera armas a distancia a varitas, arcos, ballestas, pistolas, rifles y escopetas, con rangos por defecto 1-4, 2-5, 1-4, 1-3, 2-5 y 1-2 respectivamente.
- El editor de objetos permite editar el alcance mínimo y máximo de armas y guarda esos atributos en el JSON.
- Actualizadas las instrucciones JSON de objetos/equipo con el nuevo contrato de alcance para armas.
- Actualizada la versión de la app y del paquete a `0.36.8`.

## v0.36.7 - 2026-07-24

- La opción `Aleatorio` para floors durante la generación de dungeons tira exclusivamente de los floors consolidados en Supabase (`config_floor`).
- La generación se bloquea con un error claro si no hay floors consolidados en Supabase, evitando usar tilesets legacy por defecto para floors aleatorios.
- La selección manual de floors por piso también se resuelve contra `config_floor`, manteniendo los valores vacíos como aleatorios desde Supabase.
- Actualizada la versión de la app y del paquete a `0.36.7`.

## v0.36.6 - 2026-07-24

- Añadido borde negro de 2px siguiendo la silueta alfa a los iconos recortados desde el configurador de objetos, clases y enemigos.
- Las previsualizaciones de iconos configurados muestran el mismo borde de silueta para reflejar el resultado final.
- Excluidos explícitamente los tiles de floors del borde de silueta para mantenerlos como texturas completas.
- Actualizada la versión de la app y del paquete a `0.36.6`.

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

## v0.38.0 - Loop de subida de nivel consolidado
- Cambiado el flujo de subida de nivel para abrir inmediatamente un popup obligatorio al ganar nivel.
- El popup permite distribuir 1 punto en una stat principal: Fuerza, Vitalidad, Agilidad, Suerte, Inteligencia o Sabiduría.
- En los niveles 3, 5, 10, 15, 20, 25, 30, 35 y 40, el mismo popup añade una skill aleatoria de la clase.
- Las skills aleatorias salen de cualquier tier disponible de la clase, pero las de tier III solo entran en el pool desde nivel 10.
- Ajustado el loop posterior a ataques/skills para que, si el golpe mata a un enemigo y provoca subida de nivel, se atienda el popup antes de avanzar el turno enemigo.

## v0.72.0 - 2026-08-15

- Reducido el egress de los listados de items, pociones, clases, razas, floors, personajes y dungeons: las vistas de selección/configuración reciben solo metadatos y reservan los JSON completos para el detalle necesario.
- La selección de personaje obtiene la ficha completa únicamente después de pulsar el personaje elegido.
- Eliminado el guardado automático de partidas por turno y la creación automática de sesiones al entrar en una dungeon.
- Añadido un botón **Guardar partida** bajo la ficha del personaje; solo una pulsación explícita crea o actualiza la partida recuperable.
- Las partidas guardadas conservan únicamente el snapshot del piso actual en cada consolidación manual, evitando transportar el histórico completo de pisos.
- Los listados de dungeons continúan usando metadatos ligeros y el mundo completo se obtiene solo al elegir, editar o continuar una dungeon concreta.
- Actualizada la versión de la app y del paquete a `0.72.0` (`v0.72.0 EGRESS MÍNIMO`).

## v0.73.0 - 2026-08-15

- Auditado el stack real: frontend CSR estático sin framework y backend de funciones Serverless Vercel que consulta Supabase PostgREST.
- Restaurado el contrato completo por defecto de los endpoints de configuración; el modo ligero ahora es explícito con `light=1`, evitando romper consumidores existentes.
- Sustituidos los `select=*` restantes de detalle de personaje y sesión por listas exactas de columnas consumidas.
- Eliminada la descarga de `pj_json` para login, progreso y puntuaciones mediante proyecciones `->>` de nivel, clase y raza.
- Corregida la hidratación bajo demanda de personajes en los flujos multijugador y la identidad de clases/razas en listados ligeros.
- Eliminadas las precargas pesadas al abrir el menú de un jugador; los catálogos se solicitan al entrar en el flujo que realmente los usa.
- Documentadas las queries originales/nuevas, consumidores, equivalencia funcional y riesgos no modificados en `EGRESS_SUPABASE.md`.
- No se alteraron polling ni Realtime por requerir confirmación previa al afectar datos en tiempo real.
- Actualizada la versión de la app y del paquete a `0.73.0` (`v0.73.0 EGRESS AUDITADO`).

## v0.74.0 - 2026-08-15

- Corregida la hidratación de imágenes de `config_world_object`: las cargas ligeras de metadatos ya no borran iconos previamente cargados y se distingue entre catálogo disponible e imágenes completas disponibles.
- La entrada y reanudación de dungeons, tanto individuales como multijugador, espera ahora a que los iconos de objetos y assets de mundo estén cargados desde Supabase antes de dibujar el piso.
- Eliminado el rectángulo gris provisional de los assets de mundo; mientras llega una imagen bajo demanda se conserva el propio tile de la dungeon.
- Los objetos fijos también solicitan bajo demanda su imagen de `config_world_object` cuando todavía no está hidratada.
- Actualizada la versión de la app y del paquete a `0.74.0`.

## v0.75.0 - 2026-08-15

- Añadida una caché persistente mediante la Cache API del navegador para las imágenes de `config_world_object`; se evita usar cookies porque no son apropiadas para payloads de imagen y se enviarían innecesariamente con las peticiones HTTP.
- Tras la primera descarga completa, la app consulta únicamente los metadatos ligeros y reutiliza localmente los iconos que no hayan cambiado.
- Los iconos nuevos o modificados se descargan individualmente comparando `updated_at`, y los objetos eliminados desaparecen de la caché al reconstruirla desde el catálogo actual.
- El endpoint de objetos incluye ahora `updated_at` en sus proyecciones y actualiza esa marca temporal al crear o editar filas.
- Actualizada la versión de la app y del paquete a `0.75.0`.
