# Instrucciones completas para crear JSON de items

Esta guía sirve únicamente para escribir JSON de **equipo** y **pociones**. Incluye los campos disponibles, sus valores válidos y el efecto que producen durante la partida.

## 1. Formato del archivo

El archivo puede contener un solo item:

```json
{ "type": "equipment", "name": "Espada simple" }
```

O una lista de items:

```json
[
  { "type": "equipment", "name": "Espada simple" },
  { "type": "potion", "name": "Poción de cura" }
]
```

Reglas de sintaxis:

- Usa comillas dobles en claves y textos.
- Separa propiedades y objetos con comas, sin coma después del último elemento.
- Usa `true` y `false` sin comillas.
- Usa punto para decimales: `0.5`.
- No incluyas comentarios dentro del JSON.
- No incluyas `id`, `created_at` ni `quantity`: no pertenecen a la plantilla del item.

## 2. Tier, nivel y poder

Mantén siempre alineados estos cuatro campos:

| `rarity` | `label` | `itemLevel` | `score` |
|---|---|---:|---:|
| `common` | `Común` | 1 | 8 |
| `uncommon` | `Infrecuente` | 2 | 16 |
| `rare` | `Raro` | 3 | 24 |
| `epic` | `Épico` | 4 | 32 |
| `legendary` | `Legendario` | 5 | 40 |
| `artifact` | `Artefacto` | 6 | 48 |

El tier determina la calidad visual y sirve de referencia para la potencia. `itemLevel` representa el nivel del item y `score` su poder mostrado.

## 3. Equipo

### 3.1 Plantilla completa

```json
{
  "type": "equipment",
  "name": "Nombre del objeto",
  "slot": "chest",
  "rarity": "rare",
  "label": "Raro",
  "itemLevel": 3,
  "score": 24,
  "icon": "",
  "hidden": false,
  "stats": "vitality:+2, armor:+3",
  "affixes": [
    { "key": "vitality", "label": "Vitalidad", "value": 2, "percent": false },
    { "key": "armor", "label": "Armadura", "value": 3, "percent": false }
  ],
  "skillIds": [],
  "passives": [],
  "effects": [],
  "desc": "Descripción visible del objeto."
}
```

### 3.2 Campos de equipo

| Campo | Valor | Efecto |
|---|---|---|
| `type` | siempre `"equipment"` | Identifica el item como equipable. |
| `name` | texto | Nombre visible. Se recomienda un máximo de 80 caracteres. |
| `slot` | uno de §3.3 | Decide dónde se equipa y cómo se activan sus efectos. |
| `rarity` | tier de §2 | Calidad del item. |
| `label` | nombre de §2 | Texto visible de la calidad. |
| `itemLevel` | entero positivo | Nivel mostrado y referencia de potencia. |
| `score` | número | Poder de objeto mostrado. |
| `icon` | PNG 50×50 en hexadecimal o `""` | Icono personalizado; vacío utiliza el aspecto disponible por defecto. |
| `hidden` | booleano | Si es `true`, permanece oculto en selectores hasta buscarlo por nombre. |
| `stats` | texto | Versión editable de los atributos, por ejemplo `strength:+2`. |
| `affixes` | array | Atributos estructurados que recibe el personaje. |
| `skillIds` | array de IDs | Compatibilidad con objetos antiguos que conceden habilidades al equiparse; para items nuevos usa `[]`. |
| `passives` | array | Pasivas legendarias antiguas; normalmente `[]`. |
| `effects` | array | Efectos apilables descritos en §6. |
| `desc` | texto | Descripción visible; no crea mecánicas por sí sola. |

### 3.3 Slots posibles y comportamiento de `effects`

