# Reglas JSON objetos

Este documento define cómo generar JSON de objetos para el configurador de items. Puedes importar un objeto individual o un array de objetos.

## Reglas generales

- Usa `type: "equipment"` para equipo y `type: "potion"` para pociones.
- El campo visible de progresión es `rarity` / **Tier**. No edites iLvl desde el formulario; si incluyes `itemLevel`, mantenlo alineado con el Tier.
- `name`, `slot`, `rarity`, `label`, `itemLevel`, `score` e `icon` son los campos comunes más importantes.
- `icon` debe contener el PNG en hexadecimal si quieres icono personalizado; si está vacío el motor dibuja un icono base.
- `hidden` (bool, opcional, por defecto `false`): si es `true`, el objeto queda oculto en los buscadores generales hasta que una búsqueda de texto coincida con él. No es una restricción de seguridad ni impide que el motor lo use donde no se filtre explícitamente (loot, chest pools, etc.).

## Tiers permitidos

| Tier JSON | Nombre visible | Nivel interno recomendado |
|---|---|---:|
| `common` | Común | 1 |
| `uncommon` | Infrecuente | 2 |
| `rare` | Raro | 3 |
| `epic` | Épico | 4 |
| `legendary` | Legendario | 5 |
| `artifact` | Artefacto | 6 |

## Slots de equipo permitidos

| Slot | Nombre visible |
|---|---|
| `weapon` | Arma |
| `offhand` | Mano secundaria |
| `head` | Cabeza |
| `chest` | Pecho |
| `hands` | Manos |
| `legs` | Piernas |
| `boots` | Botas |
| `neck` | Cuello |
| `ring1` | Anillo I |
| `ring2` | Anillo II |
| `trinket1` | Trinket I |
| `trinket2` | Trinket II |
| `consumable` | Poción / consumible |

## Plantilla base de equipo

```json
{
  "type": "equipment",
  "name": "Objeto sin nombre",
  "slot": "trinket1",
  "rarity": "common",
  "label": "Común",
  "itemLevel": 1,
  "score": 8,
  "icon": "",
  "hidden": false,
  "stats": "strength:+1",
  "affixes": [
    { "key": "strength", "label": "Fuerza", "value": 1, "percent": false }
  ],
  "passives": [],
  "effects": [],
  "skillIds": [],
  "desc": "Configurado · strength:+1"
}
```

## Stats / affixes

El campo `stats` puede escribirse como texto para el importador/editor: `strength:+2, armor:+1`. Al consolidar, el juego lo transforma en `affixes`.

### Stats principales

| key | Nombre | Uso |
|---|---|---|
| `strength` | Fuerza | Daño físico y pruebas de fuerza |
| `vitality` | Vitalidad | Vida, stamina, armadura y resistencia |
| `agility` | Agilidad | Evasión, crítico y movilidad |
| `luck` | Suerte | Crítico, botín y eventos |
| `intelligence` | Inteligencia | Poder mágico y maná |
| `wisdom` | Sabiduría | Regeneración y defensa mágica |

### Stats derivadas habituales

| key | Significado |
|---|---|
| `damage` | Daño base del personaje |
| `armor` | Armadura |
| `maxHp` | Vida máxima |
| `maxStamina` | Stamina máxima |
| `maxMana` | Maná máximo |
| `critChance` | Probabilidad de crítico |
| `dodge` | Evasión |
| `staminaRegen` | Regeneración de stamina |
| `manaRegen` | Regeneración de maná |

## Armas

Los objetos con `slot: "weapon"` pueden declarar datos de arma. Si no los declaras, el motor intenta inferir icono/categoría al generar loot.

### Alcance de ataque normal

- Añade `rangeMin` y `rangeMax` para definir el alcance mínimo y máximo del ataque normal con esa arma.
- Las armas a distancia son: `Varitas`, `Arcos`, `Ballestas`, `Pistolas`, `Rifles` y `Escopetas`.
- Si el arma está dentro de esos tipos, el ataque normal usa selección de objetivo, exige línea de visión y solo permite enemigos entre `rangeMin` y `rangeMax`.
- Alcances por defecto por tipo: `Varitas` 1-4, `Arcos` 2-5, `Ballestas` 1-4, `Pistolas` 1-3, `Rifles` 2-5, `Escopetas` 1-2.
- Las armas cuerpo a cuerpo conservan `rangeMin: 1` y `rangeMax: 1`.

