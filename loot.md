# Sistema de loot completo

Este documento describe el sistema de botín implementado en `src/game.js`: fuentes de drops, porcentajes, rarezas, efecto de Suerte, efectos de más porcentaje de looteo, niveles de objeto, tiers y recompensas especiales.

## 1. Rarezas, tiers y pesos base

El loot usa 6 rarezas de equipo. Cada rareza define color, número de afijos, probabilidad de pasivas, probabilidad de efectos legendarios y multiplicador de poder.

| Rareza | Tier visual | Peso legacy | Afijos | Pasivas | Efectos especiales | Multiplicador |
|---|---:|---:|---:|---:|---:|---:|
| Común (`common`) | Común | 48 | 1-2 | 0% | 0% | x1.00 |
| Infrecuente (`uncommon`) | Infrecuente | 27 | 2-3 | 15% | 0% | x1.15 |
| Raro (`rare`) | Raro | 15 | 3-4 | 45% | 12% | x1.35 |
| Épico (`epic`) | Épico | 8 | 4-5 | 85% | 42% | x1.65 |
| Legendario (`legendary`) | Legendario | 2 | 5-6 | 100% + 55% de segunda pasiva | 100% | x2.10 |
| Artefacto (`artifact`) | Artefacto | 0.6 | 6-7 | 100% + 75% de segunda pasiva | 100% | x2.65 |

> Nota: los pesos legacy están definidos en la tabla `rarities`, pero la tirada normal actual usa la progresión por piso (`rarityWeights`) como base principal y solo cae al peso legacy si falta el peso de esa rareza en la fila de progresión.

## 2. Desbloqueo de rarezas por progreso y nivel

Cada piso calcula una fila de progresión según:

```text
ratio = (piso - 1) / (totalPisos - 1)
```

Con un solo piso, el ratio es 1. El máximo tier permitido depende de ese ratio y del nivel del personaje:

| Rareza máxima | Condición |
|---|---|
| Raro | Estado inicial: Común, Infrecuente y Raro siempre pueden aparecer. |
| Épico | Ratio >= 0.22 **o** nivel >= 4. |
| Legendario | Ratio >= 0.55 **y** nivel >= 9. |
| Artefacto | Ratio >= 0.82 **y** nivel >= 14. |

La tabla de loot guardada en mundos (`lootTable`) se usa para saber cuántos pisos tiene el mundo, pero la fila se recalcula con el nivel actual del jugador. Si no hay tabla de mundo, se usa el número de pisos configurado en parámetros de mundo; por defecto son 20 pisos.

## 3. Pesos de rareza por piso

La progresión empieza con estos pesos base:

```text
Común 72, Infrecuente 22, Raro 6, Épico 0, Legendario 0, Artefacto 0
```

Después se recalculan por ratio:

| Rareza | Fórmula de peso antes de suerte |
|---|---|
| Común | `max(20, round(72 - ratio * 54))` |
| Infrecuente | `max(16, round(22 + ratio * 14))` |
| Raro | `max(6, round(6 + ratio * 16))` |
| Épico | si está permitido: `max(1, round((ratio - 0.18) * 18))`; si no, 0 |
| Legendario | si está permitido: `max(1, round((ratio - 0.50) * 9))`; si no, 0 |
| Artefacto | si está permitido: `max(1, round((ratio - 0.78) * 5))`; si no, 0 |

Las rarezas por encima del máximo permitido se fuerzan a peso 0.

### Ejemplos aproximados con mundo de 20 pisos y sin aplicar suerte

| Piso | Ratio | Rarezas permitidas | Pesos aproximados |
|---:|---:|---|---|
| 1 | 0.00 | Común, Infrecuente, Raro | 72 / 22 / 6 |
| 5 | 0.21 | Común, Infrecuente, Raro | 61 / 25 / 9 |
| 6 | 0.26 | Común, Infrecuente, Raro, Épico | 58 / 26 / 10 / 1 |
| 11 | 0.53 | Común, Infrecuente, Raro, Épico; Legendario solo si nivel >= 9 y ratio >= 0.55, por tanto aún no | 44 / 29 / 14 / 6 |
| 12 | 0.58 | hasta Legendario si nivel >= 9 | 41 / 30 / 15 / 7 / 1 |
| 17 | 0.84 | hasta Artefacto si nivel >= 14 | 27 / 34 / 19 / 12 / 3 / 1 |
| 20 | 1.00 | hasta Artefacto si nivel >= 14 | 20 / 36 / 22 / 15 / 5 / 1 |

## 4. Efecto de Suerte y `% de hallazgo de rareza`

La rareza final se elige con `weightedRarity(level)`. Primero se obtiene la fila de progresión del piso y después se ajusta cada peso con un bonus de calidad:

```text
bonus = (level - 1) * 0.18 + (SuerteFinal + lootLuckTemporal) * 0.14 + rarityFind * 0.18
pesoAjustado = max(0.2, pesoBase * (1 + (indiceRareza - 1) * bonus / 55))
```