| `slot` | Hueco | Comportamiento de los efectos |
|---|---|---|
| `weapon` | Arma | La pila completa puede activarse al golpear, según `procChance`. |
| `offhand` | Mano secundaria | Solo los efectos `buff` funcionan pasivamente mientras esté equipado. |
| `head` | Cabeza | Solo `buff` pasivo. |
| `chest` | Pecho | Solo `buff` pasivo. |
| `hands` | Manos | Solo `buff` pasivo. |
| `legs` | Piernas | Solo `buff` pasivo. |
| `boots` | Botas | Solo `buff` pasivo. |
| `neck` | Cuello | Solo `buff` pasivo. |
| `ring1` | Anillo I | Activable manual, no se consume; usa `cooldown` y `range`. |
| `ring2` | Anillo II | Activable manual, no se consume; usa `cooldown` y `range`. |
| `trinket1` | Trinket I | Activable manual, no se consume; usa `cooldown` y `range`. |
| `trinket2` | Trinket II | Activable manual, no se consume; usa `cooldown` y `range`. |

No uses `consumable` en equipo; está reservado para pociones.

### 3.4 Stats y afijos

`stats` admite entradas separadas por coma, punto y coma o salto de línea:

```json
"stats": "strength:+2, armor:+3, critChance:+5"
```

Representa exactamente lo mismo en `affixes`:

```json
"affixes": [
  { "key": "strength", "label": "Fuerza", "value": 2, "percent": false },
  { "key": "armor", "label": "Armadura", "value": 3, "percent": false },
  { "key": "critChance", "label": "Crítico", "value": 5, "percent": true }
]
```

Claves disponibles:

| `key` | Efecto |
|---|---|
| `strength` | Aumenta Fuerza y la potencia asociada al daño físico. |
| `vitality` | Aumenta Vitalidad, vida y resistencia derivada. |
| `agility` | Aumenta Agilidad, evasión, crítico y movilidad derivada. |
| `luck` | Aumenta Suerte, crítico, botín y resultados de eventos asociados. |
| `intelligence` | Aumenta Inteligencia, potencia mágica y maná derivado. |
| `wisdom` | Aumenta Sabiduría, regeneración y defensa mágica derivada. |
| `damage` | Aumenta el daño base. |
| `armor` | Aumenta la armadura. |
| `maxHp` | Aumenta la vida máxima. |
| `maxStamina` | Aumenta la stamina máxima. |
| `maxMana` | Aumenta el maná máximo. |
| `critChance` | Añade probabilidad de crítico. Usa `percent:true`. |
| `dodge` | Añade evasión. Usa `percent:true`. |
| `blockChance` | Añade probabilidad de bloqueo. Usa `percent:true`. |
| `staminaRegen` | Añade regeneración de stamina cuando exista una recuperación aplicable. |
| `manaRegen` | Añade regeneración de maná cuando exista una recuperación aplicable. |

Cada afijo requiere `key`, `label`, `value` numérico y `percent` booleano. Mantén `stats` y `affixes` sincronizados.

### 3.5 Armas

Añade estos campos si `slot` es `weapon`:

```json
{
  "damageDice": "1d8",
  "weaponType": "Espadas",
  "rangeMin": 1,
  "rangeMax": 1,
  "procChance": 25
}
```

Dados disponibles: `1d4`, `1d6`, `1d6+1`, `1d8`, `1d8+1`, `1d10`, `1d12`, `2d6`, `2d8`.

Tipos disponibles: `Espadas`, `Dagas`, `Sables`, `Hachas`, `Mazas`, `Martillos`, `Lanzas`, `Bastones`, `Varitas`, `Arcos`, `Ballestas`, `Pistolas`, `Rifles`, `Escopetas`, `Armas pesadas`, `Guanteletes`, `Látigos`, `Drones`, `Granadas`, `Artefactos`.

Alcances recomendados:

| Tipo | `rangeMin` | `rangeMax` |
|---|---:|---:|
| Varitas | 1 | 4 |
| Arcos | 2 | 5 |
| Ballestas | 1 | 4 |
| Pistolas | 1 | 3 |
| Rifles | 2 | 5 |
| Escopetas | 1 | 2 |
| Resto | 1 | 1 |

- `damageDice` controla los dados del ataque normal.
- `rangeMin` es la distancia mínima válida.
- `rangeMax` es la distancia máxima válida.
- Las armas a distancia requieren línea de visión.
- `procChance` es un entero de 0 a 100: porcentaje de posibilidad por golpe conectado de activar toda la pila `effects`.
- Puedes añadir `weaponCategory`, `weaponIconRow`, `weaponIconCol`, `weaponIconPath` y `defenseStat` si necesitas fijar manualmente esos datos visuales o de categoría; normalmente basta con `weaponType`.

