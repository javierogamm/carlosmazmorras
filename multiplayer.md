# Revisión técnica del sistema multijugador

**Versión revisada:** 0.51.0  
**Fecha de revisión:** 25 de julio de 2026  
**Alcance:** presencia, salas, entrada y reanudación de partidas, envío y recepción del estado, refresco, turnos, persistencia, recuperación, cambio de piso e intercambio de objetos.

## 1. Resumen ejecutivo

El multijugador es un sistema **por turnos, cliente a cliente para la ruta rápida y con Supabase como almacenamiento/checkpoint**. No existe un servidor de juego autoritativo que simule las acciones. Cada navegador ejecuta localmente la acción de su jugador; el navegador que cierra la ronda también ejecuta la fase enemiga.

La comunicación utiliza dos vías complementarias:

1. **Supabase Realtime Broadcast (WebSocket)** para entregar inmediatamente transiciones de turno, confirmaciones y avisos.
2. **Supabase PostgREST** sobre la tabla `dungeon_status` para persistencia, concurrencia optimista, recuperación y sondeo de seguridad. El cliente intenta acceder directamente a PostgREST para evitar arranques en frío de Vercel; si no puede, usa `/api/dungeon-status` como proxy.

La prevención de turnos cruzados está bien planteada para clientes cooperativos: combina un reloj lógico `seq`, validación del autor activo, ACK/reenvío y checkpoints con una revisión `rev` escrita mediante compare-and-swap (CAS). El estado persistente no se escribe en cada turno cuando Realtime funciona: se consolida cada 10 rondas y en eventos especiales.

La principal limitación técnica es de **confianza y seguridad**, no de latencia: la clave anónima de Supabase y toda la autoridad de simulación están en el navegador. Sin políticas RLS estrictas y validación autoritativa externa, un cliente modificado puede leer/escribir sesiones o emitir mensajes falsos. El repositorio no contiene las políticas de base de datos, por lo que no se puede confirmar esa protección.

## 2. Componentes y responsabilidades

| Componente | Responsabilidad |
|---|---|
| `src/game.js` | Estado local, presencia, salas, conexión Realtime, turnos, snapshots, sondeo, recuperación y comercio. |
| `api/dungeon-status.js` | CRUD de `dungeon_status`, listado ligero y escritura CAS opcional mediante `expectedRev`. |
| `api/multi-session.js` | Presencia: alta, heartbeat, logout y consulta de usuarios recientes. |
| `api/rt-config.js` | Entrega al navegador `SUPABASE_URL` y `SUPABASE_ANON_KEY` para REST directo y Realtime. |
| Supabase `dungeon_status` | Registro persistente de la sesión y checkpoints del juego. |
| Supabase `multi_session` | Registros de presencia. |
| Canal Realtime `ds-<sessionId>` | Transporte efímero de `state`, `turn`, `ack`, `need`, `full` y `trade`. |

Dependencias operativas:

- variables `SUPABASE_URL` y `SUPABASE_ANON_KEY`;
- Supabase Realtime habilitado;
- librería `@supabase/supabase-js` v2 cargada desde jsDelivr;
- tablas y permisos/RLS compatibles con las consultas REST utilizadas.

## 3. Modelo persistente

Cada fila de `dungeon_status` contiene, como mínimo:

- `id`, `created_at`, `dungeon_world_id` y `players_ID`;
- `dungeon_status.multiplayer` y `started`;
- `host`, `hostUser`, `roster` y `turnOrder`;
- `activePlayerIndex`, `turn`, `seq` y `rev`;
- `currentFloor`, `floors` y `players`;
- `events`, `evSeq` y, opcionalmente, `trade`.

### Dos relojes distintos

- **`seq`** ordena las transiciones lógicas de turno transmitidas por Realtime. Debe aumentar exactamente de uno en uno.
- **`rev`** ordena las escrituras persistentes del documento JSON. `mpSaveSession` lee o reutiliza el espejo local, calcula `rev + 1` y hace PATCH condicionado a que la revisión almacenada siga siendo la esperada.

No deben confundirse: durante una partida sana puede aumentar `seq` muchas veces mientras `rev` permanece igual hasta el siguiente checkpoint.

### Snapshot de piso

