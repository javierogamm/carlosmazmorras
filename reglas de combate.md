# Reglas de combate y motor de daño

Documento consolidado para `main` sobre el cálculo de daño del juego. Versión de app asociada: `0.36.11`.

## 1. Fuentes de daño

El daño del juego sale de cinco rutas principales:

1. **Ataque básico del jugador**: usa el dado del arma equipada o un dado base sin arma.
2. **Habilidades del jugador**: usan dados por rareza/tier, nivel de habilidad, atributo principal y modificadores por alcance/área.
3. **Daño directo de habilidades antiguas/no apuntadas**: algunas skills llaman a `attack()` con un bonus numérico adicional.
4. **Daño periódico o diferido**: estados de enemigos como sangrado, quemadura, veneno, plaga, decaimiento, zonas activas y cuenta atrás.
5. **Ataques y habilidades de enemigos**: parten del daño/base de ataque del enemigo, escalan por piso/nivel y se normalizan antes de aplicar defensa del jugador.

## 2. Estadísticas base del jugador

Al crear personaje, la clase aporta estadísticas base y la raza suma bonos. Las estadísticas principales son:

- **Fuerza**: daño físico y defensas físicas ofensivas.
- **Vitalidad**: vida, armadura, stamina y defensa contra golpes pesados o tóxicos.
- **Agilidad**: ataques a distancia/finesse, evasión y defensa contra proyectiles.
- **Suerte**: crítico, botín y defensas contra caos/azar.
- **Inteligencia**: daño mágico, maná y defensa contra magia técnica/arcana.
- **Sabiduría**: regeneración, percepción y defensa contra miedo, alma, sagrado o sombras.

Valores iniciales relevantes:

```text
baseDamage = 2 + Fuerza inicial
baseArmor = 4 + floor(Vitalidad inicial / 2)
maxHp = 30 + Vitalidad derivada * 3 + floor(Vitalidad derivada * 2) + bonos raciales/permanentes
maxStamina = 45 + Vitalidad derivada * 4 + Agilidad derivada * 2 + bonos
maxMana = 30 + Inteligencia derivada * 5 + Sabiduría derivada * 3 + bonos
```

La vida extra por vitalidad se concentra en `vitalityHpBonus(v) = floor(v * 2)`, por lo que cada punto de Vitalidad derivada aporta 5 HP antes de otros bonos.

## 3. Derivados, equipo, pasivas y pociones

`recomputeDerived()` recalcula el personaje después de equipar objetos, consumir pociones o aplicar buffs.

### 3.1 Afijos de equipo

Los afijos pueden sumar estadísticas primarias o derivadas. Si el afijo coincide con una stat primaria (`strength`, `vitality`, `agility`, `luck`, `intelligence`, `wisdom`), aumenta esa stat final. Si no, suma al derivado correspondiente, por ejemplo:

- `damage`: daño base mostrado.
- `armor`: armadura.
- `critChance`: probabilidad crítica informativa/equipo.
- `critDamage`: daño crítico informativo/equipo.
- `physicalPower`, `magicPower`: poder físico/mágico almacenado como derivado.
- `lifeSteal`, `thorns`, `executeBonus`, `bossDamage`: pasivas disponibles en objetos.

### 3.2 Conversión de stats finales

Cuando el equipo o pociones suben stats primarias por encima de la base:

```text
maxHp += max(0, (Vitalidad final - Vitalidad base) * 5)
maxStamina += max(0, (Vitalidad final - Vitalidad base) * 4 + (Agilidad final - Agilidad base) * 2)
maxMana += max(0, (Inteligencia final - Inteligencia base) * 5 + (Sabiduría final - Sabiduría base) * 3)
damage += floor((Fuerza final - Fuerza base) * 1.2)
armor += floor((Vitalidad final - Vitalidad base) * 0.6)
```

### 3.3 Buffs y pociones temporales

