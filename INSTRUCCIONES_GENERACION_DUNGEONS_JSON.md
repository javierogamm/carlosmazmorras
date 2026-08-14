# Contrato completo para generar dungeons JSON con IA

> Versión del contrato: **1.0** · Compatible con la app **0.68.0** · `schemaVersion` del mundo: **4**.

Este documento enumera el contrato que debe seguir una IA para crear un JSON de dungeon compatible con **MAZMORRA // BOTÍN**. El formato recomendado es el contenedor `{ "world_name", "world_json" }`. No inventes claves alternativas, no incluyas comentarios dentro del JSON y conserva coordenadas enteras, índices de piso desde 1 y matrices rectangulares.

## 1. Reglas invariables

- La app consolida exactamente **6 pisos** (`params.floors` se normaliza a 6), aunque el generador interno contempla progresión más profunda en algunos arquetipos.
- La geometría efectiva del motor es una matriz de **49 × 49 tiles**. Los campos `fine.width` y `fine.height` se conservan como metadatos del editor (mínimo 15), pero actualmente no redimensionan el mapa generado.
- Cada fila de `map` debe tener 49 enteros y deben existir 49 filas.
- Valores del mapa: `0` transitable, `1` pared/bloqueo, `2` puerta cerrada y `3` puerta abierta.
- Las coordenadas usan `{ "x", "y" }`, origen arriba a la izquierda, `x` horizontal y `y` vertical. Valores válidos: 0–48; reserva el borde exterior como pared.
- `spawn`, `stairs`, entidades y objetos deben caer en tiles transitables y no solaparse. Nunca encierres la ruta `spawn → stairs`.
- Toda dungeon necesita al menos una familia consolidada en `enemy_family` y un tileset consolidado en `config_floor`. Para máxima compatibilidad, usa sus nombres e IDs reales exportados desde la app.
- No incluyas imágenes/base64/hex en un JSON solicitado a una IA. Referencia nombres, IDs y claves existentes.
- Por compatibilidad futura, conserva las claves desconocidas al editar un JSON existente.

## 2. Envoltorio raíz

```json
{
  "world_name": "Cripta de las seis señales",
  "world_json": {
    "schemaVersion": 4,
    "appVersion": "0.68.0",
    "worldName": "Cripta de las seis señales",
    "generatedAt": "2026-08-14T00:00:00.000Z",
    "story": "Historia general opcional.",
    "params": {},
    "lootTable": [],
    "floors": []
  }
}
```

| Campo | Tipo | Obligatorio | Regla |
|---|---:|:---:|---|
| `world_name` | string | sí | Nombre de la fila en `dungeon_worlds`. |
| `world_json.schemaVersion` | integer | sí | `4`. |
| `appVersion` | string | recomendado | Versión que creó el fichero. |
| `worldName` | string | sí | Normalmente igual a `world_name`. |
| `generatedAt` | ISO-8601 | recomendado | Fecha de generación. |
| `story` | string | no | Narrativa general. |
| `params` | object | sí | Reglas globales y plan por piso. |
| `lootTable` | array | sí | Progresión de loot por piso. |
| `floors` | array[6] | sí | Pisos pregenerados completos. |

La importación también tolera `world_json` directamente, pero el envoltorio evita ambigüedades.

## 3. Parámetros globales (`params`)

```json
{
  "damageReceivedPct": 125,
  "damageDealtPct": 100,
  "lifePct": 125,
  "xpReceivedPct": 100,
  "enemyCountPct": 100,
  "enemyLootPct": 100,
  "floors": 6,
  "apMode": false,
  "fine": {
    "story": "Narrativa general",
    "lootPerFloor": 4,
    "width": 49,
    "height": 49,
    "geometry": "rooms",
    "roomDensityPct": 100
  },
  "floorPlan": []
}
```

Los seis porcentajes aceptan **25–500**. `floors` termina siendo 6. `apMode` activa combate por puntos de acción. `fine.lootPerFloor` admite 0 o más; `width`/`height`, mínimo 15; `roomDensityPct`, mínimo 25.

