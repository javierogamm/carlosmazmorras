# Instrucción maestra: configuración de items y generación de JSON

## 1. Propósito y alcance

Usa esta instrucción para **auditar, crear, modificar, importar, exportar y consolidar** objetos de equipo y pociones sin romper su contrato con `config_items`, el generador de botín ni el motor de combate. No des por válido un JSON solo porque `JSON.parse` lo acepte: la aplicación actualmente comprueba la sintaxis, pero no aplica un esquema formal antes de persistir.

El orden de autoridad que debes respetar es:

1. Código de ejecución en `src/game.js`.
2. Sobre de persistencia de `api/config-items.js` y tabla Supabase `config_items`.
3. Referencia completa de componentes en `skills-json-rules.md`.
4. Reglas específicas de equipo en `reglas json objetos.md`.
5. Reglas específicas de consumibles en `reglas json pociones.md`.

Si la documentación y el código difieren, documenta la diferencia, sigue el comportamiento real del código y corrige la documentación dentro de la misma consolidación. No inventes campos ni semánticas.

## 2. Instrucción operativa para un agente o colaborador

> Revisa primero el repositorio y cualquier `AGENTS.md` aplicable. Lee completos `api/config-items.js`, las funciones de items/importación de `src/game.js`, `reglas json objetos.md`, `reglas json pociones.md` y `skills-json-rules.md`. Traza cada campo desde el formulario hasta el JSON, desde el JSON hasta `config_items`, y desde la fila recuperada hasta el objeto usado en loot, inventario, equipo y combate. Genera JSON canónico, no solo JSON sintácticamente válido. No borres campos heredados al editar si la UI no los expone. No ejecutes tests salvo petición explícita. Antes de consolidar, actualiza la versión de la app y registra todos los cambios en `logcambios.md`.

## 3. Arquitectura y flujo de datos real

### 3.1 Fuente de verdad persistente

Todos los objetos configurados, incluidos equipo y pociones, viven en `config_items`. La API proyecta estas columnas:

| Columna | Tipo lógico | Función |
|---|---|---|
| `id` | id de Supabase | Identidad de la fila; no forma parte del objeto reutilizable. |
| `created_at` | fecha | Orden de listado descendente. |
| `nombre` | texto | Índice/metadata; respaldo de `item_json.name`. |
| `slot` | texto | Índice/metadata; respaldo de `item_json.slot`. |
| `tier` | texto | Índice/metadata; respaldo de `item_json.rarity`/`tier`. |
| `icon` | texto | Índice/metadata; respaldo del icono hexadecimal. |
| `stats` | texto | Puede ser texto de stats o, si solo llegan `affixes`, JSON serializado. |
| `ilvl` | texto | Metadata de nivel; la API lo fuerza a `String`. |
| `item_json` | JSON/JSONB | Sobre canónico consumido por el juego. |

Al guardar, `cleanItem(body)` usa `body.item_json || body` como objeto. En metadata, los campos exteriores tienen prioridad sobre los interiores. Por eso una importación debe evitar dos copias contradictorias: genera un `item_json` autoconsistente y deja que la API derive metadata, o repite exactamente los mismos valores.

### 3.2 Escritura

- `POST /api/config-items`: acepta un objeto o un array y crea filas.
- `PUT /api/config-items?id=<id>`: exige id y hace `PATCH` de la fila.
- `DELETE /api/config-items?id=<id>`: exige id y elimina la fila.
- La UI guarda/importa los registros **secuencialmente**, uno por petición; no existe transacción del lote. Si el elemento 8 falla, los 7 anteriores ya quedaron consolidados.
- Importar siempre **crea** filas: no compara nombres, ids ni contenido y no hace upsert. Reimportar duplica.
- La API no autentica roles ni valida el esquema de item por sí misma; no confundas una respuesta HTTP correcta con validación funcional.

### 3.3 Lectura y normalización en runtime

`configuredItemFromRow` copia `item_json`, crea un `id` nuevo para la instancia de inventario y completa fallbacks. Aspectos críticos:

- `name`, `slot`, `rarity`, `label` e `icon` pueden caer a metadata de fila.
- El `itemLevel` de una caída se **recorta a la banda de nivel del loot actual**; el nivel base ayuda a elegir la fila, pero no garantiza el nivel final de cada copia.
- `score` conserva el declarado o usa `itemLevel * 8`. Como se calcula después del recorte y un valor declarado gana, un `score` manual puede quedar desalineado con el nivel final.
- En armas se completan tipo, categoría, fila/columna/ruta visual, stat defensiva y alcance.
- En pociones se fuerzan `type: "potion"`, `slot: "consumable"`, `iconShape: "vial"`, `effects: []` si falta y rango numérico.
- `skillIds`, `affixes`, `passives` y `effects` acaban como arrays; los stats de metadata solo se parsean si `affixes` no viene ya como array.
- El generador usa primero `config_items`; el generador procedural es reserva cuando no hay filas elegibles.

## 4. Contrato canónico de equipo

### 4.1 Campos comunes

