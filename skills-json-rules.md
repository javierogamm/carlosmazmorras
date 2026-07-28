# Class Skill JSON Rules

Reference for hand-writing/generating skill JSON for the class editor (`config_class.skills_json`). Written in English to stay token-cheap. This document is exhaustive: every field, every effect kind, every default, every runtime quirk that matters for authoring correct skills.

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

Common component shape: `{ "kind": "<kind>", "target": "...", ...kind-specific fields }`.

### 3.1 Shared "dice block" (prefix defaults to `dmg`, some kinds use `dot`)

Used by: `dmg`, `heal`, `drain`, `aoe`, `multihit`, `execute`, `hot`, `counter`, `summon`, `summonturret` (all prefix `dmg`), and `dot` (prefix `dot`).

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

**Enemy-targeted damage** (`dmg` w/ target enemy/area, `aoe`, `multihit`, `execute`): the dice roll AND the stat scaling (via `{p}Stat`/`{p}StatMode`/`{p}StatCoef`) both apply through the normal `attack()` pipeline (§6.3). If `{p}Dice` is 0, a generic tier/resource-based dice expression is used instead (stat scaling in that fallback case comes from a generic type-based bonus, not `{p}Stat`).

### 3.2 Target resolution

Per-component `target` field, where applicable (see §4 table for which kinds accept which target values):
- `"enemy"`: the clicked enemy, or nearest visible enemy if the skill is self-cast.
- `"area"`: for damage/debuff-style kinds (`dmg`, `dot`, `debuff`, `cc`, `drain`, `mark`, `execute`, `pullroot`) — all enemies within `range` tiles (Chebyshev distance) of the clicked/cast tile, with line of sight (`resolveComponentEnemyTargets`). For `heal`/`hot` — all allies (companions + other human players) within `range` tiles of the cast point, via the analogous `resolveComponentAllyTargets` (see §4.5/§4.15 for exactly who counts as an "ally" and how each is healed).
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
| `drain` | enemy, area | damage enemy, heal+restore resource for self |
| `aoe` | — (always area around cast point) | area damage with explicit radius |
| `multihit` | — (always the resolved single target) | N repeated hits on one target, paced 0.5s apart |
| `mark` | enemy, area | target takes +X% damage from ALL sources for N turns |
| `summon` | — | temporary mobile ally, author-configurable |
| `summonturret` | — | temporary **stationary**, long-range ally |
| `utility` | — | reveal map / stealth / flat shield / restore resource |
| `hot` | self, area | heal-over-time on caster (+ allies if area) |
| `execute` | enemy, area | normal hit, multiplied if target is below an HP% threshold |
| `pullroot` | enemy, area | pulls target 1 tile toward caster, then roots |
| `counter` | — (self) | shield + arms a one-time counterattack |
| `cheatdeath` | — (self) | survive the next lethal hit at 1 HP |
| `holyshield` | — (self) | absorb-shield: soaks damage before it touches HP |

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
- `stat`: any of §5 core stats, plus `armor`, `damage`, `ap`.
- `mode`: `"add"` (flat +value) or `"mult"` (stat ×value — value is a raw multiplier, e.g. `1.2` = +20%, NOT a percentage number).
- Defaults: `value` 5 (buff) — see debuff below for its own default.