### 3.6 Anillos y trinkets activables

Añade:

```json
{
  "cooldown": 6,
  "range": 5,
  "effects": [
    { "kind": "heal", "target": "self", "dmgDice": 3, "dmgDie": 8 }
  ]
}
```

- `cooldown`: turnos antes de volver a utilizarlo; mínimo 1.
- `range`: alcance para elegir enemigo, aliado o área; se ignora si todo afecta al propio personaje.
- El item sigue equipado y no se consume.

### 3.7 Pasiva antigua opcional

```json
"passives": [
  { "stat": "armor", "name": "Piel férrea", "desc": "Aumenta armadura.", "value": 2, "percent": false }
]
```

No uses objetos `{ "name": ..., "desc": ... }` dentro de `effects`: `effects` exige componentes con `kind`.

## 4. Pociones

### 4.1 Plantilla completa

```json
{
  "type": "potion",
  "name": "Poción de cura",
  "slot": "consumable",
  "rarity": "rare",
  "label": "Raro",
  "itemLevel": 3,
  "score": 24,
  "icon": "",
  "iconShape": "vial",
  "hidden": false,
  "range": 5,
  "effects": [
    { "kind": "heal", "target": "self", "dmgDice": 3, "dmgDie": 8, "dmgStat": "wisdom", "dmgStatMode": "add", "dmgStatCoef": 1 }
  ],
  "skillIds": [],
  "stats": "",
  "affixes": [],
  "passives": [],
  "desc": "Cura vida al beberla."
}
```

Reglas:

- `type` debe ser `potion` y `slot` debe ser `consumable`.
- `iconShape` debe ser `vial`; `icon` vacío utiliza el vial predeterminado.
- Una poción sin componentes en `effects` no produce ningún efecto.
- Al usarse correctamente consume una unidad.
- `range` es la distancia de lanzamiento, no el radio de un AOE.
- No uses los campos antiguos `potionEffectType`, `effect`, `duration` ni un `kind` en el nivel superior.

### 4.2 Beber o lanzar

El objetivo de los componentes decide el uso:

1. Si algún componente tiene `target:"enemy"`, se debe seleccionar un enemigo.
2. Si no, pero alguno tiene `target:"area"`, se debe seleccionar una casilla.
3. Si no, pero alguno tiene `target:"ally"`, se debe seleccionar un aliado.
4. Si todos son propios o no requieren objetivo, se bebe y se aplica inmediatamente.

## 5. Reglas compartidas de `effects`

`effects` es una lista ordenada de componentes independientes. Todos los componentes se intentan aplicar en el mismo uso. Los componentes `move` se resuelven primero aunque aparezcan después en el array.

### 5.1 Objetivos

| `target` | Efecto |
|---|---|
| `self` | El propio personaje. |
| `enemy` | El enemigo seleccionado. |
| `area` | Entidades dentro del radio `range` alrededor de la casilla elegida. |
| `ally` | Un aliado seleccionado; especialmente relevante en multijugador. |

Prioridad de selección de toda la pila: `enemy` → `area` → `ally` → aplicación inmediata.

### 5.2 Bloque de dados

Muchos componentes usan:

```json
{
  "dmgDice": 2,
  "dmgDie": 6,
  "dmgStat": "strength",
  "dmgStatMode": "add",
  "dmgStatCoef": 1
}
```

Para DOT cambia el prefijo `dmg` por `dot`.

- `dmgDice`/`dotDice`: cantidad de dados; entero ≥ 0.
- `dmgDie`/`dotDie`: caras, una de `4`, `6`, `8`, `10`, `12`, `20`.
- `dmgStat`/`dotStat`: stat que escala el resultado; `""` usa el cálculo automático disponible.
- `dmgStatMode`/`dotStatMode`: `add` suma `stat × coeficiente`; `mult` multiplica el resultado usando stat y coeficiente.
- `dmgStatCoef`/`dotStatCoef`: número decimal de escalado.

## 6. Todos los tipos de efecto

### 6.1 `dmg` — daño directo