El primer jugador que inicia la partida genera el piso y, en la misma escritura que cambia `started` a `true`, guarda el snapshot y las posiciones de todo el grupo. En escrituras posteriores del mismo piso se conserva el plano estático y se mezclan solo los datos dinámicos. Los broadcasts `state` eliminan `map`, `rooms`, `safeRooms` y `floorTileset`; si cambia el piso, el receptor solicita la fila completa.

## 4. Presencia, listado y salas

### Presencia

1. Al entrar en la pantalla multijugador, el cliente crea una fila en `multi_session` usando el nombre del usuario como `user_id`.
2. Cada 8 segundos actualiza `login_time` (`heartbeat`) y refresca usuarios y sesiones abiertas.
3. Se considera visible a quien tenga `logout_time` nulo y un `login_time` dentro de los últimos 45 segundos.
4. Al salir se escribe `logout_time`.

El temporizador de presencia se detiene al entrar en lobby o partida para no competir con la sincronización del juego. Esto significa que el jugador puede dejar de aparecer como conectado durante una partida, aunque la sesión continúe correctamente.

### Creación y unión

- El anfitrión selecciona personaje y mundo y crea una fila con `rev: 0`, roster y orden inicial.
- El invitado selecciona personaje y se incorpora mediante `mpSaveSession`, que actualiza atómicamente `players_ID`, `roster`, `turnOrder` y, si la partida ya comenzó, su posición.
- No se observa límite de participantes, contraseña, invitación, bloqueo de sesión ni rechazo explícito de incorporaciones tardías.
- El lobby escucha Realtime, pero conserva un sondeo completo cada 2 segundos. Cuando detecta `started`, entra en la partida.
- Al reanudar, se listan sesiones cuya cadena JSON `players_ID` contiene alguno de los personajes del usuario.

## 5. Envío de datos durante una partida

### Ruta principal: transición `turn`

Al terminar una acción:

1. Se regeneran recursos y cooldowns localmente.
2. Si actúa el último jugador, ese mismo cliente ejecuta la fase enemiga tras 60 ms, incrementa la ronda y devuelve el turno al índice 0.
3. `mpTurnPayload()` crea el mensaje con:
   - `seq`, `author`, `nextIdx`, ronda y piso;
   - posición, dirección y vida de jugadores;
   - enemigos como tuplas `[eid, x, y, hp]`;
   - puertas, cofres, llaves, trampas, altares y objetivo;
   - hasta seis eventos recientes.
4. El cliente incrementa su `mpSeq`, emite `turn` y espera ACK de los demás participantes del orden de turnos.
5. Reenvía cada 600 ms, hasta cinco intentos. Si faltan ACK, fuerza un checkpoint en base de datos.

El payload es un delta/snapshot dinámico compacto: no incluye el mapa completo, inventarios ni la ficha completa de cada personaje.

### Broadcast `state`

Toda escritura realizada por `mpSaveSession` emite además un evento `state` con la revisión persistida. Se usa para lobby, cambios persistentes, checkpoints y mutaciones como las del comercio. En un piso normal se aligera eliminando geometría estática.

### Escritura persistente

`mpSaveSession` realiza hasta seis intentos:

1. En el primer intento puede reutilizar `game.mpStatusMirror` si su `rev` coincide.
2. Ejecuta la función `mutate` sobre ese estado.
3. Escribe con filtro `dungeon_status->>rev=eq.<rev>`.
4. En la ruta rápida pide `return=minimal,count=exact`; si hay conflicto o no existe el encabezado esperado, relee y reintenta con representación.
5. Tras éxito actualiza espejo/revisión local y emite `state`.

Con Realtime activo los turnos ordinarios no escriben en base de datos. Se crea checkpoint:

- cada 10 rondas completas;
- al cambiar de piso;
- después de entrega no confirmada;
- en muerte u otros flujos que invoquen persistencia;
- como mejor esfuerzo al ocultar/cerrar la pestaña mediante `keepalive`.

Sin Realtime, cada avance vuelve al flujo persistente CAS.

## 6. Recepción y aplicación

Un evento `turn` se acepta únicamente si:

- pertenece a la sesión actual;
- no fue escrito por el propio cliente;
- `msg.seq === localSeq + 1`;
- `msg.author` coincide con el jugador que el receptor considera activo.

Los duplicados se descartan y se vuelven a confirmar. Un salto de secuencia o autor inesperado nunca se aplica: inicia recuperación. Al aplicar un turno se actualizan jugadores remotos, enemigos por `eid`, interactivos, objetivo, log, índice activo e interfaz.

