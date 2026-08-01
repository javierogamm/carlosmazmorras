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

Equipo, pociones y skills comparten la misma lista ordenada de componentes `effects[]`. Antes de generar un componente, consulta la tabla y las fórmulas completas de `skills-json-rules.md`. Kinds soportados por el editor actual:

`dmg`, `dot`, `buff`, `debuff`, `heal`, `cc`, `drain`, `aoe`, `multihit`, `mark`, `summon`, `summonturret`, `utility`, `hot`, `execute`, `pullroot`, `counter`, `cheatdeath`, `holyshield`, `lineshot`, `trap`, `clones`, `linkdamage`, `invisible`, `ascend`, `transform`.

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