- Buffs con `effects.armor` multiplican la armadura: `armor = round(armor * (1 + armorBuff))`.
- Pociones con `armorMult` hacen lo mismo.
- Pociones con `damageMult` entran en el multiplicador ofensivo activo.
- Pociones de invulnerabilidad fuerzan daño recibido final a 0.

## 4. Ataque básico del jugador

### 4.1 Dado de ataque

`baseAttackDice()` decide el dado:

| Situación | Dado |
|---|---:|
| Sin arma | `1d4` |
| Arma con `damageDice` configurado | usa ese valor |
| Arma de alcance máximo >= 9 | `1d10` |
| Arma de alcance máximo >= 7 | `1d8+1` |
| Arma de alcance máximo >= 3 | `1d8` |
| Martillo/hacha/maza | `1d10` |
| Espada | `1d8` |
| Daga | `1d6+1` |
| Resto | `1d6` |

### 4.2 Alcance de armas

Armas sin rango son melee 1. Algunas categorías tienen preset:

| Tipo | Alcance mínimo | Alcance máximo |
|---|---:|---:|
| Varitas | 1 | 4 |
| Arcos | 2 | 5 |
| Ballestas | 1 | 4 |
| Pistolas | 1 | 3 |
| Rifles | 2 | 5 |
| Escopetas | 1 | 2 |

Los campos `rangeMin/rangeMax`, `minRange/maxRange` o `alcanceMinimo/alcanceMaximo` del item sobrescriben el preset.

### 4.3 Penalización por alcance

Ataques a distancia y skills apuntadas usan:

```text
rangeDamageMultiplier(range, area=false)
distancePenalty = min(0.32, (range - 1) * 0.035)
areaPenalty = area ? 0.10 : 0
multiplicador = max(0.58, 1 - distancePenalty - areaPenalty)
```

Ejemplos:

- Alcance 1: 100%.
- Alcance 3: 93%.
- Alcance 5: 86%.
- Alcance 8 en área: 65.5%.

### 4.4 Fórmula de daño básico

La función `attack()` calcula:

```text
tirada = roll(dado)
statMod básico = max(0, floor(total('damage') * 0.45))
raw = round((tirada + statMod + bonus * 0.35) * multiplier * nextSkillMultiplier * activeBuffDamageMultiplier * damageDealtMultiplier)
```

Después se resuelve defensa del enemigo y crítico.

## 5. Habilidades del jugador

### 5.1 Progresión por uso

Cada habilidad tiene nivel propio:

```text
XP necesaria para subir skill = 8 + nivelSkill * 6
skillPowerMultiplier = 1 + (nivelSkill - 1) * 0.12
```

Cada uso exitoso suma 1 XP a esa habilidad. Al subir de nivel, la habilidad gana +12% multiplicativo por nivel sobre varias rutas de daño/utilidad.

### 5.2 Hitos de aprendizaje por clase

La selección de habilidades de clase se escalona por tier:

| Nivel de personaje | Tier |
|---:|---:|
| 1, 3, 5, 7 | I |
| 10, 15, 20, 25 | II |
| 30, 40, 50 | III |

El popup muestra hasta 3 opciones aleatorias no aprendidas del pool de la clase y tier.

### 5.3 Dado base de skills (`skillDiceExpr`)

| Categoría de skill | Tier I / común | Tier II / rare | Tier III / épica+ |
|---|---:|---:|---:|
| Utilidad, buff, shield, heal | Sin daño | Sin daño | Sin daño |
| Massive / `blackSun` / `worldBreaker` | `3d8+4` | `4d8+4` | `5d8+6` |
| Ultimate | `3d6+3` | `4d6` | `5d6+3` |
| AoE / multihit / skills de área | `2d6+3` | `3d6+3` | `4d6+4` |
| Execute / `execute` | `2d8+3` | `3d8+1` | `3d10+5` |
| Magia genérica | `2d8+1` | `3d8` | `4d8` |
| Física genérica | `2d8+1` | `3d8` | `4d8` |

