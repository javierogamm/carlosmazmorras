# Estadísticas y su efecto real en el motor

> Referencia de la versión **0.61.0**. Este documento describe lo que calcula el código, no solo los textos de la interfaz. Los valores de raza, equipo y buffs se vuelven a consolidar mediante `recomputeDerived()`.

## Flujo de cálculo

1. Se parte de los seis atributos base de la clase: Fuerza, Vitalidad, Agilidad, Suerte, Inteligencia y Sabiduría.
2. Se suman los atributos de raza.
3. Se incorporan afijos y pasivas del equipo.
4. Los buffs de atributo se aplican como suma (`add`), multiplicador (`mult`) o, para datos antiguos, porcentaje decimal.
5. Se recalculan vida, stamina, maná, daño, armadura y estadísticas secundarias. Los recursos actuales nunca pueden quedar por encima de sus nuevos máximos.

## Atributos primarios

| Stat | Efecto directo y fórmulas |
|---|---|
| **Fuerza (FUE)** | `+4` de stamina máxima por punto. El personaje nace con daño base `2 + FUE`. En ataques físicos de skill es el atributo principal; Agilidad aporta como secundario. En armas asociadas a Fuerza, el bonus es `floor((FUE×2 + AGI) / 3)`. También participa en defensas de Fuerza. |
| **Vitalidad (VIT)** | `+6 HP` máximos por punto (`3×VIT` en la base y otros `3×VIT` mediante el bonus de vitalidad). El personaje nace con armadura base `4 + floor(VIT/2)`. La Vitalidad añadida por equipo/buffs da igualmente `+6 HP` y `floor(0,6 × VIT adicional)` de armadura. Participa en defensas físicas. |
| **Agilidad (AGI)** | `+2` de stamina máxima por punto; visión inicial `4 + floor(AGI/4)`; PA máximos `30 + ceil(AGI/2)`. Es principal de armas ágiles y secundaria habitual del daño físico. Participa en defensa/evasión y detección de trampas. |
| **Suerte (SUE)** | Crítico efectivo de ataques: `min(75%, 4% + SUE×1,5% + buffCrit)`. Mejora el peso de rareza del loot en `SUE×0,14`, interviene en eventos y actúa como atributo ofensivo automático de efectos que no sean físicos ni mágicos. |
| **Inteligencia (INT)** | `+3` de maná máximo por punto. Es principal del daño mágico y secundaria de las armas/efectos vinculados a Sabiduría. Participa en defensas de Inteligencia. |
| **Sabiduría (SAB)** | `+5` de maná máximo por punto. Es secundaria normal del daño mágico, atributo de curaciones concretas y defensa frente a numerosos hechizos. |

## Recursos y supervivencia

### Vida

```text
HP máximo = 30 + VIT×6 + bonus racial fijo + afijos/pasivas/buffs de maxHp
```

El daño entrante primero se suaviza contra un presupuesto dependiente del piso y nivel. Después se aplica el multiplicador base enemigo `0,55`, un `+2` si la fuente parece jefe y el ajuste de dificultad del mundo. Luego se resuelve una defensa `1d20 + defensa` contra `CD = 10 + floor(potencia×0,75)`: éxito reduce el daño a la mitad, 20 natural lo evita y 1 natural lo eleva al 125%. Escudos de absorción se consumen antes de HP.

La armadura alimenta sobre todo la tirada defensiva: Fuerza/Vitalidad reciben `floor(armadura/3)` y los demás atributos `floor(armadura/6)`. Un escudo equipado puede añadir bloqueo; el bloqueo está limitado al 75% y reduce otro 50% del daño restante.

### Stamina

```text
Stamina máxima = 45 + FUE×4 + AGI×2 + bonus y afijos
```

Paga skills físicas y otras acciones configuradas. No existe regeneración base ni escalado automático por atributos. Al final del turno solo se recupera `derived.staminaRegen`, procedente de equipo de mano secundaria, raza o buffs/pociones.

### Maná

```text
Maná máximo = 30 + SAB×5 + INT×3 + bonus y afijos
```

Paga skills mágicas. Igual que la stamina, su regeneración natural es **cero**: `manaRegen` solo procede de afijos de mano secundaria, rasgos raciales o buffs/pociones y se aplica una vez por turno.