```json
{ "kind": "dmg", "target": "enemy", "dmgDice": 2, "dmgDie": 6, "dmgStat": "strength", "dmgStatMode": "add", "dmgStatCoef": 1, "multiplier": 1 }
```

Objetivos: `enemy`, `area`, `self`. `self` daña directamente al usuario. `area` usa `range` (2 por defecto) y normalmente aplica potencia 0.85. `multiplier` sustituye el multiplicador normal.

### 6.2 `dot` — daño periódico

```json
{ "kind": "dot", "target": "enemy", "dotDice": 1, "dotDie": 6, "dotStat": "intelligence", "dotStatMode": "add", "dotStatCoef": 0.5, "turns": 4, "flavor": "burn", "range": 2 }
```

Objetivos: `enemy`, `area`. `turns` fija la duración. `flavor` puede ser `dot`, `bleed`, `burn` o `poison`; cambia la etiqueta/identidad del estado, no la fórmula básica.

### 6.3 `buff` — mejora

```json
{ "kind": "buff", "target": "self", "stat": "strength", "mode": "add", "value": 5, "turns": 6 }
```

Stats: las seis principales y `armor`, `damage`, `ap`, `dodge`, `critChance`, `blockChance`, `manaRegen`, `staminaRegen`. `add` suma valor plano; `mult` usa multiplicador bruto (`1.2` equivale a +20%). En dodge/crítico/bloqueo, `value` son puntos porcentuales y conviene usar `add`.

### 6.4 `debuff` — debilitación

```json
{ "kind": "debuff", "target": "enemy", "stat": "damage", "mode": "add", "value": 2, "turns": 3, "range": 2 }
```

Objetivos: `enemy`, `area`. Stats útiles: principales, `damage` y `ap`. `ap` en modo `add` interpreta `value` como porcentaje de PA reducido. Omitir `stat` aplica debilitación genérica.

### 6.5 `heal` — curación instantánea

```json
{ "kind": "heal", "target": "self", "dmgDice": 2, "dmgDie": 8, "dmgStat": "wisdom", "dmgStatMode": "add", "dmgStatCoef": 1, "range": 2 }
```

Objetivos: `self`, `ally`, `area`. Cura vida; sobre el propio personaje también puede restaurar el recurso asociado. `area` cura al usuario y aliados dentro del radio.

### 6.6 `move` — desplazamiento

```json
{ "kind": "move", "mode": "dash", "range": 3, "multiplier": 1 }
```

`mode` puede ser `dash` o `teleport`. Dash avanza hacia el objetivo y ataca. Teleport mueve a la casilla elegida o a una casilla libre junto al enemigo. Siempre ocurre antes que los demás componentes.

### 6.7 `cc` — control

```json
{ "kind": "cc", "target": "enemy", "type": "stun", "turns": 2, "range": 2 }
```

Objetivos: `enemy`, `area`. `type`: `stun`, `freeze`, `silence`, `root`. Aplica el control durante `turns` y puede producir un impacto menor.

### 6.8 `drain` — drenaje

```json
{ "kind": "drain", "target": "enemy", "dmgDice": 2, "dmgDie": 6, "dmgStat": "intelligence", "dmgStatMode": "add", "dmgStatCoef": 1 }
```

Objetivos: `enemy`, `area`. Daña al objetivo y cura/restaura recurso al usuario. Los dados configuran principalmente la recuperación obtenida.

### 6.9 `aoe` — daño de área

```json
{ "kind": "aoe", "dmgDice": 2, "dmgDie": 8, "dmgStat": "intelligence", "dmgStatMode": "add", "dmgStatCoef": 1, "range": 2, "multiplier": 0.85 }
```

No usa `target`. Golpea a los enemigos con línea de visión dentro del radio `range` alrededor de la casilla de lanzamiento.

### 6.10 `multihit` — impactos múltiples

```json
{ "kind": "multihit", "hits": 3, "dmgDice": 1, "dmgDie": 6, "dmgStat": "strength", "dmgStatMode": "add", "dmgStatCoef": 0.6, "multiplier": 0.6 }
```

Golpea al mismo enemigo `hits` veces. Cada impacto resuelve daño, defensa y crítico de forma independiente.