Estos dados se comparan contra un ataque básico de referencia de EV 7.5 (`1d8+1` con statMod medio +2). Antes de `skillPowerMultiplier`, los mínimos objetivo son Tier I 9.75 (1.3×), Tier II 12 (1.6×) y Tier III 15 (2.0×); todos los dados de la tabla superan esos suelos y crecen de forma monótona por tier.

### 5.4 Atributo añadido por skills

Para skills ejecutadas por `attack()`:

```text
statMod skill = floor((statPrimaria * 2 + statSecundaria) / 3)
```

La stat primaria depende de tipo/recurso:

| Skill | Primaria | Secundaria |
|---|---|---|
| `type: magic` o `resource: mana` | Inteligencia | Sabiduría |
| `type: physical` o `resource: stamina` | Fuerza | Agilidad |
| Otra | Suerte | Sabiduría |

### 5.5 Fórmula de skills apuntadas

Para skills con objetivo o área, `resolveTargetedSkill()` usa:

```text
targetedSkillDamage = round((5 + nivelSkill * 2 + stat) * skillPowerMultiplier)
rangeMult = rangeDamageMultiplier(alcance, esArea)
```

En el daño final real se llama a `attack()` con `skillId`, por tanto entran:

```text
raw = round((roll(skillDiceExpr) + statMod + bonus * 0.35) * multiplier * rangeMult * buffs * worldDamageDealt)
```

Multiplicadores específicos:

- Objetivo único por rareza: común `1.1`, rara `1.4`, épica `1.75`, legendaria `2.2`.
- Execute: `skillId: 'execute'` usa la ruta apuntada (`targetMode: enemy`) y multiplica además por `2.35` si el objetivo está por debajo del 40% de vida.
- Área: `massive/blackSun/worldBreaker` usan `1.65`; `ultimate` usa `1.35`; el resto `1`. Las áreas aplican además `* 0.85` y la penalización de área del rango.

### 5.6 Skills legacy/no apuntadas con daño explícito

Estas skills se resuelven sin selector o con comportamiento específico:

| Skill | Daño/efecto principal |
|---|---|
| `smash` / Golpe de Yunque | Daño a enemigos adyacentes: bonus aproximado `Fuerza * skillPowerMultiplier`. |
| `charge` / Embestida | Avanza hasta 3 casillas y golpea con bonus `Fuerza * skillPowerMultiplier`. |
| `quake` / Terremoto | Daño a enemigos a 2 casillas con bonus `(2 + INT + floor(SAB/2)) * skillPowerMultiplier`. |
| `ironRain` / Lluvia de hierro | Hasta `min(6, enemigosVisibles + 2)` impactos aleatorios; bonus `(3 + INT + 1d6-1) * skillPowerMultiplier`. |
| `taunt` / Insulto estructural | No causa daño directo; atrae enemigos visibles y aplica debuff defensivo propio. |
| `lootMagnet` | Sin daño; abre cofres y recoge llaves cercanas. |

### 5.7 Skills de botín no utilitarias

Si una skill de botín no fue resuelta por una ruta especial:

```text
base = 8 + nivelSkill * 3 + (INT si magic, FUE si physical)
```

- `healingPulse`: cura `(8 + nivelSkill * 4 + SAB) * skillPowerMultiplier`.
- `mirrorWard`: escudo `8 + nivelSkill * 4`.
- `boneArmor`: escudo `12 + nivelSkill * 4`.
- `bloodRush`: pierde 5 HP y recupera `20 + nivelSkill * 4` stamina.
- `quickStep`: movimiento/uso sin daño directo.
- `blackSun`, `worldBreaker`, `alchemicalNova`, `entropyWave`, `stormTotem`, `chainSpark`, `gravityWell`, `holyCircuit`: golpean varios objetivos con `base * 1.25`, salvo `blackSun` con `base * 2.1`.
- Resto de skills ofensivas de botín: golpean al objetivo cercano con `base * multiplicadorRareza`, donde común `1.15`, rara `1.45`, épica `1.8`, legendaria `2.4`.