`indiceRareza` es la posición en la lista de rarezas: Común=0, Infrecuente=1, Raro=2, Épico=3, Legendario=4, Artefacto=5.

Consecuencias:

- Infrecuente no cambia por esta fórmula, porque `(1 - 1) = 0`.
- Común baja con más bonus, porque `(0 - 1) = -1`.
- Raro, Épico, Legendario y Artefacto suben cada vez más cuanto mayor sea su índice.
- La suerte no permite saltarse bloqueos de progreso/nivel: si Épico, Legendario o Artefacto no están permitidos por la fila de loot, su peso sigue siendo 0.
- El peso nunca baja de 0.2 para rarezas que estén permitidas.

### Fuentes de Suerte y rareza

- La Suerte final (`derived.finalStats.luck`) afecta al bonus de rareza, incluyendo base, raza, subidas, equipo y pociones permanentes/temporales de stats.
- La raza Mediano Rompebolsas aporta `+2 SUE`, `+1 AGI` y `+12% de hallazgo de rareza` (`rarityFind`).
- El pasivo de objeto `Olfato de Chatarra` (`treasure`) aporta `rarityFind` entre 4% y 18%, escalado por nivel de objeto y multiplicador de rareza.
- El `rarityFind` acumulado desde pasivas y raza se suma en `derived.rarityFind`.
- Los efectos temporales `lootLuck`, como `fortuneShot`, se suman solo para tiradas de botín.

## 5. Niveles de objeto (`iLvl`)

Cada piso calcula un rango de nivel de objeto:

```text
base = round(nivelJugador + piso * 0.85)
min = max(1, floor(base + ratio * 2) - 1)
max = max(1, ceil(base + 2 + ratio * 5))
```

Para loot generado proceduralmente:

```text
iLvl = clamp(nivelSolicitado + random(0..2) - 1, min, max)
```

Para objetos configurados en `config_items`:

```text
iLvl = clamp(iLvlConfigurado || iLvlFila || nivelSolicitado, min, max)
```

El `iLvl` aumenta:

- por nivel del jugador;
- por piso actual;
- por avance relativo dentro del mundo (`ratio`);
- por fuentes que llamen a `makeLoot()` con un nivel aumentado, como recompensas especiales o jefes.

## 6. Fuentes de loot y porcentajes

### Cofres

Cada piso genera:

```text
14 + floor( piso * 0.8 ) cofres
```

Al abrir un cofre:

- siempre da 1 objeto;
- tiene 24% de probabilidad de dar un segundo objeto;
- tiene `min(65%, 16% + piso * 2.5%)` de probabilidad de enseñar una habilidad lootable;
- da oro: `5 + random(0..13)`.

La skill `lootMagnet` abre cofres cercanos en radio Manhattan <= 3 y recoge llaves cercanas en el mismo radio. `dimensionalPocket` abre cofres ya explorados con un límite de `2 + floor(nivelSkill / 2)`.

### Enemigos

Al matar un enemigo:

- oro normal: `3 + random(0..5)`;
- oro de jefe: 75;
- XP normal: `8 + floor(piso / 2)`;
- XP de jefe: 60;
- probabilidad de objeto normal: `min(65%, 13% + SuerteFinal * 0.8%)`;
- jefes y jefes de evento siempre tiran un objeto;
- si el enemigo es jefe, el loot se crea con `nivelJugador + 3` y fuente `boss`;
- si el enemigo es élite, la fuente marcada es `elite`, pero la probabilidad base de soltar objeto no cambia salvo que sea jefe.

Drops de habilidades desde enemigos:

- Si el enemigo tiene skills, puede soltar una skill que el jugador no conozca:
  - jefe: 38%;
  - élite: 18%;
  - normal: 5.5%.
- Si no se produce ese drop, puede aprenderse una habilidad aleatoria:
  - jefe o jefe de evento: garantizado por esa rama;
  - enemigo normal/élite: 1.8%.
- Al derrotar un jefe normal, además se aprende `ironRain` por el logro del primer jefe si aún no se tenía.

### Eventos de recompensa

Los eventos de tipo `reward` dan recompensas especiales:

- `buriedArmory`: 3 objetos.
- Otros eventos de recompensa: 2 objetos.
- Cada objeto se genera con `makeLoot(nivelJugador + piso + 2, 'specialReward')`.
- El primer objeto tiene 60% de probabilidad de forzarse a Raro, Épico o Legendario al azar, filtrando antes por las rarezas permitidas en la progresión actual de piso/nivel.
- `fairyCache`: 65% de probabilidad adicional de enseñar una habilidad lootable.
- `forgottenShrine`: restaura vida, maná y stamina al máximo.
- `smugglerLocker`: da `40 + piso * 15` oro.

## 7. Objetos configurados vs. procedural

Cuando se genera un objeto con `makeLoot()`:

1. Se intenta crear un objeto configurado desde `config_items`.
2. Si existe un objeto configurado elegible y pasa una tirada del 55%, se usa ese objeto.
3. Si no, se puede generar una poción procedural.
4. Si tampoco se genera poción, se genera equipo procedural.