### 4.4 `debuff` — Enemy debuff
```json
{ "kind":"debuff", "target":"enemy", "stat":"strength", "mode":"add", "value":2, "turns":3 }
```
- Same `mode`/`value` semantics as buff, applied to the enemy's stat (reversed on expiry).
- `stat` omitted → generic "weakened" flag instead of a specific stat debuff.
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
- `mode:"teleport"`: blink to the clicked tile (must be free). Forces whole-skill target mode to `area`.

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
  "kind":"summon", "hp":20, "turns":8, "ap":10, "effectType":"damage",
  "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1,
  "effectTurns":2, "iconImage":""
}
```
- `hp`: flat max HP of the summon.
- `turns`: lifespan in player turns.
- `ap`: **every 10 = 1 action per its turn** (so `ap:20` = 2 actions/turn). Rounded via `max(1, round(ap/10))`.
- `effectType`: `"damage"` (melee-range-1 attacks nearest enemy, dice via `dmgDice/dmgDie` as a flat expr, no stat scaling), `"heal"` (heals the player each action, magnitude = roll of `dmgDice`d`dmgDie`, no stat scaling either — companions never read `dmgStat`), or `"root"` (applies `root` status to nearest enemy each action, duration = `effectTurns`).
- Mobile: walks toward its target if out of range 1 each turn.
- `iconImage`: optional hex PNG (50x50) replacing the default procedural ally sprite; see §8.

### 4.13 `summonturret` — Stationary ranged ally
```json
{
  "kind":"summonturret", "hp":16, "turns":8, "ap":10, "range":7,
  "dmgDice":1, "dmgDie":6, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1,
  "iconImage":""
}
```
- Same as `summon` with `effectType` forced to `"damage"`, but **never moves** — idles if no enemy is within `range` instead of approaching. Default `range` 7 (vs 1 for `summon`).

### 4.14 `utility` — Misc self effects
```json
{ "kind":"utility", "mode":"reveal", "value":10 }
```
- `mode:"reveal"`: reveals the map in a `value`-tile radius around the caster (default 10).
- `mode:"stealth"`: sets `shadowVeil` — the next enemy turn is skipped entirely (one-shot, no `value`/`turns` needed).
- `mode:"shield"`: adds `value` flat points to `player.shield` (default 10). Shield is **armor**, not an HP buffer — it adds directly to armor total and decays by 1 point every player turn (whether hit or not).
- `mode:"resource"`: restores `value` points (default 10) of the skill's own `resource` (stamina/mana).

### 4.15 `hot` — Heal over time
```json
{ "kind":"hot", "target":"self", "dmgDice":1, "dmgDie":6, "dmgStat":"wisdom", "dmgStatMode":"add", "dmgStatCoef":.5, "turns":4 }
```
- Magnitude via dicePowerFor (fallback `~3+lvl`), applied once per player turn for `turns` turns. Stacks are independent (multiple `hot` applications run in parallel, not refreshed/merged).
- `target:"area"`: same self HOT as above, **plus** every ally within `range` tiles (default 2) of the cast point (`resolveComponentAllyTargets`):
  - Companions (AI summons) get the identical `{turns, power}` HOT pushed onto their own stack, ticked every companion turn (`tickEntityHots`, the same generic ticker the player uses).
  - Other human players (multiplayer) have no live per-turn HOT-sync channel yet, so their whole HOT is instead sent as **one upfront instant heal** of `power*turns` via the existing `ally_heal` network action — mechanically equivalent total healing, just front-loaded instead of ticking turn by turn.

### 4.16 `execute` — Execute below HP threshold
```json
{ "kind":"execute", "target":"enemy", "dmgDice":2, "dmgDie":6, "dmgStat":"strength", "dmgStatMode":"add", "dmgStatCoef":1, "threshold":35, "execMultiplier":2.5 }
```
- Normal attack roll (full dice+stat scaling) against target(s). If `target.hp/target.maxHp < threshold/100`, the hit is multiplied by `execMultiplier` instead of the normal `multiplier` (default 1).

### 4.17 `pullroot` — Pull + root
```json
{ "kind":"pullroot", "target":"enemy", "turns":2 }
```
- ~0.8x chip hit, pulls the target 1 tile toward the caster (if the destination is free), then applies `root` for `turns` turns. `multiplier` optional override for the chip hit.

### 4.18 `counter` — Counterattack stance
```json
{ "kind":"counter", "shield":10, "dmgDice":1, "dmgDie":8, "dmgStat":"", "dmgStatMode":"add", "dmgStatCoef":1, "turns":5 }
```
- Grants `shield` armor points immediately, and arms `player.counterReady = { damage: "{dmgDice}d{dmgDie}", turns }`.
- The **next** time the player takes any damage (before this expires), the nearest living enemy is struck back for that dice roll at ×0.8, then the counter is consumed (one-shot, regardless of `turns` remaining). `dmgStat`/`dmgStatMode`/`dmgStatCoef` are accepted by the form but **not applied** to the counter hit (dice only).

### 4.19 `cheatdeath` — Cheat death
```json
{ "kind":"cheatdeath", "turns":5 }
```
- Arms `player.cheatDeathTurns`. The next time HP would hit 0 while this is armed, HP is set to 1 instead and the charge is consumed (one-shot; `turns` is stored but not decremented/ticked — it only matters as "armed vs not").

### 4.20 `holyshield` — Absorb shield
```json
{ "kind":"holyshield", "target":"self", "value":20, "stat":"", "mode":"add", "statCoef":1, "turns":0 }
```
- Grants `player.holyShield` points that **absorb incoming damage before it touches HP** — a dedicated damage-buffer pool, distinct from both `utility`'s `mode:"shield"` (§4.14, which adds flat **armor** instead, no HP absorption) and `counter`'s `shield` field (§4.18, also armor). Consumed in `damagePlayer()` right after the block-chance check and before HP is reduced: `absorbed = min(holyShield, incomingDamage)`; the log line reports how much was absorbed and whether the shield broke (`holyShield` hits 0).
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

## 5. Stat keys

Core stats (used everywhere a `*Stat` field is expected): `strength, vitality, agility, luck, intelligence, wisdom`.
Buff-only extra stat targets: `armor, damage, ap`.

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