```json
{
  "type": "equipment",
  "name": "Nombre visible",
  "slot": "weapon",
  "rarity": "rare",
  "label": "Raro",
  "itemLevel": 3,
  "score": 24,
  "icon": "",
  "hidden": false,
  "stats": "strength:+2, damage:+3",
  "affixes": [
    { "key": "strength", "label": "Fuerza", "value": 2, "percent": false },
    { "key": "damage", "label": "Daño", "value": 3, "percent": false }
  ],
  "skillIds": [],
  "passives": [],
  "effects": [],
  "desc": "Descripción visible"
}
```

Reglas:

- `type` debe ser `equipment`.
- `name`: texto no vacío; el editor limita a 80 caracteres.
- `rarity`: `common`, `uncommon`, `rare`, `epic`, `legendary` o `artifact`.
- La equivalencia actual es tier → `itemLevel`: 1, 2, 3, 4, 5, 6; tier → `score`: 8, 16, 24, 32, 40, 48.
- `label` debe concordar: Común, Infrecuente, Raro, Épico, Legendario, Artefacto.
- `hidden: true` oculta el registro en buscadores generales hasta que una búsqueda textual coincida; no es una medida de seguridad ni impide que el motor lo use donde no se filtre explícitamente.
- `icon` es un PNG 50×50 codificado como hexadecimal por el editor. No uses base64, ruta o data URL en este campo.
- `stats` es la representación editable. `affixes` es la representación estructurada que usa runtime. Mantén ambas sincronizadas.
- El parser de `stats` separa por coma, punto y coma o salto de línea y reconoce un entero con signo. No admite decimales ni `%`; además conserva como `label` la propia key. Para casos fuera de ese formato escribe `affixes` correctamente y verifica que una futura edición no los regenere desde `stats`.
- `skillIds` es legado conservado al editar, pero ya no se expone en el formulario de equipo. No lo uses en objetos nuevos salvo que el encargo exija compatibilidad histórica y hayas verificado el aprendizaje al equipar.
- `passives` pertenece al sistema legendario previo. No mezcles pasivas antiguas con objetos de forma `{name, desc}` dentro de `effects`.

### 4.2 Slots válidos

`weapon`, `offhand`, `head`, `chest`, `hands`, `legs`, `boots`, `neck`, `ring1`, `ring2`, `trinket1`, `trinket2`.

`consumable` solo corresponde a pociones. La UI de equipo no ofrece ese slot y, si carga un registro consumible por error, lo cambia visualmente a `trinket1`.

### 4.3 Armas

Añade al contrato común:

```json
{
  "damageDice": "1d8",
  "rangeMin": 1,
  "rangeMax": 1,
  "weaponType": "Espadas",
  "weaponCategory": "Armas blancas steampunk básicas",
  "weaponIconRow": 0,
  "weaponIconCol": 0,
  "weaponIconPath": "weapons/.../icon.png",
  "defenseStat": "strength",
  "procChance": 20
}
```

Dados admitidos por el formulario: `1d4`, `1d6`, `1d6+1`, `1d8`, `1d8+1`, `1d10`, `1d12`, `2d6`, `2d8`.

Tipos admitidos: Espadas, Dagas, Sables, Hachas, Mazas, Martillos, Lanzas, Bastones, Varitas, Arcos, Ballestas, Pistolas, Rifles, Escopetas, Armas pesadas, Guanteletes, Látigos, Drones, Granadas y Artefactos.

Presets a distancia:

| Tipo | Mín. | Máx. |
|---|---:|---:|
| Varitas | 1 | 4 |
| Arcos | 2 | 5 |
| Ballestas | 1 | 4 |
| Pistolas | 1 | 3 |
| Rifles | 2 | 5 |
| Escopetas | 1 | 2 |

Los demás tipos caen a 1–1. El editor limita ambos extremos a 1–20, normaliza números y ordena mínimo/máximo. `procChance` se limita a 0–100 y solo tiene semántica en `weapon`: cada impacto conectado hace una tirada independiente y, si acierta, dispara la pila completa de `effects` sobre el objetivo.

No calcules manualmente fila, columna, ruta, categoría o `defenseStat` si generas desde el formulario: se derivan del tipo. Si escribes JSON a mano puedes omitirlos y dejar los fallbacks, pero declarar `weaponType` exacto evita inferencias por nombre.

### 4.4 Efectos según slot

- `weapon`: proc on-hit de toda la pila; necesita `procChance`.
- `ring1`, `ring2`, `trinket1`, `trinket2`: activable no consumible; necesita `cooldown >= 1` y normalmente `range >= 1`.
- `offhand`, `head`, `chest`, `hands`, `legs`, `boots`, `neck`: solo los componentes `buff` se aplican pasivamente al equipar; otros kinds no tienen efecto útil en esos slots.
- Los campos de disparo ajenos al slot deben ser `null` u omitirse, no reutilizarse con otro significado.

## 5. Contrato canónico de pociones

