# Auditoría de egress de Supabase — v0.73.0

## Stack real inspeccionado

- **Frontend:** aplicación estática CSR, sin framework, compuesta por `index.html`, `src/styles.css` y `src/game.js`.
- **Backend:** funciones Serverless de Vercel en `api/*.js`, CommonJS sobre Node.js.
- **Paquetes:** npm; no hay runtime frontend empaquetado ni SSR. `vercel` es la única dependencia de desarrollo.
- **Acceso a datos:** las funciones `api/*.js` llaman a PostgREST de Supabase mediante `fetch`. El cliente llama normalmente a `/api/*`; el multijugador usa además REST directo y Supabase Realtime Broadcast.

## Inventario de cambios de queries

| Archivo | Consumidores confirmados | Query anterior | Query nueva | Equivalencia funcional |
|---|---|---|---|---|
| `api/user.js` | Login; cálculo de `max_pj_lv` y `accumulated_points` | `select=pj_score,pj_json` | `select=pj_score,level:pj_json->player->>level` | El cálculo solo leía `pj_json.player.level`; puntuación y nivel siguen disponibles con el mismo valor. |
| `api/user-pj.js` (detalle) | Selección de PJ, reanudación y multijugador | `select=*` | columnas explícitas `id,created_at,nombre,pj_name,pj_status,pj_score,last_use,pj_json,feats,shards,souls,custom_items` | Son exactamente las columnas consumidas por esos flujos; se conserva el JSON completo solo en detalle. |
| `api/user-pj.js` (listado propio) | Selección solo/multi y cálculo local de progreso | `select=*` | `id,pj_name,pj_status,pj_score,last_use` más `level`, `class_name` y `race_name` extraídos con `->>` | Las tarjetas y agregados usan únicamente esos campos; al elegir PJ se solicita el detalle por `id`. |
| `api/user-pj.js` (puntuaciones) | `fetchScores()` | incluía `pj_json`, `shards`, `souls`, `custom_items` | metadatos, `feats` y los tres escalares `level/class_name/race_name` extraídos con `->>` | La tabla conserva todas sus celdas sin descargar inventario, equipo, iconos ni objetos personalizados. |
| `api/dungeon-status.js` (detalle) | Continuar partida, lobby, resync y fallback multiplayer | `select=*` | `id,created_at,dungeon_world_id,"players_ID",dungeon_status` | Es la forma completa que ya consumían esos flujos; elimina columnas futuras/no usadas sin alterar el estado JSON requerido. |
| `src/game.js` (`dsGet`) | Lectura REST directa del estado multijugador | `select=*` | `id,created_at,dungeon_world_id,"players_ID",dungeon_status` | Mantiene los mismos cinco campos usados por sincronización y elimina cualquier columna ajena al protocolo. |
| `api/config-items.js` | Listas de items/pociones; detalle de editor | JSON completo por defecto en toda lista | `light=1` devuelve metadatos y escalares `type/weapon_type`; `id` conserva la fila completa | La lista conserva nombre, slot, tier, iLvl y tipo; editar hidrata exactamente una fila. El endpoint sin `light=1` mantiene su contrato completo previo. |
| `api/config-class.js` | Listas/editores de clases y razas; creación de PJ | JSON completos en toda lista | `light=1` devuelve identidad y flags; `id` hidrata una fila; sin `light=1` mantiene respuesta completa | Configuración lista con metadatos y edita bajo demanda; creación sigue solicitando definiciones completas porque necesita stats/skills/iconos. |
| `api/config-floor.js` | Lista/editor de floors; generación | `floor_json` en toda lista | `light=1` devuelve `id,created_at,floor_name`; detalle por `id`; llamada normal completa para generación | El editor obtiene el JSON solo al pulsar editar; la generación conserva los tiles completos que necesita. |

## Riesgos detectados y no modificados

- El multijugador conserva polling (`400 ms` sin Realtime, `6 s` con Realtime), polling de lobby/trade y Realtime Broadcast. Reducir frecuencias podría cambiar la latencia observable y la lógica en tiempo real; **no se modifica sin confirmación**.
- Los detalles de `dungeon_world` y `dungeon_status` siguen siendo grandes cuando el flujo realmente necesita reconstruir una dungeon/sesión. Dividir `world_json.floors` por piso requeriría adaptar transiciones, preview y sincronización multiplayer; no se ha asumido ese cambio en esta consolidación.
- `enemy_family.family_json` y `config_chest.chest_json` se cargan completos cuando se genera contenido. Separarlos exige confirmar qué partes deben permanecer disponibles durante generación y crafting; se dejan sin cambios para no romper lógica.

No se ejecutaron migraciones, no se modificaron columnas, RLS ni políticas, y no se añadieron dependencias.