### 6.11 `mark` — marca amplificadora

```json
{ "kind": "mark", "target": "enemy", "value": 25, "turns": 4, "range": 2 }
```

Objetivos: `enemy`, `area`. El objetivo recibe `value` por ciento de daño adicional de todas las fuentes durante `turns`. Reaplicar refresca o conserva el valor/duración mayor.

### 6.12 `summon` — aliado móvil

```json
{
  "kind": "summon", "hp": 20, "turns": 8, "ap": 10,
  "effectType": "damage", "range": 0,
  "dmgDice": 1, "dmgDie": 6, "dmgStat": "", "dmgStatMode": "add", "dmgStatCoef": 1,
  "effectTurns": 2, "iconImage": "", "targetable": true, "hitByAoe": true,
  "stance": "aggressive", "permanent": false
}
```

- `hp`: vida máxima.
- `turns`: duración; se ignora si `permanent:true`.
- `ap`: cada 10 concede aproximadamente una acción por turno.
- `effectType`: `damage`, `skill`, `heal`, `root`, `buff`, `debuff`.
- `range`: 0 es cuerpo a cuerpo; un valor positivo permite actuar a distancia.
- Para `skill`, añade `skillName` y `skillEffects`; estos últimos pueden contener `dmg`, `dot`, `debuff`, `cc`, `drain`, `mark`, `buff` o `heal`.
- Para `buff`/`debuff`, añade `stat`, `mode`, `value`; `effectTurns` controla root/debuff.
- `iconImage`: PNG 50×50 hexadecimal.
- `targetable:false`: no puede ser elegido como objetivo directo.
- `hitByAoe:false`: inmune a ataques enemigos considerados AOE.
- `stance`: `aggressive` combate; `passive` solo sigue al jugador.
- `permanent:true`: compañero persistente que no expira. Solo existe uno por fuente. Al morir penaliza las stats principales hasta revivir.
- Para permanente: `reviveResource` puede ser `hp`, `stamina` o `mana`; `reviveAmount` determina el coste y revive con parte de su vida.

### 6.13 `summonturret` — torreta estacionaria

```json
{ "kind": "summonturret", "hp": 16, "turns": 8, "ap": 10, "effectType": "damage", "range": 7, "damageMode": "nearest", "dmgDice": 1, "dmgDie": 6, "iconImage": "" }
```

No se mueve. Comparte los seis `effectType` y campos asociados de `summon`. `damageMode` puede ser `nearest` o `area`; solo se usa con `effectType:"damage"`. No admite compañero permanente.

### 6.14 `clones` — varios aliados

```json
{ "kind": "clones", "count": 2, "hp": 14, "turns": 8, "ap": 10, "effectType": "damage", "range": 0, "dmgDice": 1, "dmgDie": 6, "iconImage": "" }
```

`count` admite 1–4. Cada clon se comporta como una invocación temporal independiente y comparte sus `effectType` y campos. No admite modo permanente.

### 6.15 `utility` — utilidad propia

```json
{ "kind": "utility", "mode": "reveal", "value": 10, "resource": "stamina" }
```

- `reveal`: revela mapa en radio `value`.
- `stealth`: omite la siguiente respuesta enemiga.
- `shield`: suma `value` de armadura temporal que decae por turno; no absorbe como vida extra.
- `resource`: restaura `value` del `resource` indicado (`stamina` o `mana`).

### 6.16 `hot` — curación periódica

```json
{ "kind": "hot", "target": "self", "dmgDice": 1, "dmgDie": 6, "dmgStat": "wisdom", "dmgStatMode": "add", "dmgStatCoef": 0.5, "turns": 4, "range": 2 }
```

Objetivos: `self`, `area`. Cura cada turno durante `turns`. Las aplicaciones se apilan. En área afecta también a aliados dentro del radio; en multijugador la curación de otro jugador puede entregarse de forma adelantada en vez de por ticks.

### 6.17 `execute` — ejecución

```json
{ "kind": "execute", "target": "enemy", "dmgDice": 2, "dmgDie": 6, "dmgStat": "strength", "dmgStatMode": "add", "dmgStatCoef": 1, "threshold": 35, "execMultiplier": 2.5 }
```