Para el HP del jugador local hay una regla adicional: solo la transición que vuelve a `nextIdx = 0`, es decir, la enviada por quien resolvió enemigos, puede reducirlo. Esto evita que un jugador ordinario sobrescriba la vida ajena durante su acción.

Los `state` con `rev` anterior o igual al último aplicado se descartan. Un checkpoint con `seq` menor que el reloj vivo puede refrescar elementos del mapa, pero no retrocede turno, ronda ni índice activo.

## 7. Refresco y recuperación

| Contexto | Mecanismo | Frecuencia/retardo | Propósito |
|---|---|---:|---|
| Pantalla multijugador | REST presencia + lista ligera | 8 s | Heartbeat, conectados y partidas. |
| Ventana de conectado | Filtro temporal | 45 s | Tolerar heartbeats perdidos. |
| Lobby | GET completo de sesión | 2 s | Roster e inicio; Realtime también provoca refresco. |
| Partida con Realtime | Consulta ligera de `rev` | 6 s | Red de seguridad para checkpoints/estado perdido. |
| Partida sin Realtime | Consulta ligera de `rev` | 400 ms | Sustituir temporalmente al push. |
| Comercio con Realtime | GET completo | 2.5 s | Recuperar avisos/mutaciones perdidos. |
| Comercio sin Realtime | GET completo | 1.5 s | Compensar ausencia del evento `trade`. |
| Reenvío de turno | Broadcast | 600 ms, máximo 5 | Confirmar entrega a peers. |
| Resync vivo | `need` / `full` | fallback a DB en 900 ms | Reparar huecos de `seq`. |
| Espera del primer snapshot | GET completo | 500 ms, máximo 8 intentos | Permitir que el host publique el piso. |

### Recuperación de huecos

El receptor publica `need` con su `seq`. Un peer más avanzado puede responder `full` con orden de turnos y snapshot dinámico. Si nadie responde en 900 ms, se consulta la base. Las solicitudes se limitan a una cada 700 ms.

### Cierre o pestaña oculta

Si existe estado vivo sin checkpoint (`mpDirty`), se intenta un PUT `keepalive` condicionado por `rev`. Es deliberadamente best-effort: si otra escritura ganó, el CAS lo rechaza. No existe garantía de que un navegador terminado abruptamente ejecute este envío.

## 8. Comercio

Solo puede existir un intercambio por sesión y participan exactamente dos personajes. El estado `trade` guarda identificador, ofertas, aceptaciones y qué lado aplicó su inventario.

- Proponer, cancelar, modificar oferta, aceptar y aplicar pasan por CAS.
- Cambiar una oferta borra ambas aceptaciones.
- Los objetos ofertados permanecen en inventario, pero quedan bloqueados para equipar, consumir o vender.
- Después de ambas aceptaciones cada cliente marca primero su lado como aplicado en la base y solo después modifica su inventario local.
- Al completar su lado guarda inmediatamente el personaje.

La estrategia evita la doble aplicación local en condiciones normales, pero no constituye una transacción atómica entre las dos filas/fichas de personaje: si un cliente no vuelve, su mitad no se aplica; y si falla el guardado de `user-pj` después de marcar `applied`, su inventario persistido puede quedar desalineado. Para garantías económicas fuertes, el intercambio completo debería ejecutarse en una transacción de servidor.

## 9. Comportamiento ante fallos

- **Realtime no carga o no se suscribe:** REST directo/proxy y polling a 400 ms; una escritura CAS por turno.
- **Mensaje duplicado o retrasado:** `seq`/`rev` lo descartan.
- **Mensaje perdido:** reenvío + ACK; después checkpoint.
- **Hueco o autor inesperado:** `need/full`; después base de datos.
- **Conflicto de escritura:** espera aleatoria corta, relectura y hasta seis intentos.
- **Cambio de piso con broadcast reducido:** fetch completo.
- **API directa bloqueada:** proxy `/api/dungeon-status`.
- **Pestaña cerrada durante turnos no consolidados:** checkpoint `keepalive` sin garantía absoluta.
- **Jugador activo desconectado:** no hay timeout, expulsión, transferencia de turno ni IA; la partida puede quedar bloqueada hasta que regrese o se manipule el estado.

## 10. Hallazgos de la revisión

### Alta prioridad