### Puntos de Acción (modo PA)

```text
PA máximos = round((30 + ceil(AGI/2)) × buffs multiplicativos de PA + buffs planos de PA)
```

Se rellenan al comenzar el turno. Mover, atacar, usar objetos y skills descuentan su coste específico; cuando no quedan PA suficientes termina la fase del jugador.

## Daño causado

Un ataque básico tira el dado del arma (o `1d4` sin arma), suma un 30% del daño agregado y el bonus de los atributos asociados al tipo de arma. Una skill usa sus dados configurados y su stat explícita; si no existe, el motor elige Fuerza/Agilidad para físico, Inteligencia/Sabiduría para magia y Suerte/Sabiduría para el resto.

Antes de restar HP se aplican, en este orden conceptual, bonus de stat, buffs planos y multiplicativos, multiplicador de siguiente skill, dificultad `damageDealtPct`, marcas sobre el enemigo, defensa y crítico. El crítico de jugador multiplica por **1,75**. El daño nunca baja de 1 salvo evasión completa.

Los DOT tiran sus dados una vez al aplicarse y conservan esa potencia durante su duración. HOT, drenaje y curación usan la potencia configurada y respetan los máximos del objetivo.

## Secundarias y afijos

| Stat interna | Impacto actual |
|---|---|
| `damage` | Se suma al daño agregado; los buffs pueden ser planos o multiplicativos. En el ataque básico solo el 30% del agregado entra como bonus porque el atributo del arma lleva el peso principal. |
| `armor` | Aumenta la defensa de todas las tiradas y puede escalar skills concretas. Incluye armadura base, equipo, buffs y escudo general. |
| `blockChance` | Probabilidad porcentual de bloquear y reducir a la mitad el daño tras la defensa; máximo 75%. Los escudos garantizan 5/10/15/20/25% según tier. |
| `critChance` | Los buffs activos se leen como puntos porcentuales. El crítico real usa la Suerte base del jugador; el campo derivado de raza/equipo se conserva para UI/datos, pero actualmente no entra en `critChance()`. |
| `critDamage` | Se calcula/almacena con base 150, pero el ataque del jugador usa actualmente un multiplicador crítico fijo de 1,75. |
| `dodge` | El campo derivado se calcula con `AGI×0,45 + bonus`; la defensa ordinaria ya usa el atributo elegido. La esquiva aleatoria adicional solo lee buffs activos de `dodge` y tiene tope 60%. |
| `physicalPower` / `magicPower` | Se consolidan desde raza, equipo o pasivas para visualización/configuración, pero el daño vigente escala mediante dados, stats y `damage`; no hay un multiplicador global que consuma directamente estos dos campos. |
| `staminaRegen` / `manaRegen` | Cantidad plana recuperada por turno; sin baseline. |
| `rarityFind` | Añade `valor×0,18` al bonus usado al ponderar rareza. El nivel añade `(nivel−1)×0,18` y la Suerte `SUE×0,14`. |
| `vision` | Radio inicial `4 + floor(AGI/4)`; controla revelado y objetivos visibles. |

## Experiencia, nivel y mundo

La XP recibida se redondea hacia arriba después de multiplicar el valor por el rasgo racial `xpMult` y por `xpReceivedPct` del mundo. Al subir de nivel se aplican crecimientos propios de la clase, se restauran vida/stamina/maná y se ofrecen puntos de stat o skills en los hitos correspondientes.

Los parámetros del mundo modifican globalmente daño causado, daño recibido, vida, XP, cantidad de enemigos y loot. Sus porcentajes se normalizan entre 25% y 500%. `lifePct` interviene al crear/escalar entidades; `damageDealtPct` multiplica el daño del jugador y `damageReceivedPct` ajusta la normalización del daño enemigo.

## Razas: efectos especiales

Además de sumar atributos, las razas pueden aportar armadura/HP fijos, máximo de recursos, crítico/dodge derivados, regeneración de maná, hallazgo de rareza o XP. `floorHeal` cura al entrar en cada piso. Estos bonus pasan por el mismo recálculo que el equipo; las salvedades de crítico, dodge y poderes físico/mágico indicadas arriba también se aplican a los rasgos raciales.