Objetivos: `enemy`, `area`. Hace un golpe normal; si el objetivo está por debajo de `threshold` por ciento de vida, usa `execMultiplier`.

### 6.18 `pullroot` — atraer y enraizar

```json
{ "kind": "pullroot", "target": "enemy", "turns": 2, "multiplier": 0.8, "range": 2 }
```

Objetivos: `enemy`, `area`. Inflige un impacto menor, atrae una casilla si está libre y aplica root durante `turns`.

### 6.19 `counter` — contraataque

```json
{ "kind": "counter", "shield": 10, "dmgDice": 1, "dmgDie": 8, "turns": 5 }
```

Concede armadura `shield` y prepara una respuesta al próximo daño recibido. El contraataque usa los dados y se consume al activarse. Los campos de escalado por stat no aumentan este contraataque.

### 6.20 `cheatdeath` — desafiar la muerte

```json
{ "kind": "cheatdeath", "turns": 5 }
```

El próximo golpe mortal deja al usuario con 1 HP y consume la carga. La carga permanece armada; `turns` no funciona como una cuenta atrás normal.

### 6.21 `holyshield` — escudo de absorción

```json
{ "kind": "holyshield", "target": "self", "value": 20, "stat": "wisdom", "mode": "add", "statCoef": 1, "turns": 0 }
```

Absorbe daño antes de la vida. `stat` puede ser una stat principal o `""`. `add` suma `stat × statCoef`; `mult` amplifica `value` usando stat y coeficiente. `turns:0` dura hasta romperse; un valor positivo también lo hace caducar. Nuevos escudos se suman.

### 6.22 `lineshot` — disparo perforante

```json
{ "kind": "lineshot", "dmgDice": 2, "dmgDie": 6, "dmgStat": "agility", "dmgStatMode": "add", "dmgStatCoef": 1, "range": 6, "multiplier": 0.8 }
```

Dispara una línea hasta `range`, se detiene ante pared y golpea a todos los enemigos atravesados.

### 6.23 `trap` — trampa

```json
{ "kind": "trap", "turns": 8, "range": 1 }
```

Coloca una trampa invisible. Se activa cuando un enemigo entra en `range`, golpea a los enemigos cercanos y desaparece; si no, caduca tras `turns`. Los campos de dados/stat admitidos por editores no modifican actualmente el daño real, por lo que es preferible omitirlos.

### 6.24 `linkdamage` — daño en cadena

```json
{ "kind": "linkdamage", "dmgDice": 2, "dmgDie": 6, "dmgStat": "intelligence", "dmgStatMode": "add", "dmgStatCoef": 1, "jumps": 3, "falloff": 25, "range": 4 }
```

Golpea al primer enemigo y salta hasta `jumps` veces a enemigos nuevos dentro de `range`. `falloff` es el porcentaje acumulativo perdido por salto, de 0 a 95.

### 6.25 `invisible` — invisibilidad

```json
{ "kind": "invisible", "turns": 2, "breakOnAttack": true }
```

Durante `turns`, los enemigos omiten su turno. Si `breakOnAttack` es `true`, atacar o usar una habilidad ofensiva termina el efecto.

### 6.26 `ascend` — ascensión

```json
{ "kind": "ascend", "resource": "any", "value": 150, "turns": 6, "allowSkills": true, "iconImage": "" }
```

Cambia el coste de habilidades al `value` por ciento de su coste normal. `resource`: `any`, `mana`, `stamina`. No cambia cooldown ni PA. `allowSkills:false` bloquea otras habilidades. `iconImage` puede sustituir temporalmente el aspecto del personaje.

### 6.27 `transform` — transformación

```json
{ "kind": "transform", "turns": 8, "damagePct": 20, "armorPct": 10, "hpPct": 25, "allowSkills": true, "iconImage": "" }
```

Modifica daño, armadura y vida máxima por porcentaje durante `turns`; admite porcentajes negativos. `hpPct` se calcula con la vida máxima al activarse. `allowSkills:false` impide usar otras habilidades. `iconImage` sustituye temporalmente el icono y tiene prioridad sobre el de ascensión.

## 7. Ejemplos completos