```json
{
  "type": "equipment",
  "name": "Espada configurada",
  "slot": "weapon",
  "rarity": "rare",
  "label": "Raro",
  "itemLevel": 3,
  "score": 24,
  "icon": "",
  "damageDice": "1d8",
  "rangeMin": 1,
  "rangeMax": 1,
  "weaponType": "Espadas",
  "weaponCategory": "Armas blancas steampunk básicas",
  "defenseStat": "strength",
  "stats": "strength:+2, damage:+3",
  "affixes": [
    { "key": "strength", "label": "Fuerza", "value": 2, "percent": false },
    { "key": "damage", "label": "Daño", "value": 3, "percent": false }
  ],
  "skillIds": ["smash"],
  "passives": [],
  "effects": [],
  "desc": "Configurado · strength:+2, damage:+3 · Habilidades: Golpe de Yunque"
}
```

## Habilidades en objetos (legado)

- `skillIds` es un array de IDs de skill. Al equipar el objeto, el motor intenta aprender esas skills (`learnItemSkills`).
- **El editor ya no expone este campo**: la pestaña Items eliminó el selector "Habilidades" porque los efectos apilables configurables del propio objeto (ver más abajo) lo hacen redundante. Un objeto editado y reguardado conserva el `skillIds` que ya tuviera (no se borra silenciosamente), pero no hay forma de asignar uno nuevo desde el formulario.
- Solo tiene sentido incluir `skillIds` a mano en un JSON si necesitas compatibilidad con objetos antiguos que ya dependían de este mecanismo. Para efectos nuevos, usa el `effects[]` del objeto en su lugar.

## Pasivas legendarias

Puedes dejar `passives` vacío. Si lo usas, la estructura habitual es:

```json
{
  "passives": [
    { "stat": "armor", "name": "Piel férrea", "desc": "Aumenta armadura.", "value": 2, "percent": false }
  ]
}
```

(`effects` con forma `{name, desc}` era el texto de sabor legendario del loot generado al azar; el equipo configurado a mano usa `effects` para la pila de efectos apilables — ver la sección siguiente. Nunca mezcles ambas formas en el mismo objeto.)

## Efectos apilables de equipo

El equipo configurado (`type: "equipment"`) puede llevar exactamente la misma pila de efectos apilables (`effects[]`) que las skills y las pociones — mismos `kind`, mismos campos, mismo comportamiento. Aquí abajo se documenta primero cómo se disparan esos efectos según el `slot` del objeto, y luego el catálogo completo de los 27 `kind` disponibles.

Cómo se activa `effects[]` depende del slot:

- **Equipo general** (`offhand`, `head`, `chest`, `hands`, `legs`, `boots`, `neck`): los componentes de tipo `buff` se aplican de forma **pasiva** en cuanto el objeto está equipado (y se retiran al desequiparlo). Otros `kind` no tienen efecto en estos slots.
- **`weapon`**: cada golpe conectado tiene una posibilidad de disparar la pila completa de `effects[]` sobre el objetivo golpeado (**proc on hit**). La posibilidad se controla con el campo `procChance` (0-100, entero, % por golpe).
- **`trinket1`, `trinket2`, `ring1`, `ring2`**: los efectos son **activables a mano**, igual que una poción, desde un hueco propio ("Activables") junto a la mochila — si algún componente apunta a Enemigo/Área/Aliado hay que seleccionar objetivo al activarlo; si todos son sobre uno mismo, se aplica al instante. El objeto **no se consume** (sigue equipado); en su lugar queda en enfriamiento tras usarse, definido por el campo `cooldown` (turnos, entero ≥1). `range` define el alcance en casillas para seleccionar objetivo (por defecto 5), igual que `range` en una poción.

`procChance`, `cooldown` y `range` se ignoran fuera de su slot correspondiente (ponlos a `null` o simplemente omítelos).

```json
{
  "type": "equipment",
  "name": "Guantelete de la tormenta",
  "slot": "weapon",
  "rarity": "epic",
  "label": "Épico",
  "itemLevel": 4,
  "score": 32,
  "damageDice": "1d8",
  "rangeMin": 1,
  "rangeMax": 1,
  "weaponType": "Mazas",
  "procChance": 25,
  "effects": [
    { "kind": "dmg", "dmgDice": 1, "dmgDie": 6, "dmgStat": "strength", "dmgStatMode": "add", "dmgStatCoef": .5, "flavor": "shock" }
  ],
  "passives": [],
  "skillIds": [],
  "desc": "25% de posibilidad de descarga eléctrica adicional al golpear."
}
```