## 6. Defensa del enemigo contra daño del jugador

Cada ataque del jugador tira defensa enemiga:

```text
defenseDie = 1d20
defenseBonus = enemyDefenseScore(enemigo, statDefensa)
DC = 10 + floor(rawDamage * 0.75)
```

Resultado:

| Condición | Multiplicador de daño |
|---|---:|
| 20 natural | `0` (evita) |
| `1d20 + defenseBonus >= DC` | `0.5` |
| 1 natural | `1.25` |
| Otro | `1` |

El daño nunca baja de 1 si el multiplicador no es 0.

### 6.1 Stat defensiva atacada

- Armas: se infiere por texto/tipo. Proyectiles y dagas suelen atacar Agilidad; bastones/orbes/grimorios Inteligencia; reliquias/sagrado Sabiduría; martillos/mazas/hachas/yunque Vitalidad; resto Fuerza.
- Skills: puede venir en `defenseStat`; si no se infiere por palabras clave. Caos usa Suerte; miedo/alma/sagrado/sombra usa Sabiduría; arcano/mana/fuego/hielo/rayo usa Inteligencia; veneno/ácido/terremoto/explosión usa Vitalidad; proyectil/trampa/embestida/execute usa Agilidad; fallback Fuerza.

### 6.2 Bonus defensivo enemigo

```text
score = floor(piso * 0.65) + eliteBonus + bossBonus + archetypeBonus - estados
eliteBonus = 2 si élite
bossBonus = 4 si jefe
```

Arquetipos suman según `type`:

- Fuerza +3: orc, golem, knight, abomin, tyrant.
- Vitalidad +3: golem, mummy, beast, orc, abomin, tyrant.
- Agilidad +3: goblin, wolf, hound, thief, imp, vamp.
- Suerte +2: jester, error, quantum, goblin.
- Inteligencia +3: mage, lich, clerk, wraith, priest, shaman, archiv.
- Sabiduría +3: lich, undead, mummy, wraith, priest, shaman, vamp.

Estados reducen defensa:

- `armorBreak`: -4.
- `wither`: -3.

## 7. Críticos del jugador

La probabilidad crítica usada actualmente por `attack()` es:

```text
critChance = min(0.38, 0.04 + AgilidadBase * 0.012 + SuerteBase * 0.005)
```

Si hay crítico y el daño es mayor que 0:

```text
daño = round(daño * 1.75)
```

Nota: esta función usa `game.player.stats` base, no `derived.finalStats`; por tanto afijos `critChance/critDamage` quedan documentados como derivados/equipo, pero no se aplican en esta ruta de crítico salvo que otra ruta los consuma.

## 8. Multiplicadores ofensivos del jugador

El raw ofensivo de `attack()` incluye:

```text
activeBuffDamageMultiplier = producto(1 + buff.effects.damage) * producto(1 + potion.effect.damageMult)
damageDealtMultiplier = worldParams.damageDealtPct / 100
nextSkillMultiplier = multiplicador de una próxima skill, se consume después de una skill
```

Ejemplos:

- Mundo con `damageDealtPct = 150`: daño infligido `* 1.5`.
- Elixir del berserker `damageMult = 0.20`: daño `* 1.2`.
- Buff de clase con `effects.damage = .15 + nivelSkill * .01`: daño multiplicado mientras dure.

## 9. Cálculo de daño de enemigos

Los enemigos tienen dos campos compatibles:

- `damage`: campo usado por enemigos legacy y escalado.
- `atk`: campo usado por algunos enemigos configurados o familias antiguas; si no existe `atk`, se usa `damage`.

### 9.1 Enemigos legacy generados por tema

`spawnEnemy()` toma una plantilla con `hp`, `damage`, `xp`, `boss/ranged` y aplica:

```text
mult = 1 + piso * 0.18 + (boss ? 1.2 : 0)
maxHp = hp * mult
damage = damage * (boss ? 1.35 : 1)
```

