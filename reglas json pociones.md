# Reglas JSON pociones

Este documento define cómo generar JSON válido para items de tipo `Poción` en el configurador y para importarlos mediante el botón **IMPORTAR JSON**. Cada JSON puede ser un único objeto o un array de objetos.

Las pociones usan **exactamente la misma pila de efectos apilables (`effects[]`)** que las skills de clase — mismos tipos (`kind`), mismos campos, mismo comportamiento. Antes de escribir una poción, lee `skills-json-rules.md` (§3 y §4): ese documento es la referencia completa de cada `kind` disponible (`dmg`, `dot`, `buff`, `debuff`, `heal`, `cc`, `drain`, `aoe`, `multihit`, `mark`, `summon`, `summonturret`, `utility`, `hot`, `execute`, `pullroot`, `counter`, `cheatdeath`, `holyshield`, `lineshot`, `trap`, `clones`, `linkdamage`, `invisible`, `ascend`, `transform`). Aquí solo se documenta el sobre (envelope) específico de una poción.

## Reglas generales

- `type` debe ser siempre `"potion"`.
- `slot` debe ser siempre `"consumable"`.
- `rarity` actúa como **Tier** y sustituye al uso manual de iLvl. El motor deriva el `itemLevel` interno desde el Tier.
- Si no incluyes `icon`, el juego dibuja el vial base con `iconShape: "vial"`.
- `effects`: array de componentes apilables, misma sintaxis que el `effects[]` de una skill (ver `skills-json-rules.md`). Una poción sin `effects` no hace nada al usarla.
- `range`: alcance en casillas para lanzar la poción. Solo se usa si `effects` incluye algún componente dirigido a `"enemy"`, `"area"` o `"ally"` (ver "Beber vs. lanzar" abajo); se ignora si todos los componentes son sobre uno mismo. Por defecto `5` si se omite.

## Beber vs. lanzar (arma arrojadiza de un solo uso)

El comportamiento se deriva automáticamente de los `target` de los componentes en `effects` (misma regla que decide el modo de objetivo de una skill, §3.3 de `skills-json-rules.md`):

- Si **algún** componente tiene `"target":"enemy"` → la poción exige seleccionar un enemigo al usarla (arma arrojadiza).
- Si no, pero **algún** componente tiene `"target":"area"` → exige seleccionar una casilla/área.
- Si no, pero **algún** componente tiene `"target":"ally"` → exige seleccionar un aliado (multijugador).
- Si ningún componente pide objetivo (todos `"self"`, o kinds sin `target` como `buff`/`hot` en self/`utility`/`cheatdeath`/`counter`/`holyshield`) → se aplica al instante al pulsarla en el inventario, sin selección de objetivo, igual que siempre.

Una poción es de un solo uso: al usarse con éxito se descuenta 1 de `quantity` (o se elimina del inventario si era la última).

## Plantilla base

```json
{
  "type": "potion",
  "name": "Poción sin nombre",
  "slot": "consumable",
  "rarity": "common",
  "label": "Común",
  "itemLevel": 1,
  "score": 8,
  "icon": "",
  "iconShape": "vial",
  "range": 5,
  "effects": [],
  "desc": "Descripción visible del efecto"
}
```

## Tiers permitidos

| Tier JSON | Nombre visible | Nivel interno recomendado |
|---|---|---:|
| `common` | Común | 1 |
| `uncommon` | Infrecuente | 2 |
| `rare` | Raro | 3 |
| `epic` | Épico | 4 |
| `legendary` | Legendario | 5 |
| `artifact` | Artefacto | 6 |

## Ejemplos

### Poción de curación (bebida, instantánea)

```json
{
  "type": "potion",
  "name": "Poción de cura mayor",
  "slot": "consumable",
  "rarity": "rare",
  "label": "Raro",
  "itemLevel": 3,
  "score": 24,
  "iconShape": "vial",
  "effects": [
    { "kind": "heal", "target": "self", "dmgDice": 4, "dmgDie": 10, "dmgStat": "vitality", "dmgStatMode": "add", "dmgStatCoef": 1.5 }
  ],
  "desc": "Cura una gran cantidad de vida."
}
```

### Elixir de fuerza (bebido, buff temporal)

```json
{
  "type": "potion",
  "name": "Elixir de fuerza breve",
  "slot": "consumable",
  "rarity": "rare",
  "label": "Raro",
  "itemLevel": 3,
  "score": 24,
  "iconShape": "vial",
  "effects": [
    { "kind": "buff", "target": "self", "stat": "strength", "mode": "add", "value": 3, "turns": 8 }
  ],
  "desc": "+3 Fuerza durante 8 turnos."
}
```

### Bomba incendiaria (arma arrojadiza: daño en área + quemadura)

```json
{
  "type": "potion",
  "name": "Bomba incendiaria",
  "slot": "consumable",
  "rarity": "rare",
  "label": "Raro",
  "itemLevel": 3,
  "score": 24,
  "iconShape": "vial",
  "range": 5,
  "effects": [
    { "kind": "aoe", "dmgDice": 2, "dmgDie": 8, "dmgStat": "intelligence", "dmgStatMode": "add", "dmgStatCoef": 1, "range": 2 },
    { "kind": "dot", "target": "area", "dotDice": 1, "dotDie": 6, "dotStat": "intelligence", "dotStatMode": "add", "dotStatCoef": .4, "turns": 4, "flavor": "burn", "range": 2 }
  ],
  "desc": "Arma arrojadiza: explota en área y quema."
}
```

### Vial debilitante (arma arrojadiza: debuff a un enemigo)

```json
{
  "type": "potion",
  "name": "Vial debilitante",
  "slot": "consumable",
  "rarity": "uncommon",
  "label": "Infrecuente",
  "itemLevel": 2,
  "score": 16,
  "iconShape": "vial",
  "range": 5,
  "effects": [
    { "kind": "debuff", "target": "enemy", "stat": "damage", "mode": "add", "value": 3, "turns": 4 }
  ],
  "desc": "Arma arrojadiza: debilita al enemigo."
}
```

## JSON con varias pociones

```json
[
  {
    "type": "potion",
    "name": "Tónico del corredor",
    "slot": "consumable",
    "rarity": "uncommon",
    "label": "Infrecuente",
    "itemLevel": 2,
    "score": 16,
    "iconShape": "vial",
    "effects": [
      { "kind": "utility", "mode": "resource", "resource": "stamina", "value": 35 }
    ],
    "desc": "Restaura stamina."
  },
  {
    "type": "potion",
    "name": "Vial invisible",
    "slot": "consumable",
    "rarity": "epic",
    "label": "Épico",
    "itemLevel": 4,
    "score": 32,
    "iconShape": "vial",
    "effects": [
      { "kind": "invisible", "turns": 4, "breakOnAttack": true }
    ],
    "desc": "Los enemigos ignoran tu turno durante 4 turnos."
  }
]
```

## Notas de migración

Las pociones creadas con el sistema antiguo (`potionEffectType`/`effect`/`kind`/`duration`) **ya no funcionan**: el motor solo entiende `effects[]`. Hay que reconfigurarlas a mano una a una desde el editor (pestaña Items → tipo Poción → acordeón "Efectos apilables"), igual que se editan los efectos de una skill. Dos capacidades del sistema antiguo no tienen equivalente directo en `effects[]` y quedan fuera por ahora: **aprender una habilidad** al beber la poción, y una **invulnerabilidad** literal (el equivalente más cercano es un `holyshield` grande, o un `buff` de armadura).