```json
{
  "type": "equipment",
  "name": "Anillo de curación de emergencia",
  "slot": "ring1",
  "rarity": "rare",
  "label": "Raro",
  "itemLevel": 3,
  "score": 24,
  "cooldown": 6,
  "range": 5,
  "effects": [
    { "kind": "heal", "target": "self", "dmgDice": 3, "dmgDie": 8, "dmgStat": "wisdom", "dmgStatMode": "add", "dmgStatCoef": 1 }
  ],
  "passives": [],
  "skillIds": [],
  "desc": "Activable · cura una porción de vida · enfriamiento 6 turnos."
}
```

```json
{
  "type": "equipment",
  "name": "Collar del guardián",
  "slot": "neck",
  "rarity": "rare",
  "label": "Raro",
  "itemLevel": 3,
  "score": 24,
  "effects": [
    { "kind": "buff", "target": "self", "stat": "vitality", "mode": "add", "value": 3, "turns": 999999 }
  ],
  "passives": [],
  "skillIds": [],
  "desc": "Pasivo mientras esté equipado: +3 Vitalidad."
}
```

Nota: en un `buff` pasivo de equipo el campo `turns` es irrelevante para el jugador (el motor lo aplica con duración permanente mientras el objeto siga equipado), pero debe existir en el componente por consistencia con el resto de la pila de efectos.

## Catálogo completo de efectos apilables (`effects[]`)

Objetos, pociones y skills de clase comparten **exactamente el mismo motor de efectos apilables**: el mismo array `effects[]`, los mismos 27 `kind` disponibles, los mismos campos, el mismo comportamiento (`applySkillEffectsList`/`applyEffectComponent` en `src/game.js`). Lo único que cambia entre skill/poción/objeto es **cómo se dispara** la pila (pulsar una skill, beber/lanzar una poción, o pasiva/proc/activable según el slot del objeto — ver la sección correspondiente más arriba). Este catálogo es idéntico al de `skills-json-rules.md` §3-§5; si alguna vez difieren, `skills-json-rules.md` manda porque documenta también las fórmulas de daño completas (`attack()`, crítico, defensa) que aquí se omiten por brevedad.

### Reglas generales de `effects[]`

- `effects` es una **lista ordenada de componentes independientes**. Cada componente se aplica en orden; la pila "tiene éxito" (se consume: cooldown, quantity de poción, etc.) si al menos un componente hizo algo.
- Excepción: un componente `move` (dash/teletransporte) siempre se resuelve **antes que todos los demás**, sin importar su posición en el array. Si mueve al lanzador, cualquier componente de área que venga después se centra en la posición **nueva**, no en la de partida.
- Forma común de un componente: `{ "kind": "<kind>", "target": "...", ...campos propios del kind }`.

### Bloque de dados compartido (prefijo `dmg` o `dot`)

Lo usan: `dmg`, `heal`, `drain`, `aoe`, `multihit`, `execute`, `hot`, `counter`, `summon`, `summonturret`, `clones`, `lineshot`, `linkdamage`, `trap` (prefijo `dmg`) y `dot` (prefijo `dot`). Cada uno deriva su bono/multiplicador de **su propio** `{p}Stat`/`{p}StatMode`/`{p}StatCoef` sobre el stat del lanzador (jugador), no de un campo genérico del sobre exterior.

| Campo | Tipo | Por defecto | Significado |
|---|---|---|---|
| `{p}Dice` | int ≥0 | 0 | número de dados. `0` = usa una fórmula automática en vez de una tirada fija (solo donde se indica). |
| `{p}Die` | 4\|6\|8\|10\|12\|20 | 6 | caras del dado |
| `{p}Stat` | stat de §Stats, o `""` | `""` | stat que escala la tirada. `""` = sin escalado propio (cae a un bono genérico por tipo). |
| `{p}StatMode` | `"add"` \| `"mult"` | `"add"` | cómo contribuye el stat |
| `{p}StatCoef` | número | `1` (add) / `.02` (mult) | coeficiente de escalado |