### Geometrías declarables (`fine.geometry`)

| Valor | Uso esperado |
|---|---|
| `rooms` | Salas rectangulares/temáticas conectadas por corredores; valor predeterminado. |
| `maze` | Prioriza nudos, callejones, bucles y caminos falsos. |
| `arena` | Salas grandes y conexiones directas para oleadas. |
| `open` | Distrito abierto/ciudad, sin salas amuralladas convencionales. |

**Importante:** en la versión actual, el arquetipo de cada piso decide la geometría real; `fine.geometry`, tamaño, densidad y loot fino se almacenan y editan, pero no sustituyen por sí solos las reglas del arquetipo.

### Plan de cada piso (`params.floorPlan`)

Debe contener hasta 6 entradas:

```json
{
  "floor": 1,
  "floorId": "17",
  "familyName": "No muertos",
  "ambiente": "Cripta",
  "archetype": "laberinto",
  "story": "Las paredes murmuran."
}
```

- `floor`: 1–6.
- `floorId`: ID/nombre exacto del tileset de `config_floor`; vacío = aleatorio.
- `familyName`: nombre exacto de `enemy_family`; vacío = familia compatible aleatoria.
- `ambiente`: familia de assets de objetos del mundo; vacío = un ambiente aleatorio coherente para todo el piso.
- `archetype`: una de las posibilidades de la sección 5; vacío = selección ponderada.
- `story`: texto de entrada al piso, máximo recomendado 240 caracteres.

## 4. Todas las clases de sala (`room.type`)

Rangos `size`, `enemies`, probabilidades y flags usados por el generador:

| ID | Sala | Tamaño | Enemigos | Tier | Cobertura | Trampas | Cofre | Salidas | Particularidades |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| `filler` | Sala vacía | 3–5 | 0–1 | 0 | .15 | 0 | .10 | 2 | Relleno. |
| `combat` | Sala de combate | 4–7 | 2–4 | 0 | .30 | .10 | .20 | 2 | Combate estándar. |
| `ambush` | Emboscada | 4–6 | 3–6 | 0 | .20 | .25 | .15 | 2 | Enemigos en bordes. |
| `guardpost` | Puesto de guardia | 4–6 | 2–3 | +1 | .35 | .10 | .45 | 2 | Punto estrecho. |
| `eliteden` | Guarida de élite | 5–8 | 1–3 | +1 | .30 | .05 | .65 | 2 | Alta probabilidad de élite. |
| `vault` | Cámara acorazada | 3–5 | 0–2 | 0 | .10 | .45 | 100% | 1 | 2–4 cofres; algunos cerrados. |
| `arena` | Arena | 7–11 | 4–8 | 0 | .20 | .05 | .25 | 2 | Apta para oleadas. |
| `hub` | Encrucijada | 4–6 | 0–2 | 0 | .25 | .10 | .15 | 4 | Conecta rutas. |
| `traproom` | Sala trampa | 4–6 | 0–2 | 0 | .20 | .90 | .55 | 2 | Coloca 3–6 trampas. |
| `shrine` | Altar | 3–4 | 0 | 0 | .10 | 0 | .10 | 2 | Altar heal/shield/power. |
| `creator` | Sala del Creador | 3–4 | 0 | 0 | .10 | 0 | .10 | 2 | Altar `disenchant`; normalmente se fuerzan al menos 2. |
| `soulmerchant` | Mercader de Souls | 4–5 | 0 | 0 | .05 | 0 | 0 | 2 | Altar/mercader `soulmerchant`. |
| `deadend` | Callejón | 3–4 | 0–1 | 0 | .10 | .20 | .30 | 1 | Camino sin salida. |
| `knot` | Nudo de pasillos | 3–4 | 0–2 | 0 | .15 | .15 | .05 | 3 | Bifurcación. |
| `bossarena` | Arena del jefe | 8–11 | 0–2 | +1 | .25 | 0 | .35 | 1 | Jefe. |
| `megaboss` | Cámara del megajefe | 15–19 | 0 | +3 | .05 | 0 | .40 | 1 | Megajefe especial. |
| `prep` | Sala de preparación | 4–6 | 0–1 | 0 | .15 | 0 | .55 | 2 | Altar y preparación. |