```json
{
  "type": "potion",
  "name": "Poción de cura",
  "slot": "consumable",
  "rarity": "common",
  "label": "Común",
  "itemLevel": 1,
  "score": 8,
  "icon": "",
  "iconShape": "vial",
  "range": 5,
  "effects": [
    {
      "kind": "heal",
      "target": "self",
      "dmgDice": 2,
      "dmgDie": 8,
      "dmgStat": "vitality",
      "dmgStatMode": "add",
      "dmgStatCoef": 1
    }
  ],
  "skillIds": [],
  "stats": "",
  "affixes": [],
  "passives": [],
  "hidden": false,
  "desc": "Cura vida."
}
```

- Una poción sin `effects` se puede guardar, pero no hace nada: trátala como inválida funcionalmente.
- Si algún componente apunta a `enemy`, se selecciona enemigo; si no, `area`; si no, `ally`; en otro caso se consume inmediatamente sobre el jugador.
- `range` es alcance exterior de lanzamiento. No lo confundas con el radio `range` de un componente AOE.
- El uso exitoso reduce `quantity` o elimina la última unidad. `quantity` pertenece a la instancia de inventario, no a la plantilla de catálogo.
- No uses el sistema antiguo `potionEffectType`, `effect`, `kind` superior o `duration`: el runtime moderno requiere `effects[]`.

## 6. Habilidades y efectos apilables

En esta documentación, **habilidad** puede significar dos cosas distintas:

1. Habilidad del juego: una skill de clase definida en `skills_json`.
2. Skill/herramienta del agente: una capacidad auxiliar disponible en el entorno de trabajo.

### 6.1 Habilidades del juego

Equipo, pociones y skills comparten la misma lista ordenada de componentes `effects[]` (27 `kind` posibles, verificado contra el `switch` real de `applyEffectComponent` en `src/game.js`). Catálogo completo:

Objetos, pociones y skills de clase comparten **exactamente el mismo motor de efectos apilables**: el mismo array `effects[]`, los mismos 27 `kind` disponibles, los mismos campos, el mismo comportamiento (`applySkillEffectsList`/`applyEffectComponent` en `src/game.js`). Lo único que cambia entre skill/poción/objeto es **cómo se dispara** la pila (pulsar una skill, beber/lanzar una poción, o pasiva/proc/activable según el slot del objeto — ver la sección correspondiente más arriba). Este catálogo es idéntico al de `skills-json-rules.md` §3-§5; si alguna vez difieren, `skills-json-rules.md` manda porque documenta también las fórmulas de daño completas (`attack()`, crítico, defensa) que aquí se omiten por brevedad.

#### Reglas generales de `effects[]`

- `effects` es una **lista ordenada de componentes independientes**. Cada componente se aplica en orden; la pila "tiene éxito" (se consume: cooldown, quantity de poción, etc.) si al menos un componente hizo algo.
- Excepción: un componente `move` (dash/teletransporte) siempre se resuelve **antes que todos los demás**, sin importar su posición en el array. Si mueve al lanzador, cualquier componente de área que venga después se centra en la posición **nueva**, no en la de partida.
- Forma común de un componente: `{ "kind": "<kind>", "target": "...", ...campos propios del kind }`.

#### Bloque de dados compartido (prefijo `dmg` o `dot`)

Lo usan: `dmg`, `heal`, `drain`, `aoe`, `multihit`, `execute`, `hot`, `counter`, `summon`, `summonturret`, `clones`, `lineshot`, `linkdamage`, `trap` (prefijo `dmg`) y `dot` (prefijo `dot`). Cada uno deriva su bono/multiplicador de **su propio** `{p}Stat`/`{p}StatMode`/`{p}StatCoef` sobre el stat del lanzador (jugador), no de un campo genérico del sobre exterior.

| Campo | Tipo | Por defecto | Significado |
|---|---|---|---|
| `{p}Dice` | int ≥0 | 0 | número de dados. `0` = usa una fórmula automática en vez de una tirada fija (solo donde se indica). |
| `{p}Die` | 4\|6\|8\|10\|12\|20 | 6 | caras del dado |
| `{p}Stat` | stat de §Stats, o `""` | `""` | stat que escala la tirada. `""` = sin escalado propio (cae a un bono genérico por tipo). |
| `{p}StatMode` | `"add"` \| `"mult"` | `"add"` | cómo contribuye el stat |
| `{p}StatCoef` | número | `1` (add) / `.02` (mult) | coeficiente de escalado |

#### Resolución de `target`

- `"enemy"`: el enemigo pulsado, o el más cercano visible si es autolanzado.
- `"area"`: para kinds de daño/debuff (`dmg`, `dot`, `debuff`, `cc`, `drain`, `mark`, `execute`, `pullroot`) — todos los enemigos dentro de `range` casillas (distancia Chebyshev) del punto pulsado/lanzado, con línea de visión. Para `heal`/`hot` — todos los aliados (compañeros + otros jugadores humanos) dentro de `range` casillas.
- `"self"`: el lanzador.
- `"ally"`: aliado pulsado (solo multijugador).

#### Modo de objetivo de toda la pila (auto-derivado)