### Resolución de `target`

- `"enemy"`: el enemigo pulsado, o el más cercano visible si es autolanzado.
- `"area"`: para kinds de daño/debuff (`dmg`, `dot`, `debuff`, `cc`, `drain`, `mark`, `execute`, `pullroot`) — todos los enemigos dentro de `range` casillas (distancia Chebyshev) del punto pulsado/lanzado, con línea de visión. Para `heal`/`hot` — todos los aliados (compañeros + otros jugadores humanos) dentro de `range` casillas.
- `"self"`: el lanzador.
- `"ally"`: aliado pulsado (solo multijugador).

### Modo de objetivo de toda la pila (auto-derivado)

Prioridad: algún componente con `target:"enemy"` → toda la pila exige pulsar un enemigo. Si no, algún `target:"area"` (o un `move` con `mode:"teleport"`) → exige pulsar una casilla. Si no, algún `target:"ally"` → exige pulsar un aliado. Si no → se aplica al instante sin selección (p. ej. una pila solo con `buff`/`heal(self)`/`hot`/`cheatdeath`/`counter`).

### Los 27 `kind` disponibles

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

#### `dmg` — Daño
```json
{ "kind":"dmg", "target":"enemy", "dmgDice":2, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":1 }
```
`target:"self"` → autodaño directo (sin tirada de defensa). `target:"enemy"/"area"` → tirada de ataque + salvación de defensa normal; `area` usa `range` (por defecto 2) como radio y aplica ×0.85 salvo que fijes `multiplier`.

#### `dot` — Daño periódico
```json
{ "kind":"dot", "target":"enemy", "dotDice":1, "dotDie":6, "dotStat":"strength", "dotStatMode":"add", "dotStatCoef":.5, "turns":4, "flavor":"dot" }
```
`flavor`: `"dot" | "bleed" | "burn" | "poison"` — solo etiqueta visual, sin diferencia mecánica. Golpe inicial ~0.7x + estado que hace daño cada turno durante `turns` turnos (tirada fija al aplicarse).

#### `buff` — Buff propio
```json
{ "kind":"buff", "target":"self", "stat":"strength", "mode":"add", "value":5, "turns":6 }
```
`stat`: cualquier stat principal, más `armor, damage, ap, dodge, critChance, blockChance, manaRegen, staminaRegen`. `mode`: `"add"` (+valor plano) o `"mult"` (stat ×valor, ej. `1.2` = +20%). `dodge`/`critChance`/`blockChance` solo en `"add"`, ahí `value` son puntos porcentuales. Este es el `kind` que usan los **pasivos de equipo general** (ver más arriba) — se aplica con `turns:999999` mientras el objeto siga equipado.

#### `debuff` — Debuff a enemigo
```json
{ "kind":"debuff", "target":"enemy", "stat":"damage", "mode":"add", "value":2, "turns":3 }
```
`stat`: `damage` o `ap` (los enemigos no tienen armadura ni las stats derivadas de `buff`); cualquier stat principal también vale. `stat` omitido → "debilitado" genérico sin stat concreto. También aplica un golpe genérico ~0.7x.

#### `heal` — Curación instantánea
```json
{ "kind":"heal", "target":"self", "dmgDice":2, "dmgDie":6, "dmgStat":"wisdom", "dmgStatMode":"add", "dmgStatCoef":1 }
```
Magnitud vía fórmula de dados (fallback ~`8+nivel*3`), aplicada como `curación = poder*2` HP, más `poder` de recurso restaurado (solo self/skills — en objetos/pociones no hay recurso propio que restaurar salvo que el propio objeto lo tenga, se ignora si no aplica). `target:"ally"` (multijugador) cura al aliado pulsado. `target:"area"`: cura al lanzador y a todos los aliados dentro de `range` casillas (por defecto 2).

#### `move` — Dash o teletransporte
```json
{ "kind":"move", "mode":"dash", "range":3 }
```
Kind pensado para skills; técnicamente aceptado en objetos/pociones pero sin sentido práctico (no hay "lanzador humano manual" distinto del jugador). `mode:"dash"`: avanza hasta `range` casillas hacia el enemigo y lo golpea. `mode:"teleport"`: si hay un componente `enemy` en la misma pila, se teletransporta junto a él; si no, al punto pulsado.