1. **Autoridad en cliente.** Movimiento, daño, enemigos, loot, orden y mensajes se calculan o emiten desde navegadores que comparten la clave anónima. Las comprobaciones evitan carreras accidentales, no trampas deliberadas.
2. **Autorización no verificable.** Los endpoints no autentican al usuario y exponen CRUD general. La seguridad depende por completo de RLS/permisos externos no versionados en este repositorio.
3. **Clave anónima entregada al navegador.** Es normal para Supabase únicamente si RLS limita cada operación. Aquí el cliente necesita acceso amplio a la tabla, por lo que se debe auditar la política real.
4. **Desconexión del jugador activo bloquea la partida.** No existe lease de turno, timeout, voto de expulsión ni mecanismo de abandono.
5. **Comercio no transaccional entre personajes.** El protocolo de sesión y el guardado final de cada inventario son operaciones separadas.

### Prioridad media

6. **Unión tardía y tamaño sin límites.** Una sesión iniciada continúa apareciendo como disponible y acepta nuevos personajes; no hay capacidad ni regla del host.
7. **Presencia no representa jugadores en partida.** El heartbeat se detiene intencionadamente en lobby/juego y el registro termina envejeciendo tras 45 s.
8. **Polling comercial costoso.** Descarga el documento completo —incluidos snapshots— cada 1.5/2.5 s, independientemente del sondeo de revisión.
9. **Dependencia CDN sin fallback local/SRI.** Si jsDelivr o la carga de Supabase falla, desaparece la ruta Realtime y se incrementa fuertemente el tráfico REST.
10. **Estado vivo potencialmente perdido.** Hasta 10 rondas pueden existir solo en memoria/Realtime. `pagehide` reduce el riesgo pero no protege ante crash, pérdida súbita de red o cierre forzado.

### Prioridad baja / mantenibilidad

11. `players_ID` es una cadena JSON en vez de una relación o array tipado, lo que obliga a parsear en cliente e impide filtros robustos.
12. Se silencian varios errores de red (`catch {}`), dificultando diagnóstico y telemetría.
13. Los comentarios históricos todavía describen en puntos concretos un sondeo de 2 s o pings provisionales que ya no corresponden exactamente al transporte vigente.
14. No hay negociación explícita de versión/protocolo; clientes con assets cacheados distintos podrían compartir una sesión y discrepar sobre payload o reglas.

## 11. Recomendaciones

1. **Versionar el protocolo** (`protocolVersion`) y rechazar clientes incompatibles.
2. **Añadir autenticación real** y versionar/migrar políticas RLS. Cada escritura debe demostrar que el usuario controla el `pjId` y pertenece a la sesión.
3. **Mover validación crítica al servidor**: transición de turno, rango de movimiento, daño, loot, cambio de piso y comercio.
4. **Implementar lease de turno** con expiración, reconexión y opción controlada de saltar/expulsar.
5. **Hacer el comercio transaccional** en una función SQL/RPC o servicio autoritativo que bloquee y actualice ambos inventarios.
6. **Definir reglas de sala**: capacidad, abierta/cerrada, incorporaciones tardías, expulsión y abandono con limpieza de roster/turnOrder.
7. **Separar estado estático, dinámico y comercio** en registros/canales distintos para reducir descargas y contención sobre un único JSON/revisión.
8. **Persistir con mayor frecuencia según riesgo**, no solo por rondas: loot raro, apertura de cofre, muerte, cambio de piso, comercio y acciones económicas.
9. **Añadir observabilidad** de latencia, conflictos CAS, reconexiones, huecos de `seq`, fallos de checkpoint y errores silenciados.
10. **Servir o fijar la dependencia Realtime** con versión exacta y estrategia de fallback controlada.

## 12. Conclusión

El diseño actual ofrece una experiencia rápida y una defensa razonable contra duplicados, reordenación y carreras accidentales. El modelo híbrido Realtime + checkpoints CAS es coherente para un juego cooperativo por turnos y degrada correctamente a REST.

No obstante, la consistencia está garantizada principalmente **entre clientes honestos**. Antes de tratar inventario, progreso o partidas públicas como datos de valor, deben resolverse la autoridad del cliente, la autenticación/RLS, el bloqueo por desconexión y la atomicidad del comercio. En su estado actual es apropiado para cooperación de confianza o beta controlada, pero no para un entorno competitivo u hostil.