Prioridad: algún componente con `target:"enemy"` → toda la pila exige pulsar un enemigo. Si no, algún `target:"area"` (o un `move` con `mode:"teleport"`) → exige pulsar una casilla. Si no, algún `target:"ally"` → exige pulsar un aliado. Si no → se aplica al instante sin selección (p. ej. una pila solo con `buff`/`heal(self)`/`hot`/`cheatdeath`/`counter`).

#### Los 27 `kind` disponibles

| kind | Target admitidos | Propósito |
|---|---|---|
| `dmg` | enemy, area, self | daño directo (o autodaño) |
| `dot` | enemy, area | daño periódico |
| `buff` | self (implícito) | buff de stat propio |
| `debuff` | enemy, area | debuff de stat al objetivo |
| `heal` | self, ally, area | curación instantánea (+ recurso si self/area) |
| `move` | — | dash o teletransporte |
| `cc` | enemy, area | aturdir/congelar/silenciar/enraizar |
| `drain` | enemy, area | daña al enemigo, cura+restaura recurso propio |
| `aoe` | — (siempre área en torno al punto lanzado) | daño en área con radio explícito |
| `multihit` | — (siempre el objetivo resuelto) | N impactos repetidos, espaciados 0.5s |
| `mark` | enemy, area | el objetivo recibe +X% daño de TODAS las fuentes durante N turnos |
| `summon` | — | aliado móvil configurable (incl. "Compañero" permanente) |
| `summonturret` | — | aliado **estático** de largo alcance, mismos tipos que `summon` |
| `clones` | — | 1-4 aliados móviles a la vez, mismos tipos que `summon` |
| `utility` | — | revelar mapa / sigilo / escudo plano / restaurar recurso |
| `hot` | self, area | curación periódica en el lanzador (+ aliados si area) |
| `execute` | enemy, area | golpe normal, multiplicado si el objetivo está bajo un umbral de %HP |
| `pullroot` | enemy, area | atrae 1 casilla hacia el lanzador y luego enraiza |
| `counter` | — (self) | escudo + arma un contraataque de un solo uso |
| `cheatdeath` | — (self) | sobrevive al próximo golpe letal a 1 HP |
| `holyshield` | — (self) | escudo de absorción: amortigua daño antes de tocar la vida |
| `lineshot` | — (línea hacia el enemigo pulsado/cercano) | disparo perforante, golpea a todos en la línea |
| `trap` | — (casilla lanzada) | trampa invisible, golpea a quien la pise |
| `linkdamage` | — (objetivo resuelto + saltos) | daño en cadena que salta de enemigo en enemigo |
| `invisible` | — (self) | los enemigos se saltan su turno durante N turnos |
| `ascend` | self (implícito) | cambia el %-coste de las skills mientras esté activo |
| `transform` | self (implícito) | cambios de stat en % + icono propio, opcionalmente bloquea otras skills |

##### `dmg` — Daño
```json
{ "kind":"dmg", "target":"enemy", "dmgDice":2, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":1 }
```
`target:"self"` → autodaño directo (sin tirada de defensa). `target:"enemy"/"area"` → tirada de ataque + salvación de defensa normal; `area` usa `range` (por defecto 2) como radio y aplica ×0.85 salvo que fijes `multiplier`.

##### `dot` — Daño periódico
```json
{ "kind":"dot", "target":"enemy", "dotDice":1, "dotDie":6, "dotStat":"strength", "dotStatMode":"add", "dotStatCoef":.5, "turns":4, "flavor":"dot" }
```
`flavor`: `"dot" | "bleed" | "burn" | "poison"` — solo etiqueta visual, sin diferencia mecánica. Golpe inicial ~0.7x + estado que hace daño cada turno durante `turns` turnos (tirada fija al aplicarse).

##### `buff` — Buff propio
```json
{ "kind":"buff", "target":"self", "stat":"strength", "mode":"add", "value":5, "turns":6 }
```
`stat`: cualquier stat principal, más `armor, damage, ap, dodge, critChance, blockChance, manaRegen, staminaRegen`. `mode`: `"add"` (+valor plano) o `"mult"` (stat ×valor, ej. `1.2` = +20%). `dodge`/`critChance`/`blockChance` solo en `"add"`, ahí `value` son puntos porcentuales. Este es el `kind` que usan los **pasivos de equipo general** (ver más arriba) — se aplica con `turns:999999` mientras el objeto siga equipado.

##### `debuff` — Debuff a enemigo
```json
{ "kind":"debuff", "target":"enemy", "stat":"damage", "mode":"add", "value":2, "turns":3 }
```
`stat`: `damage` o `ap` (los enemigos no tienen armadura ni las stats derivadas de `buff`); cualquier stat principal también vale. `stat` omitido → "debilitado" genérico sin stat concreto. También aplica un golpe genérico ~0.7x.

##### `heal` — Curación instantánea
```json
{ "kind":"heal", "target":"self", "dmgDice":2, "dmgDie":6, "dmgStat":"wisdom", "dmgStatMode":"add", "dmgStatCoef":1 }
```
Magnitud vía fórmula de dados (fallback ~`8+nivel*3`), aplicada como `curación = poder*2` HP, más `poder` de recurso restaurado (solo self/skills — en objetos/pociones no hay recurso propio que restaurar salvo que el propio objeto lo tenga, se ignora si no aplica). `target:"ally"` (multijugador) cura al aliado pulsado. `target:"area"`: cura al lanzador y a todos los aliados dentro de `range` casillas (por defecto 2).