`cover` controla pilares interiores bloqueantes; el anillo interior de paso y el centro quedan protegidos para no sellar salas. Una sala puede ser rectangular (aprox. 35% de casos, un eje ×1,6). La estructura puede reflejar salas con simetría `vertical`, `horizontal` o `point`; corredores, contenido y loot continúan aleatorios.

Forma de una sala:

```json
{"x": 4, "y": 8, "w": 7, "h": 5, "cx": 7, "cy": 10, "type": "combat"}
```

## 5. Todos los tipos de piso/arquetipos

| ID | Disponible | Salas / tamaño | Geometría | Enemigos | Recompensa | Objetivo / rasgos |
|---|---:|---|---|---|---|---|
| `standard` | piso 1+ | 26–40 / 3–8 | normal, loops .15 | densidad 1; boss en pares | cofres ×1, rareza +0 | `stairs`; equilibrado. |
| `superboss` | piso 8+ | 18–26 / 4–8 | normal, loops .10 | densidad .5; superjefe +1–3 tiers | ×1.3, +2 | `bossKill`, anuncio. |
| `laberinto` | piso 3+ | 40–56 / 3–4 | maze, loops .55, deadEnds .35 | densidad .55 | ×1.15, +1 | `stairs`. |
| `horda` | piso 4+ | 14–22 / 6–11 | arena, loops .30 | densidad 1.35, oleadas | ×1.2, +1 | `waves`; no fuerza salas creator. |
| `elites` | piso 5+ | 16–24 / 4–8 | normal, loops .20 | densidad .32, élite ×6, tier +1, minijefe | ×1.35, +2 | `stairs`. |
| `bossrush` | piso 12+ | 12–18 / 6–10 | arena, loops .15 | hasta 4 arenas/jefes | ×1.5, +3 | `bossKill`, anuncio. |
| `tesoro` | piso 3+ | exactamente 4 / 3–6 | normal, loops .25 | densidad .45, tier mínimo III | ×2.8, +3 | `stairs`, emboscada codiciosa. |
| `supervivencia` | piso 6+ | 16–24 / 5–9 | arena, loops .35 | densidad .9, escalada | ×1.4, +2 | `survive`, anuncio. |
| `contrarreloj` | piso 7+ | 22–32 / 4–7 | normal, loops .40 | densidad .7 | ×1.3, +2 | `timed`, anuncio. |
| `city` | piso 4+ | 16 zonas / 6–11 | `open` | densidad .85, boss en pares | ×1.1, +1 | `stairs`; calles abiertas y edificios-assets. |
| `megaboss` | especial | cámara 15–19 | cámara única/especial | megajefe | recompensa máxima contextual | `bossKill`; seleccionable explícitamente. |

Con una dungeon de 6 pisos, los mínimos 7/8/12 hacen que `contrarreloj`, `superboss` y `bossrush` no salgan aleatoriamente por peso. Sí pueden forzarse con `floorPlan.archetype`. El **piso 6** siempre culmina en `megaboss` o `bossrush` si no se fuerza otro tipo; además, en múltiplos de 3 hay un 33% de megaboss. Los tipos pesados (`superboss`, `bossrush`) no se encadenan aleatoriamente y existen cooldowns de 3–9 pisos.

### Pesos de salas por arquetipo