Los objetos configurados se filtran por rareza permitida en la fila de loot actual. No se filtran por slot ni por nivel configurado, pero su `iLvl` queda clampado al rango del piso.

## 8. Pociones

Antes del equipo procedural, `makeLoot()` puede devolver una poción con probabilidad:

```text
min(22%, 7% + piso * 2.5% + bonusBoss)
```

Donde `bonusBoss` es 8% si la fuente es `boss`; otras fuentes no añaden bonus en esta fórmula.

Las pociones usan `encounterLootQuality(source)` para su calidad y pueden tener efectos instantáneos, temporales o permanentes. Entre las definiciones existe `fortuneShot`, una poción épica con `lootLuck: 20` en su efecto descrito como `+20 de Suerte efectiva para botín durante 15 turnos`; `weightedRarity()` suma ese `lootLuck` temporal al bonus de Suerte para botín.

## 9. Afijos, pasivas y efectos especiales

### Afijos

El número de afijos depende de la rareza. Cada afijo elige una definición compatible con el slot y calcula valor así:

```text
scale = 1 + (iLvl - 1) * 0.16
valor = round(random(min..max) * scale * multiplicadorRareza)
mínimo = 1
```

Los afijos primarios pueden subir Fuerza, Vitalidad, Agilidad, Suerte, Inteligencia o Sabiduría. Los secundarios incluyen vida, stamina, maná, armadura, daño, crítico, evasión, poder físico/mágico y regeneraciones.

### Pasivas

La probabilidad de pasiva depende de la rareza:

- Común: 0%.
- Infrecuente: 15% de 1 pasiva.
- Raro: 45% de 1 pasiva.
- Épico: 85% de 1 pasiva.
- Legendario: 100% de 1 pasiva y 55% de una segunda.
- Artefacto: 100% de 1 pasiva y 75% de una segunda.

Pasivas disponibles: robo de vida, espinas, daño a enemigos bajos de vida, hallazgo de rareza, escudo por piso, recursos al matar, daño a jefes, armadura con poca vida, reducción de cooldown y aturdimiento.

### Efectos especiales

La probabilidad de efecto especial depende de la rareza:

- Raro: 12%.
- Épico: 42%.
- Legendario: 100%.
- Artefacto: 100%.

Los efectos disponibles incluyen impacto extra, segunda vida, atravesar pared, sobrecarga dual, berserk, conversión de oro en recursos, eco de skill y bonus por coleccionar rarezas distintas.

## 10. Habilidades como botín

Las skills lootables se eligen con pesos independientes:

| Rareza de skill | Peso | Multiplicador XP |
|---|---:|---:|
| Común | 45 | x1.00 |
| Infrecuente | 27 | x1.15 |
| Raro | 16 | x1.35 |
| Épico | 9 | x1.65 |
| Legendario | 3 | x2.10 |

Filtros de desbloqueo:

- no debe estar ya aprendida;
- si es skill de clase, debe pertenecer a la clase del jugador o ser usable por enemigos;
- Tier II requiere nivel 10;
- Tier III requiere nivel 30;
- rareza Rara requiere nivel >= 2;
- Épica requiere nivel >= 4;
- Legendaria requiere nivel >= 7.

## 11. Resumen rápido de porcentajes importantes

| Sistema | Porcentaje |
|---|---:|
| Segundo objeto en cofre | 24% |
| Skill desde cofre | `min(65%, 16% + piso * 2.5%)` |
| Drop de objeto de enemigo normal | `min(65%, 13% + SuerteFinal * 0.8%)` |
| Drop de objeto de jefe / jefe evento | 100% |
| Poción en `makeLoot()` | `min(22%, 7% + piso * 2.5% + 8% si boss)` |
| Objeto configurado si hay elegibles | 55% |
| Skill desde enemigo con skills normal / élite / jefe | 5.5% / 18% / 38% |
| Skill aleatoria fallback en enemigo normal/élite | 1.8% |
| Skill aleatoria fallback en jefe / jefe evento | 100% en esa rama |
| Primer objeto de evento reward forzado a Raro/Épico/Legendario | 60%, limitado a rarezas permitidas |
| Skill adicional en `fairyCache` | 65% |

## 12. Notas de implementación y balance

- La Suerte usada en el drop de enemigos es `derived.finalStats.luck`, igual que la Suerte usada para calidad en `weightedRarity()`, por lo que el equipo con Suerte afecta a cantidad y calidad.
- La calidad de rareza de objetos también usa `derived.rarityFind`; este valor acumula pasivas como `Olfato de Chatarra` y bonus raciales.
- El sistema diferencia cantidad de loot y calidad de loot: `rarityFind` mejora pesos de rareza, pero no aumenta directamente el número de cofres ni la probabilidad de que enemigos suelten objeto.
- La progresión de mundo limita rarezas altas antes de aplicar Suerte. Por eso mucha Suerte al inicio mejora sobre todo Raro frente a Común, pero no crea Legendarios/Artefactos antes de los umbrales.
- Los efectos de más `% de looteo` actualmente están representados como `rarityFind`: mejoran rareza, no cantidad.
