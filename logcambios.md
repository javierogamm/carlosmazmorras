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