#### `cc` — Control
```json
{ "kind":"cc", "target":"enemy", "type":"stun", "turns":2 }
```
`type`: `"stun" | "freeze" | "silence" | "root"`. Golpe ~0.75x + estado de control puro (0 de magnitud) durante `turns` turnos.

#### `drain` — Drenaje
```json
{ "kind":"drain", "target":"enemy", "dmgDice":2, "dmgDie":6, "dmgStat":"intelligence", "dmgStatMode":"add", "dmgStatCoef":1 }
```
Golpe fijo ~0.8x al enemigo (los campos de dados NO afectan a ese golpe); cura al lanzador y le restaura recurso por `poder` (eso sí lo configuran los campos de dados/stat).

#### `aoe` — Daño en área
```json
{ "kind":"aoe", "dmgDice":2, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":1, "range":2 }
```
Golpea a todos los enemigos dentro de `range` casillas del punto de lanzamiento, con línea de visión. Sin `target` — siempre área centrada en el punto de cast. `multiplier` opcional, por defecto 0.85.

#### `multihit` — Golpes repetidos
```json
{ "kind":"multihit", "hits":3, "dmgDice":1, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":.6 }
```
Golpea al objetivo resuelto `hits` veces (tiradas y salvaciones independientes), espaciadas 0.5s entre sí. `multiplier` opcional, por defecto 0.6 por golpe.

#### `mark` — Amplificador de daño recibido
```json
{ "kind":"mark", "target":"enemy", "value":25, "turns":4 }
```
`value`: % extra de daño que recibe el objetivo de cualquier fuente mientras dure la marca. No se acumula consigo misma (reaplicar refresca `turns`/magnitud al máximo).

#### `summon` — Aliado móvil
```json
{
  "kind":"summon", "hp":20, "turns":8, "ap":10, "effectType":"damage", "range":0,
  "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1,
  "effectTurns":2, "iconImage":"", "targetable":true, "hitByAoe":true, "stance":"aggressive"
}
```
`hp`: vida máxima. `turns`: duración en turnos del jugador (ignorado si `permanent:true`). `ap`: cada 10 = 1 acción por turno. `effectType`: `"damage"` (ataca dados+stat), `"skill"` (pila de efectos propia vía `skillEffects[]`, mismas reglas que `effects[]` pero limitado a `dmg/dot/debuff/cc/drain/mark/buff/heal`), `"heal"` (cura al jugador cada acción), `"root"` (enraiza al enemigo más cercano), `"buff"`/`"debuff"` (aplica al jugador/enemigo, campos `stat/mode/value/effectTurns`). `range` (solo damage/skill): 0 = cuerpo a cuerpo, >0 = distancia. `iconImage`: PNG 50×50 hex opcional. `targetable`/`hitByAoe`/`stance` controlan si los enemigos pueden atacarlo y su comportamiento. `permanent:true` lo convierte en un pet "Compañero" que no expira y penaliza -10% a todas las stats del jugador si muere (hasta revivirlo).

#### `summonturret` — Aliado estático a distancia
```json
{
  "kind":"summonturret", "hp":16, "turns":8, "ap":10, "range":7, "damageMode":"nearest",
  "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1,
  "iconImage":""
}
```
Igual que `summon` (mismos 6 `effectType`) pero nunca se mueve; `range` por defecto 7. `damageMode`: `"nearest"` (un objetivo) o `"area"` (golpea a todos los enemigos dentro de `range` cada acción). No admite `permanent`/`targetable`/`hitByAoe`/`stance`.

#### `clones` — Varios aliados móviles a la vez
```json
{
  "kind":"clones", "count":2, "hp":14, "turns":8, "ap":10, "effectType":"damage", "range":0,
  "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1,
  "effectTurns":2, "iconImage":""
}
```
Igual que `summon` pero invoca `count` (1-4, por defecto 2) aliados independientes de golpe. No admite `permanent`/`targetable`/`hitByAoe`/`stance`.

#### `utility` — Efectos varios sobre uno mismo
```json
{ "kind":"utility", "mode":"reveal", "value":10 }
```
`mode:"reveal"`: revela el mapa en radio `value` (por defecto 10). `"stealth"`: el próximo turno enemigo se salta entero (un solo uso). `"shield"`: añade `value` puntos planos de **armadura** (decae 1 punto por turno propio, se te golpee o no — distinto del `holyshield`). `"resource"`: restaura `value` puntos del recurso propio (solo aplica si el objeto/skill tiene recurso propio).