### Arma con proc de quemadura

```json
{
  "type": "equipment",
  "name": "Espada de la fragua",
  "slot": "weapon",
  "rarity": "epic",
  "label": "Épico",
  "itemLevel": 4,
  "score": 32,
  "icon": "",
  "hidden": false,
  "damageDice": "1d10",
  "weaponType": "Espadas",
  "rangeMin": 1,
  "rangeMax": 1,
  "procChance": 25,
  "stats": "strength:+4, damage:+3",
  "affixes": [
    { "key": "strength", "label": "Fuerza", "value": 4, "percent": false },
    { "key": "damage", "label": "Daño", "value": 3, "percent": false }
  ],
  "effects": [
    { "kind": "dot", "target": "enemy", "dotDice": 1, "dotDie": 6, "dotStat": "strength", "dotStatMode": "add", "dotStatCoef": 0.5, "turns": 4, "flavor": "burn" }
  ],
  "skillIds": [],
  "passives": [],
  "desc": "25% de posibilidad por golpe de aplicar quemadura durante 4 turnos."
}
```

### Anillo activable de curación y escudo

```json
{
  "type": "equipment",
  "name": "Anillo del custodio",
  "slot": "ring1",
  "rarity": "legendary",
  "label": "Legendario",
  "itemLevel": 5,
  "score": 40,
  "icon": "",
  "hidden": false,
  "stats": "wisdom:+5",
  "affixes": [
    { "key": "wisdom", "label": "Sabiduría", "value": 5, "percent": false }
  ],
  "cooldown": 6,
  "range": 5,
  "effects": [
    { "kind": "heal", "target": "self", "dmgDice": 3, "dmgDie": 8, "dmgStat": "wisdom", "dmgStatMode": "add", "dmgStatCoef": 1 },
    { "kind": "holyshield", "target": "self", "value": 15, "stat": "wisdom", "mode": "add", "statCoef": 0.5, "turns": 4 }
  ],
  "skillIds": [],
  "passives": [],
  "desc": "Activable: cura y concede un escudo de absorción. Enfriamiento 6 turnos."
}
```

### Bomba arrojadiza de área

```json
{
  "type": "potion",
  "name": "Bomba incendiaria",
  "slot": "consumable",
  "rarity": "rare",
  "label": "Raro",
  "itemLevel": 3,
  "score": 24,
  "icon": "",
  "iconShape": "vial",
  "hidden": false,
  "range": 5,
  "effects": [
    { "kind": "aoe", "dmgDice": 2, "dmgDie": 8, "dmgStat": "intelligence", "dmgStatMode": "add", "dmgStatCoef": 1, "range": 2 },
    { "kind": "dot", "target": "area", "dotDice": 1, "dotDie": 6, "dotStat": "intelligence", "dotStatMode": "add", "dotStatCoef": 0.4, "turns": 4, "flavor": "burn", "range": 2 }
  ],
  "skillIds": [],
  "stats": "",
  "affixes": [],
  "passives": [],
  "desc": "Se lanza hasta 5 casillas; explota en radio 2 y aplica quemadura."
}
```

## 8. Lista final antes de guardar

- [ ] El JSON tiene sintaxis válida y no contiene comentarios.
- [ ] `type` es `equipment` o `potion`.
- [ ] El slot corresponde al tipo.
- [ ] `rarity`, `label`, `itemLevel` y `score` pertenecen a la misma fila de §2.
- [ ] `stats` y `affixes` representan los mismos atributos.
- [ ] `effects`, `affixes`, `skillIds` y `passives` son arrays.
- [ ] Cada componente tiene un `kind` válido y solamente los campos apropiados.
- [ ] Los objetivos hacen que el item se beba, lance, active o procese como se desea.
- [ ] `range` exterior y radio de componentes no están confundidos.
- [ ] Un arma define dados, tipo, alcance y `procChance` si tiene efectos.
- [ ] Un anillo/trinket con efectos define `cooldown` y `range`.
- [ ] Un item pasivo usa únicamente componentes `buff`.
- [ ] Una poción contiene al menos un efecto útil.
- [ ] La descripción explica el resultado real y no pretende crear mecánicas adicionales.