##### `move` — Dash o teletransporte
```json
{ "kind":"move", "mode":"dash", "range":3 }
```
Kind pensado para skills; técnicamente aceptado en objetos/pociones pero sin sentido práctico (no hay "lanzador humano manual" distinto del jugador). `mode:"dash"`: avanza hasta `range` casillas hacia el enemigo y lo golpea. `mode:"teleport"`: si hay un componente `enemy` en la misma pila, se teletransporta junto a él; si no, al punto pulsado.

##### `cc` — Control
```json
{ "kind":"cc", "target":"enemy", "type":"stun", "turns":2 }
```
`type`: `"stun" | "freeze" | "silence" | "root"`. Golpe ~0.75x + estado de control puro (0 de magnitud) durante `turns` turnos.

##### `drain` — Drenaje
```json
{ "kind":"drain", "target":"enemy", "dmgDice":2, "dmgDie":6, "dmgStat":"intelligence", "dmgStatMode":"add", "dmgStatCoef":1 }
```
Golpe fijo ~0.8x al enemigo (los campos de dados NO afectan a ese golpe); cura al lanzador y le restaura recurso por `poder` (eso sí lo configuran los campos de dados/stat).

##### `aoe` — Daño en área
```json
{ "kind":"aoe", "dmgDice":2, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":1, "range":2 }
```
Golpea a todos los enemigos dentro de `range` casillas del punto de lanzamiento, con línea de visión. Sin `target` — siempre área centrada en el punto de cast. `multiplier` opcional, por defecto 0.85.

##### `multihit` — Golpes repetidos
```json
{ "kind":"multihit", "hits":3, "dmgDice":1, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":.6 }
```
Golpea al objetivo resuelto `hits` veces (tiradas y salvaciones independientes), espaciadas 0.5s entre sí. `multiplier` opcional, por defecto 0.6 por golpe.

##### `mark` — Amplificador de daño recibido
```json
{ "kind":"mark", "target":"enemy", "value":25, "turns":4 }
```
`value`: % extra de daño que recibe el objetivo de cualquier fuente mientras dure la marca. No se acumula consigo misma (reaplicar refresca `turns`/magnitud al máximo).

##### `summon` — Aliado móvil
```json
{
  "kind":"summon", "hp":20, "turns":8, "ap":10, "effectType":"damage", "range":0,
  "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1,
  "effectTurns":2, "iconImage":"", "targetable":true, "hitByAoe":true, "stance":"aggressive"
}
```
`hp`: vida máxima. `turns`: duración en turnos del jugador (ignorado si `permanent:true`). `ap`: cada 10 = 1 acción por turno. `effectType`: `"damage"` (ataca dados+stat), `"skill"` (pila de efectos propia vía `skillEffects[]`, mismas reglas que `effects[]` pero limitado a `dmg/dot/debuff/cc/drain/mark/buff/heal`), `"heal"` (cura al jugador cada acción), `"root"` (enraiza al enemigo más cercano), `"buff"`/`"debuff"` (aplica al jugador/enemigo, campos `stat/mode/value/effectTurns`). `range` (solo damage/skill): 0 = cuerpo a cuerpo, >0 = distancia. `iconImage`: PNG 50×50 hex opcional. `targetable`/`hitByAoe`/`stance` controlan si los enemigos pueden atacarlo y su comportamiento. `permanent:true` lo convierte en un pet "Compañero" que no expira y penaliza -10% a todas las stats del jugador si muere (hasta revivirlo).

##### `summonturret` — Aliado estático a distancia
```json
{
  "kind":"summonturret", "hp":16, "turns":8, "ap":10, "range":7, "damageMode":"nearest",
  "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1,
  "iconImage":""
}
```
Igual que `summon` (mismos 6 `effectType`) pero nunca se mueve; `range` por defecto 7. `damageMode`: `"nearest"` (un objetivo) o `"area"` (golpea a todos los enemigos dentro de `range` cada acción). No admite `permanent`/`targetable`/`hitByAoe`/`stance`.

##### `clones` — Varios aliados móviles a la vez
```json
{
  "kind":"clones", "count":2, "hp":14, "turns":8, "ap":10, "effectType":"damage", "range":0,
  "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1,
  "effectTurns":2, "iconImage":""
}
```
Igual que `summon` pero invoca `count` (1-4, por defecto 2) aliados independientes de golpe. No admite `permanent`/`targetable`/`hitByAoe`/`stance`.

##### `utility` — Efectos varios sobre uno mismo
```json
{ "kind":"utility", "mode":"reveal", "value":10 }
```
`mode:"reveal"`: revela el mapa en radio `value` (por defecto 10). `"stealth"`: el próximo turno enemigo se salta entero (un solo uso). `"shield"`: añade `value` puntos planos de **armadura** (decae 1 punto por turno propio, se te golpee o no — distinto del `holyshield`). `"resource"`: restaura `value` puntos del recurso propio (solo aplica si el objeto/skill tiene recurso propio).