#### `hot` — Curación periódica
```json
{ "kind":"hot", "target":"self", "dmgDice":1, "dmgDie":6, "dmgStat":"wisdom", "dmgStatMode":"add", "dmgStatCoef":.5, "turns":4 }
```
Magnitud vía fórmula de dados (fallback `~3+nivel`), aplicada una vez por turno propio durante `turns` turnos. Los stacks son independientes (no se refrescan entre sí). `target:"area"`: además cura a los aliados dentro de `range` (por defecto 2) — compañeros reciben el HOT tick a tick; otros jugadores humanos reciben el total como una curación instantánea única.

#### `execute` — Ejecutar bajo umbral de vida
```json
{ "kind":"execute", "target":"enemy", "dmgDice":2, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":1, "threshold":35, "execMultiplier":2.5 }
```
Tirada normal con escalado completo. Si `hp/maxHp` del objetivo < `threshold/100`, el golpe se multiplica por `execMultiplier` en vez del `multiplier` normal (por defecto 1).

#### `pullroot` — Atraer + enraizar
```json
{ "kind":"pullroot", "target":"enemy", "turns":2 }
```
Golpe ~0.8x, atrae al objetivo 1 casilla hacia el lanzador (si hay hueco libre) y aplica `root` durante `turns` turnos. `multiplier` opcional.

#### `counter` — Postura de contraataque
```json
{ "kind":"counter", "shield":10, "dmgDice":1, "dmgDie":8, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1, "turns":5 }
```
Concede `shield` puntos de armadura al instante y arma un contraataque de un solo uso: la próxima vez que el lanzador reciba daño (antes de que expire), golpea al enemigo vivo más cercano con esa tirada ×0.8. `dmgStat`/`dmgStatMode`/`dmgStatCoef` se aceptan pero no se aplican al golpe de vuelta (solo dados).

#### `cheatdeath` — Desafiar a la muerte
```json
{ "kind":"cheatdeath", "turns":5 }
```
Arma una protección de un solo uso: la próxima vez que la vida llegaría a 0 mientras esté armado, se fija a 1 HP en su lugar y se consume.