- `standard`: filler 26, combat 30, ambush 10, guardpost 8, eliteden 5, vault 4, hub 6, traproom 4, shrine 3, creator 2, soulmerchant 2, deadend 4, knot 4.
- `superboss`: prep 16, shrine 10, creator 2, filler 20, combat 16, guardpost 10, eliteden 8, vault 6, hub 6, deadend 4.
- `laberinto`: knot 24, deadend 20, filler 18, hub 12, traproom 10, combat 8, vault 5, shrine 3, creator 2.
- `horda`: arena 34, combat 24, filler 14, hub 10, ambush 8, eliteden 5, vault 5.
- `elites`: eliteden 30, combat 20, guardpost 14, filler 12, vault 8, hub 6, shrine 5, creator 2, arena 5.
- `bossrush`: bossarena 30, prep 16, arena 16, shrine 12, creator 2, filler 12, vault 8, hub 6.
- `tesoro`: vault 30, filler 18, traproom 14, combat 12, guardpost 10, deadend 8, hub 5, shrine 3, creator 2.
- `supervivencia`: arena 26, combat 22, filler 16, hub 12, ambush 10, eliteden 8, shrine 6, creator 2.
- `contrarreloj`: combat 24, filler 20, hub 16, knot 12, traproom 10, vault 8, guardpost 6, shrine 4, creator 2.
- `city`: filler 26, combat 22, guardpost 12, vault 8, shrine 8, creator 6, hub 8, eliteden 6, traproom 4.

## 6. Contrato completo de cada piso

```json
{
  "floor": 1,
  "map": [[1, 1, 1]],
  "rooms": [],
  "safeRooms": [],
  "spawn": {"x": 2, "y": 2},
  "stairs": {"x": 46, "y": 46},
  "doors": [],
  "keys": [],
  "chests": [],
  "traps": [],
  "altars": [],
  "assets": [],
  "event": null,
  "archetype": "standard",
  "archetypeLabel": "Piso estándar",
  "archetypeDesc": "Mezcla equilibrada de salas.",
  "objective": {"type": "stairs", "done": false, "label": "Encuentra la salida"},
  "tierExpected": 1,
  "rewardRarityBonus": 0,
  "announce": false,
  "enemies": [],
  "enemyFamily": "No muertos",
  "enemyFamilyId": 12,
  "themeName": "Cripta",
  "floorTileset": {},
  "boss": null,
  "story": "Narrativa opcional."
}
```

### Posibilidades de contenido

- `safeRooms`: copias de sala con `id` (`safe-<floor>-<n>`) y `rested:false`; 1 en supervivencia, normalmente 2–4 en otros pisos, alejadas del spawn.
- `doors`: `{x,y,locked,open}`; las cerradas usan tile 2. `keys`: `{x,y,picked:false}`.
- `traps`: `{x,y,dmg,revealed:false,sprung:false}`; daño base aproximado `4 + floor × 1.6`, mínimo 3.
- `altars`: `{x,y,kind,used:false}`. `kind`: `heal`, `shield`, `power`, `disenchant`, `soulmerchant`.
- `event`: `null` o `{id}`. En objetivos de escaleras aparece con probabilidad 12%; en otros, 6%. Usa IDs existentes del juego.
- `objective.type`: `stairs`, `bossKill`, `waves`, `survive` o `timed`; incluye `done:false` y etiqueta legible. Si se pide matar jefe pero no existe, usa `stairs`.
- `boss`: referencia/objeto compacto del primer jefe, o `null`. El jefe también aparece en `enemies`.

## 7. Enemigos y familias

La composición siempre debe proceder de una familia existente. Una familia consolidada tiene esta forma conceptual:

```json
{
  "name": "No muertos",
  "enemies": [
    {
      "type": "skeleton",
      "class": "Guerrero esqueleto",
      "tier": "i",
      "boss": false,
      "stats": {"strength": 3, "vitality": 3, "agility": 2, "luck": 1, "intelligence": 1, "wisdom": 1},
      "skillIds": []
    }
  ]
}
```

Posibilidades:

- Tiers de enemigo: `i`, `ii`, `iii`, `iv` (la profundidad/nivel esperado selecciona el adecuado).
- Rol: enemigo normal, `elite:true`, boss (`boss:true`), minijefe, superjefe con `superBoss:true` y `phases`, o megaboss.
- Una élite recibe prefijo `Élite`, HP ×1.5, ataque ×1.28 y XP ×1.8.
- Bonus positivo de tier por sala/arquetipo: HP +22%, ataque +15%, XP +20% por nivel. Bonus negativo: HP ×.75 y ataque ×.8.
- Presupuesto aproximado: `(30 + floor × 4.5 + aleatorio 0–10) × densidad del arquetipo × populationScale × enemyCountPct/100`.
- Boss estándar: en piso par; en impar existe 8% de posibilidad. En profundidades altas puede haber campeones adicionales.
- `enemyCountPct` altera cantidad. `lifePct` altera vida global. `damageReceivedPct`, `damageDealtPct` y `xpReceivedPct` alteran el balance del jugador; `enemyLootPct` altera drops enemigos.

Un enemigo pregenerado compacto debe conservar al menos identidad, posición, vida/ataque/defensa, tier/rol, XP, familia y habilidades que entregue la exportación real de la app. No inventes `skillIds`: usa IDs configurados.

## 8. Loot, cofres y rarezas

Rarezas posibles, en orden:

| ID | Nombre | Peso base | Afijos | Multiplicador | Pasivas/efectos |
|---|---|---:|---:|---:|---|
| `common` | Común | 48 | 1–2 | 1.00 | sin pasiva/efecto base |
| `uncommon` | Infrecuente | 27 | 2–3 | 1.15 | 15% pasiva |
| `rare` | Raro | 15 | 3–4 | 1.35 | 45% pasiva, 12% efecto |
| `epic` | Épico | 8 | 4–5 | 1.65 | 85% pasiva, 42% efecto |
| `legendary` | Legendario | 2 | 5–6 | 2.10 | pasiva y efecto garantizados |
| `artifact` | Artefacto | .6 | 6–7 | 2.65 | pasiva/efecto, 75% segunda pasiva |

Tipos configurables de cofre (`chestDef.type`): `equipment`, `weapon`, `potion`, `skill`. Tiers de cofre: **1–5**. Cada cofre puede filtrar rarezas y objetos concretos. Si `config_chest` está vacío no se colocan cofres normales.

Forma recomendada:

```json
{
  "x": 10,
  "y": 7,
  "opened": false,
  "locked": false,
  "chestDef": {
    "name": "Cofre de cripta",
    "tier": 2,
    "type": "equipment",
    "rarities": ["uncommon", "rare"],
    "specificItemIds": []
  }
}
```

Reglas del generador:

- Mínimo orientativo: `(8 + floor(floor × .6)) × multiplicador de cofres del arquetipo` si existen cofres configurados.
- Se mejoran 1–2 cofres un tier sobre el límite del piso cuando ese tier existe.
- Las cámaras acorazadas generan 2–4 y pueden cerrarlos con llave.
- Pueden añadirse cofres bonus de pociones.
- `rewardRarityBonus` va de 0 a 3 según arquetipo y mejora recompensas.
- `lootTable` raíz debe tener una entrada por piso. Si no puedes reproducir el catálogo configurado, exporta una dungeon desde la app y úsala como plantilla: no inventes IDs de objetos.

## 9. Tilesets / tipos de suelo (`floorTileset`)

El tileset procede de `config_floor`. Debes usar el objeto exportado por la instalación, porque nombres y aspecto son configurables. Campos conceptuales que deben conservarse:

```json
{
  "name": "Cripta",
  "floorColor": "#334735",
  "wallColor": "#241a2c",
  "doorColor": "#a26d3d",
  "openDoorColor": "#ffc35a"
}
```

La implementación compacta puede incluir colores, patrones y referencias de tiles que existan en la configuración. Posibilidades lógicas de celda, independientemente del tema visual:

1. suelo transitable (`map=0`),
2. pared/pilar/asset bloqueante (`map=1` o máscara de asset),
3. puerta cerrada (`map=2`),
4. puerta abierta (`map=3`),
5. sala segura (overlay lógico),
6. suelo especial del Mercader de Souls (overlay dorado),
7. trampas/altares/escalera/cofres como objetos sobre el suelo.

`themeName` debe coincidir con `floorTileset.name`. `floorPlan.floorId` fija un tileset; si falta o no existe, se selecciona uno compatible al azar.

