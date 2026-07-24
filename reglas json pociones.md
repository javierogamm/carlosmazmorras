# Reglas JSON pociones

Este documento define cómo generar JSON válido para items de tipo `Poción` en el configurador y para importarlos mediante el botón **IMPORTAR JSON**. Cada JSON puede ser un único objeto o un array de objetos.

## Reglas generales

- `type` debe ser siempre `"potion"`.
- `slot` debe ser siempre `"consumable"`.
- Los efectos son excluyentes: usa un único valor en `potionEffectType` por poción.
- `rarity` actúa como **Tier** y sustituye al uso manual de iLvl. El motor deriva el `itemLevel` interno desde el Tier.
- Si no incluyes `icon`, el juego dibuja el vial base con `iconShape: "vial"`.
- Para efectos temporales, `duration` es obligatorio y representa número de turnos.
- Mantén `effect` y `potionEffect` iguales si quieres máxima compatibilidad con versiones anteriores.

## Tiers permitidos

| Tier JSON | Nombre visible | Nivel interno recomendado |
|---|---|---:|
| `common` | Común | 1 |
| `uncommon` | Infrecuente | 2 |
| `rare` | Raro | 3 |
| `epic` | Épico | 4 |
| `legendary` | Legendario | 5 |
| `artifact` | Artefacto | 6 |

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
  "potionEffectType": "heal",
  "kind": "instant",
  "duration": 0,
  "effect": {},
  "potionEffect": {},
  "skillIds": [],
  "affixes": [],
  "passives": [],
  "effects": [],
  "desc": "Descripción visible del efecto"
}
```

## Efectos permitidos

### 1. Curación de stat: `heal`

- `kind`: `"instant"`
- `duration`: `0`
- Recurso objetivo: `hp`, `mana` o `stamina`.
- Valor en porcentaje: usa `hpPct`, `manaPct` o `staminaPct` con decimal entre `0` y `1`.
- Valor plano: usa `hpFlat`, `manaFlat` o `staminaFlat` con número entero.

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
  "potionEffectType": "heal",
  "kind": "instant",
  "duration": 0,
  "effect": { "hpPct": 0.50 },
  "potionEffect": { "hpPct": 0.50 },
  "desc": "Recupera 50% de HP."
}
```

### 2. Regeneración de stat: `regen`

- `kind`: `"temporary"`
- `duration`: número de turnos.
- Recurso objetivo y modo de valor igual que en `heal`.
- El valor se aplica cada turno mientras dure el efecto.

```json
{
  "type": "potion",
  "name": "Tónico de maná persistente",
  "slot": "consumable",
  "rarity": "uncommon",
  "label": "Infrecuente",
  "itemLevel": 2,
  "score": 16,
  "iconShape": "vial",
  "potionEffectType": "regen",
  "kind": "temporary",
  "duration": 5,
  "effect": { "manaFlat": 6 },
  "potionEffect": { "manaFlat": 6 },
  "desc": "Regenera 6 de maná por turno durante 5 turnos."
}
```

### 3. Incremento temporal de stat: `temporaryStats`