#### `holyshield` — Escudo de absorción
```json
{ "kind":"holyshield", "target":"self", "value":20, "stat":"", "mode":"add", "statCoef":1, "turns":0 }
```
Concede puntos de un pool de absorción dedicado que amortigua el daño **antes** de tocar la vida (distinto de `utility`'s `"shield"`, que es armadura). `turns:0` (por defecto) = sin límite de tiempo, dura hasta romperse por daño; `>0` = también expira tras esos turnos aunque no se haya agotado. Volver a lanzarlo **suma** al pool actual.

#### `lineshot` — Disparo en línea perforante
```json
{ "kind":"lineshot", "dmgDice":2, "dmgDie":6, "dmgStat":"agility", "dmgStatMode":"add", "dmgStatCoef":1, "range":6 }
```
Dispara en línea recta hacia el enemigo pulsado/cercano, hasta `range` casillas (por defecto 6), se detiene en el primer muro. Golpea a **todos** los enemigos de la línea, cada uno con escalado completo. `multiplier` opcional, por defecto 0.8.

#### `trap` — Trampa en el suelo
```json
{ "kind":"trap", "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1, "turns":8, "range":1 }
```
Coloca una trampa invisible en la casilla pulsada (o la del lanzador si no hay componente que exija click). Se dispara sola cuando un enemigo entra en `range` casillas (por defecto 1), golpeando a todos los enemigos en rango con un golpe ×1.15 vía el pipeline normal, y desaparece. Expira sola tras `turns` turnos (por defecto 8) sin efecto. **Detalle importante**: los campos de dados/stat se calculan pero **no se usan realmente** al dispararse — el golpe real usa el fallback genérico ×1.15; solo `turns`/`range` importan de verdad.

#### `linkdamage` — Daño en cadena
```json
{ "kind":"linkdamage", "dmgDice":2, "dmgDie":6, "dmgStat":"intelligence", "dmgStatMode":"add", "dmgStatCoef":1, "jumps":3, "falloff":25, "range":4 }
```
Golpea al objetivo resuelto con escalado completo (`multiplier` opcional, por defecto 1), luego salta al enemigo no golpeado más cercano dentro de `range` (por defecto 4), hasta `jumps` saltos adicionales (por defecto 3). `falloff` (0-95, por defecto 25): % de daño perdido por salto, acumulativo.

#### `invisible` — Invisibilidad temporal
```json
{ "kind":"invisible", "turns":2, "breakOnAttack":true }
```
Solo self, se aplica al instante. Durante `turns` turnos (por defecto 2) los enemigos se saltan su turno entero. `breakOnAttack` (por defecto `true`): atacar mientras está activo lo termina antes de tiempo.

#### `ascend` — Ascensión (coste de skills)
```json
{ "kind":"ascend", "resource":"any", "value":150, "turns":6, "allowSkills":true, "iconImage":"" }
```
Cambia lo que cuestan las **propias skills** del jugador mientras está activo. `resource`: `"any"` (por defecto) | `"mana"` | `"stamina"`. `value` (por defecto 150): coste resultante como % del normal (100 = sin cambio). `allowSkills:false` bloquea lanzar cualquier otra skill mientras esté activo. `iconImage`: sustituye el icono del personaje en el mapa mientras dure.

#### `transform` — Transformación
```json
{ "kind":"transform", "turns":8, "damagePct":0, "armorPct":0, "hpPct":0, "allowSkills":true, "iconImage":"" }
```
`damagePct`/`armorPct` (pueden ser negativos): % aplicado como multiplicador a daño/armadura totales. `hpPct`: % de la vida máxima actual en el momento de lanzarlo, convertido una vez a un bonus plano de HP máxima. `allowSkills:false` bloquea otras skills. `iconImage`: sustituye el icono del personaje (tiene prioridad sobre el de `ascend` si ambos están activos).

### Stats disponibles

Principales (válidos en cualquier `*Stat`): `strength, vitality, agility, luck, intelligence, wisdom`.
Extra solo para `buff`: `armor, damage, ap, skilleffect, dodge, critChance, blockChance, manaRegen, staminaRegen` (los últimos cuatro, puntos porcentuales/planos por turno, solo en modo `"add"`).
Extra solo para `debuff`/las variantes `effectType:"debuff"` de `summon`/`summonturret`/`clones`: `damage, ap, skilleffect` (sin `armor` — los enemigos no tienen ese stat).

### Iconos de invocación

`summon`/`summonturret`/`clones` aceptan `iconImage`: PNG 50×50 codificado en hexadecimal (mismo formato que el icono del propio objeto/poción). Déjalo `""` para usar el sprite procedural por defecto.

Referencia completa de fórmulas de daño, tabla de coste AP y heurística de IA enemiga (todo eso es exclusivo de skills, no aplica a objetos/pociones): **`skills-json-rules.md`** §6-§7.

## Importar varios objetos

```json
[
  {
    "type": "equipment",
    "name": "Anillo de suerte",
    "slot": "ring1",
    "rarity": "uncommon",
    "label": "Infrecuente",
    "itemLevel": 2,
    "score": 16,
    "stats": "luck:+2",
    "affixes": [{ "key": "luck", "label": "Suerte", "value": 2, "percent": false }],
    "skillIds": [],
    "passives": [],
    "effects": []
  },
  {
    "type": "potion",
    "name": "Ampolla de HP",
    "slot": "consumable",
    "rarity": "common",
    "label": "Común",
    "itemLevel": 1,
    "score": 8,
    "iconShape": "vial",
    "effects": [
      { "kind": "heal", "target": "self", "dmgDice": 2, "dmgDie": 8, "dmgStat": "vitality", "dmgStatMode": "add", "dmgStatCoef": 1 }
    ],
    "desc": "Restaura una porción de vida."
  }
]
```


### Bonus de PA y efecto de habilidad

Los objetos admiten `ap:+N` en `stats` para sumar PA máximos mientras estén equipados. Los buffs de equipo/arma admiten `stat:"skilleffect"`: en modo `add`, 20 representa +20% de potencia de habilidades; en modo `mult`, 1.2 representa ×1.2. Las invocaciones de tipo daño usan exactamente `dmgDice`; con `dmgDice:0` no atacan. La imagen se conserva en `iconImage` dentro del propio efecto `summon`/`summonturret`/`clones`, incluida una skill racial.