##### `hot` — Curación periódica
```json
{ "kind":"hot", "target":"self", "dmgDice":1, "dmgDie":6, "dmgStat":"wisdom", "dmgStatMode":"add", "dmgStatCoef":.5, "turns":4 }
```
Magnitud vía fórmula de dados (fallback `~3+nivel`), aplicada una vez por turno propio durante `turns` turnos. Los stacks son independientes (no se refrescan entre sí). `target:"area"`: además cura a los aliados dentro de `range` (por defecto 2) — compañeros reciben el HOT tick a tick; otros jugadores humanos reciben el total como una curación instantánea única.

##### `execute` — Ejecutar bajo umbral de vida
```json
{ "kind":"execute", "target":"enemy", "dmgDice":2, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":1, "threshold":35, "execMultiplier":2.5 }
```
Tirada normal con escalado completo. Si `hp/maxHp` del objetivo < `threshold/100`, el golpe se multiplica por `execMultiplier` en vez del `multiplier` normal (por defecto 1).

##### `pullroot` — Atraer + enraizar
```json
{ "kind":"pullroot", "target":"enemy", "turns":2 }
```
Golpe ~0.8x, atrae al objetivo 1 casilla hacia el lanzador (si hay hueco libre) y aplica `root` durante `turns` turnos. `multiplier` opcional.

##### `counter` — Postura de contraataque
```json
{ "kind":"counter", "shield":10, "dmgDice":1, "dmgDie":8, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1, "turns":5 }
```
Concede `shield` puntos de armadura al instante y arma un contraataque de un solo uso: la próxima vez que el lanzador reciba daño (antes de que expire), golpea al enemigo vivo más cercano con esa tirada ×0.8. `dmgStat`/`dmgStatMode`/`dmgStatCoef` se aceptan pero no se aplican al golpe de vuelta (solo dados).

##### `cheatdeath` — Desafiar a la muerte
```json
{ "kind":"cheatdeath", "turns":5 }
```
Arma una protección de un solo uso: la próxima vez que la vida llegaría a 0 mientras esté armado, se fija a 1 HP en su lugar y se consume.