## 10. Assets de objetos del mundo y ambientes

Cada piso usa **un solo ambiente coherente**. Si `floorPlan.ambiente` existe y contiene assets, se usa; si no, se elige al azar un ambiente existente. Si ningún asset tiene ambiente, todos son elegibles.

Asset colocado:

```json
{
  "key": "asset_abc123",
  "name": "Estatua rota",
  "x": 12,
  "y": 9,
  "cols": 2,
  "rows": 3,
  "mask": [[true, true], [true, false], [true, true]],
  "ambiente": "Cripta"
}
```

- `cols`/`rows`: 1–49; huella en tiles.
- `mask`: matriz `rows × cols`; `true` bloquea a PJ y monstruos, `false` es transitable.
- Se coloca dentro de salas mayores que su huella, manteniendo libre el borde para no sellarlas.
- Un asset grande puede ampliar el máximo de sala hasta `max(cols,rows)+2`, limitado por el mapa.
- `icon` no debe incluirse en peticiones a IA ni en la exportación de ambientes.

En **Configuración → Objetos del mundo → Assets de decoración** hay un botón global y uno por ambiente. Su JSON exporta: nombre del ambiente, número de assets, totales de tiles, bloqueados/transitables, máximos de columnas/filas y, por asset, `objectKey`, nombre, dimensiones y máscara de colisión. Este es el catálogo que debe entregarse a la IA junto con este documento.

## 11. Checklist obligatorio para una IA

Antes de devolver el JSON, comprueba sin añadir texto dentro del bloque JSON:

1. Hay exactamente 6 pisos, numerados 1–6.
2. Cada `map` es 49×49 y solo contiene 0, 1, 2 o 3.
3. El borde completo es pared.
4. `spawn`, `stairs`, enemigos, cofres, llaves, trampas, altares y assets están dentro de rango.
5. Existe ruta transitable entre spawn y salida/objetivo.
6. `rooms` no sale del mapa y `cx/cy` está dentro de su sala.
7. Los IDs de arquetipo y sala pertenecen a este documento.
8. Familia, enemigos, skills, cofres, items, tilesets y assets proceden de exportaciones reales, no son IDs inventados.
9. Cada máscara de asset tiene exactamente `rows` filas y `cols` booleanos por fila.
10. `enemyFamily`/`enemyFamilyId`, `themeName`/`floorTileset` y `boss`/`enemies` son consistentes.
11. Los cofres empiezan con `opened:false`; trampas con `revealed:false,sprung:false`; altares con `used:false`.
12. No hay imágenes, data URLs ni hexadecimal de PNG.
13. El fichero es JSON válido UTF-8, sin comentarios, comas finales ni Markdown alrededor si se va a importar directamente.

## 12. Prompt recomendado

```text
Genera un único JSON válido para MAZMORRA // BOTÍN schemaVersion 4.
Sigue literalmente INSTRUCCIONES_GENERACION_DUNGEONS_JSON.md.
Usa exactamente 6 pisos y matrices map de 49x49.
No inventes IDs ni nombres: usa solamente los catálogos de familias enemigas,
tilesets, cofres/items y ambientes que adjunto. No incluyas imágenes.
Valida posiciones, colisiones, máscaras y una ruta spawn→stairs.
Devuelve exclusivamente JSON, sin bloque Markdown ni explicación.

Tema e historia: [DESCRIBIR]
Dificultad global: [PORCENTAJES]
Plan de pisos: [ARQUETIPO, TILESET, FAMILIA, AMBIENTE E HISTORIA POR PISO]
```

### Flujo aconsejado

1. Exporta las familias de enemigos desde **Enemigos**.
2. Exporta/consulta los floors y cofres/items configurados.
3. Exporta todos los ambientes desde **Objetos del mundo**.
4. Adjunta esos catálogos y este MD a la IA.
5. Pide primero `params` y `floorPlan` si quieres revisar el diseño; después solicita el mundo completo.
6. Importa el resultado en **Configuración → Dungeons → Importar JSON** y revisa la vista previa antes de consolidar.
