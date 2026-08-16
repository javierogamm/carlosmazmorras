# Class Skill JSON Rules

Reference for hand-writing/generating skill JSON for the class editor (`config_class.skills_json`). Written in English to stay token-cheap. This document is exhaustive: every field, every effect kind, every default, every runtime quirk that matters for authoring correct skills.

The `effects[]` component catalog in §3-§5 is not skill-only: equipment (`reglas json objetos.md`) and potions (`reglas json pociones.md`) run the exact same stack (`applySkillEffectsList`/`applyEffectComponent`), and both of those documents keep their own inlined copy of this same catalog for convenience. This file stays the authoritative source — if a copy ever drifts, this one wins, since it's also the only place with the full damage-formula/AP-cost/enemy-AI reference (§6-§7).

## 1. Where this data lives

- Table `config_class`, one row per class, columns:
  - `class_json`: `{ classId, name, desc, icon, stats, starterSkills, resourceBias }`
  - `skills_json`: an **object keyed by skill id** → skill object (schema in §2). This is what you generate.
- Skill ids must be unique across the whole game (built-ins + all classes' `skills_json`). Convention: `<classId>_<slug>_<n>` or `<classId>_custom_<n>`. Any unique string works.
- `classId` for a new custom class: `slugifyClassName` produces `custom_<lowercased-alnum-name>_<4-char-random>`. Existing built-in classIds: `yunque, berserker, necromancer, paladin, jester, sniper, shaman, thief, cleric, entropyMage, bountyHunter, druid, monk, engineer, seer, beastGuardian`.
- `unlock` is always `"Clase"` for these.

## 2. Top-level skill object

```json
{
  "name": "string, required",
  "icon": "single emoji/char, fallback ✦",
  "iconImage": "hex-encoded 50x50 PNG, optional, overrides icon",
  "desc": "string",
  "cd": "int >=1, cooldown in turns, default 5",
  "apCost": "int >=0, AP-mode cost, default 10",
  "resource": "\"stamina\" | \"mana\"",
  "cost": "int >=0, resource cost per cast",
  "type": "\"physical\" | \"magic\" | \"utility\"",
  "rarity": "\"common\" | \"uncommon\" | \"rare\" | \"epic\" | \"legendary\"",
  "range": "int >=0, 0 = melee",
  "targetMode": "\"\" | \"self\" | \"enemy\" | \"area\" (optional; auto-derived from effects[] when omitted, see §4)",
  "classEffect": "string, see §7 — still meaningful even with effects[], see §6.4",
  "tier": "1 | 2 | 3",
  "classId": "string, the owning class",
  "enemyUsable": "bool, default true — can enemies of a matching class cast this too",
  "effects": "array of effect components, see §3 — THE mechanic definition. Omit/empty = legacy classEffect-only skill (not recommended; every skill should carry at least one effect).",
  "unlock": "\"Clase\""
}
```

Notes:
- `rarity` is now mostly cosmetic (icon border color) — `tier` drives power scaling everywhere that matters.
- `type` and `classEffect` both feed the enemy-AI heuristic (§6.4) — set them even though `effects[]` is authoritative for the player-cast behavior.

## 3. Effects array — general rules

`effects` is an **ordered list of independent components**. Each component is applied in order; the skill "succeeds" (consumes cost/cooldown/CD) if at least one component did something.

Exception: any `move` component (dash/teleport, §4.6) always resolves **before every other component**, regardless of where it sits in the array — you don't need to list it first. Once it lands, any following area-style component (`aoe`, or a `dmg`/`dot`/`debuff`/`cc` targeting `area`) is centered on the caster's *new* position, not on the pre-move click. This is what makes a stacked "teleport/dash + damage" skill land next to the enemy first and only then roll its damage.

Common component shape: `{ "kind": "<kind>", "target": "...", ...kind-specific fields }`.

### 3.1 Shared "dice block" (prefix defaults to `dmg`, some kinds use `dot`)

Used by: `dmg`, `heal`, `drain`, `aoe`, `multihit`, `execute`, `hot`, `counter`, `summon`, `summonturret`, `clones`, `lineshot`, `linkdamage`, `trap` (all prefix `dmg`), and `dot` (prefix `dot`). Los dados fijan la magnitud base. Los campos legacy de stat/coefficient se ignoran: el bonus automático se calcula con INT para daño/DOT/debuff y con SAB para curación/utilidad. `trap` computes but then discards its own dice/stat magnitude entirely — see §4.23.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `{p}Dice` | int >=0 | 0 | number of dice. `0` = use an automatic fallback formula instead of a fixed roll (only applies where noted). |
| `{p}Die` | 4\|6\|8\|10\|12\|20 | 6 | die size |
| `{p}Stat` | one of §5 stat keys, or `""` | `""` | stat used to scale the roll. `""` = no per-component scaling (falls back to a generic type-based bonus — see §6.1/§6.2). |
| `{p}StatMode` | `"add"` \| `"mult"` | `"add"` | how the stat contributes |
| `{p}StatCoef` | number | `1` (add) / `.02` (mult) | scaling coefficient |

**Self-targeted magnitude formula** (`dicePowerFor`, used for: `dmg` w/ `target:self`, `heal`, `drain` heal-back, `hot`):
```
roll = {p}Dice d {p}Die
contribution = StatMode==='mult' ? roll * statValue * StatCoef(default .02) : statValue * StatCoef(default 1)
power = max(1, round(roll + contribution))
```
If `{p}Dice` is 0, a hand-tuned per-kind fallback (roughly `~8 + skillLevel*2..4`) is used instead.

**Enemy-targeted damage** (`dmg` w/ target enemy/area, `aoe`, `multihit`, `execute`): the dice roll AND the stat scaling (via `{p}Stat`/`{p}StatMode`/`{p}StatCoef`) both apply through the normal `attack()` pipeline (§6.3). If `{p}Dice` is 0, a generic tier/resource-based dice expression is used instead (except damage summons, which deal no damage) (stat scaling in that fallback case comes from a generic type-based bonus, not `{p}Stat`).

### 3.2 Target resolution

Per-component `target` field, where applicable (see §4 table for which kinds accept which target values):
- `"enemy"`: the clicked enemy, or nearest visible enemy if the skill is self-cast.
- `"area"`: for damage/debuff-style kinds (`dmg`, `dot`, `debuff`, `cc`, `fear`, `mesmer`, `drain`, `mark`, `execute`, `pullroot`) — all enemies within `range` tiles (Chebyshev distance) of the clicked/cast tile, with line of sight (`resolveComponentEnemyTargets`). For `heal`/`hot` — all allies (companions + other human players) within `range` tiles of the cast point, via the analogous `resolveComponentAllyTargets` (see §4.5/§4.16 for exactly who counts as an "ally" and how each is healed).
- `"self"`: the caster.
- `"ally"`: clicked ally (multiplayer only).

### 3.3 Whole-skill target mode (auto-derived, `effectsListTargetMode`)

Priority: any component targets `enemy` → whole skill needs an enemy click. Else any targets `area` (or is a `move` with `mode:"teleport"`) → needs a tile click. Else any targets `ally` → needs an ally click. Else → casts instantly on button press (no click needed), e.g. a skill with only `buff`/`heal(self)`/`hot`/`cheatdeath`/`counter` components.

## 4. Effect kinds — full reference

Legend: **Target opts** = allowed `target` values (— = no target field, implicit). **AP-relevant** fields don't exist per component; AP is skill-level only (`apCost`).

| kind | Target opts | Purpose |
|---|---|---|
| `dmg` | enemy, area, self | direct damage (or self-damage) |
| `dot` | enemy, area | damage-over-time status |
| `buff` | self (implicit) | stat buff on caster |
| `debuff` | enemy, area | stat debuff on target(s) |
| `heal` | self, ally, area | instant heal (+ resource restore if self/area) |
| `move` | — | dash-and-hit or teleport |
| `cc` | enemy, area | stun/freeze/silence/root |
| `fear` | enemy, area | target flees and spends all AP moving for N turns; WIS resistance, capped at 30% |
| `mesmer` | enemy, area | target changes sides for N turns; INT resistance, capped at 30% |
| `drain` | enemy, area | damage enemy, heal+restore resource for self |
| `aoe` | — (always area around cast point) | area damage with explicit radius |
| `multihit` | — (always the resolved single target) | N repeated hits on one target, paced 0.5s apart |
| `mark` | enemy, area | target takes +X% damage from ALL sources for N turns |
| `summon` | — | mobile ally, author-configurable effect type (incl. permanent "Compañero" pets) |
| `summonturret` | — | **stationary**, long-range ally, same effect types as `summon` |
| `clones` | — | 1-4 mobile allies spawned at once, same effect types as `summon` |
| `utility` | — | reveal map / stealth / flat shield / restore resource |
| `hot` | self, area | heal-over-time on caster (+ allies if area) |
| `execute` | enemy, area | normal hit, multiplied if target is below an HP% threshold |
| `pullroot` | enemy, area | pulls target 1 tile toward caster, then roots |
| `counter` | — (self) | shield + arms a one-time counterattack |
| `cheatdeath` | — (self) | survive the next lethal hit at 1 HP |
| `holyshield` | — (self) | absorb-shield: soaks damage before it touches HP |
| `lineshot` | — (line toward clicked/nearest enemy) | piercing shot, hits every enemy on the line |
| `trap` | — (cast tile) | invisible trigger, hits whoever steps on it |
| `linkdamage` | — (always the resolved single target + jumps) | chain-lightning style jumping hit with falloff |
| `invisible` | — (self) | enemies skip their turn for N turns |
| `ascend` | self (implicit, buff-typology) | changes % skill-cost of a resource while active, optional icon swap |
| `transform` | self (implicit, buff-typology) | %-based stat changes + custom icon, optionally blocks other skills |

### 4.1 `dmg` — Damage
```json
{ "kind":"dmg", "target":"enemy", "dmgDice":2, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":1 }
```
- `target:"self"` → direct self-damage (magnitude via dicePowerFor, no defense roll).
- `target:"enemy"/"area"` → normal attack roll + defense save on the enemy. `area` uses `range` (default 2) as radius and applies an implicit ×0.85 multiplier unless `multiplier` is set.
- Optional: `multiplier` (number, overrides the default 1 / 0.85 for area).

### 4.2 `dot` — Damage over time
```json
{ "kind":"dot", "target":"enemy", "dotDice":1, "dotDie":6, "dotStat":"strength", "dotStatMode":"add", "dotStatCoef":.5, "turns":4, "flavor":"dot" }
```
- `flavor`: `"dot" | "bleed" | "burn" | "poison"` — purely a status label used for enemy status display/stacking key, no mechanical difference.
- Applies a front-loaded ~0.7x generic hit, then a status dealing `dotPowerFor(this, ~2+lvl*.7)` per turn for `turns` turns (rolled once at application, then fixed for the duration).

### 4.3 `buff` — Self buff
```json
{ "kind":"buff", "target":"self", "stat":"strength", "mode":"add", "value":5, "turns":6 }
```
- `stat`: any of §5 core stats, plus `armor`, `damage`, `ap`, `skilleffect`, `dodge`, `critChance`, `blockChance`, `manaRegen`, `staminaRegen`.
- `mode`: `"add"` (flat +value) or `"mult"` (stat ×value — value is a raw multiplier, e.g. `1.2` = +20%, NOT a percentage number).
- Defaults: `value` 5, `turns` 6.
- `dodge`/`critChance`/`blockChance` only make sense in `"add"` mode — `value` there is **percentage points** (e.g. `10` = +10% dodge chance), not a multiplier. Total buff-derived `dodge` is capped at 60%; `critChance` (base ~4%+luck*1.5%, plus buffs) is capped at 75% overall. `blockChance` folds into `recomputeDerived()`'s existing block-chance total (no cap of its own beyond the normal derived-stat clamp).
- `manaRegen`/`staminaRegen` add flat points per turn on top of the character's normal regen (folded in by `recomputeDerived()`, same as `armor`/`damage`).
- `armor`/`damage` are aggregate multipliers/bonuses read live from active buffs at the point of use (`activeBuffMultFactor`/`activeBuffFlatBonus`), not baked into `recomputeDerived()`.

### 4.4 `debuff` — Enemy debuff
```json
{ "kind":"debuff", "target":"enemy", "stat":"damage", "mode":"add", "value":2, "turns":3 }
```
- `stat`: `damage`, `ap` or `skilleffect` only (no `armor` — enemies have no armor stat this system reads, so an armor debuff would be an inert no-op; the dodge/crit/block/regen stats added to `buff` are likewise not offered here for the same reason — enemies have no baseline value in any of those to subtract from). Any §5 core stat also works (mutates `e.stats[stat]` directly, reverted on expiry).
- `mode`/`value` same semantics as buff.
- `stat==="damage"`: mutates the enemy's own `atk`/`damage` fields directly (both kept in sync), reverted on expiry.
- `stat==="skilleffect"`: reduce la potencia de daño, curación y demás magnitudes de las habilidades enemigas; en modo `add`, `value` son puntos porcentuales (20 = -20%).
- `stat==="ap"`: multiplies the enemy's AP-mode per-turn action pool (`e.apDebuffMult`) — only visible against enemies using the AP/PA turn system; **in `"add"` mode the value is percentage points of PA**, e.g. `value:15` = -15% PA (this only applies to `"add"` mode; the UI shows a hint about it). Reverted on expiry.
- `stat` omitted → generic "weakened" flag instead of a specific stat debuff.
- Defaults: `value` 2, `turns` 3.
- Also lands a ~0.7x generic chip hit.

### 4.5 `heal` — Instant heal
```json
{ "kind":"heal", "target":"self", "dmgDice":2, "dmgDie":6, "dmgStat":"wisdom", "dmgStatMode":"add", "dmgStatCoef":1 }
```
- Magnitude via dicePowerFor (fallback ~`8+lvl*3`), applied as `heal = power*2` HP, plus `power` restored to the skill's own `resource` pool.
- `target:"ally"` (multiplayer): heals the clicked ally instead, same `power*2` amount, syncs over the network.
- `target:"area"`: heals the caster (same as self, incl. resource restore) **and** every ally within `range` tiles (default 2, Chebyshev) of the cast point — companions (AI summons) and other human players alike (`resolveComponentAllyTargets`). Companions are healed directly; each human ally in range gets its own `power*2` heal synced over the network exactly like the single-target `"ally"` case.

### 4.6 `move` — Dash or teleport
```json
{ "kind":"move", "mode":"dash", "range":3 }
```
- `mode:"dash"`: advance up to `range` tiles toward the nearest/clicked enemy, then attack it (multiplier configurable via `multiplier`, default 1).
- `mode:"teleport"`: if the skill also has an `enemy`-targeted component (so the whole cast targets an enemy, clicked or auto-picked), blinks onto a free tile touching that enemy instead of its own occupied tile - i.e. teleport next to it, then whatever component follows (a single `dmg` or an `aoe`) hits from there. With no enemy under the cast (a pure area click), it blinks to the exact clicked tile instead, same as before. Forces whole-skill target mode to `area` only when no other component already forces `enemy`.

### 4.7 `cc` — Crowd control
```json
{ "kind":"cc", "target":"enemy", "type":"stun", "turns":2 }
```
- `type`: `"stun" | "freeze" | "silence" | "root"`.
- Lands a ~0.75x chip hit, then applies the status for `turns` turns (0 magnitude — pure control).

### 4.8 `drain` — Life/resource drain
```json
{ "kind":"drain", "target":"enemy", "dmgDice":2, "dmgDie":6, "dmgStat":"intelligence", "dmgStatMode":"add", "dmgStatCoef":1 }
```
- Deals a fixed ~0.8x generic chip hit to the enemy (dice/stat fields do **not** affect this hit).
- Heals the caster and restores their resource by `power` (dicePowerFor on this component, fallback `~5+lvl*2`) — this is what the dice/stat fields actually configure.

### 4.9 `aoe` — Area damage
```json
{ "kind":"aoe", "dmgDice":2, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":1, "range":2 }
```
- Hits every enemy within `range` tiles (Chebyshev) of the cast point, with line-of-sight. Full dice+stat scaling applies (post-fix). `multiplier` optional, default 0.85.
- No `target` field — always area-shaped, centered on cast position.

### 4.10 `multihit` — Repeated single-target hits
```json
{ "kind":"multihit", "hits":3, "dmgDice":1, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":.6 }
```
- Attacks the resolved target (clicked enemy, or nearest) `hits` times independently (separate rolls, separate defense saves, separate crit checks). `multiplier` optional, default 0.6 per hit.
- Hits are **paced 0.5s apart** (staggered via `setTimeout`, one attack + redraw per tick) instead of all landing in the same frame — same look as normal consecutive attacks. A hit is skipped if the target already died from an earlier one in the sequence. The component still returns success synchronously (as soon as a valid target is resolved); the hits themselves land over the following `(hits-1)*0.5s`.

### 4.11 `mark` — Damage-taken amplifier
```json
{ "kind":"mark", "target":"enemy", "value":25, "turns":4 }
```
- `value`: percent extra damage the target takes from **any** subsequent hit (from anyone — player, companions), while the mark lasts. Implemented as a multiplicative stack on `attack()`'s raw damage. Does not stack additively with itself (re-applying refreshes `turns`/`power` to the max of old/new).

### 4.12 `summon` — Mobile ally
```json
{
  "kind":"summon", "hp":20, "turns":8, "ap":10, "effectType":"damage", "range":0,
  "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1,
  "effectTurns":2, "iconImage":"", "targetable":true, "hitByAoe":true, "stance":"aggressive"
}
```
- `hp`: flat max HP of the summon.
- `turns`: lifespan in player turns. Ignored entirely when `permanent:true` (see below).
- `ap`: **every 10 = 1 action per its turn** (so `ap:20` = 2 actions/turn). Rounded via `max(1, round(ap/10))`. Every action is actually spent: it either closes a tile of distance, casts/attacks, or (with nothing left to do) advances on the player — it never stops early and wastes the rest of the turn's actions.
- `effectType`: one of 6 options, shared with `summonturret`/`clones`:
  - `"damage"`: attacks the nearest qualifying enemy, dice via `dmgDice/dmgDie`, stat bonus from `dmgStat`/`dmgStatMode`/`dmgStatCoef` (§3.1) applied against **the player's own live stat** — same as every other stat-derived effect in the game, not a flat hit. `range` (below) controls whether it's melee or ranged.
  - `"skill"`: fires the invocation's **own inline stackable-effects list** at the nearest qualifying enemy each action, instead of a flat dice hit or a reference to an existing skill. Configured via two extra fields:
    - `skillName` (string, cosmetic only): a name for this ad-hoc "skill", not shown anywhere in-game yet.
    - `skillEffects`: an array of components, same shape as the top-level `effects[]` (§3) but restricted to the kinds that make sense fired at a single already-engaged target: `dmg`, `dot`, `debuff`, `cc`, `fear`, `mesmer`, `drain`, `mark` (all hit/affect the target), plus `buff`/`heal` (affect the player instead — a companion's "heal" sub-effect heals the player, its "buff" sub-effect buffs the player). Every listed sub-effect fires in the same action (they stack); each one's own `dmgStat`/`dmgStatMode`/`dmgStatCoef` (where applicable) scales off the player's stat, exactly like `damage` above. An empty `skillEffects` falls back to a plain dice hit.
  - `"heal"`: heals the player each action, magnitude = roll of `dmgDice`d`dmgDie` **plus** the `dmgStat`/`dmgStatMode`/`dmgStatCoef`-derived bonus off the player's stat.
  - `"root"`: applies `root` status to nearest enemy each action, duration = `effectTurns`.
  - `"buff"`: grants the caster a buff (see `stat`/`mode`/`value` below) that is refreshed every action and lasts only while the companion is alive.
  - `"debuff"`: applies a stat debuff to the nearest enemy each action (see `stat`/`mode`/`value`/`effectTurns` below), same mechanics as the top-level `debuff` kind (§4.4).
- `range` (only read when `effectType` is `"damage"` or `"skill"`, default/`0` = melee): how many tiles away the companion can act from without closing in further. `0` (or omitted) means melee — it must be adjacent, same as before this field existed. Any positive number makes it a ranged attacker/caster that stops advancing once within that distance and fights from there instead of walking all the way up to the target.
- `stat`/`mode`/`value`: only read when `effectType` is `"buff"` (stat options: `armor`, `damage`, `ap`, `skilleffect`, plus any §5 core stat) or `"debuff"` (stat options: `damage`, `ap`, `skilleffect`, plus any §5 core stat) — same semantics as §4.3/§4.4.
- `effectTurns`: duration of the `root`/`debuff` application per action (default 2); irrelevant for `damage`/`skill`/`heal`/`buff`.
- Targeting/movement priority (shared by `summon`/`summonturret`/`clones`): only enemies within 6 tiles are ever considered a valid target — anything farther is ignored outright instead of being chased across the map. With no such target in range, a mobile companion closes in on the player instead of idling, and **stops burning actions the moment it's already standing next to the player** (`companionFollowPlayer`/`companionApproachOrStop`) rather than creeping forward one tile per turn regardless of how many actions it has left.
- `iconImage`: optional hex PNG (50x50) replacing the default procedural ally sprite; see §8.
- `targetable` (bool, default `true`): if `false`, enemies can never pick this companion as an attack target (it can still die to AOE-classed enemy skills unless `hitByAoe` is also `false`). Regardless of this flag, a companion can never be targeted on the very turn it spawns (a built-in one-pass grace period).
- `hitByAoe` (bool, default `true`): if `false`, the companion is immune specifically to enemy skills whose `classEffect` is `aoe`/`multihit`/`ultimate`/`massive` — it can still be targeted by single-target attacks/skills unless `targetable:false` also blocks that.
- `stance`: `"aggressive"` (default — fights nearby enemies, follows the player when none are in range) or `"passive"` (never attacks, always just follows the player and stops next to them).
- `permanent` (bool, default `false`) — turns this into a **"Compañero"** pet: doesn't expire from `turns`, only one instance exists per source skill (recasting while it's alive does nothing; recasting while it's downed attempts a revive instead of summoning a duplicate). When it dies:
  - The caster is immediately hit with a **-10% penalty to every core stat** (flat debuff, `999999`-turn sentinel, removed only on revive).
  - While alive, it pulls **15% of nearby enemy aggro** toward itself (reselected from targetable companions when an enemy's normal target roll lands on the pet-pull chance).
  - The downed pet's corpse occupies its last tile; walking onto that tile, or resting in a safe room (free, at full HP), revives it and clears the stat debuff. Manual revive (walking onto it) costs `reviveResource`/`reviveAmount`, and revives it at 50% of `hp`.
  - `reviveResource`: `"hp"` (default) | `"stamina"` | `"mana"` — resource paid by the caster to revive.
  - `reviveAmount` (default `20`): amount of `reviveResource` paid.

### 4.13 `summonturret` — Stationary ranged ally
```json
{
  "kind":"summonturret", "hp":16, "turns":8, "ap":10, "range":7, "damageMode":"nearest",
  "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1,
  "iconImage":""
}
```
- Same as `summon` (same 6 `effectType` options: `damage`/`skill`/`heal`/`root`/`buff`/`debuff`, same `stat`/`mode`/`value`/`effectTurns`/`skillName`/`skillEffects` fields), but **never moves** — idles if no enemy is within `range` instead of approaching. Default `range` 7 for `damage`/`skill` (vs melee-only for `summon` unless it sets its own `range`). Does not support `permanent`/`targetable`/`hitByAoe`/`stance` (always a temporary, non-companion-pet ally).
- `damageMode` (only read when `effectType:"damage"`): `"nearest"` (default — single-target the closest enemy within `range`) or `"area"` (hits every enemy within `range` tiles of the turret each action instead of just one). `"skill"` casts are always single-target nearest, no area mode.

### 4.14 `clones` — Multiple mobile allies at once
```json
{
  "kind":"clones", "count":2, "hp":14, "turns":8, "ap":10, "effectType":"damage", "range":0,
  "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1,
  "effectTurns":2, "iconImage":""
}
```
- Spawns `count` (1-4, default 2) independent mobile allies in one cast, each behaving exactly like a non-permanent `summon` companion — same 6 `effectType` options (`damage`/`skill`/`heal`/`root`/`buff`/`debuff` with the same `stat`/`mode`/`value`/`effectTurns`/`range`/`skillName`/`skillEffects` fields), same mobility, same `iconImage`. Each clone contributes its own instance of a `buff`/`debuff` independently (they stack, one per living clone).
- Does not support `permanent`/`targetable`/`hitByAoe`/`stance` — always temporary, always targetable/vulnerable like a plain summon.

### 4.15 `utility` — Misc self effects
```json
{ "kind":"utility", "mode":"reveal", "value":10 }
```
- `mode:"reveal"`: reveals the map in a `value`-tile radius around the caster (default 10).
- `mode:"stealth"`: sets `shadowVeil` — the next enemy turn is skipped entirely (one-shot, no `value`/`turns` needed).
- `mode:"shield"`: adds `value` flat points to `player.shield` (default 10). Shield is **armor**, not an HP buffer — it adds directly to armor total and decays by 1 point every player turn (whether hit or not).
- `mode:"resource"`: restores `value` points (default 10) of the skill's own `resource` (stamina/mana).

### 4.16 `hot` — Heal over time
```json
{ "kind":"hot", "target":"self", "dmgDice":1, "dmgDie":6, "dmgStat":"wisdom", "dmgStatMode":"add", "dmgStatCoef":.5, "turns":4 }
```
- Magnitude via dicePowerFor (fallback `~3+lvl`), applied once per player turn for `turns` turns. Stacks are independent (multiple `hot` applications run in parallel, not refreshed/merged).
- `target:"area"`: same self HOT as above, **plus** every ally within `range` tiles (default 2) of the cast point (`resolveComponentAllyTargets`):
  - Companions (AI summons) get the identical `{turns, power}` HOT pushed onto their own stack, ticked every companion turn (`tickEntityHots`, the same generic ticker the player uses).
  - Other human players (multiplayer) have no live per-turn HOT-sync channel yet, so their whole HOT is instead sent as **one upfront instant heal** of `power*turns` via the existing `ally_heal` network action — mechanically equivalent total healing, just front-loaded instead of ticking turn by turn.

### 4.17 `execute` — Execute below HP threshold
```json
{ "kind":"execute", "target":"enemy", "dmgDice":2, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":1, "threshold":35, "execMultiplier":2.5 }
```
- Normal attack roll (full dice+stat scaling) against target(s). If `target.hp/target.maxHp < threshold/100`, the hit is multiplied by `execMultiplier` instead of the normal `multiplier` (default 1).

### 4.18 `pullroot` — Pull + root
```json
{ "kind":"pullroot", "target":"enemy", "turns":2 }
```
- ~0.8x chip hit, pulls the target 1 tile toward the caster (if the destination is free), then applies `root` for `turns` turns. `multiplier` optional override for the chip hit.

### 4.19 `counter` — Counterattack stance
```json
{ "kind":"counter", "shield":10, "dmgDice":1, "dmgDie":8, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1, "turns":5 }
```
- Grants `shield` armor points immediately, and arms `player.counterReady = { damage: "{dmgDice}d{dmgDie}", turns }`.
- The **next** time the player takes any damage (before this expires), the nearest living enemy is struck back for that dice roll at ×0.8, then the counter is consumed (one-shot, regardless of `turns` remaining). `dmgStat`/`dmgStatMode`/`dmgStatCoef` are accepted by the form but **not applied** to the counter hit (dice only).

### 4.20 `cheatdeath` — Cheat death
```json
{ "kind":"cheatdeath", "turns":5 }
```
- Arms `player.cheatDeathTurns`. The next time HP would hit 0 while this is armed, HP is set to 1 instead and the charge is consumed (one-shot; `turns` is stored but not decremented/ticked — it only matters as "armed vs not").

### 4.21 `holyshield` — Absorb shield
```json
{ "kind":"holyshield", "target":"self", "value":20, "stat":"", "mode":"add", "statCoef":1, "turns":0 }
```
- Grants `player.holyShield` points that **absorb incoming damage before it touches HP** — a dedicated damage-buffer pool, distinct from both `utility`'s `mode:"shield"` (§4.15, which adds flat **armor** instead, no HP absorption) and `counter`'s `shield` field (§4.19, also armor). Consumed in `damagePlayer()` right after the block-chance check and before HP is reduced: `absorbed = min(holyShield, incomingDamage)`; the log line reports how much was absorbed and whether the shield broke (`holyShield` hits 0).
- Magnitude formula (same "dice/stat" idiom as `dicePowerFor`, but flat `value` instead of a dice roll):
  ```
  statVal = stat ? statValueFor(player, stat) : 0
  contribution = mode==='mult' ? value*(statVal*statCoef) : statVal*statCoef
  amount = max(1, round(value + contribution))
  player.holyShield += amount
  ```
- `stat`: any of §5 core stats, or `""` (no stat scaling — pure flat `value`).
- `mode`: `"add"` (contribution is `statVal*statCoef`, added once) or `"mult"` (contribution scales with `value` too: `value*statVal*statCoef` — bigger base `value` also amplifies the stat's contribution).
- `turns`: `0` (default) = the shield has **no time limit** — it persists until damage breaks it entirely, however many turns that takes. `>0` = the shield also expires after that many player turns even if not fully depleted (ticked by `tickHolyShield`, which zeroes it out when the counter reaches 0). Casting `holyshield` again **adds** to the current pool (`+=`) and raises the timer to `max(current, new)` turns if a limit is set — it does not overwrite/refresh from zero.
- No `target` options beyond self — always cast on the caster, no click/target needed (like `buff`/`cheatdeath`).
- Shown to the player in the active-effects HUD as `Escudo: <points>[ (<turns>T)]`.

### 4.22 `lineshot` — Piercing line shot
```json
{ "kind":"lineshot", "dmgDice":2, "dmgDie":6, "dmgStat":"agility", "dmgStatMode":"add", "dmgStatCoef":1, "range":6 }
```
- No `target` field — always fires in a straight line from the caster toward the clicked enemy (or nearest, if self-cast), up to `range` tiles (default 6), stopping at the first wall.
- Hits **every** enemy standing on that line (in order), each with the full dice+stat scaling, `multiplier` optional override (default 0.8).

### 4.23 `trap` — Ground trap
```json
{ "kind":"trap", "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1, "turns":8, "range":1 }
```
- No `target` field — drops an invisible trap on the clicked tile (or the caster's own tile if the skill has no other targeted component forcing a click).
- Triggers automatically the moment any enemy enters within `range` tiles (default 1) of it, dealing one ×1.15 hit to every enemy in range at that moment via the normal `attack()` pipeline, then disappears. Otherwise expires silently after `turns` player turns (default 8) with no effect.
- **Quirk**: `dmgDice`/`dmgDie`/`dmgStat`/`dmgStatMode`/`dmgStatCoef` are accepted by the form (and a magnitude is computed from them at cast time via `dicePowerFor`, fallback `~4+lvl*1.5`) but that computed value is **never actually read when the trap triggers** — the triggered hit uses the generic §6.2 fallback dice expression at ×1.15, same as if no dice fields were set at all. Setting these fields has no effect on the trap's real damage; only `turns`/`range` matter.

### 4.24 `linkdamage` — Chain jump damage
```json
{ "kind":"linkdamage", "dmgDice":2, "dmgDie":6, "dmgStat":"intelligence", "dmgStatMode":"add", "dmgStatCoef":1, "jumps":3, "falloff":25, "range":4 }
```
- No `target` field — hits the clicked enemy (or nearest) first at full dice+stat scaling (`multiplier` optional, default 1), then jumps to the nearest not-yet-hit enemy within `range` tiles (default 4) of the previous target, up to `jumps` additional times (default 3).
- `falloff` (0-95, default 25): percent damage lost **per jump**, multiplicative and cumulative (jump 1 = `(1-falloff)`, jump 2 = `(1-falloff)^2`, etc.) — does not affect the first hit.
- Stops early if no valid next target is in range; already-hit enemies are never hit twice.

### 4.25 `invisible` — Temporary invisibility
```json
{ "kind":"invisible", "turns":2, "breakOnAttack":true }
```
- No `target` field — self-only, casts instantly. Sets `turns` (default 2) of invisibility during which **enemies skip their turn entirely**, same effect as `utility`'s `mode:"stealth"` but lasting multiple turns instead of a single one-shot skip.
- `breakOnAttack` (bool, default `true`): if `true`, attacking (or casting an offensive skill) while invisible immediately ends the effect early.

### 4.26 `ascend` — Ascensión (skill-cost buff)
```json
{ "kind":"ascend", "resource":"any", "value":150, "turns":6, "allowSkills":true, "iconImage":"" }
```
- Buff-typology effect (stacks like `buff`, cast on self, no click needed). While active, changes what **the player's own skill casts** cost.
- `resource`: `"any"` (default — affects every skill regardless of its own resource) | `"mana"` | `"stamina"` (only affects skills using that specific resource).
- `value` (default 150): the resulting cost **as a percentage of normal** (100 = no change, <100 = cheaper, >100 = more expensive). Read live at cast time by every skill via `effectiveSkillCost()` — cooldowns/AP costs are unaffected, only the `cost`/resource-drain number.
- `turns` (default 6): duration.
- `allowSkills` (bool, default `true`): if `false`, **no other skill can be cast at all** while Ascensión is active (same `blockSkills` mechanism as `transform`, shared code path — casting any other skill logs a "your transformation/ascension doesn't allow casting other skills" message and refuses).
- `iconImage`: optional hex PNG (50x50, see §8). While active, **replaces the player's own rendered character icon** on the map with this image (same icon-override mechanism as `transform` — if both a `transform` and an `ascend` buff with icons are active at once, `transform`'s icon takes priority). Leave `""` to keep the normal character icon.

### 4.27 `transform` — Transformación (self stat/icon buff)
```json
{ "kind":"transform", "turns":8, "damagePct":0, "armorPct":0, "hpPct":0, "allowSkills":true, "iconImage":"" }
```
- Buff-typology effect (stacks like `buff`, cast on self, no click needed). Applies %-based changes to the caster's own stats for the duration, and/or swaps their rendered icon.
- `damagePct`/`armorPct` (default `0`, can be negative): percent change applied as a multiplier to the aggregate damage/armor totals (`damage: 1+damagePct/100`, same `activeBuffMultFactor('damage')`/`('armor')` read path as `buff`'s own `mode:"mult"`).
- `hpPct` (default `0`, can be negative): percent of the caster's **current max HP at cast time**, converted once to a flat amount and applied as a flat max-HP buff (same slot `recomputeDerived()` already folds in for other flat max-HP buffs) — it does not keep rescaling if max HP changes later during the buff's duration.
- `allowSkills` (bool, default `true`): if `false`, blocks casting any other skill while transformed (see `ascend` above — same shared `blockSkills` mechanism).
- `iconImage`: optional hex PNG (50x50, see §8). While active, replaces the player's rendered character icon (takes priority over an `ascend` icon if both are active). Leave `""` to keep the normal icon.

## 5. Stat keys

Core stats (used everywhere a `*Stat` field is expected): `strength, vitality, agility, luck, intelligence, wisdom`.
`buff`-only extra stat targets: `armor, damage, ap, dodge, critChance, blockChance, manaRegen, staminaRegen` (the last four are percentage-point/flat-per-turn bonuses, `"add"` mode only — see §4.3).
`debuff`/`summon`-`effectType:"debuff"`/`summonturret`-`effectType:"debuff"`/`clones`-`effectType:"debuff"` extra stat targets: `damage, ap` only (no `armor` — see §4.4 for why).

## 6. Damage/formula notes

### 6.1 `attack()` pipeline (enemy-targeted hits)
```
raw = (diceRoll + statMod + max(0,bonus)*.35 + flatDamageBuffs) * statMultFactor * multiplier
      * nextSkillMultiplier * activeBuffDamageMultiplier * damageDealtMultiplier * markMultiplier
final = raw * defenseMult(0 / .5 / 1 / 1.25, from a d20 save roll against a DC derived from raw)
crit: ~4-38% chance (agility/luck-scaled), ×1.75 if it lands
```
`statMod`/`statMultFactor` come from the component's own `dmgStat` fields for `dmg`/`aoe`/`multihit`/`execute` (fixed in this codebase's latest revision); other enemy-targeting kinds (`dot`/`cc`/`debuff`/`drain`/`mark`/`pullroot`) use a generic tier/type-based fallback for their chip hit instead, ignoring `dmgStat` for that hit specifically (their own dice/stat fields, where present, drive a separate self-contained magnitude — heal-back, DOT tick, etc).

### 6.2 Generic fallback dice (`skillDiceExpr`, used whenever a component omits `{p}Dice` for an enemy-targeted hit)
Cascades on the **skill's own** `classEffect`/`type`/`resource`/`tier` (not on `effects[]`): `utility` type or `buff/shield/heal/utility` classEffect → no damage; `massive` → 3-5d8+; `ultimate` → 3-5d6+; `aoe/multihit` classEffect → 2-4d6+; `execute` classEffect → 2-3d8-10+; else scales 2-4d8 by tier, mana resource included.

### 6.3 AP cost resolution (`skillApCost`)
`apCost` field (explicit) → else `AP_COST_BY_EFFECT[classEffect]` table below → else 10 (skill default).

| classEffect | AP | classEffect | AP |
|---|---|---|---|
| dash, utility, shield, heal, buff | 8-9 | debuff, ranged | 10 |
| aoe, multihit, execute | 12 | ultimate, massive | 14 |
| stun, silence, doomMark, swapConfuse | 11 | dot, drain, holyLeech, echoDot, hookBleed | 11 |
| bountyRoot, rootBleed, comboMark, lineShot | 11 | stormTotem, trap | 12 |
| shadowStrike | 11 | | |

Always set `apCost` explicitly — it's simpler and takes priority anyway. Move costs 5 AP, so anything above ~10 AP is a "big" action relative to a 30±agility AP pool.

### 6.4 `classEffect` still matters — enemy AI heuristic
Even when `effects[]` fully defines player-cast behavior, `enemyUseSkill()` (the separate, simpler dispatch enemies use) branches purely on the skill's top-level `classEffect`/`type`:
- `classEffect==="heal"` + caster is `clerigo`/`chaman` class → heals a wounded ally.
- `classEffect==="shield"` or `"buff"`, or `type==="utility"` → self-heals the enemy (visual "reinforces itself").
- anything else → deals flat damage to the target.
- `ranged` detection (attack from range vs needing adjacency) checks `classEffect` in `{"ranged","multihit","ultimate","massive"}` OR the skill's own `range` field.

**Always set `classEffect` to match the skill's real intent** (`"heal"` for a `hot`/`heal`-only skill, `"shield"`/`"buff"` or `type:"utility"` for a pure-buff skill, `"ranged"` if `range>1`) even though it's not read by the player-cast path — otherwise an `enemyUsable:true` version of your skill will misbehave (e.g. a pure-heal skill dealing damage to the player instead of healing an ally).

## 7. `classEffect` legacy value list

Only the **shape** matters for enemy AI (§6.4) and as a legacy fallback if `effects[]` is empty. Full accepted set (any string works technically, but these are the recognized/handled ones):

```
ranged, shield, dash, debuff, aoe, heal, multihit, utility, ultimate, execute, buff, massive,
root, pullRoot, rootBleed, bountyRoot, freeze, delayedFreeze, poison, dot, decayDot, echoDot,
delayedPoison, drain, holyLeech, steal, stun, silence, age, wither, doomMark, mark, bountyMark,
holyMark, shadowStrike, holyDash, leapBuff, hookBleed, combo, comboMark, markedExecute,
bountyExecute, packExecute, pierce, lineShot, ricochet, chain, blinkChain, swapConfuse,
teleportDecoy, teleportBuff, randomTeleport, freeTeleport, teleportShield, teleportClones,
trap, rootZone, consecrate, stormTotem, areaDot, summon, summonTurret, summonHealer,
summonTank, summonScanner, summonElite, multiSummon, clones, clone, cleanseHeal, bigHeal,
regenHeal, survivalHeal, healShield, buffArmor, counter, bloodBuff, lifestealBuff, rampage,
overcharge, fortress, holyShield, holyAvatar, randomBuff, luckBuff, sniperBuff, stealthShot,
shapeShift, lichBuff, implantBuff, mechBuff, wisdomBuff, martyrBuff, oakBuff, resourceRegen,
reflect, monkAvatar, tauntBuff, beastAvatar, cheatDeath, cheatDeathHeal, rewind
```
The 12 "shared" tags (`ranged, shield, dash, debuff, aoe, heal, multihit, utility, ultimate, execute, buff, massive`) are the only ones with fully-implemented standalone legacy behavior; everything else is a "signature" tag meant to pair with `effects[]` for real behavior, kept alive mainly for §6.4's AI heuristic and §6.3's AP table.

## 8. Summon images

`summon`/`summonturret` components accept `iconImage`: a hex-encoded 50x50 PNG string (same encoding as skill/class/enemy/item icons — raw PNG bytes, hex-encoded). Leave `""` to use the built-in procedural ally sprite. To generate one programmatically: produce a 50x50 PNG, hex-encode its raw bytes (`Buffer.from(pngBytes).toString('hex')` in Node, or equivalent). No magic/transparency requirements beyond what any other icon uses.

## 9. Full example

```json
{
  "pyromancer_t1_burn": {
    "name": "Cinder Lash",
    "icon": "🔥",
    "desc": "Whip of fire that burns and marks the target.",
    "cd": 5,
    "apCost": 10,
    "resource": "mana",
    "cost": 14,
    "type": "magic",
    "rarity": "rare",
    "range": 4,
    "classEffect": "dot",
    "tier": 1,
    "classId": "pyromancer",
    "enemyUsable": true,
    "unlock": "Clase",
    "effects": [
      { "kind": "dmg", "target": "enemy", "dmgDice": 2, "dmgDie": 8, "dmgStat": "intelligence", "dmgStatMode": "add", "dmgStatCoef": 1 },
      { "kind": "dot", "target": "enemy", "dotDice": 1, "dotDie": 6, "dotStat": "intelligence", "dotStatMode": "add", "dotStatCoef": .4, "turns": 4, "flavor": "burn" },
      { "kind": "mark", "target": "enemy", "value": 20, "turns": 3 }
    ]
  },
  "pyromancer_t2_phoenix": {
    "name": "Phoenix Bond",
    "icon": "🕊️",
    "desc": "Summon a spectral phoenix that mends your wounds, and steel yourself against death.",
    "cd": 14,
    "apCost": 20,
    "resource": "mana",
    "cost": 30,
    "type": "magic",
    "rarity": "epic",
    "range": 0,
    "classEffect": "cheatDeath",
    "tier": 2,
    "classId": "pyromancer",
    "enemyUsable": false,
    "unlock": "Clase",
    "effects": [
      { "kind": "summon", "hp": 14, "turns": 6, "ap": 10, "effectType": "heal", "dmgDice": 1, "dmgDie": 6, "dmgStat": "", "dmgStatMode": "add", "dmgStatCoef": 1, "iconImage": "" },
      { "kind": "cheatdeath", "turns": 5 }
    ]
  }
}
```

## Bonus automático consolidado (v0.62.1)

No se configura categoría, atributo de scaling ni coeficiente por skill. El motor clasifica el efecto que resuelve:

- Daño directo y DOT: `base × (1 + INT × 0.01)`.
- Debuffs cuantitativos: su magnitud usa `1 + INT × 0.01`.
- Curación y HOT: `base × (1 + SAB × 0.01)`.
- Utilidad cuantitativa (escudos, buffs, HP de invocaciones, recursos, alcance de revelado, transformaciones y ascensiones): su magnitud usa `1 + SAB × 0.01`.
- Los efectos binarios no reciben una magnitud artificial.

Se usa la INT o SAB total consolidada del actor que lanza la habilidad. Esto se aplica igualmente a jugadores, enemigos, élites y bosses. Los campos legacy `scaling`, `dmgStat`, `dotStat`, modos y coeficientes pueden existir en datos antiguos, pero no producen ningún efecto.

### `skilleffect`

Potencia las magnitudes de las habilidades. En buffs sumatorios, `value:20` equivale a +20%; en modo multiplicador, `value:1.2` equivale a ×1.2. También se admite como bonus racial (`stats.skilleffect`) y en buffs de armas/equipo.

### 4.29 `fear` / `mesmer` — Mind control
```json
{ "kind":"fear", "target":"area", "range":2, "turns":3 }
{ "kind":"mesmer", "target":"enemy", "turns":2 }
```
- `fear`: the affected unit spends its complete AP pool moving away from the caster and is shown with a black frame.
- `mesmer`: the affected unit changes sides, attacking its former allies when possible, and is shown with a purple frame.
- Both accept `target:"enemy"` or `target:"area"`, work in class/race/item/potion stacks, and are resolved by enemy AI too (including bosses and megabosses when their configured skill is `enemyUsable`).
- Resistance is `min(30%, WIS × 1%)` for `fear` and `min(30%, INT × 1%)` for `mesmer`.
