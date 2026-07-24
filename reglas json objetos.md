# Reglas JSON objetos

Este documento define cómo generar JSON de objetos para el configurador de items. Puedes importar un objeto individual o un array de objetos.

## Reglas generales

- Usa `type: "equipment"` para equipo y `type: "potion"` para pociones.
- El campo visible de progresión es `rarity` / **Tier**. No edites iLvl desde el formulario; si incluyes `itemLevel`, mantenlo alineado con el Tier.
- `name`, `slot`, `rarity`, `label`, `itemLevel`, `score` e `icon` son los campos comunes más importantes.
- `icon` debe contener el PNG en hexadecimal si quieres icono personalizado; si está vacío el motor dibuja un icono base.

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

## Habilidades en objetos

- `skillIds` es un array de IDs de skill.
- Al equipar el objeto, el motor intenta aprender esas skills.
- Usa IDs de la lista incluida en **reglas json pociones.md**.

## Pasivas y efectos legendarios

Puedes dejar `passives` y `effects` vacíos. Si los usas, la estructura habitual es:

```json
{
  "passives": [
    { "stat": "armor", "name": "Piel férrea", "desc": "Aumenta armadura.", "value": 2, "percent": false }
  ],
  "effects": [
    { "name": "Chispa", "desc": "Efecto especial descriptivo." }
  ]
}
```

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
    "potionEffectType": "heal",
    "kind": "instant",
    "duration": 0,
    "effect": { "hpFlat": 20 },
    "potionEffect": { "hpFlat": 20 }
  }
]
```

## Relación con pociones

Para reglas exhaustivas de efectos de poción, usa **reglas json pociones.md**.