- `kind`: `"temporary"`
- `duration`: número de turnos.
- `effect.stats` contiene exactamente las stats que aumentan temporalmente. Recomendado: una sola stat por poción para mantener el efecto excluyente y claro.
- Stats válidas: `strength`, `vitality`, `agility`, `luck`, `intelligence`, `wisdom`.

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
  "potionEffectType": "temporaryStats",
  "kind": "temporary",
  "duration": 8,
  "effect": { "stats": { "strength": 3 } },
  "potionEffect": { "stats": { "strength": 3 } },
  "desc": "+3 Fuerza durante 8 turnos."
}
```

### 4. Incremento permanente de stat: `permanentStats`

- `kind`: `"permanent"`
- `duration`: `0`
- Stats válidas: `strength`, `vitality`, `agility`, `luck`, `intelligence`, `wisdom`, `maxHp`.

```json
{
  "type": "potion",
  "name": "Sangre de gigante refinada",
  "slot": "consumable",
  "rarity": "legendary",
  "label": "Legendario",
  "itemLevel": 5,
  "score": 40,
  "iconShape": "vial",
  "potionEffectType": "permanentStats",
  "kind": "permanent",
  "duration": 0,
  "effect": { "stats": { "strength": 2 } },
  "potionEffect": { "stats": { "strength": 2 } },
  "desc": "+2 Fuerza permanente."
}
```

### 5. Aprender habilidad: `learnSkill`

- `kind`: `"permanent"`
- `duration`: `0`
- `effect.skillId` debe existir en la lista de skills de este documento.

```json
{
  "type": "potion",
  "name": "Memoria embotellada de Fortificar",
  "slot": "consumable",
  "rarity": "epic",
  "label": "Épico",
  "itemLevel": 4,
  "score": 32,
  "iconShape": "vial",
  "potionEffectType": "learnSkill",
  "kind": "permanent",
  "duration": 0,
  "effect": { "skillId": "fortify" },
  "potionEffect": { "skillId": "fortify" },
  "desc": "Aprende Fortificar."
}
```

### 6. Teletransporte a sala segura: `teleportSafe`

- `kind`: `"instant"`
- `duration`: `0`
- `effect` puede ir vacío: el motor busca la sala segura más cercana.

```json
{
  "type": "potion",
  "name": "Frasco de refugio",
  "slot": "consumable",
  "rarity": "rare",
  "label": "Raro",
  "itemLevel": 3,
  "score": 24,
  "iconShape": "vial",
  "potionEffectType": "teleportSafe",
  "kind": "instant",
  "duration": 0,
  "effect": {},
  "potionEffect": {},
  "desc": "Te teletransporta a la sala segura más cercana."
}
```

### 7. Teletransporte a escalera de piso: `teleportStairs`

- `kind`: `"instant"`
- `duration`: `0`
- `effect` puede ir vacío: el motor mueve al personaje a las escaleras del piso actual.

### 8. Invulnerabilidad: `invulnerable`

- `kind`: `"temporary"`
- `duration`: número de turnos.
- `effect.invulnerable`: `true`.

### 9. Invisibilidad: `invisible`

- `kind`: `"temporary"`
- `duration`: número de turnos.
- `effect.invisible`: `true`.

## JSON con varias pociones

```json
[
  {
    "type": "potion",
    "name": "Ampolla de stamina",
    "slot": "consumable",
    "rarity": "common",
    "label": "Común",
    "itemLevel": 1,
    "score": 8,
    "iconShape": "vial",
    "potionEffectType": "heal",
    "kind": "instant",
    "duration": 0,
    "effect": { "staminaFlat": 20 },
    "potionEffect": { "staminaFlat": 20 }
  },
  {
    "type": "potion",
    "name": "Tinta invisible",
    "slot": "consumable",
    "rarity": "epic",
    "label": "Épico",
    "itemLevel": 4,
    "score": 32,
    "iconShape": "vial",
    "potionEffectType": "invisible",
    "kind": "temporary",
    "duration": 4,
    "effect": { "invisible": true },
    "potionEffect": { "invisible": true }
  }
]
```

## Lista de skills disponibles para `learnSkill`

| ID | Nombre | Rareza | Recurso | Tipo | Descripción |
|---|---|---|---|---|---|
| `bloodRush` | ♥ Acelerón Hemático | Infrecuente | mana | magic | Sacrifica vida para recuperar stamina. |
| `seer_t1_1` | ✦ Aguja Psíquica | Común | mana | magic | Ataque a distancia contra el enemigo visible más cercano. |
| `entropyMage_t3_2` | ✂ Agujero de Entropía | Épico | mana | magic | Inflige daño enorme a enemigos heridos. |
| `yunque_t1_3` | ➤ Ancla de Acero | Común | stamina | physical | Avanzas hacia un enemigo y golpeas al llegar. |
| `adminOverride` | § Anulación Administrativa | Legendario | mana | magic | Elimina enfriamientos y debilita a todos los enemigos. |
| `necromancer_t3_4` | ☄ Apagón de los Muertos | Épico | mana | magic | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `berserker_t3_1` | ★ Apocalipsis Rosa | Épico | stamina | physical | Ataque potente en un área amplia. |
| `boneArmor` | ♜ Armadura de Hueso | Raro | mana | magic | Aumenta mucho la armadura durante varios turnos. |
| `thief_t3_1` | ★ Atraco Temporal | Épico | stamina | physical | Ataque potente en un área amplia. |
| `berserker_t2_3` | ϟ Aullido de Guerra | Raro | stamina | physical | Realiza varios impactos contra enemigos visibles. |
| `paladin_t2_2` | ✚ Aura de Valor | Raro | mana | utility | Recupera vida y parte del recurso principal. |
| `engineer_t2_3` | ϟ Autómata de Guerra | Raro | mana | magic | Realiza varios impactos contra enemigos visibles. |
| `beastGuardian_t3_1` | ★ Avatar de la Bestia | Épico | stamina | physical | Ataque potente en un área amplia. |
| `druid_t3_1` | ★ Avatar del Chatarral | Épico | mana | magic | Ataque potente en un área amplia. |
| `shaman_t3_2` | ✂ Avatar del Rayo | Épico | mana | magic | Inflige daño enorme a enemigos heridos. |
| `cleric_t3_3` | Ψ Avatar del Templo | Épico | mana | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `mirrorWard` | ◇ Barrera Espejo | Infrecuente | mana | magic | Obtienes escudo y reflejas parte del siguiente golpe. |
| `cleric_t1_3` | ➤ Barrera Piadosa | Común | mana | magic | Avanzas hacia un enemigo y golpeas al llegar. |
| `paladin_t3_3` | Ψ Bastión Sagrado | Épico | mana | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `bountyHunter_t2_3` | ϟ Blindaje Mercenario | Raro | stamina | physical | Realiza varios impactos contra enemigos visibles. |
| `dimensionalPocket` | ▧ Bolsillo Dimensional | Legendario | mana | utility | Abre automáticamente varios cofres explorados sin desplazarte. |
| `thief_t2_2` | ✚ Bomba de Sombra | Raro | mana | utility | Recupera vida y parte del recurso principal. |
| `druid_t2_3` | ϟ Bosque Improvisado | Raro | mana | magic | Realiza varios impactos contra enemigos visibles. |
| `jester_t1_2` | ▣ Broma Cruel | Común | mana | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `druid_t1_4` | ☠ Brote Curativo | Común | mana | magic | Daña y reduce temporalmente el daño del objetivo. |
| `chronoLoop` | ∞ Bucle Cronológico | Legendario | mana | magic | Restablece parcialmente vida y recursos al estado anterior. |
| `monk_t2_2` | ✚ Bucle Defensivo | Raro | stamina | utility | Recupera vida y parte del recurso principal. |
| `shaman_t2_1` | ✹ Cadena de Relámpagos | Raro | mana | magic | Golpea a varios enemigos cercanos. |
| `yunque_t2_3` | ϟ Cadena Demoledora | Raro | stamina | physical | Realiza varios impactos contra enemigos visibles. |
| `jester_t2_4` | ◐ Cambio de Papeles | Raro | mana | utility | Revela terreno y mejora temporalmente tu posición. |
| `entropyMage_t2_4` | ◐ Campo de Decadencia | Raro | mana | utility | Revela terreno y mejora temporalmente tu posición. |
| `engineer_t2_2` | ✚ Campo Magnético | Raro | mana | utility | Recupera vida y parte del recurso principal. |
| `sniper_t2_4` | ◐ Camuflaje Rúnico | Raro | stamina | utility | Revela terreno y mejora temporalmente tu posición. |
| `cleric_t1_4` | ☠ Cántico Breve | Común | mana | magic | Daña y reduce temporalmente el daño del objetivo. |
| `engineer_t3_2` | ✂ Cañón de Singularidad | Épico | mana | magic | Inflige daño enorme a enemigos heridos. |
| `jester_t3_4` | ☄ Caos de Camerino | Épico | mana | magic | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `yunque_t2_1` | ✹ Carga del Coloso | Raro | stamina | physical | Golpea a varios enemigos cercanos. |
| `berserker_t3_4` | ☄ Carnicería de Neón | Épico | stamina | physical | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `jester_t1_1` | ✦ Carta Cortante | Común | mana | magic | Ataque a distancia contra el enemigo visible más cercano. |
| `yunque_t3_4` | ☄ Cataclismo del Bastión | Épico | stamina | physical | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `beastGuardian_t3_2` | ✂ Caza Salvaje | Épico | stamina | physical | Inflige daño enorme a enemigos heridos. |
| `bountyHunter_t3_1` | ★ Caza Total | Épico | stamina | physical | Ataque potente en un área amplia. |
| `chainSpark` | ϟ Chispa Encadenada | Raro | mana | magic | Salta entre varios enemigos visibles. |
| `shaman_t1_1` | ✦ Chispa Espiritual | Común | mana | magic | Ataque a distancia contra el enemigo visible más cercano. |
| `shaman_t3_4` | ☄ Cielo Quebrado | Épico | mana | magic | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `holyCircuit` | ✥ Circuito Consagrado | Épico | mana | magic | Cura y daña a no muertos visibles. |
| `yunque_t3_1` | ★ Ciudadela Ambulante | Épico | stamina | physical | Ataque potente en un área amplia. |
| `execute` | ✂ Cláusula de demolición | Raro | stamina | physical | Gran daño contra enemigos con poca vida. |
| `bountyHunter_t2_4` | ◐ Cobro Anticipado | Raro | stamina | utility | Revela terreno y mejora temporalmente tu posición. |
| `engineer_t2_4` | ◐ Cóctel Transmutador | Raro | mana | utility | Revela terreno y mejora temporalmente tu posición. |
| `entropyMage_t2_2` | ✚ Colapso Local | Raro | mana | utility | Recupera vida y parte del recurso principal. |
| `jester_t2_1` | ✹ Confeti Explosivo | Raro | mana | magic | Golpea a varios enemigos cercanos. |
| `shaman_t3_3` | Ψ Consejo de Espíritus | Épico | mana | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `yunque_t1_4` | ☠ Contraataque de Bastión | Común | stamina | physical | Daña y reduce temporalmente el daño del objetivo. |
| `beastGuardian_t3_3` | Ψ Corazón de Alfa | Épico | stamina | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `yunque_t3_3` | Ψ Corazón Inquebrantable | Épico | stamina | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `thief_t2_1` | ✹ Corte Imposible | Raro | stamina | physical | Golpea a varios enemigos cercanos. |
| `druid_t1_2` | ▣ Corteza Reforzada | Común | mana | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `necromancer_t3_3` | Ψ Cosecha de Almas | Épico | mana | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `paladin_t3_1` | ★ Cruzada de Circuitos | Épico | mana | magic | Ataque potente en un área amplia. |
| `berserker_t1_1` | ✦ Cuchillada de Neón | Común | stamina | physical | Ataque a distancia contra el enemigo visible más cercano. |
| `jester_t1_4` | ☠ Dado Trucado | Común | mana | magic | Daña y reduce temporalmente el daño del objetivo. |
| `thief_t1_1` | ✦ Daga de Fase | Común | stamina | physical | Ataque a distancia contra el enemigo visible más cercano. |
| `entropyMage_t1_1` | ✦ Dardo Entrópico | Común | mana | magic | Ataque a distancia contra el enemigo visible más cercano. |
| `thief_t1_4` | ☠ Dedos Ligeros | Común | mana | magic | Daña y reduce temporalmente el daño del objetivo. |
| `thief_t3_4` | ☄ Desaparición Cuántica | Épico | mana | magic | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `sniper_t2_3` | ϟ Descarga Gemela | Raro | stamina | physical | Realiza varios impactos contra enemigos visibles. |
| `berserker_t2_4` | ◐ Desgarro de Cromo | Raro | stamina | utility | Revela terreno y mejora temporalmente tu posición. |
| `entropyMage_t1_4` | ☠ Desgaste Acelerado | Común | mana | magic | Daña y reduce temporalmente el daño del objetivo. |
| `entropyMage_t3_3` | Ψ Deshacer Realidad | Épico | mana | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `seer_t2_3` | ϟ Destino Torcido | Raro | mana | magic | Realiza varios impactos contra enemigos visibles. |
| `monk_t3_2` | ✂ Detener el Turno | Épico | stamina | physical | Inflige daño enorme a enemigos heridos. |
| `seer_t3_2` | ✂ Detener la Catástrofe | Épico | mana | magic | Inflige daño enorme a enemigos heridos. |
| `cleric_t3_2` | ✂ Diluvio Sagrado | Épico | mana | magic | Inflige daño enorme a enemigos heridos. |
| `sniper_t1_1` | ✦ Disparo Rúnico | Común | stamina | physical | Ataque a distancia contra el enemigo visible más cercano. |
| `bountyHunter_t2_2` | ✚ Doble Disparo | Raro | stamina | utility | Recupera vida y parte del recurso principal. |
| `necromancer_t1_4` | ☠ Drenaje de Memoria | Común | mana | magic | Daña y reduce temporalmente el daño del objetivo. |
| `engineer_t1_4` | ☠ Dron Reparador | Común | mana | magic | Daña y reduce temporalmente el daño del objetivo. |
| `thief_t2_4` | ◐ Duplicado Fantasma | Raro | mana | utility | Revela terreno y mejora temporalmente tu posición. |
| `monk_t2_1` | ✹ Eco del Golpe | Raro | stamina | physical | Golpea a varios enemigos cercanos. |
| `sniper_t3_3` | Ψ Ejecución Perfecta | Épico | stamina | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `engineer_t3_3` | Ψ Ejército Mecánico | Épico | mana | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `beastGuardian_t2_1` | ✹ Embate Bestial | Raro | stamina | physical | Golpea a varios enemigos cercanos. |
| `charge` | ➤ Embestida | Infrecuente | stamina | physical | Avanza hasta 3 casillas y golpea. |
| `druid_t2_1` | ✹ Enjambre Metálico | Raro | mana | magic | Golpea a varios enemigos cercanos. |
| `paladin_t1_2` | ▣ Escudo de Firmware | Común | mana | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `entropyMage_t1_2` | ▣ Escudo Inestable | Común | mana | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `seer_t2_2` | ✚ Espejo de Posibilidades | Raro | mana | utility | Recupera vida y parte del recurso principal. |
| `druid_t1_1` | ✦ Espina de Chatarra | Común | mana | magic | Ataque a distancia contra el enemigo visible más cercano. |
| `necromancer_t1_2` | ▣ Esqueleto de Datos | Común | mana | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `beastGuardian_t3_4` | ☄ Estampida Aumentada | Épico | stamina | physical | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `thief_t3_2` | ✂ Evasión Absoluta | Épico | mana | magic | Inflige daño enorme a enemigos heridos. |
| `necromancer_t2_1` | ✹ Explosión de Restos | Raro | mana | magic | Golpea a varios enemigos cercanos. |
| `engineer_t3_1` | ★ Fábrica Instantánea | Épico | mana | magic | Ataque potente en un área amplia. |
| `toxicEdge` | ☣ Filo Tóxico | Raro | stamina | physical | Tu siguiente golpe aplica daño adicional. |
| `entropyMage_t3_1` | ★ Fin Estadístico | Épico | mana | magic | Ataque potente en un área amplia. |
| `seer_t3_4` | ☄ Fin Inevitable | Épico | mana | magic | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `sniper_t2_1` | ✹ Flecha Perforante | Raro | stamina | physical | Golpea a varios enemigos cercanos. |
| `druid_t2_2` | ✚ Forma de Bestia | Raro | mana | utility | Recupera vida y parte del recurso principal. |
| `fortify` | ▣ Fortificar | Común | stamina | physical | Escudo temporal basado en Vitalidad. |
| `berserker_t1_2` | ▣ Frenesí Callejero | Común | stamina | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `campfire` | ♨ Fuego de Campamento | Raro | mana | utility | Recupera vida, maná y stamina, pero consume un turno. |
| `neonRage` | Ψ Furia de Neón | Épico | stamina | physical | Aumenta daño físico y crítico durante varios turnos. |
| `ironHook` | ⌁ Gancho de Hierro | Común | stamina | physical | Atrae un enemigo visible hacia ti. |
| `beastGuardian_t1_1` | ✦ Garra Aumentada | Común | stamina | physical | Ataque a distancia contra el enemigo visible más cercano. |
| `smash` | ⚒ Golpe de Yunque | Común | stamina | physical | Daño en las 8 casillas adyacentes. |
| `paladin_t1_1` | ✦ Golpe Radiante | Común | mana | magic | Ataque a distancia contra el enemigo visible más cercano. |
| `jester_t3_1` | ★ Gran Chiste Final | Épico | mana | magic | Ataque potente en un área amplia. |
| `scrapGrenade` | ● Granada de Chatarra | Infrecuente | stamina | physical | Explosión en área alrededor de un enemigo visible. |
| `bountyHunter_t2_1` | ✹ Granada Rastreadora | Raro | stamina | physical | Golpea a varios enemigos cercanos. |
| `sniper_t3_4` | ☄ Horizonte Partido | Épico | stamina | physical | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `thief_t1_2` | ▣ Humo Cuántico | Común | mana | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `quantumThief` | ⌘ Hurto Cuántico | Épico | mana | magic | Roba vida, maná y oro al enemigo objetivo. |
| `lootMagnet` | ✦ Imán de porquería | Infrecuente | mana | magic | Abre cofres cercanos y recoge llaves. |
| `berserker_t2_2` | ✚ Implante Sobrecargado | Raro | stamina | utility | Recupera vida y parte del recurso principal. |
| `bountyHunter_t1_3` | ➤ Impulso de Cadera | Común | stamina | physical | Avanzas hacia un enemigo y golpeas al llegar. |
| `taunt` | ☠ Insulto estructural | Infrecuente | mana | magic | Atrae enemigos visibles y reduce su daño. |
| `paladin_t2_3` | ϟ Juicio Compilado | Raro | mana | magic | Realiza varios impactos contra enemigos visibles. |
| `yunque_t3_2` | ✂ Juicio de Hierro | Épico | stamina | physical | Inflige daño enorme a enemigos heridos. |
| `cleric_t3_4` | ☄ Juicio del Dios Roto | Épico | mana | magic | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `paladin_t2_1` | ✹ Lanza Solar | Raro | mana | magic | Golpea a varios enemigos cercanos. |
| `engineer_t2_1` | ✹ Lanzallamas Casero | Raro | mana | magic | Golpea a varios enemigos cercanos. |
| `necromancer_t2_3` | ϟ Legión Corrupta | Raro | mana | magic | Realiza varios impactos contra enemigos visibles. |
| `arcaneLantern` | ☀ Linterna Arcana | Común | mana | utility | Revela una amplia zona del mapa alrededor del personaje. |
| `phaseKey` | ⚿ Llave de Fase | Infrecuente | mana | utility | Abre puertas cercanas, incluso si están cerradas con llave. |
| `sniper_t3_2` | ✂ Lluvia de Flechas | Épico | stamina | physical | Inflige daño enorme a enemigos heridos. |
| `ironRain` | ☄ Lluvia de hierro | Épico | mana | magic | Golpea aleatoriamente enemigos visibles. |
| `spiritWolf` | ◆ Lobo de Estática | Raro | mana | magic | Invoca un golpe espiritual sobre el enemigo más débil. |
| `cleric_t1_1` | ✦ Luz Reparadora | Común | mana | magic | Ataque a distancia contra el enemigo visible más cercano. |
| `seer_t1_4` | ☠ Mal Augurio | Común | mana | magic | Daña y reduce temporalmente el daño del objetivo. |
| `shaman_t2_4` | ◐ Maldición Estática | Raro | mana | utility | Revela terreno y mejora temporalmente tu posición. |
| `druid_t3_3` | Ψ Manada Aumentada | Épico | mana | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `beastGuardian_t2_3` | ϟ Manada Cibernética | Raro | stamina | physical | Realiza varios impactos contra enemigos visibles. |
| `cleric_t2_4` | ◐ Manos del Servidor | Raro | mana | utility | Revela terreno y mejora temporalmente tu posición. |
| `necromancer_t1_3` | ➤ Marca Cadavérica | Común | mana | magic | Avanzas hacia un enemigo y golpeas al llegar. |
| `sniper_t1_3` | ➤ Marca de Presa | Común | stamina | physical | Avanzas hacia un enemigo y golpeas al llegar. |
| `bountyHunter_t1_4` | ☠ Marca de Recompensa | Común | stamina | physical | Daña y reduce temporalmente el daño del objetivo. |
| `yunque_t1_1` | ✦ Martillazo Sísmico | Común | stamina | physical | Ataque a distancia contra el enemigo visible más cercano. |
| `cleric_t1_2` | ▣ Maza Bendita | Común | mana | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `monk_t2_4` | ◐ Meditación Acelerada | Raro | stamina | utility | Revela terreno y mejora temporalmente tu posición. |
| `thief_t3_3` | Ψ Mil Cortes | Épico | stamina | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `seer_t3_3` | Ψ Mil Futuros | Épico | mana | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `monk_t3_1` | ★ Mil Puños Simultáneos | Épico | stamina | physical | Ataque potente en un área amplia. |
| `paladin_t2_4` | ◐ Milagro de Emergencia | Raro | mana | utility | Revela terreno y mejora temporalmente tu posición. |
| `engineer_t1_3` | ➤ Mina Improvisada | Común | mana | magic | Avanzas hacia un enemigo y golpeas al llegar. |
| `bountyHunter_t3_2` | ✂ Misil de Bolsillo | Épico | stamina | physical | Inflige daño enorme a enemigos heridos. |
| `beastGuardian_t2_4` | ◐ Mordida Paralizante | Raro | stamina | utility | Revela terreno y mejora temporalmente tu posición. |
| `entropyMage_t3_4` | ☄ Muerte Térmica | Épico | mana | magic | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `yunque_t1_2` | ▣ Muralla Viviente | Común | stamina | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `necromancer_t2_2` | ✚ Muro de Huesos | Raro | mana | utility | Recupera vida y parte del recurso principal. |
| `bountyHunter_t3_4` | ☄ Nadie Escapa | Épico | stamina | physical | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `alchemicalNova` | ✺ Nova Alquímica | Épico | mana | magic | Explosión elemental alrededor del jugador. |
| `rustCloud` | ☁ Nube de Óxido | Infrecuente | mana | magic | Reduce temporalmente la armadura de enemigos cercanos. |
| `nineLives` | ⑨ Nueve Errores | Legendario | mana | magic | Evita una muerte y desencadena una onda de choque. |
| `sniper_t1_4` | ☠ Ojo de Halcón | Común | stamina | physical | Daña y reduce temporalmente el daño del objetivo. |
| `seer_t2_4` | ◐ Ojo del Abismo | Raro | mana | utility | Revela terreno y mejora temporalmente tu posición. |
| `beastGuardian_t1_4` | ☠ Olfato de Sangre | Común | stamina | physical | Daña y reduce temporalmente el daño del objetivo. |
| `treasureSense` | ◆ Olfato para el Tesoro | Infrecuente | mana | utility | Revela cofres, llaves y recompensas cercanas en el minimapa. |
| `entropyWave` | ≋ Onda de Entropía | Épico | mana | magic | Daño mágico masivo que escala con Inteligencia. |
| `entropyMage_t2_1` | ✹ Onda de Ruina | Raro | mana | magic | Golpea a varios enemigos cercanos. |
| `jester_t3_3` | Ψ Ovación Mortal | Épico | mana | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `monk_t2_3` | ϟ Palma del Segundo Perdido | Raro | stamina | physical | Realiza varios impactos contra enemigos visibles. |
| `voidBlink` | ◈ Parpadeo del Vacío | Raro | mana | magic | Teletransporte corto a una casilla libre. |
| `monk_t1_2` | ▣ Paso Circular | Común | stamina | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `mistStep` | ≈ Paso de Bruma | Raro | mana | utility | Te teletransporta a una casilla libre visible cercana. |
| `jester_t1_3` | ➤ Paso de Bufón | Común | mana | magic | Avanzas hacia un enemigo y golpeas al llegar. |
| `quickStep` | » Paso de Emergencia | Común | stamina | physical | Desplazamiento corto sin provocar respuesta inmediata. |
| `sniper_t1_2` | ▣ Paso del Tirador | Común | stamina | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `shaman_t2_3` | ϟ Paso del Viento | Raro | mana | magic | Realiza varios impactos contra enemigos visibles. |
| `entropyMage_t1_3` | ➤ Paso Improbable | Común | mana | magic | Avanzas hacia un enemigo y golpeas al llegar. |
| `seer_t1_3` | ➤ Paso Predicho | Común | mana | magic | Avanzas hacia un enemigo y golpeas al llegar. |
| `thief_t1_3` | ➤ Paso Trasero | Común | stamina | physical | Avanzas hacia un enemigo y golpeas al llegar. |
| `monk_t1_4` | ☠ Patada Repetida | Común | stamina | physical | Daña y reduce temporalmente el daño del objetivo. |
| `manaBolt` | ✧ Perno de Maná | Común | mana | magic | Proyectil mágico contra el enemigo visible más cercano. |
| `necromancer_t1_1` | ✦ Perno Funerario | Común | mana | magic | Ataque a distancia contra el enemigo visible más cercano. |
| `necromancer_t2_4` | ◐ Peste Binaria | Raro | mana | utility | Revela terreno y mejora temporalmente tu posición. |
| `yunque_t2_2` | ✚ Piel de Fortaleza | Raro | stamina | utility | Recupera vida y parte del recurso principal. |
| `beastGuardian_t2_2` | ✚ Piel de Quimera | Raro | stamina | utility | Recupera vida y parte del recurso principal. |
| `shaman_t1_4` | ☠ Piel de Tormenta | Común | mana | magic | Daña y reduce temporalmente el daño del objetivo. |
| `engineer_t1_1` | ✦ Pistola Alquímica | Común | mana | magic | Ataque a distancia contra el enemigo visible más cercano. |
| `druid_t2_4` | ◐ Polen Tóxico | Raro | mana | utility | Revela terreno y mejora temporalmente tu posición. |
| `gravityWell` | ◎ Pozo Gravitatorio | Raro | mana | magic | Agrupa enemigos cercanos y les inflige daño. |
| `druid_t3_4` | ☄ Primavera Radiactiva | Épico | mana | magic | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `seer_t3_1` | ★ Profecía Cumplida | Épico | mana | magic | Ataque potente en un área amplia. |
| `corpseProtocol` | ☠ Protocolo Cadáver | Épico | mana | magic | Explota un enemigo muerto recientemente contra los vivos. |
| `healingPulse` | ✚ Pulso Reparador | Común | mana | magic | Recupera una pequeña cantidad de vida. |
| `monk_t1_1` | ✦ Puño del Instante | Común | stamina | physical | Ataque a distancia contra el enemigo visible más cercano. |
| `cleric_t2_2` | ✚ Purga de Corrupción | Raro | mana | utility | Recupera vida y parte del recurso principal. |
| `cleanse` | ✤ Purificación | Infrecuente | mana | utility | Elimina penalizaciones y recupera una pequeña cantidad de vida. |
| `berserker_t3_3` | Ψ Rabia Inmortal | Épico | stamina | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `druid_t3_2` | ✂ Raíces del Mundo | Épico | mana | magic | Inflige daño enorme a enemigos heridos. |
| `druid_t1_3` | ➤ Raíz Enredadora | Común | mana | magic | Avanzas hacia un enemigo y golpeas al llegar. |
| `cleric_t2_1` | ✹ Rayo de Silicio | Raro | mana | magic | Golpea a varios enemigos cercanos. |
| `seer_t2_1` | ✹ Rayo del Futuro | Raro | mana | magic | Golpea a varios enemigos cercanos. |
| `engineer_t3_4` | ☄ Reactor Prohibido | Épico | mana | magic | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `bountyHunter_t1_2` | ▣ Red Magnética | Común | stamina | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `monk_t3_3` | Ψ Regreso al Instante | Épico | stamina | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `necromancer_t3_1` | ★ Reinicio de Cadáver | Épico | mana | magic | Ataque potente en un área amplia. |
| `monk_t1_3` | ➤ Respiración Serena | Común | stamina | physical | Avanzas hacia un enemigo y golpeas al llegar. |
| `cleric_t3_1` | ★ Resurrección de Emergencia | Épico | mana | magic | Ataque potente en un área amplia. |
| `paladin_t3_2` | ✂ Resurrección Parcial | Épico | mana | magic | Inflige daño enorme a enemigos heridos. |
| `paladin_t1_3` | ➤ Rezo de Combate | Común | mana | magic | Avanzas hacia un enemigo y golpeas al llegar. |
| `jester_t2_2` | ✚ Risa Contagiosa | Raro | mana | utility | Recupera vida y parte del recurso principal. |
| `thief_t2_3` | ϟ Robo de Energía | Raro | stamina | physical | Realiza varios impactos contra enemigos visibles. |
| `entropyMage_t2_3` | ϟ Robo de Tiempo | Raro | mana | magic | Realiza varios impactos contra enemigos visibles. |
| `worldBreaker` | ▰ Rompepisos | Legendario | stamina | physical | Golpe físico devastador en gran área. |
| `monk_t3_4` | ☄ Rueda Infinita | Épico | stamina | physical | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `yunque_t2_4` | ◐ Rugido del Yunque | Raro | stamina | utility | Revela terreno y mejora temporalmente tu posición. |
| `beastGuardian_t1_2` | ▣ Rugido Protector | Común | stamina | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `jester_t3_2` | ✂ Ruleta del Vacío | Épico | mana | magic | Inflige daño enorme a enemigos heridos. |
| `recallRune` | ⌂ Runa de Retorno | Épico | mana | utility | Te devuelve a la sala inicial del nivel. |
| `beastGuardian_t1_3` | ➤ Salto de Depredador | Común | stamina | physical | Avanzas hacia un enemigo y golpeas al llegar. |
| `berserker_t1_3` | ➤ Salto Rabioso | Común | stamina | physical | Avanzas hacia un enemigo y golpeas al llegar. |
| `berserker_t1_4` | ☠ Sangre por Combustible | Común | stamina | physical | Daña y reduce temporalmente el daño del objetivo. |
| `cleric_t2_3` | ϟ Santuario Portátil | Raro | mana | magic | Realiza varios impactos contra enemigos visibles. |
| `paladin_t1_4` | ☠ Sello de Protección | Común | mana | magic | Daña y reduce temporalmente el daño del objetivo. |
| `bountyHunter_t3_3` | Ψ Sentencia del Contrato | Épico | stamina | utility | Mejora daño, armadura y regeneración durante varios turnos. |
| `lootSingularity` | ✦ Singularidad de Botín | Legendario | mana | magic | Absorbe cofres y mejora temporalmente la rareza encontrada. |
| `blackSun` | ✹ Sol Negro | Legendario | mana | magic | Daño extremo a todos los enemigos visibles. |
| `jester_t2_3` | ϟ Sombrero Infinito | Raro | mana | magic | Realiza varios impactos contra enemigos visibles. |
| `arcSlash` | ◒ Tajo de Arco | Común | stamina | physical | Golpea hasta tres enemigos frente a ti. |
| `shaman_t3_1` | ★ Tempestad Ancestral | Épico | mana | magic | Ataque potente en un área amplia. |
| `quake` | ✹ Terremoto | Raro | mana | magic | Daño a enemigos a 2 casillas. |
| `bulletTime` | ◷ Tiempo de Bala | Raro | stamina | physical | Reduce el tiempo de respuesta enemiga y mejora evasión. |
| `sniper_t3_1` | ★ Tiro a Través del Mundo | Épico | stamina | physical | Ataque potente en un área amplia. |
| `bountyHunter_t1_1` | ✦ Tiro de Contrato | Común | stamina | physical | Ataque a distancia contra el enemigo visible más cercano. |
| `berserker_t2_1` | ✹ Torbellino Magenta | Raro | stamina | physical | Golpea a varios enemigos cercanos. |
| `engineer_t1_2` | ▣ Torreta de Bolsillo | Común | mana | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `stormTotem` | ♆ Tótem de Tormenta | Épico | mana | magic | Descargas repetidas sobre enemigos visibles. |
| `shaman_t1_2` | ▣ Tótem Menor | Común | mana | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `shaman_t2_2` | ✚ Tótem Sanador | Raro | mana | utility | Recupera vida y parte del recurso principal. |
| `sniper_t2_2` | ✚ Trampa de Cazador | Raro | stamina | utility | Recupera vida y parte del recurso principal. |
| `shockTrap` | ⌗ Trampa de Descarga | Infrecuente | mana | magic | Daña y puede aturdir a un enemigo adyacente. |
| `transmute` | ♲ Transmutar Chatarra | Raro | mana | utility | Convierte el objeto de menor calidad del inventario en oro. |
| `necromancer_t3_2` | ✂ Trono del Archiliche | Épico | mana | magic | Inflige daño enorme a enemigos heridos. |
| `berserker_t3_2` | ✂ Última Sobrecarga | Épico | stamina | physical | Inflige daño enorme a enemigos heridos. |
| `shadowVeil` | ◐ Velo de Sombras | Épico | mana | utility | Los enemigos ignoran tu siguiente movimiento. |
| `paladin_t3_4` | ☄ Veredicto Celestial | Épico | mana | magic | Habilidad definitiva de gran daño contra todos los enemigos visibles. |
| `seer_t1_2` | ▣ Visión Cercana | Común | mana | utility | Obtienes un escudo que escala con el nivel de habilidad. |
| `shaman_t1_3` | ➤ Voz del Trueno | Común | mana | magic | Avanzas hacia un enemigo y golpeas al llegar. |