Los enemigos de evento usan esta ruta legacy y después `scaleEnemy()` sustituye vida/daño/XP desde esos valores base; las plantas configuradas de pisos usan `buildConfiguredEnemy()` y no vuelven a pasar por `scaleEnemy()`. Por tanto no se acumulan dos escalados de piso en la generación normal.

### 9.2 Escalado global por piso y nivel

`difficultyScale()` define:

```text
hpScale = 1.055^(nivelJugador - 1) * (1 + (piso - 1) * 0.19)
damageScale = 1.035^(nivelJugador - 1) * (1 + (piso - 1) * 0.13)
xpScale = 1 + (piso - 1) * 0.09 + (nivelJugador - 1)^0.72 * 0.045
eliteChance = min(0.42, 0.025 * piso + 0.0032 * nivelJugador)
```

Al escalar:

```text
enemy.maxHp = round(baseHp * hpScale * worldLifeMultiplier * ENEMY_HP_BASE_MULT)
enemy.damage = max(1, round(baseDamage * damageScale))
enemy.xp = round(baseXp * xpScale)
```

Constantes actuales:

```text
ENEMY_HP_BASE_MULT = 0.5
ENEMY_DAMAGE_BASE_MULT = 0.55
```

Si sale élite:

```text
maxHp *= 1.55
damage *= 1.3
xp *= 1.8
nombre = 'Élite ' + nombre
```

### 9.3 Habilidades enemigas

Asignación:

```text
chance = boss ? 95% : elite ? 55% : 18% + min(22%, piso * 1.2%)
maxTier = nivelJugador >= 30 ? 3 : nivelJugador >= 10 ? 2 : 1
```

Si el enemigo tiene `configuredSkillIds`, usa esas skills. Si no, puede tomar skills `enemyUsable` del pool permitido.

Daño base de habilidad enemiga:

```text
mult = boss ? 1.35 : elite ? 1.15 : 1
statMod = skillStatModifier(skillId, enemigo)
amount = max(2, round(((enemy.atk || enemy.damage || 4) + statMod) * mult * tierMult))
tierMult = skill.tier ? (1 + skill.tier * 0.12) : 1
```

- Si la skill enemiga es `shield`, `buff` o `utility`, el enemigo se cura/refuerza por `round(amount * 0.9)`.
- Si ataca al jugador, `amount` entra en `damagePlayer(amount, defensaInferida, sourceName)`.
- Si ataca a otro objetivo, resta `amount` directo al objetivo.

### 9.4 Normalización del daño recibido por el jugador

Antes de tirar defensa del jugador, todo daño enemigo pasa por `normalizeIncomingDamage()`:

```text
base = max(1, amount)
budget = max(4, round(5 + piso * 0.45 + nivelJugador * 0.18))
soft = base <= budget ? base : budget + sqrt(base - budget) * 0.65
bossBonus = sourceName contiene jefe/boss/campeón/rey ? 2 : 0
worldAdjust = round((damageReceivedPct - 100) / 100 * 3)
normalized = max(1, round(soft * ENEMY_DAMAGE_BASE_MULT + bossBonus + worldAdjust))
```

Puntos importantes:

- `damageReceivedPct` no multiplica directamente el daño recibido; aporta un ajuste plano acotado mediante `worldAdjust`.
- La normalización reduce picos de enemigos configurados con ataques muy altos.
- El bonus de jefe depende del texto de la fuente de daño.

### 9.5 Defensa del jugador contra daño enemigo

`damagePlayer()` tira defensa:

```text
defenseDie = 1d20
defenseBonus = playerDefenseBonus(statDefensa)
attackDC = 10 + round(normalizedDamage * 0.75)
```

Resultado:

| Condición | Multiplicador de daño recibido |
|---|---:|
| 20 natural | `0` |
| `1d20 + defenseBonus >= attackDC` | `0.5` |
| 1 natural | `1.25` |
| Invulnerabilidad activa | `0` |
| Otro | `1` |