##### `holyshield` — Escudo de absorción
```json
{ "kind":"holyshield", "target":"self", "value":20, "stat":"", "mode":"add", "statCoef":1, "turns":0 }
```
Concede puntos de un pool de absorción dedicado que amortigua el daño **antes** de tocar la vida (distinto de `utility`'s `"shield"`, que es armadura). `turns:0` (por defecto) = sin límite de tiempo, dura hasta romperse por daño; `>0` = también expira tras esos turnos aunque no se haya agotado. Volver a lanzarlo **suma** al pool actual.

##### `lineshot` — Disparo en línea perforante
```json
{ "kind":"lineshot", "dmgDice":2, "dmgDie":6, "dmgStat":"agility", "dmgStatMode":"add", "dmgStatCoef":1, "range":6 }
```
Dispara en línea recta hacia el enemigo pulsado/cercano, hasta `range` casillas (por defecto 6), se detiene en el primer muro. Golpea a **todos** los enemigos de la línea, cada uno con escalado completo. `multiplier` opcional, por defecto 0.8.

##### `trap` — Trampa en el suelo
```json
{ "kind":"trap", "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1, "turns":8, "range":1 }
```
Coloca una trampa invisible en la casilla pulsada (o la del lanzador si no hay componente que exija click). Se dispara sola cuando un enemigo entra en `range` casillas (por defecto 1), golpeando a todos los enemigos en rango con un golpe ×1.15 vía el pipeline normal, y desaparece. Expira sola tras `turns` turnos (por defecto 8) sin efecto. **Detalle importante**: los campos de dados/stat se calculan pero **no se usan realmente** al dispararse — el golpe real usa el fallback genérico ×1.15; solo `turns`/`range` importan de verdad.

##### `linkdamage` — Daño en cadena
```json
{ "kind":"linkdamage", "dmgDice":2, "dmgDie":6, "dmgStat":"intelligence", "dmgStatMode":"add", "dmgStatCoef":1, "jumps":3, "falloff":25, "range":4 }
```
Golpea al objetivo resuelto con escalado completo (`multiplier` opcional, por defecto 1), luego salta al enemigo no golpeado más cercano dentro de `range` (por defecto 4), hasta `jumps` saltos adicionales (por defecto 3). `falloff` (0-95, por defecto 25): % de daño perdido por salto, acumulativo.

##### `invisible` — Invisibilidad temporal
```json
{ "kind":"invisible", "turns":2, "breakOnAttack":true }
```
Solo self, se aplica al instante. Durante `turns` turnos (por defecto 2) los enemigos se saltan su turno entero. `breakOnAttack` (por defecto `true`): atacar mientras está activo lo termina antes de tiempo.

##### `ascend` — Ascensión (coste de skills)
```json
{ "kind":"ascend", "resource":"any", "value":150, "turns":6, "allowSkills":true, "iconImage":"" }
```
Cambia lo que cuestan las **propias skills** del jugador mientras está activo. `resource`: `"any"` (por defecto) | `"mana"` | `"stamina"`. `value` (por defecto 150): coste resultante como % del normal (100 = sin cambio). `allowSkills:false` bloquea lanzar cualquier otra skill mientras esté activo. `iconImage`: sustituye el icono del personaje en el mapa mientras dure.

##### `transform` — Transformación
```json
{ "kind":"transform", "turns":8, "damagePct":0, "armorPct":0, "hpPct":0, "allowSkills":true, "iconImage":"" }
```
`damagePct`/`armorPct` (pueden ser negativos): % aplicado como multiplicador a daño/armadura totales. `hpPct`: % de la vida máxima actual en el momento de lanzarlo, convertido una vez a un bonus plano de HP máxima. `allowSkills:false` bloquea otras skills. `iconImage`: sustituye el icono del personaje (tiene prioridad sobre el de `ascend` si ambos están activos).

#### Stats disponibles

Principales (válidos en cualquier `*Stat`): `strength, vitality, agility, luck, intelligence, wisdom`.
Extra solo para `buff`: `armor, damage, ap, dodge, critChance, blockChance, manaRegen, staminaRegen` (los últimos cuatro, puntos porcentuales/planos por turno, solo en modo `"add"`).
Extra solo para `debuff`/las variantes `effectType:"debuff"` de `summon`/`summonturret`/`clones`: `damage, ap` (sin `armor` — los enemigos no tienen ese stat).

#### Iconos de invocación

`summon`/`summonturret`/`clones` aceptan `iconImage`: PNG 50×50 codificado en hexadecimal (mismo formato que el icono del propio objeto/poción). Déjalo `""` para usar el sprite procedural por defecto.

Referencia completa de fórmulas de daño, tabla de coste AP y heurística de IA enemiga (todo eso es exclusivo de skills, no aplica a objetos/pociones): **`skills-json-rules.md`** §6-§7.

Lista de control por componente:

- Escribe `kind` exacto y todos los campos obligatorios de ese kind.
- Usa `target` solo con valores soportados: `self`, `enemy`, `area`, `ally`.
- No confundas dados de daño/curación (`dmgDice`, `dmgDie`) con DOT (`dotDice`, `dotDie`).
- Decide de forma explícita stat, modo (`add`/`mult`) y coeficiente.
- Conserva el orden porque los componentes se aplican secuencialmente, salvo movimientos que se resuelven primero.
- Comprueba combinaciones: una pila puede tener daño + DOT + debuff, pero cada bloque debe ser autosuficiente.
- No copies campos del sobre de una skill (`cd`, `cost`, `resource`, `classId`, `tier`) al item esperando que controlen sus efectos. En equipo activable se usa `cooldown`; en pociones no hay cooldown porque se consumen.

### 6.2 Uso de skills/herramientas del agente

- **No invoques una skill por rutina.** Primero determina si aporta valor real al encargo.
- Usa `imagegen` solo cuando se solicite crear o transformar un icono bitmap original. Después, adapta el resultado al pipeline real del editor: recorte cuadrado, 50×50, transparencia comprobada y hexadecimal. No la uses para editar código, documentación, SVG o para sustituir iconos existentes sin permiso.
- Usa `openai-docs` únicamente si el encargo trata de productos o APIs de OpenAI; no es pertinente para el esquema de items.
- Usa `skill-creator` si se pide crear una skill reutilizable **del agente**, no una habilidad de combate del juego.
- Usa `skill-installer` solo si se pide instalar una skill del agente desde el catálogo o un repositorio.
- Usa `plugin-creator` solo para plugins de Codex; no para items, mods internos ni skills de clase.
- Para imágenes ya existentes en el repositorio, inspecciona el archivo local; no regeneres el arte.
- No busques en internet para deducir el contrato local. El código del repositorio es la fuente primaria. Navega solo si se solicita información externa o actualizada.

## 7. Generación e importación de JSON

### 7.1 Formatos aceptados

- Un archivo `.json` con un objeto.
- Un archivo `.json` con un array de objetos.
- Varios archivos a la vez.
- Un `.zip` con entradas `.json`, sin límite de lote declarado por la UI.

El lector ZIP propio solo soporta entradas almacenadas (método 0) o Deflate (método 8), y depende de `DecompressionStream('deflate-raw')`. Si el navegador no lo ofrece, hay que extraer el ZIP e importar JSON suelto. Evita ZIP cifrado, ZIP64 y métodos especiales.

### 7.2 Diferencia crucial entre importar y exportar

- Exportar equipo o poción descarga **solo el objeto interior**, no la fila completa de Supabase.
- Importar envuelve cada valor como `{...x, item_json: x}` y crea una fila.
- El importador de la pestaña Equipo no verifica `type === "equipment"`.
- El importador de Pociones no verifica `type === "potion"`.
- El parser no valida campos, rangos, duplicados ni referencias; únicamente ejecuta `JSON.parse` y aplana el array superior.

Por tanto, separa los lotes por tipo y valida antes. Un archivo aceptado puede terminar listado en otra pestaña, ser inútil o fallar mucho más tarde en runtime.

### 7.3 Algoritmo obligatorio para generar

1. Determina `equipment` o `potion`.
2. Elige tier y deriva `label`, `itemLevel` y `score` coherentes.
3. Para equipo, elige un slot válido y elimina campos exclusivos de otros slots.
4. Para arma, declara tipo, dados, alcance y proc; para activables, cooldown y alcance; para equipo pasivo, limita efectos a buffs.
5. Escribe `stats` y `affixes` equivalentes.
6. Construye cada componente consultando `skills-json-rules.md`, no por analogía informal.
7. Define un `desc` que explique el resultado real, sin prometer efectos que el slot ignora.
8. Omite `id`, `created_at` y `quantity` de la plantilla.
9. Usa comillas dobles, sin comentarios, sin comas finales y con números JSON válidos (`0.5`, no expresiones).
10. Haz revisión semántica manual antes de importar.

### 7.4 Checklist de validación manual

- [ ] El documento raíz es objeto o array plano de objetos.
- [ ] Cada objeto tiene `type`, `name`, `slot`, `rarity`, `itemLevel`, `score` y `effects`.
- [ ] `type` y `slot` concuerdan.
- [ ] Tier, label, nivel y score concuerdan.
- [ ] No hay ids de fila copiados entre entornos.
- [ ] `stats` y `affixes` dicen lo mismo.
- [ ] Los arrays son realmente arrays, incluso vacíos.
- [ ] Cada `kind` existe y usa los nombres/casos exactos.
- [ ] Targets y rangos corresponden a cómo se activará el item.
- [ ] Un arma tiene dados y alcance; un activable tiene cooldown; una poción útil tiene efectos.
- [ ] El icono, si existe, es hex válido de PNG 50×50 y no una ruta/base64.
- [ ] No hay duplicados intencionados ni nombres engañosamente iguales.
- [ ] La descripción refleja los campos, no sustituye mecánicas.

## 8. Procedimiento de auditoría detallada

Cuando se pida “revisar items”, entrega hallazgos separados por severidad y evidencia:

1. **Inventario del contrato:** formulario, serializador, API, tabla, normalizador, selección de loot y ejecución de efectos.
2. **Consistencia vertical:** sigue al menos un equipo normal, un arma, un activable y una poción de extremo a extremo.
3. **Consistencia horizontal:** compara todos los tiers, slots, tipos de arma y kinds.
4. **Persistencia:** busca divergencias entre metadata y `item_json`, duplicados, nulos y tipos inesperados.
5. **Generación:** comprueba bandas de loot, clamp de iLvl, score y fallbacks.
6. **Edición destructiva:** identifica campos preservados pero no editables (`skillIds`) y campos que el editor puede regenerar.
7. **Importación:** revisa tipo de archivo, raíz, esquema, atomicidad y errores parciales.
8. **Runtime:** verifica equipar/desequipar, proc, cooldown, selección de objetivo, consumo e inventario.
9. **Documentación:** actualiza ejemplos y advertencias si cambió el comportamiento.
10. **Consolidación:** versión única y coherente, entrada de changelog, commit y PR.

## 9. Hallazgos de la revisión actual

### Riesgo alto

- No existe validación de esquema ni en el importador ni en `api/config-items.js`. Datos mal tipados pueden persistirse con HTTP 200.
- Los lotes se escriben registro a registro y no son atómicos; un error produce una importación parcial.
- Los endpoints usan la anon key del servidor sin una comprobación de autorización propia en este archivo. La protección depende por completo de la exposición de la ruta y de las políticas/configuración externa de Supabase/Vercel.

### Riesgo medio

- Los importadores de Equipo y Pociones aceptan cualquier `type`; el usuario puede importar en la pestaña equivocada sin aviso.
- Metadata exterior e `item_json` pueden divergir. Algunas vistas/selecciones leen una, otras priorizan el objeto interior.
- Un `score` declarado no se recalcula cuando runtime recorta `itemLevel` a la banda de loot.
- La UI permite guardar una poción sin efectos y equipo con efectos ignorados por su slot.
- `hidden` controla presentación/búsqueda, no confidencialidad ni exclusión universal del loot.

### Compatibilidad que debe preservarse

- `skillIds` de equipo antiguo se conserva al editar aunque ya no aparezca en el formulario.
- Las armas antiguas pueden inferir tipo/alcance por metadatos o nombre.
- El fallback procedural sigue siendo necesario si `config_items` está vacío o no tiene candidatos.
- `item_json` exportado es portable; ids y metadata de fila no deben formar parte del fichero canónico.

## 10. Criterio de finalización

Una consolidación está lista cuando:

- el JSON es sintáctica y semánticamente coherente;
- se ha trazado el efecto hasta su consumidor real;
- no se han destruido campos heredados silenciosamente;
- documentación, `APP_VERSION`, `package.json` y cache-busting de `index.html` comparten versión;
- todos los cambios consolidados están descritos en `logcambios.md`;
- no se ejecutaron tests si el usuario no los pidió;
- los cambios están confirmados en Git y la PR explica alcance, riesgos conocidos y validación realizada.