El daño final recibido es:

```text
final = mult === 0 ? 0 : max(1, round(normalizedDamage * mult))
```

El bonus defensivo del jugador:

```text
base = floor(statDefensivaFinal * 0.85)
// Intencional: Fuerza/Vitalidad reciben más conversión de armadura para sostener builds tanque.
armorPart = stat es Fuerza/Vitalidad ? floor(armor / 3) : floor(armor / 6)
playerDefenseBonus = base + armorPart
```

## 10. Daño periódico y estados

`tickEnemyStatuses()` aplica daño a enemigos antes de reducir duración para tipos:

- `bleed`
- `burn`
- `poison`
- `dot`
- `plague`
- `decay`
- `decayDot`
- `areaDot`

Fórmula:

```text
damageTick = max(1, round(status.power))
```

`decayDot` reduce su propio poder en 1 por tick hasta mínimo 1.

`doomCountdown` no daña en cada tick normal: al expirar, aplica:

```text
damage = max(1, round(status.power))
```

Si el daño mata al enemigo, se llama a `kill(e)` y se entrega XP/botín.

## 11. Progresión del personaje ligada a daño

### 11.1 XP de nivel

```text
xpNeeded(level) = round(28 + level * 18 + level^1.72 * 5.4)
```

### 11.2 Crecimiento por nivel

Al subir de nivel:

```text
hp += 5 + floor(level / 5) + Vitalidad actual
stamina += 3 + floor(level / 12) + floor(Vitalidad actual / 3)
mana += 3 + floor(level / 12) + floor((Inteligencia actual + Sabiduría actual) / 3)
baseDamage += (level % 3 === 0 ? 1 : 0) + (level % 10 === 0 ? 1 : 0)
baseArmor += (level % 4 === 0 ? 1 : 0) + (level % 15 === 0 ? 1 : 0)
```

Cada 10 niveles suben todas las stats primarias +1.

### 11.3 Previsión cualitativa

- El daño base crece cada 3 niveles y recibe un punto adicional en múltiplos de 10.
- La armadura crece cada 4 niveles y recibe un punto adicional en múltiplos de 15.
- Las skills escalan por uso, no solo por nivel del personaje.
- Los enemigos escalan simultáneamente por piso y nivel del jugador.

## 12. Orden resumido de resolución

### 12.1 Jugador golpea enemigo

1. Elegir dado: arma o skill.
2. Tirar dados.
3. Calcular modificador de atributo/daño.
4. Aplicar multiplicadores de skill, alcance, buffs y mundo.
5. Inferir defensa atacada.
6. Tirar defensa enemiga.
7. Reducir, evitar o aumentar por pifia.
8. Tirar crítico del jugador.
9. Restar HP y matar si llega a 0.

### 12.2 Enemigo golpea jugador

1. Tomar `damage`/`atk` o calcular `amount` de skill enemiga.
2. Aplicar escalado de enemigo y multiplicadores de élite/jefe/skill.
3. Normalizar contra presupuesto de daño recibido.
4. Inferir stat defensiva si viene de skill.
5. Tirar defensa del jugador.
6. Aplicar reducción/evasión/pifia/invulnerabilidad.
7. Restar HP y resolver muerte o cheat death.

## 13. Notas de balance detectadas

- `damageReceivedMultiplier()` existe, pero la ruta actual usa `worldPercentFlatAdjustment()` en lugar de multiplicar directamente el daño recibido.
- Las pasivas `critChance`, `critDamage`, `executeBonus`, `bossDamage`, `physicalPower` y `magicPower` se acumulan en derivados, pero el núcleo de `attack()` no las consume directamente en la fórmula principal actual.
- `damagePlayer()` muestra dos veces el flotante/efecto visual del daño recibido, aunque solo resta HP una vez.
- La normalización enemiga hace que subir `damageReceivedPct` tenga efecto plano moderado, no proporcional.
