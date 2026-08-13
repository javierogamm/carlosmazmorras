/* MAZMORRA // BOTÍN v0.61.0
 * Resolución de combate, efectos, turnos, inventario y actualización del HUD.
 * Carga clásica ordenada por index.html; el estado compartido pertenece al ámbito global del juego.
 */
function attackDefenseLabel(stat){return DEFENSE_STAT_LABELS[stat]||'Agilidad'}
function enemyDefenseScore(e,stat){
 const floor=game.floor||1,elite=e.elite?2:0,boss=e.boss?4:0;
 const archetype={
  strength:/orc|golem|knight|abomin|tyrant/i.test(e.type||'')?3:0,
  vitality:/golem|mummy|beast|orc|abomin|tyrant/i.test(e.type||'')?3:0,
  agility:/goblin|wolf|hound|thief|imp|vamp/i.test(e.type||'')?3:0,
  luck:/jester|error|quantum|goblin/i.test(e.type||'')?2:0,
  intelligence:/mage|lich|clerk|wraith|priest|shaman|archiv/i.test(e.type||'')?3:0,
  wisdom:/lich|undead|mummy|wraith|priest|shaman|vamp/i.test(e.type||'')?3:0
 }[stat]||0;
 let score=Math.floor(floor*.65)+elite+boss+archetype;
 if(enemyHasStatus(e,'armorBreak'))score-=4;
 if(enemyHasStatus(e,'wither'))score-=3;
 return score
}
function playerDefenseBonus(stat){
 const p=game.player,s=p.derived?.finalStats||p.stats,armorValue=Math.max(0,total('armor'));
 const base=Math.floor((s[stat]||0)*.85);
 // Fuerza y Vitalidad conservan doble conversión de armadura: es intencional para que las builds tanque tengan una identidad defensiva clara.
 const armorPart=['strength','vitality'].includes(stat)?Math.floor(armorValue/3):Math.floor(armorValue/6);
 return base+armorPart
}
function resolveEnemyDefense(e,stat,attackPower){
 const die=rollDie(20),bonus=enemyDefenseScore(e,stat),dc=10+Math.max(1,Math.floor(attackPower*.75));
 let mult=1,result=`no supera la defensa de ${attackDefenseLabel(stat)}`;
 if(die===20){mult=0;result=`evita el ataque con ${attackDefenseLabel(stat)}`}
 else if(die+bonus>=dc){mult=.5;result=`resiste parcialmente con ${attackDefenseLabel(stat)}`}
 else if(die===1){mult=1.25;result=`falla críticamente su defensa de ${attackDefenseLabel(stat)}`}
 return{die,bonus,dc,mult,result}
}

function rollDie(sides){return 1+rng(Math.max(1,sides))}
function parseDice(expr){
 const m=String(expr||'1d4').replace(/\s+/g,'').match(/^(\d+)d(\d+)([+-]\d+)?$/i);
 return m?{count:Number(m[1]),sides:Number(m[2]),bonus:Number(m[3]||0)}:{count:1,sides:4,bonus:0}
}
function rollDice(expr){
 const d=parseDice(expr),rolls=[];for(let i=0;i<d.count;i++)rolls.push(rollDie(d.sides));
 return{expr,total:rolls.reduce((a,b)=>a+b,0)+d.bonus,rolls,bonus:d.bonus}
}
function baseAttackDice(){
 const w=equippedWeapon(),r=weaponRange(w);
 if(!w)return'1d4';
 if(w.damageDice)return w.damageDice;
 if(r>=9)return'1d10';
 if(r>=7)return'1d8+1';
 if(r>=3)return'1d8';
 const text=`${w.name||''} ${w.iconShape||''}`.toLowerCase();
 if(/(martillo|hammer|hacha|axe|maza|mace)/.test(text))return'1d10';
 if(/(espada|sword|blade)/.test(text))return'1d8';
 if(/(daga|dagger)/.test(text))return'1d6+1';
 return'1d6'
}
function statValueFor(actor,statKey){const st=actor?.derived?.finalStats||actor?.stats||{};return st[statKey]||0}
// Secondary stat paired with each weapon-associated stat for the basic
// attack's stat bonus below - same 2:1 primary/secondary blend as
// actorStatDamageBonus (used by skills), just keyed by the full 6-stat set
// instead of only the physical/magic split.
const WEAPON_STAT_SECONDARY={strength:'agility',agility:'strength',vitality:'strength',intelligence:'wisdom',wisdom:'intelligence',luck:'wisdom'};
function weaponStatDamageBonus(actor,stat){
 const secondary=WEAPON_STAT_SECONDARY[stat]||'strength';
 return Math.floor((statValueFor(actor,stat)*2+statValueFor(actor,secondary))/3);
}
function skillDiceExpr(id){
 const d=skillDefs[id]||{},tier=d.tier||({common:1,uncommon:1,rare:2,epic:3,legendary:3}[d.rarity]||1);
 if(d.dmgDice>0)return `${d.dmgDice}d${d.dmgDie||6}`;
 if(d.type==='utility'||['buff','shield','heal','utility'].includes(d.classEffect))return null;
 if(d.classEffect==='massive'||id==='blackSun'||id==='worldBreaker')return tier>=3?'5d8+6':tier===2?'4d8+4':'3d8+4';
 if(d.classEffect==='ultimate')return tier>=3?'5d6+3':tier===2?'4d6':'3d6+3';
 if(['aoe','multihit'].includes(d.classEffect)||AREA_SKILLS.has(id))return tier>=3?'4d6+4':tier===2?'3d6+3':'2d6+3';
 if(d.classEffect==='execute'||id==='execute')return tier>=3?'3d10+5':tier===2?'3d8+1':'2d8+3';
 if(d.resource==='mana')return tier>=3?'4d8':tier===2?'3d8':'2d8+1';
 return tier>=3?'4d8':tier===2?'3d8':'2d8+1'
}
function damageStatForType(type,resource){if(type==='magic'||resource==='mana')return'intelligence';if(type==='physical'||resource==='stamina')return'strength';return'luck'}
function actorStatDamageBonus(actor,type='physical',resource='stamina'){const st=actor?.derived?.finalStats||actor?.stats||{};const primary=damageStatForType(type,resource),secondary=primary==='intelligence'?'wisdom':primary==='strength'?'agility':'wisdom';return Math.floor(((st[primary]||0)*2+(st[secondary]||0))/3)}
// Generalized over any object carrying dmgStat/dmgStatMode/dmgStatCoef (plus
// type/resource for the no-stat-chosen "Automática" fallback) - a full
// skillDefs entry, a single composable-effect component, or a companion/
// turret/clone object (they all use the same field names) - so the flat
// stat-derived bonus/multiplier isn't only reachable through a skillId.
function statModifierFor(defLike,actor=game.player){
 const d=defLike||{};
 if(d.dmgStat&&d.dmgStatMode!=='mult')return Math.round(statValueFor(actor,d.dmgStat)*(d.dmgStatCoef??1));
 return actorStatDamageBonus(actor,d.type,d.resource)
}
function statMultiplierFor(defLike,actor=game.player){
 const d=defLike||{};
 if(d.dmgStat&&d.dmgStatMode==='mult')return 1+statValueFor(actor,d.dmgStat)*(d.dmgStatCoef??.02);
 return 1
}
function skillStatModifier(id,actor=game.player){return statModifierFor(skillDefs[id],actor)}
function skillStatMultiplier(id,actor=game.player){return statMultiplierFor(skillDefs[id],actor)}
// Per-tick DOT power, generalized over any object carrying dotDice/dotDie/
// dotStat/dotStatMode/dotStatCoef - a full skillDefs entry (legacy single-
// effect skills) or a single effect component (composable skills). Rolls
// once at application time (the roll then holds for the status' whole
// duration); objects without dot fields keep the caller's hand-tuned
// level-scaled fallback.
function dotPowerFor(defLike,fallback,actor=game.player){
 const d=defLike||{};
 if(!(d.dotDice>0))return fallback;
 const roll=rollDice(`${d.dotDice}d${d.dotDie||6}`).total;
 const statVal=d.dotStat?statValueFor(actor,d.dotStat):0;
 const contribution=d.dotStatMode==='mult'?roll*(statVal*(d.dotStatCoef??.02)):statVal*(d.dotStatCoef??1);
 return Math.max(1,Math.round(roll+contribution))
}
function skillDotPower(id,fallback,actor=game.player){return dotPowerFor(skillDefs[id],fallback,actor)}
// Unified dice+stat scalar, generalized over any object carrying dmgDice/
// dmgDie/dmgStat/dmgStatMode/dmgStatCoef - a full skillDefs entry or a
// single effect component. `fallback` is the level-scaled formula used when
// no dice are configured.
function dicePowerFor(defLike,fallback,actor=game.player){
 const d=defLike||{};
 if(d.dmgDice>0){
  const roll=rollDice(`${d.dmgDice}d${d.dmgDie||6}`).total;
  const statVal=d.dmgStat?statValueFor(actor,d.dmgStat):0;
  const contribution=d.dmgStatMode==='mult'?roll*(statVal*(d.dmgStatCoef??.02)):statVal*(d.dmgStatCoef??1);
  return Math.max(1,Math.round(roll+contribution))
 }
 return fallback
}
// Same dice+stat formula as dicePowerFor, but rolling a companion/turret/
// clone's already-built `atk` dice expression directly instead of separate
// dmgDice/dmgDie fields (the invocation only stores the merged expression),
// while still reading its own dmgStat/dmgStatMode/dmgStatCoef for the stat
// contribution - used for the 'heal' effectType, which never goes through
// attack() so it needs this combined outside of it.
function companionDicePower(c,actor=game.player){
 const roll=rollDice(c.atk||'1d4').total;
 const statVal=c.dmgStat?statValueFor(actor,c.dmgStat):0;
 const contribution=c.dmgStatMode==='mult'?roll*(statVal*(c.dmgStatCoef??.02)):statVal*(c.dmgStatCoef??1);
 return Math.max(1,Math.round(roll+contribution))
}
// Unified "scalar power" used by self-cast classEffect skills (ranged/dash/
// aoe/multihit/ultimate/execute/massive pass it as attack()'s flat bonus;
// heal/shield use it directly as their magnitude) so every one of those
// effects is configurable through the same dice+stat fields as direct hits.
function resolveSkillPower(id,actor=game.player){
 const d=skillDefs[id]||{},lvl=skillLevel(id),power=skillPowerMultiplier(id);
 const fallback=Math.round((8+lvl*3+(d.resource==='mana'?statValueFor(actor,'intelligence')+statValueFor(actor,'wisdom')/2:statValueFor(actor,'strength')+statValueFor(actor,'agility')/3)));
 return Math.round(dicePowerFor(d,fallback,actor)*power)
}
function activeBuffDamageMultiplier(){
 return activeBuffMultFactor('damage')
}
function diceDamageLabel(id){
 const expr=skillDiceExpr(id),d=skillDefs[id]||{};
 if(!expr)return'Sin daño';
 if(d.dmgStat)return`${expr} ${d.dmgStatMode==='mult'?'× (stat) ':'+ '}${{strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'}[d.dmgStat]||d.dmgStat}`;
 return `${expr} + atributo`
}

function total(stat){let v=stat==='damage'?game.player.baseDamage:stat==='armor'?game.player.baseArmor:0;for(const item of Object.values(game.player.equipment))if(item?.stat===stat)v+=item.power;if(stat==='armor')v+=game.player.shield;if(stat==='maxHp')v=game.player.maxHp;if(stat==='armor'||stat==='damage')v=Math.round(v*activeBuffMultFactor(stat)+activeBuffFlatBonus(stat));return v}
// Buff value for 'critChance' is read as flat percentage points (e.g. 10 =
// +10%), same convention as the other %-based buffable stats below.
function critChance(){return Math.min(.75,.04+game.player.stats.luck*.015+activeBuffFlatBonus('critChance')/100)}
function attack(e,bonus=0,options={}){
 if(game.player.invisibleTurns>0&&game.player.invisibleBreaksOnAttack){game.player.invisibleTurns=0;log('La invisibilidad se rompe al atacar.','sys')}
 const skillId=options.skillId||null,expr=options.dice||skillDiceExpr(skillId)||baseAttackDice();
 const roll=rollDice(expr);
 // statDefLike lets a caller override where the stat-derived bonus/multiplier
 // comes from (a composable effect component's own dmgStat/dmgStatMode/
 // dmgStatCoef, or a companion/turret/clone's) instead of it always being
 // read off skillDefs[skillId] - see statModifierFor/statMultiplierFor.
 const statSource=options.statDefLike||(skillId?skillDefs[skillId]:null);
 // Basic attack (no skill): the stat bonus is driven by the equipped
 // weapon's own associated stat (weaponCategoryStats/WEAPON_TYPE_STAT via
 // inferWeaponDefenseStat) rather than always Fuerza - a dagger/rifle
 // bonuses off Agilidad, a staff off Inteligencia, etc. total('damage')
 // still contributes (gear with the 'damage' affix, HUD "Daño" stat) but
 // at reduced weight now that the weapon-stat term carries most of it.
 const weaponStat=skillId?null:inferWeaponDefenseStat(equippedWeapon());
 const statMod=statSource?statModifierFor(statSource):Math.max(0,Math.floor(total('damage')*.3)+weaponStatDamageBonus(game.player,weaponStat||'strength'));
 const statMultFactor=statSource?statMultiplierFor(statSource):1;
 const defenseStat=options.defenseStat||(skillId?inferSkillDefenseStat(skillId):weaponStat);
 const markMult=1+((e.statuses||[]).find(s=>s.type==='mark'&&s.turns>0)?.power||0);
 let raw=Math.max(1,Math.round((roll.total+statMod+Math.max(0,bonus)*.35+activeBuffFlatBonus('damage'))*statMultFactor*(options.multiplier||1)*(game.player.nextSkillMultiplier||1)*activeBuffDamageMultiplier()*damageDealtMultiplier()*markMult));
 if(skillId&&game.player.nextSkillMultiplier)game.player.nextSkillMultiplier=1;
 const defense=resolveEnemyDefense(e,defenseStat,raw);
 let d=Math.max(defense.mult===0?0:1,Math.round(raw*defense.mult));
 const crit=Math.random()<critChance();if(crit&&d>0)d=Math.round(d*1.75);
 if(game?.multiplayer){mpEnsureEnemyIds();sendMpAction(isRangedSkill(skillId)||weaponIsRanged(equippedWeapon())?'ranged_attack':'attack',{attackerType:'player',attackerId:game.pjId,targetType:'enemy',targetId:e.eid,visualAmount:d,result:crit?'critical':d?'hit':'evaded'})}
 const origin=options.origin||game.player;
 if(Math.max(Math.abs(origin.x-e.x),Math.abs(origin.y-e.y))>1)rangedTracer(origin.x,origin.y,e.x,e.y,crit?'#ffd75c':'#9be8ff');
 e.hp-=d;floating(d?`${crit?'CRIT ':''}-${d}`:'EVITA',e.x,e.y,d?(crit?'#ffd75c':'#fff'):'#70dc9b');effect('flash');
 log(`${e.name}: ${defense.result}. Tirada 1d20 (${defense.die}) + ${defense.bonus} contra CD ${defense.dc}. ${d?`Recibe ${d}${crit?' crítico':''}`:'No recibe daño'} [${expr}: ${roll.rolls.join('+')}${roll.bonus?`${roll.bonus>0?'+':''}${roll.bonus}`:''}; ataque +${statMod}].`,'combat');
 if(!skillId&&origin===game.player)maybeProcWeaponEffects(e);
 if(e.hp<=0)kill(e)
}
// Guaranteed boss-kill rarity by floor - always real equipment (forceRarityName
// on makeLoot never resolves to a potion or a skill-teaching item, see
// makeLoot's forceRarityName branch).
// A boss never drops below 'rare', regardless of how early the floor is.
function bossGuaranteedRarityForFloor(floor){
 if(floor<=8)return'rare';
 if(floor<=12)return'epic';
 if(floor<=16)return'legendary';
 return'artifact';
}
// Megaboss floors only ever land on floor%3===0 (see buildMegabossFloorPlan),
// so this is keyed directly off that fixed progression rather than a general
// floor formula.
// A megaboss never drops below 'epic', regardless of how early the floor is.
function megabossGuaranteedDrops(floor){
 if(floor<9)return{count:2,rarity:'epic'};
 if(floor<12)return{count:1,rarity:'legendary'};
 return{count:1+Math.floor((floor-12)/3),rarity:'artifact'};
}
// Enemy kill loot: once a drop is decided (killLootChance, or always on
// boss/eventBoss), a normal kill gives exactly one of equipment (64.5%),
// potion (32.2%) or skill unlock (3.3%). Magical/support archetypes apply a
// 1.15 relative weight to the potion share. No potion is awarded when the
// config_items consumable catalog is empty; a substitute is never invented.
// Bosses and megabosses skip that roll entirely: they always hand out their
// guaranteed floor-tiered equipment instead (see bossGuaranteedRarityForFloor/
// megabossGuaranteedDrops).
function kill(e){
 // Idempotency guard: a weapon on-hit proc (maybeProcWeaponEffects) can fire
 // a nested attack() at the same target that finishes it off before the
 // outer attack() call gets to its own `if(e.hp<=0)kill(e)` check - without
 // this, the second call would hand out xp/gold/loot a second time.
 if(!game.enemies.includes(e))return;
 if(game?.multiplayer)sendMpAction('death_animation',{entityType:'enemy',entityId:e.eid,at:{x:e.x,y:e.y}});
 game.enemies=game.enemies.filter(x=>x!==e);
 game.feats=normalizeFeats(game.feats);
 if(e.megaboss)game.feats.megabosses++;
 else if(e.boss)game.feats.bosses++;
 else if(e.elite)game.feats.elites++;
 // A companion ordered onto this specific enemy (permanent pet) has nothing
 // left to do - clear its order and let it snap straight back to the
 // player's side right now instead of waiting out a full companionTurn()
 // tick. Also covers every other companion kind: with the kill already
 // applied above, companionsFollowPlayerStep() re-checks whether anything
 // is still within engage range and pulls back anyone left with no fight.
 for(const c of game.companions||[])if(c.orderTarget===e)c.orderTarget=null;
 companionsFollowPlayerStep();
 gainXp(e.boss?60:8+Math.floor(game.floor/2),`xp_${game.floor}_${e.eid}`);game.player.gold+=e.boss?75:3+rng(6);
 const killLootChance=Math.min(.9,(.13+(game.player.derived?.finalStats?.luck??game.player.stats.luck)*.008)*pctMult(worldParams().enemyLootPct));
 if(e.megaboss){
  const{count,rarity}=megabossGuaranteedDrops(game.floor);
  for(let i=0;i<count;i++){const item=makeLoot(game.player.level+3,'boss',rarity);addInventoryItem(item);lootToast(item)}
 }else if(e.boss){
  const item=makeLoot(game.player.level+3,'boss',bossGuaranteedRarityForFloor(game.floor));addInventoryItem(item);lootToast(item);
 }else if(Math.random()<killLootChance||e.eventBoss){
  const source=e.eventBoss?'eventBoss':e.elite?'elite':'normal';
  const potionWeight=.322*(new Set(['caster','invocador','clerigo','chaman']).has(enemyClassOf(e))?1.15:1),equipmentWeight=.645,skillWeight=.033,totalWeight=equipmentWeight+potionWeight+skillWeight,roll=Math.random()*totalWeight;
  if(roll<equipmentWeight){
   // Elites never drop below 'uncommon', same guaranteed-floor idea as
   // bosses (rare) and megabosses (epic) above.
   const item=makeLoot(game.player.level,source,null,'equipment',e.elite?'uncommon':null);addInventoryItem(item);lootToast(item);
  }else if(roll<equipmentWeight+potionWeight){
   const item=makeLoot(game.player.level,source,null,'potion');if(item){addInventoryItem(item);lootToast(item)}
  }else{
   const drop=(e.skills?.length?pick(e.skills.filter(id=>!game.player.knownSkills.includes(id))):null)||randomLootableSkill();
   if(drop)unlockSkillLoot(drop);
  }
 }
 log(`${e.name} ha sido eliminado.`,'good');
 if(e.boss){game.bossesKilled++;unlock('firstBoss','Rey de nada','Derrota al primer jefe.');learnSkill('ironRain');banner('JEFE DERROTADO · HABILIDAD DESBLOQUEADA')}
}
// Weapon on-hit procs: after a basic (non-skill) player attack lands, the
// equipped weapon's own effects[] gets one independent procChance roll; on
// success it fires at the same target through the exact same composable-
// effects engine as skills/potions (see effectSourceDef/beginExternalEffectsCast).
// Skill-driven hits never proc here - a skill's own effects[] already covers
// that cast; this is specifically the weapon itself doing its own thing on
// a plain swing/shot.
function maybeProcWeaponEffects(target){
 const weapons=[['weapon',equippedWeapon()],['offhand',game.player.equipment?.offhand]].filter(([,item])=>item?.slot==='weapon'&&Array.isArray(item.effects)&&item.effects.length);
 for(const [slot,weapon] of weapons){
  const chance=Math.max(0,Math.min(100,Number(weapon.procChance)||0))/100;
  if(chance<=0||Math.random()>=chance)continue;
  const castId=beginExternalEffectsCast(`equip:${slot}:proc`,weapon);
  applySkillEffectsList(castId,{x:target.x,y:target.y,clickedEnemy:target,nearest:target});
  endExternalEffectsCast();
 }
}
function damagePlayer(amount,defenseStat='vitality',sourceName='Ataque enemigo',options={}){
 const originalAmount=amount;
 amount=normalizeIncomingDamage(amount,sourceName);
 const p=game.player;
 const defenseDie=rollDie(20),defenseBonus=playerDefenseBonus(defenseStat);
 const attackDC=10+Math.max(1,Math.round(amount*.75));
 let mult=1,result=`fallo defensivo de ${attackDefenseLabel(defenseStat)}`;
 // 'dodge' buffs (flat percentage points, e.g. 10 = +10%) grant a chance at
 // full evasion independent of the defense die roll below.
 const dodgeChance=Math.min(.6,activeBuffFlatBonus('dodge')/100);
 if(defenseDie===20){mult=0;result=`evasión perfecta con ${attackDefenseLabel(defenseStat)}`}
 else if(dodgeChance>0&&Math.random()<dodgeChance){mult=0;result='esquiva'}
 else if(defenseDie+defenseBonus>=attackDC){mult=.5;result=`defensa de ${attackDefenseLabel(defenseStat)} superada`}
 else if(defenseDie===1){mult=1.25;result=`pifia en ${attackDefenseLabel(defenseStat)}`}
 let d=Math.max(mult===0?0:1,Math.round(amount*mult));
 const blockChance=Math.min(.75,(p.derived?.blockChance||0)/100);
 const blocked=mult>0&&d>0&&Math.random()<blockChance;
 if(blocked){d=0;result=`${result} · bloqueado con el escudo`}
 if(d>0&&p.holyShield>0){
  const absorbed=Math.min(p.holyShield,d);
  p.holyShield-=absorbed;d-=absorbed;
  result=`${result} · escudo absorbe ${absorbed}${p.holyShield<=0?' (roto)':''}`;
 }
 let finalDamage=d;
 const lifeBuff=(p.activeBuffs||[]).find(b=>b.effects?.lifesteal);
 if(lifeBuff&&options?.skillId)healEntity(p,Math.max(1,Math.round(finalDamage*lifeBuff.effects.lifesteal)));
 if(p.counterReady&&d>0){p.counterReady.turns--;const attacker=(game.enemies||[]).filter(e=>e.hp>0).sort((a,b)=>gridDistance(p,a)-gridDistance(p,b))[0];if(attacker)attack(attacker,0,{dice:p.counterReady.damage,multiplier:.8});p.counterReady=null}
 p.hp-=d;
 if(p.hp<=0&&p.cheatDeathTurns>0){p.hp=1;p.cheatDeathTurns=0;banner('TE NIEGAS A MORIR');log('La habilidad evita la muerte y te deja con 1 de vida.','good')}
 floating(d?`-${d}`:'EVITA',p.x,p.y,d?'#ff6666':'#70dc9b');effect(d?'shake':'flash');
 log(`${sourceName}: ${result}. 1d20 (${defenseDie}) + ${defenseBonus} contra CD ${attackDC}. ${d?`Recibes ${d} de daño.`:'No recibes daño.'} [base ${Math.round(originalAmount)} → ${amount}]`,'combat');
 if(p.hp<=0){p.hp=0;game.over=true;updateUI();draw();permanentDeath()}
}

const statDescriptions={strength:'Aumenta daño físico y la stamina máxima.',vitality:'Aumenta vida y resistencia.',agility:'Aumenta evasión, movilidad y los Puntos de Acción (PA).',luck:'Mejora el % de crítico, botín y eventos.',intelligence:'Aumenta poder mágico y aporta algo de maná extra.',wisdom:'Aumenta el maná máximo y mejora regeneración y percepción.'};
function queueStatPoint(level){
 const p=game.player;p.unspentStatPoints=(p.unspentStatPoints||0)+1;p.pendingLevelUpRewards=p.pendingLevelUpRewards||[];
 const skillId=LEVEL_UP_RANDOM_SKILL_LEVELS.has(level)?randomClassSkillForLevelReward(level):null;
 p.pendingLevelUpRewards.push({level,skillId});
 showStatPointModal()
}
function showStatPointModal(){
 const p=game.player;if(!p?.unspentStatPoints)return;
 const modal=document.getElementById('statPointModal'),grid=document.getElementById('statChoiceGrid'),title=document.getElementById('statPointTitle'),text=document.getElementById('statPointText'),skill=document.getElementById('statPointSkillReward'),labels={strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'};
 if(!modal||!grid)return;
 p.pendingLevelUpRewards=p.pendingLevelUpRewards||[];const reward=p.pendingLevelUpRewards[0]||{};
 if(title)title.textContent=`SUBIDA DE NIVEL${reward.level?` · NIVEL ${reward.level}`:''}`;
 if(text)text.textContent='Distribuye 1 punto en una stat principal para consolidar la subida.';
 if(skill)skill.innerHTML=reward.skillId?levelRewardLabel(reward.level,reward.skillId):'';
 grid.innerHTML=Object.keys(labels).map(k=>`<button type="button" class="statChoice" data-stat-choice="${k}"><b>${labels[k]}: ${p.stats[k]}</b><span>${statDescriptions[k]}</span></button>`).join('');modal.classList.add('open');
 grid.querySelectorAll('[data-stat-choice]').forEach(btn=>btn.addEventListener('click',()=>{const stat=btn.dataset.statChoice,reward=(p.pendingLevelUpRewards||[]).shift()||{};p.stats[stat]=(p.stats[stat]||0)+1;p.unspentStatPoints--;if(reward.skillId)learnSkill(reward.skillId);recomputeDerived();updateUI();draw();banner(`+1 ${labels[stat].toUpperCase()}`);log(`Asignas 1 punto a ${labels[stat]}.`,'good');if(reward.skillId)log(`Recompensa aleatoria de nivel ${reward.level}: ${skillDefs[reward.skillId].name}.`,'loot');if(p.unspentStatPoints>0)showStatPointModal();else{modal.classList.remove('open');queueMissingClassSkillChoices();processClassSkillChoices();if(game.pendingPlayerFinished&&!document.getElementById('skillChoiceModal')?.classList.contains('open')){game.pendingPlayerFinished=false;playerFinished()}}}))
}
// Living participants in the run (1 in single player).
function partySize(){
 if(!game?.multiplayer)return 1;
 const ids=(game.turnOrder&&game.turnOrder.length)?game.turnOrder:[game.pjId];
 return Math.max(1,ids.length);
}
// Enemy hp scales +25% per additional player, applied once per floor build so
// the shared snapshot carries the already-scaled values to every client.
function partyHpMultiplier(n=partySize()){return 1+.25*Math.max(0,n-1)}
function scaleFloorForParty(){
 if(!game?.multiplayer)return;
 const mult=partyHpMultiplier();
 if(mult<=1||game.partyScaled===mult)return;
 for(const e of game.enemies||[]){
  if(e.partyScaled)continue;
  e.maxHp=Math.max(1,Math.round((e.maxHp||e.hp||1)*mult));
  e.hp=Math.max(1,Math.round((e.hp||e.maxHp)*mult));
  e.partyScaled=true;
 }
 game.partyScaled=mult;
}
// Enemy level/stats baked into a precomputed floor come from a synthetic
// level-1 preview character (see createDungeonWorldJson) and may also just
// be stale if the player's level has changed since this floor was last
// generated. Rescale every enemy (including superboss tier-bonus variants,
// whose extra bump is preserved since this scales whatever they already
// have rather than rebuilding from scratch) proportionally to a fresh
// target level anchored on the player's CURRENT level, every time the
// floor is (re)loaded - for brand new runs and existing/continued sessions alike.
// Ratio-adjusts one enemy's hp/atk/armor/xp toward a new target level,
// preserving whatever bonuses it already has (elite/tier/superboss/megaboss
// bumps) instead of rebuilding it from scratch. Shared by
// scaleFloorForPlayerLevel() (every enemy incl. the boss, on floor load) and
// rescaleBossOnLevelUp() (boss only, the instant the player levels up).
function rescaleEnemyToLevel(e,targetLevel){
 if(!e||e.level==null||targetLevel==null)return;
 const oldLevel=e.level;
 if(targetLevel===oldLevel)return;
 const hpRatio=(1+targetLevel*.13)/(1+oldLevel*.13),atkRatio=(1+targetLevel*.08)/(1+oldLevel*.08);
 e.maxHp=Math.max(1,Math.round((e.maxHp||e.hp||1)*hpRatio));
 e.hp=Math.max(1,Math.round((e.hp||e.maxHp)*hpRatio));
 e.atk=Math.max(1,Math.round((e.atk||e.damage||4)*atkRatio));
 e.damage=e.atk;
 e.armor=Math.max(0,Math.round((e.armor||0)*hpRatio));
 e.xp=Math.max(1,Math.round((e.xp||8)*hpRatio));
 e.level=targetLevel;
}
function bossTargetLevel(){return game.boss?.megaboss?megabossLevelForPlayer():bossLevelForPlayer()}
function scaleFloorForPlayerLevel(){
 // multiplayer keeps enemies as a single shared/authoritative snapshot across
 // party members (see partyHpMultiplier) - rescaling per-viewer here would
 // desync combat between players at different levels, so this only applies
 // to single player, where "the player" is unambiguous.
 if(game?.multiplayer||!game?.player||!(game.enemies?.length||game.boss))return;
 for(const e of game.enemies||[])rescaleEnemyToLevel(e,enemyLevelForFloor(game.floor));
 if(game.boss)rescaleEnemyToLevel(game.boss,bossTargetLevel());
}
// A boss (or megaboss) always sits at playerLevel+1..3 (megaboss: +2..4),
// independent of the floor - so unlike regular enemies it has to be
// re-rolled and rescaled the instant the player levels up mid-floor, not
// just when the floor (re)loads. See the grantXp() level-up loop.
function rescaleBossOnLevelUp(){
 if(game?.multiplayer||!game?.boss)return;
 rescaleEnemyToLevel(game.boss,bossTargetLevel());
}
function grantXp(v){
 const p=game.player;if(p.level>=LEVEL_CAP)return;
 const startLevel=p.level;
 v=Math.ceil(v*(p.raceBonuses?.xpMult||1)*xpReceivedMultiplier());p.xp+=v;
 while(p.level<LEVEL_CAP&&p.xp>=p.nextXp){
  p.xp-=p.nextXp;p.level++;
  const g=levelGrowth(p.level);
  p.nextXp=p.level<LEVEL_CAP?xpNeededForLevel(p.level):0;
  p.maxHp+=g.hp+p.stats.vitality;p.hp=p.maxHp;
  p.maxStamina+=g.stamina+Math.floor(p.stats.strength/3);p.stamina=p.maxStamina;
  p.maxMana+=g.mana+Math.floor((p.stats.wisdom*2+p.stats.intelligence)/3);p.mana=p.maxMana;
  p.baseDamage+=g.damage;p.baseArmor+=g.armor;
  if(p.level%10===0){p.stats.strength++;p.stats.vitality++;p.stats.agility++;p.stats.luck++;p.stats.intelligence++;p.stats.wisdom++}
  banner(`NIVEL ${p.level}`);queueStatPoint(p.level);
 }
 if(p.level>=LEVEL_CAP){p.level=LEVEL_CAP;p.xp=0;p.nextXp=0;banner('NIVEL MÁXIMO 100')}
 if(p.level>startLevel)rescaleBossOnLevelUp();
 // Levelling up changes both this character's score (used in accumulated_points)
 // and possibly the account's max_pj_lv gate threshold - push the save right
 // away instead of waiting for the next turn-end persist, so unlocks react
 // immediately rather than a move/action later.
 if(p.level>startLevel&&game.pjId){
  const bundle=characterBundleFromGame();
  fetch(`/api/user-pj?id=${encodeURIComponent(game.pjId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pj_json:bundle,feats:bundle.feats,pj_score:computeScore(bundle),pj_name:p.name,last_use:new Date().toISOString()})})
   .then(()=>refreshCurrentUserProgress())
   .catch(e=>console.error('No se pudo guardar el personaje tras subir de nivel',e));
 }
}
// Recomputes window.currentUser.max_pj_lv/accumulated_points from this
// user's characters (same source the server aggregates from) and refreshes
// the login stats banner and localStorage copy in place - keeps race/class
// gate checks correct within the same session (login, new character, level
// up) without forcing a re-login.
async function refreshCurrentUserProgress(){
 if(!window.currentUser?.nombre)return;
 try{
  const r=await fetch(`/api/user-pj?nombre=${encodeURIComponent(window.currentUser.nombre)}`);
  const chars=await r.json();
  if(!r.ok||!Array.isArray(chars))return;
  const maxLevel=chars.reduce((m,c)=>Math.max(m,Number(c.pj_json?.player?.level)||1),0);
  const totalScore=chars.reduce((s,c)=>s+(Number(c.pj_score)||0),0);
  window.currentUser.max_pj_lv=maxLevel;
  window.currentUser.accumulated_points=totalScore;
  try{localStorage.setItem('mazmorraUser',JSON.stringify(window.currentUser))}catch(e){}
  const statsEl=document.getElementById('userProgressStats');
  if(statsEl)statsEl.textContent=`Nivel máximo de PJ: ${maxLevel} · PUNTUACIÓN: ${Math.round(totalScore)}`;
 }catch(e){/* best-effort refresh, ignore network errors */}
}
function gainXp(v,id){
 // multiplayer: experience from a kill is split and shared with every party member
 const share=v/partySize();
 grantXp(share);
 if(game?.multiplayer&&id)sendMpAction('xp_share',{id,amount:share});
}
function learnSkill(id){if(!skillDefs[id]||game.player.knownSkills.includes(id))return;game.player.knownSkills.push(id);game.player.skillProgress=game.player.skillProgress||{};game.player.skillProgress[id]={level:1,xp:0,uses:0};const free=game.player.equippedSkills.findIndex(x=>!x);if(free>=0)game.player.equippedSkills[free]=id;log(`Nueva habilidad: ${skillDefs[id].name}.`,'loot')}
function unlock(id,title,desc){if(game.achievements[id])return;game.achievements[id]={title,desc};log(`LOGRO: ${title}`,'loot');if(id==='crowd')learnSkill('taunt');if(id==='chest5')learnSkill('lootMagnet')}

function blocked(x,y){const d=game.doors.find(d=>d.x===x&&d.y===y);return game.map[y]?.[x]!==0||(d&&!d.open)}
// A megaboss visually occupies a 2x2 block anchored on its own x,y (see
// enemySprite/drawEnemyIconHex) - matches any of those 4 cells instead of
// just the anchor tile, so walking into (or clicking) any part of its body
// hits/selects it. Regular enemies still match their single tile exactly.
function enemyAtCell(x,y){
 return game.enemies.find(e=>e.hp>0&&(e.megaboss?(x>=e.x&&x<=e.x+1&&y>=e.y&&y<=e.y+1):(e.x===x&&e.y===y)));
}
function move(dx,dy){
 if(!game||busy||game.over)return;const p=game.player,nx=p.x+dx,ny=p.y+dy,d=game.doors.find(d=>d.x===nx&&d.y===ny);
 if(dx)p.facing=dx>0?1:-1;
 if(d&&!d.open){if(d.locked&&p.keys<=0){log('Puerta cerrada: necesitas llave.','sys');return}if(!apCan('move'))return;if(d.locked)p.keys--;d.open=true;sendMpAction('open_door',{at:{x:nx,y:ny}});log('Abres una puerta.','sys');actionDone('move');return}
 const downedCompanion=(game.companions||[]).find(c=>c.permanent&&c.hp<=0&&c.x===nx&&c.y===ny);
 if(downedCompanion){reviveCompanion(downedCompanion);return}
 if(blocked(nx,ny))return;
 const e=enemyAtCell(nx,ny);
 if(e){if(!apCan('attack'))return;attack(e);actionDone('attack');return}
 if(!apCan('move'))return;
 const from={x:p.x,y:p.y};sendMpAction('move',{entityType:'player',entityId:game.pjId,from,to:{x:nx,y:ny},direction:dx||dy});anim.heroX=p.x;anim.heroY=p.y;p.x=nx;p.y=ny;anim.targetX=nx;anim.targetY=ny;anim.t=0;reveal(nx,ny);checkTile();
 companionsFollowPlayerStep();
 actionDone('move');
}
function checkTile(){
 const p=game.player,k=game.keys.find(k=>k.x===p.x&&k.y===p.y);if(k){game.keys=game.keys.filter(x=>x!==k);p.keys++;if(game.multiplayer)sendMpAction('pickup',{at:{x:p.x,y:p.y},icon:'🔑'});log('Recoges una llave.','loot')}
 detectNearbyTraps();
 const trap=(game.traps||[]).find(t=>!t.sprung&&t.x===p.x&&t.y===p.y);if(trap)springTrap(trap);
 const altar=(game.altars||[]).find(a=>!a.used&&a.x===p.x&&a.y===p.y);if(altar)useAltar(altar);
 const c=game.chests.find(c=>!c.opened&&c.x===p.x&&c.y===p.y);if(c)openChest(c);
 if(p.x===game.stairs.x&&p.y===game.stairs.y){
  const block=stairsBlockedReason();
  if(block){log(block,'combat');return}
 if(game.multiplayer)sendMpAction('floor_transition_start',{});
  if(game.floor>=DUNGEON_FLOORS){completeDungeon();return}
  game.floor++;generateFloor();
 }
}
// Why the exit is sealed, or null when the player may descend.
function stairsBlockedReason(){
 const obj=game.objective||{type:'stairs'};
 if(game.boss&&game.enemies.includes(game.boss)&&(obj.type==='bossKill'||obj.type==='stairs'))return 'La salida está sellada mientras el jefe siga vivo.';
 if(obj.type==='survive'&&!obj.done)return `Todavía no hay salida. Aguanta ${Math.max(0,(obj.turns||0)-(obj.elapsed||0))} turnos más.`;
 if(obj.type==='waves'&&(obj.done||0)<(obj.total||0))return `La salida sigue sellada: quedan ${(obj.total||0)-(obj.done||0)} oleada(s).`;
 return null;
}
// Runs once per completed round (single player and the multiplayer enemy phase).
function tickFloorObjective(){
 const obj=game?.objective;if(!obj||game.over)return;
 if(obj.type==='survive'&&!obj.done){
  obj.elapsed=(obj.elapsed||0)+1;
  // escalating threat while the exit is sealed
  if(obj.elapsed%3===0)spawnReinforcements(1+Math.floor(obj.elapsed/6));
  const left=(obj.turns||0)-obj.elapsed;
  if(left<=0){obj.done=true;banner('LA ESCALERA HA APARECIDO');log('Has resistido. La escalera de bajada se abre.','good')}
  else if(left<=3||left%5===0)log(`Aguanta: ${left} turno(s) restantes.`,'sys');
 }else if(obj.type==='timed'&&!obj.expired){
  obj.elapsed=(obj.elapsed||0)+1;
  const left=(obj.limit||0)-obj.elapsed;
  if(left<=0){
   obj.expired=true;
   banner('¡EL PISO SE DERRUMBA!');log('Se acabó el tiempo: el piso se vuelve hostil.','combat');
   spawnReinforcements(4,true);
  }else if(left<=5||left%10===0)log(`Tiempo restante: ${left} turno(s).`,'sys');
 }else if(obj.type==='timed'&&obj.expired){
  // past the limit the floor keeps punishing, but never insta-kills
  damagePlayer(Math.max(2,Math.round(game.floor*.8)),'vitality','El piso se derrumba');
  if((game.turn||0)%4===0)spawnReinforcements(1,true);
 }else if(obj.type==='waves'){
  const alive=(game.enemies||[]).filter(e=>e.hp>0&&e.waveTag).length;
  if(!obj.pending&&(obj.done||0)<(obj.total||0)&&alive===0){
   obj.done=(obj.done||0)+1;
   if(obj.done>=obj.total){banner('OLEADAS SUPERADAS');log('Has superado todas las oleadas. La salida se abre.','good')}
   else{spawnWave(obj.done);log(`Oleada ${obj.done+1} de ${obj.total}.`,'combat');banner(`OLEADA ${obj.done+1}/${obj.total}`)}
  }
 }
}
// Spawns near the player but never on top of anyone; capped to protect perf.
function spawnReinforcements(n,elite=false){
 if(!game?.enemies||game.enemies.length>110)return;
 const family=pickConfiguredFamilyForFloorWithParams(game.floor,worldParams());
 let added=0;
 for(let i=0;i<n*8&&added<n;i++){
  const dist=4+rng(6),ang=Math.random()*Math.PI*2;
  const x=Math.round(game.player.x+Math.cos(ang)*dist),y=Math.round(game.player.y+Math.sin(ang)*dist);
  if(game.map[y]?.[x]!==0||isSafeCell(x,y))continue;
  if((game.enemies||[]).some(e=>e.x===x&&e.y===y))continue;
  if(x===game.player.x&&y===game.player.y)continue;
  const e=buildConfiguredEnemy(weightedFamilyEnemy(family,false,game.floor,worldParams().floors||10),{x,y},game.floor,false);
  e.enemyFamily=family.name;e.waveTag=true;
  if(elite){e.elite=true;e.name='Élite '+e.name;e.maxHp=e.hp=Math.round(e.hp*1.5);e.atk=e.damage=Math.round((e.atk||e.damage||4)*1.28);assignEnemySkills(e)}
  if(game.multiplayer){const m=partyHpMultiplier();if(m>1){e.maxHp=e.hp=Math.round(e.hp*m);e.partyScaled=true}}
  game.enemies.push(e);added++;
 }
 if(added)floating('¡REFUERZOS!',game.player.x,game.player.y,'#ff8b4f');
}
function spawnWave(index){
 const size=Math.min(14,5+index*2+Math.floor(game.floor/5));
 spawnReinforcements(size,index>0&&index%2===0);
}
// Agility/luck let you spot adjacent traps before stepping on them.
function detectNearbyTraps(){
 const p=game.player,st=p.derived?.finalStats||p.stats||{};
 const chance=Math.min(.85,.25+((st.agility||0)+(st.luck||0))*.03);
 for(const t of game.traps||[]){
  if(t.revealed||t.sprung)continue;
  if(Math.abs(t.x-p.x)<=1&&Math.abs(t.y-p.y)<=1&&Math.random()<chance){t.revealed=true;log('Detectas una trampa junto a ti.','sys')}
 }
}
function springTrap(t){
 t.sprung=true;t.revealed=true;
 if(game.multiplayer)sendMpAction('trigger_trap',{at:{x:t.x,y:t.y}});
 floating('¡TRAMPA!',t.x,t.y,'#ff9d4f');
 damagePlayer(t.dmg||6,'agility','Trampa oculta');
 log('Pisas una trampa oculta.','combat');
}
function useAltar(a){
 // the Creator's Room altar is a reusable utility (dismantle items into
 // shards), not a one-shot buff, so it never sets a.used and instead opens
 // the disenchant picker
 if(a.kind==='disenchant'){openCraftModal();return}
 a.used=true;
 if(game.multiplayer)sendMpAction('activate_altar',{at:{x:a.x,y:a.y}});
 const p=game.player;
 if(a.kind==='heal'){healEntity(p,Math.round(p.maxHp*.45));log('El altar restaura buena parte de tu vida.','good')}
 else if(a.kind==='shield'){p.shield=(p.shield||0)+Math.round(12+game.floor*1.5);log('El altar te envuelve en un escudo.','good')}
 else{applyBuff('altarPower','Bendición del altar',8,{damage:.22,armor:.12});log('El altar potencia tu daño y tu armadura.','good')}
 floating('✦',a.x,a.y,'#9be8ff');
}
// ---- Creator's Room: dismantle items into tier shards ----------------------
// Shards are keyed by item rarity (common/uncommon/rare/epic/legendary/
// artifact) and stored on game.player.shards, persisted to user_pj's own
// `shards` column (not inside pj_json) so they survive independently of the
// rest of the character bundle - see persistShards()/api/user-pj.js.
// Equipment breaks down into 3-5 shards and each potion unit into 1-3 shards
// of its own tier; both ranges are flat and do not scale with item power.
function shardsForItem(item){return item?.type==='potion'?1+Math.floor(Math.random()*3):3+Math.floor(Math.random()*3)}
// Craft actions can fire several shard/item saves in quick succession
// (disenchant, create, upgrade tier, add/upgrade stat); plain fire-and-forget
// fetches can land out of order and let an earlier, stale write clobber a
// later one on the server, silently losing shards the player just earned.
// Chaining every save onto the previous one's promise keeps them in order.
// The shards column is stored as text server-side; api/user-pj.js parses it
// back into an object before responding, but this stays as a cheap defensive
// normalizer in case a stale/raw value ever slips through as a string.
function normalizeShards(v){
 if(v&&typeof v==='object')return v;
 if(typeof v==='string'){try{const p=JSON.parse(v||'{}');return p&&typeof p==='object'?p:{}}catch{return {}}}
 return {};
}
let shardsPersistChain=Promise.resolve();
function persistShards(){
 if(!game?.pjId){log('No se pueden guardar los shards: no hay personaje activo.','sys');return}
 const id=game.pjId,payload=JSON.stringify({shards:game.player.shards||{}});
 shardsPersistChain=shardsPersistChain.then(()=>fetch(`/api/user-pj?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:payload}))
  .then(async r=>{if(!r.ok){const d=await r.json().catch(()=>({}));log(`No se pudieron guardar los shards en el servidor: ${d.error||d.message||r.status}`,'sys');console.error('persistShards falló',d)}})
  .catch(e=>{log('No se pudieron guardar los shards (sin conexión con el servidor).','sys');console.error('No se pudieron guardar los shards',e)});
}
// Disenchanting is not gated to the Creator's Room anymore - any equipment
// item in the backpack can be broken down into shards from the Mochila tab
// itself, from anywhere in the dungeon (see the inventory render in
// updateUI() and its "Deshacer" button wired to confirmDisenchantItem()).
function disenchantItem(item){
 const idx=(game.inventory||[]).indexOf(item);if(idx<0)return;
 const n=shardsForItem(item);
 game.player.shards=game.player.shards||{};
 game.player.shards[item.rarity]=(game.player.shards[item.rarity]||0)+n;
 if(item.type==='potion'&&(item.quantity||1)>1)item.quantity--;else game.inventory.splice(idx,1);
 log(`Deshecho ${item.name}: +${n} shard(s) de ${tierDefs[item.rarity]?.label||item.rarity}.`,'good');
 persistShards();
 renderCraftShardsSummary();
 updateUI();
}
function confirmDisenchantItem(id){
 const item=(game.inventory||[]).find(i=>i.id===id);if(!item)return;
 const range=item.type==='potion'?'1-3':'3-5',unit=item.type==='potion'?' una unidad de':'';
 if(!confirm(`¿Deshacer${unit} "${item.name}" a cambio de ${range} shards de ${tierDefs[item.rarity]?.label||item.rarity}? No se puede deshacer.`))return;
 disenchantItem(item);
}
// Opens the Creator's Room altar for potion creation and equipment upgrades.
// Disenchanting lives in the inventory itself.
function openCraftModal(){switchCraftTab('tier');document.getElementById('disenchantOverlay')?.classList.remove('hidden')}

// ---- Creator's Room: potion craft + equipment tier/stat upgrades ----
// Bonus values by tier: common+1, uncommon+2, rare+4, epic+6, legendary+8, artifact+10.
const CRAFT_TIER_BONUS={common:1,uncommon:2,rare:4,epic:6,legendary:8,artifact:10};
// Extra (non-primary) stat slots an item can hold, on top of its main bonus, by tier.
const CRAFT_EXTRA_STAT_SLOTS={common:0,uncommon:0,rare:1,epic:1,legendary:2,artifact:3};
const CRAFT_TIER_UPGRADE_COST=20;
const CRAFT_ADD_STAT_COST=20;
const CRAFT_STAT_UPGRADE_COST=20;
const CRAFT_POTION_COST=7;
// Which shard tier a stat-bonus value costs to reach: +1 common, +2/+3 uncommon,
// +4/+5 rare, +6/+7 epic, +8/+9 legendary, +10 artifact.
function craftShardTierForValue(v){
 if(v<=1)return'common';
 if(v<=3)return'uncommon';
 if(v<=5)return'rare';
 if(v<=7)return'epic';
 if(v<=9)return'legendary';
 return'artifact';
}
function hasShards(tier,n){return (game.player.shards?.[tier]||0)>=n}
function spendShards(tier,n){game.player.shards=game.player.shards||{};game.player.shards[tier]=Math.max(0,(game.player.shards[tier]||0)-n);persistShards()}
const SHARD_TRANSMUTE_COST=10;
// Consumes 10 shards of one tier to produce 1 shard of the next tier up -
// lets players work toward a target tier's crafting/upgrade cost instead of
// being stuck disenchanting for the exact tier they need.
function transmuteShards(tier){
 const idx=LOOT_RARITY_ORDER.indexOf(tier),next=LOOT_RARITY_ORDER[idx+1];
 if(!next){log('No hay un tier superior al que transmutar.','sys');return}
 if(!hasShards(tier,SHARD_TRANSMUTE_COST)){log(`No tienes suficientes shards de ${tierDefs[tier]?.label||tier} (necesitas ${SHARD_TRANSMUTE_COST}).`,'sys');return}
 spendShards(tier,SHARD_TRANSMUTE_COST);
 game.player.shards=game.player.shards||{};game.player.shards[next]=(game.player.shards[next]||0)+1;
 persistShards();
 log(`Transmutados ${SHARD_TRANSMUTE_COST} shards de ${tierDefs[tier]?.label||tier} en 1 shard de ${tierDefs[next]?.label||next}.`,'good');
 renderShardsTab();renderCraftShardsSummary();
}
// Both custom-crafted AND normal (config_items/procedural loot) equipment
// qualify for add-stat/upgrade-tier, whether currently in the backpack or
// equipped - equipped items live in game.player.equipment, not game.inventory.
function craftEligibleItems(){return [...(game.inventory||[]),...Object.values(game.player?.equipment||{})].filter(i=>i&&i.type!=='potion'&&i.slot!=='consumable')}
function craftPrimaryStatForSlot(slot){const cands=primaryAffixes.filter(a=>a.slots.includes(slot));return cands.length?pick(cands):primaryAffixes[0]}
// The item's "main bonus" is its first affix matching one of the 6 core
// stats; crafted items always have exactly one, created up front.
function craftMainAffix(item){
 item.affixes=item.affixes||[];
 const primKeys=new Set(primaryAffixes.map(a=>a.key));
 let a=item.affixes.find(x=>primKeys.has(x.key));
 if(!a){const def=craftPrimaryStatForSlot(item.slot);a={key:def.key,label:def.label,value:0,percent:false};item.affixes.unshift(a)}
 return a;
}
function craftExtraStatCount(item){const main=craftMainAffix(item);return (item.affixes||[]).filter(a=>a!==main).length}
// custom_items on user_pj mirrors every player-crafted item still in the
// inventory/equipment, kept separate from the shared config_items catalog.
function syncCustomItemsRecord(){game.player.customItems=[...(game.inventory||[]),...Object.values(game.player.equipment||{})].filter(i=>i&&i.custom)}
let customItemsPersistChain=Promise.resolve();
function persistCustomItems(){
 syncCustomItemsRecord();
 if(!game?.pjId)return;
 const id=game.pjId,payload=JSON.stringify({custom_items:game.player.customItems||[]});
 customItemsPersistChain=customItemsPersistChain.then(()=>fetch(`/api/user-pj?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:payload}))
  .then(async r=>{if(!r.ok){const d=await r.json().catch(()=>({}));log(`No se pudieron guardar los objetos personalizados: ${d.error||d.message||r.status}`,'sys');console.error('persistCustomItems falló',d)}})
  .catch(e=>{log('No se pudieron guardar los objetos personalizados (sin conexión).','sys');console.error('No se pudieron guardar los objetos personalizados',e)});
}
function setCraftStatus(id,msg){const el=document.getElementById(id);if(el)el.textContent=msg}
// Shards tab: one row per tier with its (optionally admin-configured, via
// config_world_object shard_<tier> keys) icon and current count.
function renderShardsTab(){
 const root=document.getElementById('shards');if(!root)return;
 const shards=game.player.shards||{};
 root.innerHTML=`<div class="configItemsList">${LOOT_RARITY_ORDER.map((t,i)=>{
  const next=LOOT_RARITY_ORDER[i+1];
  const canTransmute=next&&hasShards(t,SHARD_TRANSMUTE_COST);
  return `<div class="configItem shardRow"><canvas class="shardTierIcon" width="28" height="28" data-shard-tier="${t}"></canvas><div><b style="color:${tierColor(t)}">${tierDefs[t]?.label||t}</b><span class="small">${shards[t]||0} shard(s)</span>${next?`<div class="configItemActions"><button type="button" data-transmute-tier="${t}" ${canTransmute?'':'disabled'}>Transmutar ${SHARD_TRANSMUTE_COST} → 1 ${tierDefs[next]?.label||next}</button></div>`:''}</div></div>`;
 }).join('')}</div><p class="small">Consigue shards deshaciendo objetos desde la Mochila. Se gastan en el Altar del Creador para crear y mejorar equipo, o transmuta ${SHARD_TRANSMUTE_COST} de un tier en 1 del siguiente.</p>`;
 setTimeout(()=>document.querySelectorAll('#shards .shardTierIcon').forEach(c=>drawShardTierIconToCanvas(c,c.dataset.shardTier)),0);
 root.querySelectorAll('[data-transmute-tier]').forEach(b=>b.onclick=()=>transmuteShards(b.dataset.transmuteTier));
}
function renderCraftShardsSummary(){
 const el=document.getElementById('craftShardsSummary');if(!el)return;
 const shards=game.player.shards||{};
 el.textContent='Shards actuales: '+(LOOT_RARITY_ORDER.map(t=>`${tierDefs[t]?.label||t} ${shards[t]||0}`).join(' · '));
}
function switchCraftTab(tab){
 document.querySelectorAll('.craftTabBtn').forEach(b=>b.classList.toggle('active',b.dataset.craftTab===tab));
 document.querySelectorAll('.craftPane').forEach(p=>p.classList.add('hidden'));
 const map={potions:'craftPanePotions',tier:'craftPaneTier',addstat:'craftPaneAddStat',upgradestat:'craftPaneUpgradeStat'};
 document.getElementById(map[tab])?.classList.remove('hidden');
 if(tab==='potions')renderCraftPotionsPane();
 else if(tab==='tier')renderCraftTierPane();
 else if(tab==='addstat')renderCraftAddStatPane();
 else if(tab==='upgradestat')renderCraftUpgradeStatPane();
 renderCraftShardsSummary();
}
function renderCraftPotionsPane(){
 const root=document.getElementById('craftPotionsList');if(!root)return;
 const rows=configuredPotionRows();
 root.innerHTML=rows.length?rows.map((row,i)=>{const item=row.item_json||row,tier=item.rarity||row.tier||'common',canCraft=hasShards(tier,CRAFT_POTION_COST);return `<div class="configItem"><span class="tierDot" style="background:${tierColor(tier)}"></span><div><b>${item.name||row.nombre||'Poción configurada'}</b><span class="small">${tierDefs[tier]?.label||tier} · ${CRAFT_POTION_COST} shards</span><div class="configItemActions"><button type="button" data-craft-potion="${i}" ${canCraft?'':'disabled'}>Crear poción</button></div></div></div>`}).join(''):'<p class="small">No hay pociones en Configuración → Pociones.</p>';
 root.querySelectorAll('[data-craft-potion]').forEach(b=>b.onclick=()=>craftConfiguredPotion(rows[Number(b.dataset.craftPotion)]));
}
function craftConfiguredPotion(row){
 if(!isConfiguredPotionRow(row)){log('Esta poción ya no pertenece al catálogo configurado.','sys');renderCraftPotionsPane();return}
 const raw=row.item_json||row,tier=raw.rarity||row.tier||'common';
 if(!hasShards(tier,CRAFT_POTION_COST)){log(`Necesitas ${CRAFT_POTION_COST} shards de ${tierDefs[tier]?.label||tier}.`,'sys');return}
 spendShards(tier,CRAFT_POTION_COST);
 const itemLevel=Math.max(1,Number(raw.itemLevel||row.ilvl)||1),item=configuredItemFromRow(row,{itemLevel:{min:itemLevel,max:itemLevel}},itemLevel);
 addInventoryItem(item);
 log(`Creada ${item.name} por ${CRAFT_POTION_COST} shards de ${tierDefs[tier]?.label||tier}.`,'good');
 renderCraftPotionsPane();renderCraftShardsSummary();updateUI();
}
function renderCraftTierPane(){
 const root=document.getElementById('craftTierList');if(!root)return;
 const items=craftEligibleItems();
 root.innerHTML=items.length?items.map((it,i)=>{
  const curIdx=LOOT_RARITY_ORDER.indexOf(it.rarity),next=LOOT_RARITY_ORDER[curIdx+1];
  const canUpgrade=next&&hasShards(next,CRAFT_TIER_UPGRADE_COST);
  return `<div class="configItem"><span class="tierDot" style="background:${tierColor(it.rarity)}"></span><div><b>${it.name}</b><span class="small">${tierDefs[it.rarity]?.label||it.rarity}${next?` → ${tierDefs[next]?.label}`:' (tier máximo)'}</span><div class="configItemActions">${next?`<button type="button" data-tier-idx="${i}" ${canUpgrade?'':'disabled'}>Mejorar (${CRAFT_TIER_UPGRADE_COST} ${tierDefs[next]?.label})</button>`:''}</div></div></div>`;
 }).join(''):'<p class="small">No tienes objetos de equipo.</p>';
 root.querySelectorAll('[data-tier-idx]').forEach(b=>b.onclick=()=>{
  const it=items[Number(b.dataset.tierIdx)],curIdx=LOOT_RARITY_ORDER.indexOf(it.rarity),next=LOOT_RARITY_ORDER[curIdx+1];
  craftUpgradeItemTier(it,next);
 });
}
function craftUpgradeItemTier(item,targetTier){
 if(!targetTier)return;
 if(!hasShards(targetTier,CRAFT_TIER_UPGRADE_COST)){log(`No tienes suficientes shards de ${tierDefs[targetTier]?.label||targetTier}.`,'sys');return}
 spendShards(targetTier,CRAFT_TIER_UPGRADE_COST);
 item.rarity=targetTier;item.label=tierDefs[targetTier]?.label||targetTier;item.custom=true;
 const main=craftMainAffix(item);
 main.value=main.key==='armor'?CRAFT_TIER_BONUS[targetTier]*2:CRAFT_TIER_BONUS[targetTier];
 applyOffhandGuarantee(item);
 log(`${item.name} mejorado a ${item.label}.`,'good');
 persistCustomItems();renderCraftTierPane();renderCraftAddStatPane();renderCraftUpgradeStatPane();renderCraftShardsSummary();recomputeDerived();updateUI();
}
function renderCraftAddStatPane(){
 const root=document.getElementById('craftAddStatList');if(!root)return;
 const items=craftEligibleItems().filter(it=>(CRAFT_EXTRA_STAT_SLOTS[it.rarity]||0)>0);
 root.innerHTML=items.length?items.map((it,i)=>{
  const allowed=CRAFT_EXTRA_STAT_SLOTS[it.rarity]||0,used=craftExtraStatCount(it);
  return `<div class="configItem"><span class="tierDot" style="background:${tierColor(it.rarity)}"></span><div><b>${it.name}</b><span class="small">${tierDefs[it.rarity]?.label} · stats extra ${used}/${allowed}</span><div class="configItemActions"><button type="button" data-addstat-idx="${i}" ${used<allowed?'':'disabled'}>Añadir stat (+1, ${CRAFT_ADD_STAT_COST} shards comunes)</button></div></div></div>`;
 }).join(''):'<p class="small">Ningún objeto admite stats adicionales (solo raros, épicos, legendarios y artefactos).</p>';
 root.querySelectorAll('[data-addstat-idx]').forEach(b=>b.onclick=()=>craftAddStat(items[Number(b.dataset.addstatIdx)]));
}
function craftAddStat(item){
 const allowed=CRAFT_EXTRA_STAT_SLOTS[item.rarity]||0,used=craftExtraStatCount(item);
 if(used>=allowed){log('Este objeto ya tiene el máximo de stats adicionales para su tier.','sys');return}
 if(!hasShards('common',CRAFT_ADD_STAT_COST)){log('No tienes suficientes shards comunes.','sys');return}
 const existingKeys=new Set((item.affixes||[]).map(a=>a.key));
 const pool=[...primaryAffixes,...secondaryAffixes].filter(a=>a.slots.includes(item.slot)&&!existingKeys.has(a.key));
 if(!pool.length){log('No quedan stats disponibles para este slot.','sys');return}
 spendShards('common',CRAFT_ADD_STAT_COST);
 const def=pick(pool);
 item.affixes=item.affixes||[];item.affixes.push({key:def.key,label:def.label,value:1,percent:!!def.percent});
 item.custom=true;
 log(`Añadida stat ${def.label} (+1) a ${item.name}.`,'good');
 persistCustomItems();renderCraftAddStatPane();renderCraftUpgradeStatPane();renderCraftShardsSummary();recomputeDerived();updateUI();
}
function renderCraftUpgradeStatPane(){
 const root=document.getElementById('craftUpgradeStatList');if(!root)return;
 const items=craftEligibleItems().filter(it=>(it.affixes||[]).length);
 root.innerHTML=items.length?items.map((it,i)=>{
  const cap=CRAFT_TIER_BONUS[it.rarity]||1;
  const rows=(it.affixes||[]).map((a,ai)=>{
   const maxed=a.value>=cap,shardTier=craftShardTierForValue(a.value+1),canUp=!maxed&&hasShards(shardTier,CRAFT_STAT_UPGRADE_COST);
   return `<div class="configItemActions"><span class="small">${a.label} +${a.value}${a.percent?'%':''}</span> <button type="button" data-up-item="${i}" data-up-affix="${ai}" ${maxed||!canUp?'disabled':''}>${maxed?'Máximo del tier':`Subir a +${a.value+1} (${CRAFT_STAT_UPGRADE_COST} ${tierDefs[shardTier]?.label})`}</button></div>`;
  }).join('');
  return `<div class="configItem"><span class="tierDot" style="background:${tierColor(it.rarity)}"></span><div><b>${it.name}</b><span class="small">${tierDefs[it.rarity]?.label} · máx stat +${cap}</span>${rows}</div></div>`;
 }).join(''):'<p class="small">No tienes objetos con stats para mejorar.</p>';
 root.querySelectorAll('[data-up-item]').forEach(b=>b.onclick=()=>{
  const it=items[Number(b.dataset.upItem)],affix=it.affixes[Number(b.dataset.upAffix)];
  craftUpgradeStat(it,affix);
 });
}
function craftUpgradeStat(item,affix){
 if(!affix)return;
 const cap=CRAFT_TIER_BONUS[item.rarity]||1;
 if(affix.value>=cap){log('Esta stat ya está en el máximo de su tier.','sys');return}
 const newValue=affix.value+1,shardTier=craftShardTierForValue(newValue);
 if(!hasShards(shardTier,CRAFT_STAT_UPGRADE_COST)){log(`No tienes suficientes shards de ${tierDefs[shardTier]?.label||shardTier}.`,'sys');return}
 spendShards(shardTier,CRAFT_STAT_UPGRADE_COST);
 affix.value=newValue;item.custom=true;
 log(`${item.name}: ${affix.label} sube a +${newValue}.`,'good');
 persistCustomItems();renderCraftUpgradeStatPane();renderCraftShardsSummary();recomputeDerived();updateUI();
}
const CHEST_ITEM_RARITY_BY_TIER={1:'common',2:'uncommon',3:'rare',4:'epic',5:'legendary'};
function chestItemRarity(tier){return CHEST_ITEM_RARITY_BY_TIER[Math.max(1,Math.min(5,Number(tier)||1))]}
function configuredRowsForChestDef(def){
 if(!def||def.type==='potion'||def.type==='skill')return [];
 const rarity=chestItemRarity(def.tier);
 return configItems.filter(row=>{const item=row.item_json||row;return !isConfiguredPotionRow(row)&&(item.rarity||row.tier||'common')===rarity&&chestItemMatchesType(item,def.type,def.slotFilter||'all',def.weaponTypeFilter||'all')})
}
function chestDefHasLoot(def){
 if(def?.type==='skill')return Object.keys(skillDefs).length>0;
 return configuredRowsForChestDef(def).length>0
}
// Chest tier (1-5) max for a floor, kept consistent with the same floor
// thresholds as the guaranteed floor-completion item
// (FLOOR_REWARD_TIER_THRESHOLDS): común/1 -> tier 1, infrecuente/2-3 -> tier
// 2, raro/4-7 -> tier 3, épico/8-10 -> tier 4 y legendario/11+ -> tier 5.
function chestTierForFloor(floor){
 const f=Math.max(1,Number(floor)||1);
 if(f<=1)return 1;
 if(f<=3)return 2;
 if(f<=7)return 3;
 if(f<=10)return 4;
 return 5;
}
// Dungeons only ever place chests backed by a real config_chest row - never a
// generic/procedural one. Picks the nearest configured tier AT OR BELOW the
// given one - never above, so an early floor can never hand out a chest
// whose tier is higher than it should be just because higher tiers happen to
// be configured and lower ones aren't. Returns null when config_chest has
// nothing at or below that tier (including when it's completely empty), in
// which case no chest gets placed at all.
function pickChestDefAtOrBelowTier(tier){
 if(!configChests.length)return null;
 for(let t=tier;t>=1;t--){const nonPotion=configChests.filter(r=>Number(r.chest_json?.tier)===t&&r.chest_json?.type!=='potion');if(nonPotion.length)return pick(nonPotion).chest_json}
 return null;
}
// Exact-tier pick (no falling back to lower tiers), used to bump a couple of
// chests per floor one tier above the floor's normal cap - see the bump step
// in buildFloorPlan(). Returns null if nothing is configured at that tier.
function pickChestDefAtTier(tier){
 if(!configChests.length)return null;
 const matches=configChests.filter(r=>Number(r.chest_json?.tier)===tier);
 const nonPotion=matches.filter(r=>r.chest_json?.type!=='potion');
 return nonPotion.length?pick(nonPotion).chest_json:null;
}
function pickPotionChestDefForFloor(floor){
 const tier=chestTierForFloor(floor);
 for(let t=tier;t>=1;t--){const rows=configChests.filter(r=>Number(r.chest_json?.tier)===t&&r.chest_json?.type==='potion');if(rows.length)return pick(rows).chest_json}
 return null
}
// Additive bonus: each regular chest grants an independent 15% chance to
// place one extra potion chest. Existing loot chests are never replaced.
function addBonusPotionChests(chests,freeCell,floor){
 const def=pickPotionChestDefForFloor(floor);if(!def)return;
 const regularCount=chests.length;
 for(let i=0;i<regularCount;i++)if(Math.random()<.15)chests.push({...freeCell(),opened:false,chestDef:def})
}
function pickChestDefForFloor(floor){
 return pickChestDefAtOrBelowTier(chestTierForFloor(floor));
}
// The chest definition determines the item type/category and its numeric tier
// determines the exact rarity. Specific ids are honored only when they meet
// both constraints; otherwise the same typed, exact-tier pool guarantees loot.
function chestLootItem(c){
 const def=c.chestDef;if(!def)return null;
 const type=def.type;
 const lootRow=currentLootProgressionRow(game.floor,game.player.level);
 if(type==='skill'){
  const ids=(def.itemIds||[]).filter(id=>id!==CHEST_RANDOM_PICK_ID),specific=ids.filter(id=>skillDefs[id]&&!(game.player.knownSkills||[]).includes(id));
  const id=specific.length?pick(specific):randomLootableSkill();
  if(id)unlockSkillLoot(id);
  return null
 }
 // itemIds may mix specific config_items ids with the CHEST_RANDOM_PICK_ID
 // sentinel ("Aleatorio" checkbox); an empty list also means random
 const pickedId=def.itemIds?.length?pick(def.itemIds):CHEST_RANDOM_PICK_ID;
 if(pickedId!==CHEST_RANDOM_PICK_ID){
  const row=configItems.find(r=>String(r.id)===String(pickedId));
  const item=row&&(row.item_json||row);
  if(row&&chestItemMatchesType(item,type,def.slotFilter||'all',def.weaponTypeFilter||'all'))return type==='potion'?configuredPotionFromRow(row,lootRow,game.player.level):configuredItemFromRow(row,lootRow,game.player.level);
 }
 // The chest's own configured itemTiers is an upper bound the admin picked
 // for that chest tier, but never a substitute for the floor's own hard
 // progression cap (lootRow.allowedRarities, see PROGRESSION_REFERENCE_FLOORS) -
 // without also checking that here, a short dungeon (few total floors) could
 // still hand out floor-1 chests with rare+ items just because the chest
 // tier's own itemTiers allowed it, regardless of how many floors the
 // dungeon actually has.
 const pool=configItems.filter(r=>{
  const j=r.item_json||r,rarity=j.rarity||r.tier||'common';
  if(!(def.itemTiers||['common']).includes(rarity))return false;
  if(!lootRarityAllowed(rarity,lootRow))return false;
  return chestItemMatchesType(j,type,def.slotFilter||'all',def.weaponTypeFilter||'all');
 });
 if(pool.length){const row=pick(pool);return type==='potion'?configuredPotionFromRow(row,lootRow,game.player.level):configuredItemFromRow(row,lootRow,game.player.level)}
 return null;
}
function openChest(c){
 c.opened=true;game.chestsOpened++;
 if(game.multiplayer)sendMpAction('open_chest',{at:{x:c.x,y:c.y}});
 const n=1+(Math.random()<.20?1:0);
 for(let i=0;i<n;i++){const item=chestLootItem(c);if(item){addInventoryItem(item);setTimeout(()=>lootToast(item),i*220)}}
 game.player.gold+=5+rng(14);floating('¡BOTÍN!',c.x,c.y,'#ffd45f');log(`Cofre: ${n} objeto(s).`,'loot');if(game.chestsOpened>=5)unlock('chest5','Coleccionista de basura','Abre 5 cofres.')
}

function applyBuff(id,name,turns,effects={}){
 const p=game.player;p.activeBuffs=p.activeBuffs||[];
 p.activeBuffs=p.activeBuffs.filter(b=>b.id!==id);
 p.activeBuffs.push({id,name,turns,effects});
 recomputeDerived();log(`${name} activo durante ${turns} turnos.`,'good')
}
function tickBuffs(){
 const p=game.player;if(!p?.activeBuffs)return;
 p.activeBuffs.forEach(b=>b.turns--);
 const ended=p.activeBuffs.filter(b=>b.turns<=0);
 p.activeBuffs=p.activeBuffs.filter(b=>b.turns>0);
 ended.forEach(b=>log(`${b.name} termina.`,'sys'));
 if(ended.length)recomputeDerived()
}
// Heal-over-time stacks from a stackable 'hot' effect component - the
// enemy-side equivalent (DOT) already lives in tickEnemyStatuses(). Shared
// between the player and companions (an area 'hot' pushes onto both), since
// neither has any other statuses array of its own.
function tickEntityHots(entity){
 if(!entity?.hots?.length)return;
 for(const h of entity.hots){restoreEntityResource(entity,h.resource||'hp',Math.max(1,Math.round(h.power)));h.turns--}
 entity.hots=entity.hots.filter(h=>h.turns>0);
}
function tickPlayerHots(){
 tickEntityHots(game.player);
}
// Applies derived.staminaRegen/manaRegen once per turn. No flat baseline and
// no stat scaling: the only sources are the off-hand item (its rolled affix,
// or the guaranteed wand/dagger regen), race passives, active buffs and
// potions - see the staminaRegen/manaRegen assembly in recomputeDerived().
function tickPlayerRegen(){
 const p=game.player;if(!p)return;
 p.stamina=Math.min(p.maxStamina,p.stamina+Math.max(0,p.derived?.staminaRegen||0));
 p.mana=Math.min(p.maxMana,p.mana+Math.max(0,p.derived?.manaRegen||0));
}
function tickEquipmentCooldowns(){
 const cd=game.player?.equipmentCooldowns;if(!cd)return;
 for(const slot in cd)if(cd[slot]>0)cd[slot]--;
}
// Only ticks down a holyshield's turn limit when one was configured (turns>0
// on cast) - a shield cast with turns:0 lasts until broken by damage, no
// timer at all.
function tickHolyShield(){
 const p=game.player;if(!p||!(p.holyShieldTurns>0))return;
 p.holyShieldTurns--;
 if(p.holyShieldTurns<=0){p.holyShield=0;p.holyShieldTurns=0}
}
// Ticks down a stackable 'invisible' effect's own turn counter each player
// turn; attacking it away early (when its breakOnAttack flag is set) happens
// separately in attack() - this only handles the timer running out on its own.
function tickPlayerInvisibility(){
 const p=game.player;if(!(p?.invisibleTurns>0))return;
 p.invisibleTurns--;
 if(p.invisibleTurns<=0){p.invisibleTurns=0;p.invisibleBreaksOnAttack=false}
}
function activeEffectsHtml(){
 // Potion-driven buffs/HOTs/shields now go through the exact same
 // activeBuffs/holyShield/invisibleTurns state as skills (see
 // effectSourceDef), so they already show up here with no separate list.
 const buffs=(game.player.activeBuffs||[]).map(b=>`<span class="effectBadge buff">${b.name}: ${b.turns}T</span>`);
 const shield=game.player.holyShield>0?[`<span class="effectBadge buff">Escudo: ${game.player.holyShield}${game.player.holyShieldTurns>0?` (${game.player.holyShieldTurns}T)`:''}</span>`]:[];
 const invisible=game.player.invisibleTurns>0?[`<span class="effectBadge buff">Invisibilidad: ${game.player.invisibleTurns}T</span>`]:[];
 return[...buffs,...shield,...invisible].join('')
}


function addEnemyStatus(e,type,turns,power=1,label=type){
 e.statuses=e.statuses||[];
 const old=e.statuses.find(s=>s.type===type);
 if(old){old.turns=Math.max(old.turns,turns);old.power=Math.max(old.power,power)}
 else e.statuses.push({type,turns,power,label});
 log(`${e.name}: ${label} durante ${turns} turnos.`,'combat')
}
function enemyHasStatus(e,type){return(e.statuses||[]).some(s=>s.type===type&&s.turns>0)}
// Debuff skills with a configured debuffStat lower that specific enemy stat
// for the status' duration (instead of the generic weakened/stunned pair),
// so "which stat" is a real, reversible mechanical choice rather than cosmetic.
// 'damage' targets the enemy's own attack power (e.atk/e.damage) directly;
// 'ap' targets its action-point pool for the turn (see the AP-mode enemy
// pool in enemyTurn) via a stored multiplier instead of a raw stat, since
// enemies don't carry a persistent AP field otherwise. Everything else still
// goes through e.stats[stat] as before.
function applyEnemyStatDebuff(e,stat,mode,value,turns,label){
 e.statuses=e.statuses||[];
 const existing=e.statuses.find(s=>s.type==='statDebuff'&&s.stat===stat);
 if(existing){existing.turns=Math.max(existing.turns,turns);return}
 if(stat==='damage'){
  const before=e.atk??e.damage??4;
  e.atk=e.damage=Math.max(1,Math.round(mode==='mult'?before*value:before-value));
  e.statuses.push({type:'statDebuff',stat,before,turns,label});
 }else if(stat==='ap'){
  const before=e.apDebuffMult??1;
  e.apDebuffMult=mode==='mult'?before*value:Math.max(0,before-value/100);
  e.statuses.push({type:'statDebuff',stat,before,turns,label});
 }else{
  e.stats=e.stats||{};
  const before=e.stats[stat]||0;
  e.stats[stat]=mode==='mult'?before*value:before-value;
  e.statuses.push({type:'statDebuff',stat,before,turns,label});
 }
 log(`${e.name}: ${label} (${DEFENSE_STAT_LABELS[stat]||stat} ${mode==='mult'?`×${value}`:`-${value}`}) durante ${turns} turnos.`,'combat')
}
function tickEnemyStatuses(){
 for(const e of [...game.enemies]){
  if(e.hp<=0)continue;
  for(const s of e.statuses||[]){
   if(['bleed','burn','poison','dot','plague','decay','decayDot','areaDot'].includes(s.type)){
    const dmg=Math.max(1,Math.round(s.power));e.hp-=dmg;floating(`-${dmg}`,e.x,e.y,'#d98a75');
    if(s.type==='decayDot')s.power=Math.max(1,s.power-1);
    if(e.hp<=0){kill(e);break}
   }
   // regen: the hot half of regenHeal/survivalHeal/oakBuff (see
   // ENEMY_HOT_HEAL_EFFECTS in enemyUseSkill) - genuine heal-over-time, not
   // the old blanket self-heal every utility/buff skill used to grant.
   if(s.type==='regen')healEntity(e,Math.max(1,Math.round(s.power)),e.x,e.y);
   s.turns--;
   if(s.turns<=0&&s.type==='doomCountdown'&&e.hp>0){const dmg=Math.max(1,Math.round(s.power));e.hp-=dmg;floating(`-${dmg}`,e.x,e.y,'#d68cff');if(e.hp<=0){kill(e);break}}
   if(s.turns<=0&&s.type==='statDebuff'){
    if(s.stat==='damage')e.atk=e.damage=s.before;
    else if(s.stat==='ap')e.apDebuffMult=s.before;
    else e.stats[s.stat]=s.before;
   }
  }
  e.statuses=(e.statuses||[]).filter(s=>s.turns>0)
 }
}
function findFreeAdjacentToPlayer(){
 const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
 for(const [dx,dy] of dirs){
  const x=game.player.x+dx,y=game.player.y+dy;
  if(!blocked(x,y)&&!isSafeCell(x,y)&&!game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)&&!(game.companions||[]).some(c=>c.x===x&&c.y===y))return{x,y}
 }
 return{x:game.player.x,y:game.player.y}
}
function findFreeNear(origin){
 const center=origin&&Number.isFinite(origin.x)&&Number.isFinite(origin.y)?origin:game.player;
 const offsets=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
 for(const [dx,dy] of offsets){
  const x=center.x+dx,y=center.y+dy;
  if(!blocked(x,y)&&!isSafeCell(x,y)&&!game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)&&!(game.companions||[]).some(c=>c.x===x&&c.y===y)&&!(game.player.x===x&&game.player.y===y))return{x,y}
 }
 return findFreeAdjacentToPlayer()
}
// `custom` (from a stackable 'summon' effect component) overrides the
// hardcoded per-kind stat table with author-configured hp/atk/range/effect,
// so admin-authored summons don't need a dedicated `kind` entry here.
function summonCompanion(kind='companion',turns=8,power=1,custom=null){
 game.companions=game.companions||[];
 const pos=findFreeNear(custom?.spawnAt);
 let stats,name;
 if(custom){
  stats={hp:Math.max(1,Math.round(custom.hp||20)),atk:custom.atk||'1d4',range:Math.max(1,custom.range||1),shape:'allyCompanion'};
  name=custom.name||'Invocación';
 }else{
  const names={companion:'Compañero',skeleton:'Siervo óseo',turret:'Torreta',healer:'Custodio',tank:'Guardián',wolf:'Lobo espiritual',clone:'Clon'};
  stats={
   skeleton:{hp:18+Math.round(power*5),atk:'1d6+2',range:1,shape:'allySkeleton'},
   turret:{hp:14+Math.round(power*3),atk:'1d6+2',range:7,shape:'allyTurret'},
   healer:{hp:16+Math.round(power*4),atk:'1d4',range:4,shape:'allyHealer'},
   tank:{hp:28+Math.round(power*7),atk:'1d6+1',range:1,shape:'allyTank'},
   wolf:{hp:20+Math.round(power*5),atk:'1d8',range:1,shape:'allyWolf'},
   clone:{hp:10+Math.round(power*2),atk:'1d4+1',range:1,shape:'allyClone'},
   companion:{hp:18+Math.round(power*4),atk:'1d6',range:1,shape:'allyCompanion'}
  }[kind]||{hp:18,atk:'1d6',range:1,shape:'allyCompanion'};
  name=names[kind]||'Aliado';
 }
 const companion={
  id:`comp-${Date.now()}-${Math.random()}`,kind:custom?'custom':kind,name,
  turns,power,x:pos.x,y:pos.y,hp:stats.hp,maxHp:stats.hp,atk:stats.atk,range:stats.range,shape:stats.shape,
  friendly:true,permanent:true,reserveResource:'mana',reservePct:20,sourceName:name,
  // spawnTurn protects it from being picked as an enemy target for the rest
  // of the turn it was summoned on (see enemySingleAction) - a companion
  // that appears mid-round shouldn't immediately eat an attack before it's
  // even had a turn of its own.
  spawnTurn:game.turn||0,
  ...(custom?{effectType:custom.effectType||'damage',skillName:custom.skillName||'',skillEffects:Array.isArray(custom.skillEffects)?custom.skillEffects:[],dmgStat:custom.dmgStat||'',dmgStatMode:custom.dmgStatMode||'add',dmgStatCoef:custom.dmgStatCoef??1,actionsPerTurn:Math.max(1,custom.actionsPerTurn||1),effectTurns:custom.effectTurns||2,stationary:!!custom.stationary,damageMode:custom.damageMode||'nearest',buffStat:custom.buffStat||'',buffMode:custom.buffMode||'add',buffValue:custom.buffValue??5,iconImage:custom.iconImage||'',permanent:true,sourceSkillId:custom.sourceSkillId||'',reviveResource:custom.reviveResource||'hp',reviveAmount:custom.reviveAmount??20,targetable:custom.targetable!==false,hitByAoe:custom.hitByAoe!==false,stance:custom.stance==='passive'?'passive':'aggressive',
   // Permanent companion (pet) command cost - what the player pays each time
   // they order it to act via issueCompanionCommand(), separate from
   // whatever the original summon itself cost. orderTarget starts empty:
   // the pet just follows until commanded (see companionTurn()).
   commandResource:custom.commandResource==='stamina'?'stamina':'mana',commandCost:Math.max(0,custom.commandCost??0),reserveResource:['hp','stamina'].includes(custom.reserveResource)?custom.reserveResource:'mana',reservePct:Math.max(1,Math.min(100,Number(custom.reservePct)||20)),sourceName:custom.sourceName||name,orderTarget:null}:{})
 };
 if(!reserveCompanionResource(companion))return null;
 game.companions.push(companion);
 reveal(pos.x,pos.y,2);draw();log(`${name} aparece en (${pos.x}, ${pos.y}) y luchará a tu lado ${turns===Infinity?'de forma permanente':`durante ${turns} turnos`}.`,'good')
 return companion
}
function moveCompanionToward(c,target){
 const occupied=(x,y)=>game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)||(game.companions||[]).some(o=>o!==c&&o.x===x&&o.y===y)||(game.player.x===x&&game.player.y===y);
 const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]],queue=[{x:c.x,y:c.y}],seen=new Set([`${c.x},${c.y}`]),parent=new Map(),goal=`${target.x},${target.y}`;let found=null;
 while(queue.length&&seen.size<2500){const cur=queue.shift();for(const [dx,dy] of dirs){const nx=cur.x+dx,ny=cur.y+dy,key=`${nx},${ny}`;if(seen.has(key)||blocked(nx,ny))continue;if(occupied(nx,ny)&&key!==goal)continue;seen.add(key);parent.set(key,`${cur.x},${cur.y}`);if(key===goal||gridDistance({x:nx,y:ny},target)<=1){found=key;queue.length=0;break}queue.push({x:nx,y:ny})}}
 if(found){let step=found;while(parent.get(step)&&parent.get(step)!==`${c.x},${c.y}`)step=parent.get(step);const [x,y]=step.split(',').map(Number);if(!occupied(x,y)){c.x=x;c.y=y;return true}}
 return false
}
// Idle behaviour: with no enemy to fight (or on a passive-stance companion,
// always), a mobile companion closes in on the player instead of standing
// still - so it isn't left behind while exploring and is in position by the
// time a fight actually starts.
function companionFollowPlayer(c){
 if(c.stationary)return;
 if(gridDistance(c,game.player)>1)moveCompanionToward(c,game.player);
}
// Closes the ENTIRE gap to a target in one call (unlike moveCompanionToward,
// which only ever takes a single step), stopping once within `range` tiles
// instead of always walking fully adjacent - so a ranged pet closing on an
// enemy stops at its own attack range instead of melee-ing in. maxSteps just
// guards against an unexpected infinite loop; a real dungeon floor is never
// that big.
function companionCloseGapTo(c,target,range=1,maxSteps=24){
 if(c.stationary)return;
 let steps=0;
 while(gridDistance(c,target)>range&&steps<maxSteps){
  if(!moveCompanionToward(c,target))break;
  steps++;
 }
}
// Used by companionsFollowPlayerStep() so a companion snaps back to your
// side the instant it has nothing to fight, instead of trailing a tile
// behind for a whole round.
function companionCloseGapToPlayer(c,maxSteps=24){companionCloseGapTo(c,game.player,1,maxSteps)}
// Whether a companion is currently committed to a fight and should NOT be
// pulled back to the player's side this step - a permanent pet with a live
// ordered target, or (for every other kind) any live enemy within the same
// COMPANION_ENGAGE_RADIUS companionTurn() itself uses to pick a target. Kept
// in sync with companionTurn()'s own targeting so this never fights the
// combat AI over where the companion should be.
function companionHasLiveEngagement(c){
 if(c.stationary)return true;
 if(c.permanent&&c.effectType)return !!(c.orderTarget&&c.orderTarget.hp>0);
 if(c.stance==='passive')return false;
 return (game.enemies||[]).some(e=>e.hp>0&&gridDistance(c,e)<=COMPANION_ENGAGE_RADIUS);
}
// Called every time the player actually moves (see move()) so companions
// stay glued to the player's side turn-by-turn instead of only catching up
// once per full round in companionTurn() - and for free: this never touches
// actionsPerTurn/commandCost or any other per-turn action budget, only the
// combat branches in companionTurn() do that. A companion mid-fight (see
// companionHasLiveEngagement) is left alone instead of being yanked back.
function companionsFollowPlayerStep(){
 for(const c of game.companions||[]){
  if(c.hp<=0)continue;
  if(companionHasLiveEngagement(c))continue;
  companionCloseGapToPlayer(c);
 }
}
// Runs one component of a 'skill'-typed invocation's own inline effects list
// (see subEffectsListHtml/COMPANION_SKILL_EFFECT_KINDS) against a single
// target - a small, single-target-only sibling of applyEffectComponent (no
// ctx/area/self-cast machinery needed here, since a companion's own "skill"
// always just fires at the one enemy it's already engaging). Each sub still
// scales off the player's own stat via statDefLike/dicePowerFor, same as
// every other stat-derived effect in the game.
function applyCompanionSkillEffect(sub,target){
 const p=game.player;
 if(sub.kind==='dmg'){
  const expr=sub.dmgDice>0?`${sub.dmgDice}d${sub.dmgDie||6}`:undefined;
  attack(target,0,{dice:expr,multiplier:sub.multiplier||1,statDefLike:sub});
  return true
 }
 if(sub.kind==='heal'){healEntity(p,dicePowerFor(sub,8,p));return true}
 if(sub.kind==='dot'){
  attack(target,0,{multiplier:.7,statDefLike:sub});
  addEnemyStatus(target,sub.flavor||'dot',sub.turns??4,dotPowerFor(sub,2));
  return true
 }
 if(sub.kind==='debuff'){
  attack(target,0,{multiplier:.7,statDefLike:sub});
  if(sub.stat)applyEnemyStatDebuff(target,sub.stat,sub.mode||'add',sub.value??2,sub.turns??3);
  return true
 }
 if(sub.kind==='cc'){
  attack(target,0,{multiplier:.75,statDefLike:sub});
  addEnemyStatus(target,sub.type||'stun',sub.turns??2,0);
  return true
 }
 if(sub.kind==='drain'){
  attack(target,0,{multiplier:.8,statDefLike:sub});
  const power=dicePowerFor(sub,3,p);
  if(sub.resource==='mana')p.mana=Math.min(p.maxMana,p.mana+power);
  else if(sub.resource==='stamina')p.stamina=Math.min(p.maxStamina,p.stamina+power);
  else healEntity(p,power);
  return true
 }
 if(sub.kind==='mark'){addEnemyStatus(target,'mark',sub.turns??4,(sub.value??25)/100);return true}
 if(sub.kind==='buff'){
  if(sub.stat)applyBuff(`companionSkillBuff:${sub.stat}`,'Habilidad de invocación',sub.turns??6,{[sub.stat]:{mode:sub.mode||'add',value:sub.value??5}});
  return true
 }
 return false
}
// Permanent companions (the 'summon' effect's "Compañero permanente" mode)
// never expire by turns and never get removed from game.companions on
// death - they sit "downed" on their tile (see companionSprite/move()) until
// revived (reviveCompanion), instead of vanishing like a regular summon.
// Enemies farther than this from a given companion are ignored entirely for
// targeting purposes - a companion never chases something outside its
// effective engagement range, it falls back to closing in on the player
// instead (see companionApproachOrStop).
const COMPANION_ENGAGE_RADIUS=6;
// Shared "no valid enemy to fight" fallback, spent as one action: close the
// gap to the player by a single tile, or - if already standing next to the
// player, or physically unable to move (stationary turrets) - report back
// that there's nothing left to do, so the calling loop stops burning the
// rest of this companion's PA on a turn with no target instead of creeping
// forward one tile per turn regardless of how many actions it has.
function companionApproachOrStop(c){
 if(c.stationary||gridDistance(c,game.player)<=1)return true;
 moveCompanionToward(c,game.player);
 return false
}
// ============================================================================
// PERMANENT COMPANION COMMANDS - a permanent pet (comp.permanent from the
// 'summon' effects-list component) no longer fights on its own: it just
// follows the player (companionFollowPlayer) and is immune to all damage
// (see the hp-refill guard at the top of companionTurn()'s loop). Once it's
// alive, its own summon skill slot is repurposed as a command instead
// (issueCompanionCommand, wired from useSkill()): attack/skill commands let
// the player pick a target, and the pet then chases and resolves it on its
// own over however many turns it takes to close the distance, with no
// further input needed. Heal fires immediately with no target to pick,
// mirroring the old effectType==='heal' autonomous behavior. None of this
// costs the player's own AP or the skill's cooldown - only a configurable
// resource cost (c.commandResource/c.commandCost) charged per command.
// ============================================================================
function permanentCompanionForSkill(id){return (game.companions||[]).find(c=>c.sourceSkillId===id&&c.permanent&&c.hp>0)}
function dismissCompanion(id){
 const idx=(game.companions||[]).findIndex(c=>c.id===id);if(idx<0)return;
 const [c]=game.companions.splice(idx,1);releaseCompanionResource(c);c.orderTarget=null;c.reservedAmount=0;
 game.player.dismissedCompanions=game.player.dismissedCompanions||[];game.player.dismissedCompanions.push(c);
 log(`${c.name} ha sido desinvocado. Se libera su reserva.`,'good');updateUI();draw()
}
function callCompanion(id){
 const list=game.player.dismissedCompanions||[],idx=list.findIndex(c=>c.id===id);if(idx<0)return;
 if(!apCan('move',5))return;const c=list[idx];if(!reserveCompanionResource(c))return;
 const pos=findFreeAdjacentToPlayer();c.x=pos.x;c.y=pos.y;c.hp=Math.max(1,c.hp);c.turns=Infinity;c.spawnTurn=game.turn||0;
 list.splice(idx,1);game.companions=game.companions||[];game.companions.push(c);
 log(`${c.name} vuelve a viajar junto a ti.`,'good');actionDone('move',5);updateUI();draw()
}
function renderCompanionsTab(){
 const root=document.getElementById('companions');if(!root)return;
 const active=(game.companions||[]).filter(c=>c.permanent),dismissed=game.player.dismissedCompanions||[],resourceLabel={hp:'vida',mana:'maná',stamina:'stamina'};
 const card=(c,isActive)=>`<div class="skillCard"><b>${c.name}</b><span class="small">${c.sourceName||'Invocación'} · HP ${c.hp}/${c.maxHp} · ${c.effectType||'compañero'} · reserva ${c.reservePct||20}% de ${resourceLabel[c.reserveResource]||'maná'}${isActive?` (${c.reservedAmount||0})`:''}</span><div><button type="button" onclick="${isActive?`dismissCompanion('${c.id}')`:`callCompanion('${c.id}')`}">${isActive?'Desinvocar':'Llamar · 5 PA'}</button></div></div>`;
 root.innerHTML=[...active.map(c=>card(c,true)),...dismissed.map(c=>card(c,false))].join('')||'<p class="small">No has vinculado ningún compañero.</p>'
}
function companionCommandKind(c){return c.effectType==='heal'?'heal':c.effectType==='damage'?'attack':'skill'}
function companionCommandLabel(c){const k=companionCommandKind(c);return k==='heal'?'Curar':k==='attack'?'Atacar':'Habilidad'}
function companionCommandIcon(c){const k=companionCommandKind(c);return k==='heal'?'✚':k==='attack'?'◆':'✦'}
// Renders the mobileSkillbar slot for a skill whose pet is already out: no
// cooldown, no player AP, and the pet's own commandCost/commandResource
// instead of the original summon skill's cost.
function companionCommandButtonHtml(c,i){
 const label=companionCommandLabel(c),icon=companionCommandIcon(c),resource=c.commandResource||'mana',cost=c.commandCost||0;
 const disabled=busy||(cost>0&&game.player[resource]<cost);
 const detail=`Ordenar a ${c.name}: ${label}${cost>0?` · ${cost} ${resource==='mana'?'maná':'stamina'}`:''} · no gasta PA`;
 return `<button class="mobileSkill companionCommand" ${disabled?'disabled':''} onclick="useSkill(${i})" title="${detail}"><span class="slotKey">${i+1}</span><span class="icon">${icon}</span><span class="skillText"><b>${label}</b>${cost>0?`<span class="costTag">${cost}${resource==='mana'?'✦':'⚡'}</span>`:''}</span></button>`;
}
function payCompanionCommandCost(c){
 const resource=c.commandResource||'mana',cost=c.commandCost||0;
 if(cost<=0)return true;
 if(game.player[resource]<cost){log(`Necesitas ${cost} ${resource==='mana'?'de maná':'de stamina'} para ordenar a ${c.name}.`,'sys');return false}
 game.player[resource]-=cost;return true
}
// Resolves a pet's pending order the instant it's already in range (used
// both right after issuing a fresh order and every subsequent turn from
// companionTurn()) - clears the order once it fires so the pet goes back to
// just following until commanded again.
function executeCompanionOrder(c){
 const target=c.orderTarget;
 if(!target||target.hp<=0){c.orderTarget=null;return}
 if(c.effectType==='skill'&&c.skillEffects?.length){for(const sub of c.skillEffects)applyCompanionSkillEffect(sub,target);floating('✦',c.x,c.y,'#d9a8ff')}
 else{attack(target,0,{dice:c.atk,multiplier:.65,statDefLike:c});floating('◆',c.x,c.y,'#9ee6c0')}
 c.orderTarget=null;
}
// A permanent pet's own PA pool for resolving an attack/skill order - kept
// separate from the player's own AP (game.player.ap) and from the free
// companionsFollowPlayerStep() follow, which never costs anything. Move/
// attack costs mirror the player's own AP_COSTS so the pet's budget reads
// the same way: enough for a handful of tiles, or fewer tiles plus a hit.
const COMPANION_AP_COSTS={move:5,attack:10};
function companionMaxAp(){return 30}
// Advances a pending order (issued via resolveCompanionCommand) as far as
// the pet's current PA allows: walks toward orderTarget one tile at a time,
// spending PA per tile, and fires the attack/skill (also spending PA) the
// instant it's in range. Stops the moment PA runs out, the path is blocked,
// or the order resolves/target dies - any unfinished distance is picked up
// again once the pet's PA refills (see startPlayerAP()), so a chase that
// can't finish this turn continues on its own at the start of the next one,
// before the player acts.
function companionResolveOrder(c){
 if(!c.orderTarget||c.orderTarget.hp<=0){c.orderTarget=null;return}
 if(c.ap==null)c.ap=companionMaxAp();
 while(c.orderTarget&&c.orderTarget.hp>0){
  const target=c.orderTarget;
  if(gridDistance(c,target)<=c.range){
   if(c.ap<COMPANION_AP_COSTS.attack)return;
   c.ap-=COMPANION_AP_COSTS.attack;
   executeCompanionOrder(c);
   return;
  }
  if(c.ap<COMPANION_AP_COSTS.move)return;
  if(!moveCompanionToward(c,target))return;
  c.ap-=COMPANION_AP_COSTS.move;
 }
}
// Entry point from useSkill(): the skill slot that originally summoned this
// pet is now its command button. Heal has no target to pick and resolves
// right away; attack/skill open normal enemy-targeting (resolveCompanionCommand
// on click) so the player picks exactly who the pet goes after.
function issueCompanionCommand(c){
 const kind=companionCommandKind(c);
 if(kind==='heal'){
  if(!payCompanionCommandCost(c))return;
  healEntity(game.player,companionDicePower(c));floating('✚',c.x,c.y,'#8dffa8');
  log(`Ordenas a ${c.name} que te cure.`,'good');updateUI();draw();
  return;
 }
 beginTargeting({kind:'companionCommand',companionId:c.id,mode:'enemy',range:24,minRange:0});
}
function resolveCompanionCommand(companionId,x,y){
 const c=(game.companions||[]).find(o=>o.id===companionId&&o.hp>0);
 if(!c){cancelTargeting('Tu compañero ya no está disponible.');return}
 if(!game.seen?.[y]?.[x]){log('No puedes ordenar un ataque fuera de tu visión.','sys');return}
 const enemy=enemyAtCell(x,y);
 if(!enemy){log('Debes seleccionar un enemigo.','sys');return}
 if(!payCompanionCommandCost(c))return;
 c.orderTarget=enemy;
 cancelTargeting('');
 log(`Ordenas a ${c.name} que ataque a ${enemy.name}.`,'good');
 // Resolve the order right now instead of leaving it for the next
 // companionTurn() tick (which only runs once per full player round): walk
 // toward the enemy and fire the moment it's in range - bounded by the pet's
 // own PA (companionResolveOrder), same as if it had used its turn. If its PA
 // runs out before it gets there, the chase continues on its own once its PA
 // refills at the start of the player's next turn (see startPlayerAP()).
 companionResolveOrder(c);
 updateUI();draw();
}
function companionTurn(){
 game.companions=game.companions||[];
 for(const c of [...game.companions]){
  // Permanent pets are fully invulnerable now - topped up every tick instead
  // of hunting down every possible damage source, so the "downed" branch
  // right below this never actually triggers for them anymore.
  if(c.permanent&&c.effectType&&c.hp<c.maxHp)c.hp=c.maxHp;
  if(c.permanent&&c.hp<=0){
   if(!c.deathHandled){
    c.deathHandled=true;
    // Applied without applyBuff()'s own log line (which reads as a positive
    // "buff active" message and would look wrong for a death debuff) - the
    // log line right below already covers it.
    const effects={};for(const k of['strength','vitality','agility','luck','intelligence','wisdom'])effects[k]={mode:'mult',value:.9};
    game.player.activeBuffs=(game.player.activeBuffs||[]).filter(b=>b.id!==`companionDown:${c.id}`);
    game.player.activeBuffs.push({id:`companionDown:${c.id}`,name:`${c.name} caído`,turns:999999,effects});
    recomputeDerived();
    log(`${c.name} ha caído: sufres un 10% menos en todas tus stats hasta que lo revivas.`,'combat');
   }
   continue;
  }
  c.turns--;
  if(c.hp<=0||c.turns<=0)continue;
  tickEntityHots(c);
  const enemies=game.enemies.filter(e=>e.hp>0);
  // Permanent pets never fight on their own: with no pending order they just
  // follow the player (companionFollowPlayer), and with one (set by
  // issueCompanionCommand/resolveCompanionCommand when the player picks a
  // target) they close the distance turn after turn - no more input needed -
  // until they're finally in range, fire once, and go back to following.
  if(c.permanent&&c.effectType){
   if(c.orderTarget&&c.orderTarget.hp>0){
    // Already resolved as far as this round's PA allows by
    // companionResolveOrder (called immediately on command, and again at the
    // start of every round by startPlayerAP()) - nothing left to spend here.
    companionResolveOrder(c);
   }else{
    c.orderTarget=null;
    companionFollowPlayer(c);
   }
   continue;
  }
  if(c.effectType){
   // custom summon from a stackable 'summon'/'summonturret' effect
   // component: runs actionsPerTurn independent actions instead of the
   // fixed one-action kind-based branches below (actionsPerTurn = author's
   // "PA" / 10). Turrets (c.stationary) get their own heal/buff/area-damage
   // branches on top of the mobile-summon damage/heal-self/root ones below,
   // gated on c.stationary so regular summons and clones keep behaving
   // exactly as before.
   for(let n=0;n<(c.actionsPerTurn||1);n++){
    // Passive stance: never fights, just stays near the player - checked
    // before any of the combat branches below. Every action either closes a
    // tile of distance or, once adjacent, stops - it doesn't burn the rest
    // of the turn's PA doing nothing.
    if(c.stance==='passive'){if(companionApproachOrStop(c))break;continue}
    if(c.stationary&&c.effectType==='heal'){
     const power=companionDicePower(c),radius=c.range||3;
     const allies=[game.player,...(game.companions||[]).filter(o=>o!==c&&o.hp>0)].filter(a=>gridDistance(c,a)<=radius);
     for(const a of allies)healEntity(a,power,a.x,a.y);
     floating('✚',c.x,c.y,'#8dffa8');continue
    }
    // Buff type works for any invocation (turret, clone or mobile companion),
    // not just stationary ones: refreshed to a short window every action
    // while the companion is alive, so it reads as "permanent while your
    // companion lives" and fades on its own within a couple of turns of it
    // dying or expiring. A mobile buff companion has no reason to chase
    // enemies, so it just stays near the player instead (stopping once
    // adjacent rather than idling through its remaining PA).
    if(c.effectType==='buff'){
     if(c.buffStat)applyBuff(`companionBuff:${c.id}`,c.name,3,{[c.buffStat]:{mode:c.buffMode||'add',value:c.buffValue??5}});
     if(!c.stationary&&companionApproachOrStop(c))break;
     continue
    }
    if(c.stationary&&c.effectType==='damage'&&c.damageMode==='area'){
     const radius=c.range||2,targets=enemies.filter(e=>gridDistance(c,e)<=radius);
     if(!targets.length)continue;
     for(const e of targets)attack(e,0,{dice:c.atk,multiplier:.55,statDefLike:c});
     floating('◆',c.x,c.y,'#9ee6c0');continue
    }
    if(c.effectType==='heal'){healEntity(game.player,companionDicePower(c));floating('✚',c.x,c.y,'#8dffa8');continue}
    // Combat priority: only enemies within COMPANION_ENGAGE_RADIUS are ever
    // considered - anything farther is ignored outright rather than pulling
    // the companion off across the map. With no such target, fall back to
    // closing in on the player (and stop the turn once adjacent) instead of
    // standing still.
    const target=enemies.filter(e=>gridDistance(c,e)<=COMPANION_ENGAGE_RADIUS).sort((a,b)=>gridDistance(c,a)-gridDistance(c,b))[0];
    if(!target){if(companionApproachOrStop(c))break;continue}
    if(gridDistance(c,target)>c.range){if(c.stationary)break;moveCompanionToward(c,target);continue}
    if(c.effectType==='root'){addEnemyStatus(target,'root',c.effectTurns||2,0,c.name);floating('◆',c.x,c.y,'#b26bff')}
    else if(c.effectType==='debuff'){if(c.buffStat)applyEnemyStatDebuff(target,c.buffStat,c.buffMode||'add',c.buffValue??2,c.effectTurns||2,c.name);floating('▼',c.x,c.y,'#ff8a8a')}
    // 'skill' invocations run their own inline stackable-effects list
    // (author-built via subEffectsListHtml, not a reference to an existing
    // skillDefs entry) against the target instead of a flat dice attack -
    // every configured sub-effect fires, same "stack as many as you want"
    // idea as a real skill's effects[]. Falls back to the plain dice attack
    // if nothing was configured yet.
    else if(c.effectType==='skill'&&c.skillEffects?.length){for(const sub of c.skillEffects)applyCompanionSkillEffect(sub,target);floating('✦',c.x,c.y,'#d9a8ff')}
    else{attack(target,0,{dice:c.atk,multiplier:.65,statDefLike:c});floating('◆',c.x,c.y,'#9ee6c0')}
   }
   continue
  }
  if(c.kind==='healer'){
   healEntity(game.player,Math.max(3,Math.round(c.power*2)));
   const nearby=enemies.filter(e=>gridDistance(c,e)<=COMPANION_ENGAGE_RADIUS).sort((a,b)=>gridDistance(c,a)-gridDistance(c,b))[0];
   if(nearby&&gridDistance(c,nearby)<=c.range)attack(nearby,0,{dice:c.atk,multiplier:.45});
   continue
  }
  if(c.stance==='passive'){companionFollowPlayer(c);continue}
  const target=enemies.filter(e=>gridDistance(c,e)<=COMPANION_ENGAGE_RADIUS).sort((a,b)=>gridDistance(c,a)-gridDistance(c,b))[0];
  if(!target){companionFollowPlayer(c);continue}
  const dist=gridDistance(c,target);
  if(dist<=c.range){
   attack(target,0,{dice:c.atk,multiplier:.65+c.power*.07});
   floating(c.kind==='skeleton'?'☠':'◆',c.x,c.y,'#9ee6c0')
  }else moveCompanionToward(c,target)
 }
 game.companions=game.companions.filter(c=>(c.permanent&&c.hp<=0)||(c.hp>0&&c.turns>0));draw()
}
// Pays the configured resource cost to bring a downed permanent companion
// back at 50% HP and lifts its death debuff - triggered by walking into its
// tile (see move()).
function reviveCompanion(c){
 const resource=c.reviveResource||'hp',cost=c.reviveAmount??20;
 if((game.player[resource]||0)<cost){log(`Necesitas ${cost} de ${resource==='hp'?'vida':resource==='mana'?'maná':'stamina'} para revivir a ${c.name}.`,'sys');return false}
 game.player[resource]-=cost;
 c.hp=Math.max(1,Math.round(c.maxHp*.5));c.deathHandled=false;
 game.player.activeBuffs=(game.player.activeBuffs||[]).filter(b=>b.id!==`companionDown:${c.id}`);
 recomputeDerived();
 log(`${c.name} vuelve a levantarse.`,'good');
 updateUI();draw();
 return true;
}
function addSkillObject(kind,id,x,y,turns=6,power=1,radius=1){
 game.skillObjects=game.skillObjects||[];
 const d=skillDefs[id]||{};
 game.skillObjects.push({id:`obj-${Date.now()}-${Math.random()}`,kind,skillId:id,name:d.name||kind,icon:d.icon||'◆',x,y,turns,power,radius});
 reveal(x,y,Math.max(1,radius));
 log(`${d.name||'Efecto'} deja una referencia visual en el tablero.`,'good')
}
function tickSkillObjects(){
 game.skillObjects=game.skillObjects||[];
 for(const o of [...game.skillObjects]){
  if(o.kind==='trap'){
   const targets=game.enemies.filter(e=>e.hp>0&&gridDistance(e,o)<=Math.max(1,o.radius));
   if(targets.length){targets.forEach(e=>attack(e,0,{skillId:o.skillId,multiplier:1.15}));floating('¡MINA!',o.x,o.y,'#ffcc55');o.turns=0;continue}
  }else if(o.kind==='decoy'){
   o.turns--;continue
  }else if(['totem','zone'].includes(o.kind)){
   for(const e of game.enemies.filter(e=>e.hp>0&&gridDistance(e,o)<=Math.max(1,o.radius)))attack(e,0,{skillId:o.skillId,multiplier:.35});
  }
  o.turns--
 }
 game.skillObjects=game.skillObjects.filter(o=>o.turns>0)
}
function teleportPlayerTo(x,y){
 if(blocked(x,y)||game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y))return false;
 game.player.x=x;game.player.y=y;anim.heroX=anim.targetX=x;anim.heroY=anim.targetY=y;reveal(x,y);return true
}
// Free tile touching `target` (8 directions, diagonals included) closest to
// the player's current spot - used to land an enemy-targeted teleport "next
// to" its target instead of requiring the enemy's own (always-occupied)
// tile to be free.
function openTileAdjacentTo(target){
 const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 const options=dirs.map(([dx,dy])=>({x:target.x+dx,y:target.y+dy}))
  .filter(pos=>!blocked(pos.x,pos.y)&&!isSafeCell(pos.x,pos.y)&&!game.enemies.some(e=>e.hp>0&&e.x===pos.x&&e.y===pos.y)&&!(game.companions||[]).some(c=>c.hp>0&&c.x===pos.x&&c.y===pos.y));
 if(!options.length)return null;
 options.sort((a,b)=>gridDistance(game.player,a)-gridDistance(game.player,b));
 return options[0];
}

// Applies a stat buff to the caster using the shared buffStat/buffStatMode/
// buffStatCoef/buffTurns fields when the skill defines them, otherwise a
// hand-tuned default (legacy percentage armor+damage, or a single flat stat)
// - shared by every hardcoded "signature" buff below so an admin can make
// ANY of them fully configurable, not just the 12 generic tags.
function applyCreativeBuff(id,d,lvl,fallbackEffects,fallbackTurns){
 const turns=d.buffTurns??fallbackTurns;
 if(d.buffStat){
  const mode=d.buffStatMode||'add',value=d.buffStatCoef??(mode==='mult'?1.2:5);
  applyBuff(id,d.name,turns,{[d.buffStat]:{mode,value}});
 }else applyBuff(id,d.name,turns,fallbackEffects);
}
function applyClassEffectState(effect,id,target,x,y,lvl){
 const p=game.player,d=skillDefs[id];
 const area=(r=2)=>game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-x),Math.abs(e.y-y))<=r);
 const status=(e,type,t,power,label)=>addEnemyStatus(e,type,t,power,label);
 const hit=(e,m=1)=>attack(e,0,{skillId:id,multiplier:m});

 if(effect==='armorBreak'){hit(target,.9);status(target,'armorBreak',d.debuffTurns??4,.20,'Quebradura');return true}
 if(effect==='pullRoot'){hit(target,.8);const dx=Math.sign(p.x-target.x),dy=Math.sign(p.y-target.y);const nx=target.x+dx,ny=target.y+dy;if(!blocked(nx,ny)&&!game.enemies.some(e=>e!==target&&e.x===nx&&e.y===ny)){target.x=nx;target.y=ny}status(target,'root',d.debuffTurns??2,0,'Inmovilizado');return true}
 if(effect==='counter'){p.shield+=8+lvl*2;p.counterReady={turns:5,damage:'1d8+'+lvl};applyCreativeBuff(id,d,lvl,{armor:.12},5);return true}
 // Self-damage then a stat buff - the exact "dmg(self)+buff(self)" combo the
 // new composable effects list expresses directly; this hardcoded version
 // stays for skills still on the legacy single-effect system.
 if(effect==='bloodBuff'){const loss=Math.max(1,Math.floor(p.hp*.10));p.hp=Math.max(1,p.hp-loss);applyCreativeBuff(id,d,lvl,{damage:{mode:'mult',value:1.25}},5);return true}
 if(effect==='lifestealBuff'){applyBuff(id,d.name,d.buffTurns??6,{lifesteal:.20});return true}
 if(effect==='overcharge'){p.hp=Math.max(1,p.hp-Math.floor(p.hp*.30));p.nextSkillMultiplier=2;return true}
 if(effect==='cheatDeath'){p.cheatDeathTurns=5;return true}
 if(effect==='missingHpNova'){const bonus=1+Math.min(.75,1-p.hp/p.maxHp);for(const e of area(3))hit(e,bonus);return true}
 if(effect==='raiseMark'){status(target,'raiseMark',d.debuffTurns??5,1,'Segunda Muerte');return true}
 if(effect==='holyMark'||effect==='mark'||effect==='bountyMark'){hit(target,.65);status(target,effect,d.debuffTurns??6,effect==='bountyMark'?.5:.2,d.name);return true}
 if(effect==='doomMark'){status(target,'doomMark',d.debuffTurns??5,1,'Mal Presagio');return true}
 if(effect==='doomCountdown'){status(target,'doomCountdown',d.dotTurns??4,dotPowerFor(d,8+lvl*3),'Cuenta final');return true}
 if(effect==='repeatSkill'){p.repeatNextSkill=.60;return true}
 if(effect==='resetCooldowns'){for(const k of Object.keys(p.cooldowns))p.cooldowns[k]=0;p[d.resource]=Math.min(p[d.resource==='mana'?'maxMana':'maxStamina'],p[d.resource]+Math.ceil(d.cost*.30));return true}
 if(effect==='reveal'){const r=12+lvl;for(let yy=Math.max(0,p.y-r);yy<=Math.min(ROWS-1,p.y+r);yy++)for(let xx=Math.max(0,p.x-r);xx<=Math.min(COLS-1,p.x+r);xx++)if(Math.hypot(xx-p.x,yy-p.y)<=r)game.seen[yy][xx]=true;return true}
 if(effect==='resourceRegen'){p.stamina=Math.min(p.maxStamina,p.stamina+12+lvl*3);applyBuff(id,d.name,d.buffTurns??4,{staminaRegen:{mode:'add',value:4+lvl}});return true}
 if(effect==='cleanseHeal'||effect==='purge'||effect==='absolution'){p.debuff=0;healEntity(p,dicePowerFor(d,10+lvl*4,p));if(effect!=='cleanseHeal')for(const e of area(3))hit(e,.75);return true}
 if(effect==='steal'){hit(target,.65);const roll=rng(3);if(roll===0){const v=dicePowerFor(d,5+lvl,p);healEntity(p,v)}else if(roll===1){p.gold+=5+lvl*2}else{const res=d.resource;p[res]=Math.min(p[res==='mana'?'maxMana':'maxStamina'],p[res]+6+lvl)}return true}
 if(effect==='freeze'){hit(target,.8);status(target,'freeze',d.debuffTurns??2,0,'Congelado');return true}
 if(effect==='stun'||effect==='silence'){hit(target,.75);status(target,effect,d.debuffTurns??(effect==='stun'?1:3),0,d.name);return true}
 if(effect==='poison'||effect==='burn'||effect==='bleed'||effect==='dot'||effect==='decayDot'){hit(target,.7);status(target,effect,d.dotTurns??4,dotPowerFor(d,2+lvl*.7),d.name);return true}
 if(effect==='root'||effect==='rootBleed'||effect==='bountyRoot'){hit(target,.7);status(target,'root',d.debuffTurns??2,0,'Inmovilizado');if(effect==='rootBleed')status(target,'dot',d.dotTurns??4,dotPowerFor(d,2+lvl*.6),'Sangrado');return true}
 return false
}

// The 12 shared classEffect tags (one per class per tier-slot: ranged, shield,
// dash, debuff, aoe, heal, multihit, utility, ultimate, execute, buff, massive)
// already have their own dedicated handling elsewhere (useSkill's self-cast
// chain, or the differentiated logic right after this function's call sites in
// resolveTargetedSkill). applyCreativeClassEffect is for the distinctive
// per-class "signature" effects (root, freeze, drain, summon, teleport...);
// it must never intercept the shared tags, or the differentiated logic below
// each call site (execute multiplier, debuff status, etc.) never runs.
const GENERIC_CLASS_EFFECTS=new Set(['ranged','shield','dash','debuff','aoe','heal','multihit','utility','ultimate','execute','buff','massive']);
function applyCreativeClassEffect(id,target,x,y){
 const d=skillDefs[id],lvl=skillLevel(id),effect=d.classEffect,p=game.player;
 if(applyClassEffectState(effect,id,target,x,y,lvl))return true;
 const enemiesIn=(radius)=>game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-x),Math.abs(e.y-y))<=radius);
 const hit=(e,m=.9)=>attack(e,0,{skillId:id,multiplier:m});
 if(['root','pullRoot','rootBleed','bountyRoot'].includes(effect)){hit(target);addEnemyStatus(target,'root',d.debuffTurns??(2+Math.floor(lvl/4)),0,'Inmovilizado');if(effect.includes('Bleed'))addEnemyStatus(target,'dot',d.dotTurns??4,dotPowerFor(d,2+lvl*.5),'Sangrado');return true}
 if(['freeze','delayedFreeze'].includes(effect)){hit(target,.8);addEnemyStatus(target,'freeze',d.debuffTurns??2,0,'Congelado');return true}
 if(['bleed','burn','poison','dot','decayDot','echoDot','delayedPoison'].includes(effect)){hit(target,.75);addEnemyStatus(target,effect==='poison'?'poison':effect==='decayDot'?'decayDot':'dot',d.dotTurns??(4+Math.floor(lvl/4)),dotPowerFor(d,2+lvl*.8),d.name);return true}
 if(['drain','holyLeech','steal'].includes(effect)){hit(target,.8);const power=dicePowerFor(d,5+lvl*2,p);healEntity(p,power);p[d.resource]=Math.min(p[d.resource==='mana'?'maxMana':'maxStamina'],p[d.resource]+power);return true}
 if(['stun','silence','age','wither','doomMark','mark','bountyMark','holyMark'].includes(effect)){hit(target,.75);addEnemyStatus(target,effect,d.debuffTurns??(2+Math.floor(lvl/5)),1,d.name);return true}
 if(['shadowStrike','holyDash','leapBuff'].includes(effect)){teleportPlayerTo(Math.max(1,target.x-Math.sign(target.x-p.x)),Math.max(1,target.y-Math.sign(target.y-p.y)));hit(target,1.15);if(effect==='shadowStrike')addEnemyStatus(target,'dot',d.dotTurns??4,dotPowerFor(d,2+lvl*.5),'Sangrado');return true}
 if(['hookBleed'].includes(effect)){hit(target,.9);addEnemyStatus(target,'dot',d.dotTurns??4,dotPowerFor(d,2+lvl*.5),'Sangrado');return true}
 if(['combo','comboMark','markedExecute','bountyExecute','packExecute','pierce','lineShot','ricochet','chain','blinkChain'].includes(effect)){hit(target,effect.includes('Execute')||effect==='markedExecute'?1.7:1.15);return true}
 if(['swapConfuse'].includes(effect)){const ox=p.x,oy=p.y;p.x=target.x;p.y=target.y;target.x=ox;target.y=oy;addEnemyStatus(target,'confuse',d.debuffTurns??2,0,'Confuso');return true}
 if(['teleportDecoy','teleportBuff','randomTeleport','freeTeleport','teleportShield','teleportClones'].includes(effect)){const ox=p.x,oy=p.y;if(!teleportPlayerTo(x,y))return false;applyCreativeBuff(id,d,lvl,{armor:.12,damage:.08},3+Math.floor(lvl/3));if(effect==='teleportDecoy')addSkillObject('decoy',id,ox,oy,4+Math.floor(lvl/3),1,1);if(effect==='teleportClones')summonCompanion('clone',5,1+lvl*.15);return true}
 if(['trap','rootZone'].includes(effect)){addSkillObject('trap',id,x,y,d.dotTurns??(6+lvl),dotPowerFor(d,1+lvl*.2),1);return true}
 // freezeTotem previously had no handler at all here (fell through to a
 // plain area attack, or a no-op with nothing in range) despite being a
 // real, admin-visible totem effect - now a proper totem like stormTotem.
 if(['consecrate','stormTotem','freezeTotem','areaDot'].includes(effect)){addSkillObject(['stormTotem','freezeTotem'].includes(effect)?'totem':'zone',id,x,y,d.dotTurns??(4+Math.floor(lvl/2)),dotPowerFor(d,1+lvl*.15),2);return true}
 if(['summon','summonTurret','summonHealer','summonTank','summonScanner','summonElite','multiSummon','clones','clone'].includes(effect)){
  const kind=effect.includes('Turret')?'turret':effect.includes('Healer')?'healer':effect.includes('Tank')?'tank':effect.includes('clone')?'clone':(id==='necromancer_t1_2'||d.classId==='necromancer')?'skeleton':d.classId==='shaman'?'wolf':'companion';
  const n=effect==='multiSummon'||effect==='clones'?2:1;for(let i=0;i<n;i++)summonCompanion(kind,d.buffTurns??(7+lvl),1+lvl*.18);return true
 }
 if(['cleanseHeal','bigHeal','regenHeal','survivalHeal','healShield'].includes(effect)){healEntity(p,dicePowerFor(d,10+lvl*4+Math.floor(p.stats.wisdom||p.stats.vitality),p));if(effect==='healShield')p.shield+=8+lvl*2;applyBuff(id,d.name,d.buffTurns??3,{maxHp:0});return true}
 if(['buffArmor','counter','bloodBuff','lifestealBuff','rampage','overcharge','fortress','holyShield','holyAvatar','randomBuff','luckBuff','sniperBuff','stealthShot','shapeShift','lichBuff','implantBuff','mechBuff','wisdomBuff','martyrBuff','oakBuff','resourceRegen','reflect','monkAvatar','tauntBuff','beastAvatar','cheatDeath','cheatDeathHeal','rewind'].includes(effect)){
  const armor=effect.includes('Armor')||effect.includes('Shield')||effect.includes('fortress')||effect.includes('Avatar')?.28:.12;
  const damage=effect.includes('blood')||effect.includes('rampage')||effect.includes('overcharge')||effect.includes('Avatar')?.24:.10;
  applyCreativeBuff(id,d,lvl,{armor,damage},5+Math.floor(lvl/2));
  if(effect.includes('Shield'))p.shield+=8+lvl*3;if(effect.includes('cheatDeath'))p.cheatDeath=1;return true
 }
 const radius=d.tier===3?3:2,targets=enemiesIn(radius);
 if(!targets.length)return false;
 for(const e of targets){hit(e,d.tier===3?1.25:.85);
  if(/root|cage|forest|blackHole/.test(effect))addEnemyStatus(e,'root',d.debuffTurns??2,0,'Inmovilizado');
  if(/freeze|thermal/.test(effect))addEnemyStatus(e,'freeze',d.debuffTurns??2,0,'Congelado');
  if(/burn|plague|dot|storm|rain|decay|nova/.test(effect))addEnemyStatus(e,'dot',d.dotTurns??3,dotPowerFor(d,2+lvl*.6),d.name);
  if(/stun|knockdown|massStun/.test(effect))addEnemyStatus(e,'stun',d.debuffTurns??(1+Math.floor(lvl/5)),0,'Aturdido');
 }
 return true
}

// ---- Composable skill effects (Advanced/custom skills) ---------------------
// A skill can carry def.effects = [{kind,target,...}, ...] instead of a
// single classEffect tag: an ordered, stackable list of independent effect
// components (deal damage, apply a DOT, buff a stat, debuff a stat, heal,
// move/teleport, apply crowd control, drain), each with its own target
// (self/enemy/area) and its own dice/stat/turns configuration - reusing the
// exact same dmgDice/dmgStat/buffStat/debuffStat/etc fields the single-
// effect system already uses, just scoped per component instead of per
// skill. When def.effects is a non-empty array it is authoritative: the
// legacy classEffect dispatch in useSkill/resolveTargetedSkill is skipped
// entirely for that skill. This is how "dmg + bloodBuff-style self-buff +
// debuff all at once" gets expressed going forward, and how a caster
// targeting itself with a 'dmg' component becomes self-damage directly,
// with no need for a dedicated bloodBuff-style hack.
function effectKindLabel(kind){return {dmg:'Daño',dot:'Daño periódico (DOT)',buff:'Buff (mejora propia)',debuff:'Debuff (empeora al enemigo)',heal:'Curación',move:'Movimiento (dash/teleport)',cc:'Control (aturdir/congelar/silenciar)',drain:'Drenaje (daña y absorbe HP/maná/stamina)',aoe:'AOE (daño en área)',multihit:'Multihit (varios impactos)',mark:'Marca (aumenta el daño recibido)',summon:'Invocación (aliado temporal)',summonturret:'Invocación-torreta (aliado estático a distancia)',utility:'Utilidad',hot:'Curación periódica (HOT)',execute:'Ejecutar (umbral de % de vida)',pullroot:'Atraer + enraizar',counter:'Contraataque',cheatdeath:'Desafiar a la muerte',holyshield:'Escudo (absorbe daño antes que la vida)',lineshot:'Disparo en línea (perfora enemigos)',trap:'Trampa (se activa al pisarla)',clones:'Clones (invocan copias que luchan contigo)',linkdamage:'Daño en cadena (salta entre enemigos)',invisible:'Invisibilidad (evita la respuesta enemiga)',transform:'Transformación (icono propio y stats en %)',ascend:'Ascensión (cambia el coste de recursos de las skills)'}[kind]||kind}
// Potions now run through the exact same composable-effects engine as
// skills (applyEffectComponent/applySkillEffectsList below), instead of a
// separate bespoke potionEffectType system - a potion "cast" just registers
// itself here for the duration of the call so every `skillDefs[id]`/
// `skillLevel(id)` lookup in that engine transparently resolves to the
// potion's own effects/level instead, with no synthetic skillDefs entry and
// no cooldown/AP/knownSkills state (potions are single-use, consumed from
// inventory quantity - see usePotion/resolveTargetedPotion).
let activeExternalCast=null; // {id,name,effects,level}
function effectSourceDef(id){return skillDefs[id]||(activeExternalCast&&activeExternalCast.id===id?activeExternalCast:null)}
function effectSourceLevel(id){return skillDefs[id]?skillLevel(id):(activeExternalCast&&activeExternalCast.id===id?activeExternalCast.level:1)}
function hasEffectsList(id){const d=effectSourceDef(id);return Array.isArray(d?.effects)&&d.effects.length>0}
// What clicking/targeting the WHOLE skill needs, derived from its
// components: any component that must hit an enemy or an area drives the
// overall target mode (enemy beats area beats none); an all-self skill
// (pure buff/heal/move-self) needs no click at all, matching how the
// existing self-cast classEffect skills behave.
const GROUND_TARGET_EFFECT_KINDS=new Set(['aoe','trap','summon','summonturret','clones']);
function effectsListTargetModeFor(list){
 if(list.some(c=>c.target==='enemy'))return'enemy';
 if(list.some(c=>c.target==='area'||(GROUND_TARGET_EFFECT_KINDS.has(c.kind)&&!c.permanent)||(c.kind==='move'&&c.mode==='teleport')))return'area';
 if(list.some(c=>c.target==='ally'))return'ally';
 return null
}
function effectsListTargetMode(id){return effectsListTargetModeFor(effectSourceDef(id)?.effects||[])}
function resolveComponentEnemyTargets(comp,ctx){
 if(comp.target==='area'){
  const radius=comp.range||2;
  return game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-ctx.x),Math.abs(e.y-ctx.y))<=radius&&hasLineOfSight(game.player,e));
 }
 return ctx.clickedEnemy?[ctx.clickedEnemy]:(ctx.nearest?[ctx.nearest]:[]);
}
// Piercing line-shot targets: walks a Bresenham-ish line from the caster
// toward the clicked/nearest enemy (same aim point resolveComponentEnemyTargets
// uses), collecting EVERY enemy on tiles it crosses up to comp.range, instead
// of stopping at the first one - that's what makes it a "line" shot rather
// than a regular ranged hit. Stops early only on a wall.
function resolveLineEnemyTargets(comp,ctx){
 const p=game.player,aim=ctx.clickedEnemy||ctx.nearest;
 const tx=aim?aim.x:ctx.x,ty=aim?aim.y:ctx.y;
 if(tx==null||ty==null||(tx===p.x&&ty===p.y))return [];
 const dx=tx-p.x,dy=ty-p.y,steps=Math.max(Math.abs(dx),Math.abs(dy)),sx=dx/steps,sy=dy/steps;
 const range=Math.max(1,comp.range||6),hits=[];
 let x=p.x,y=p.y;
 for(let i=1;i<=range;i++){
  x+=sx;y+=sy;
  const gx=Math.round(x),gy=Math.round(y);
  if(blocked(gx,gy))break;
  const e=game.enemies.find(en=>en.hp>0&&en.x===gx&&en.y===gy);
  if(e&&!hits.includes(e))hits.push(e);
 }
 return hits;
}
// Allies within radius for area heal/hot: companions (AI summons) and other
// human players (multiplayer) around the cast point - mirrors
// resolveComponentEnemyTargets' area branch but for the ally side. A single
// clicked ally (existing 'ally' target) still resolves to just ctx.clickedAlly.
function resolveComponentAllyTargets(comp,ctx){
 if(comp.target==='area'){
  const cx=ctx.x??game.player.x,cy=ctx.y??game.player.y,radius=comp.range||2;
  const companions=(game.companions||[]).filter(c=>c.hp>0&&Math.max(Math.abs(c.x-cx),Math.abs(c.y-cy))<=radius);
  const others=(game.otherPlayers||[]).filter(pl=>pl.hp>0&&Math.max(Math.abs(pl.x-cx),Math.abs(pl.y-cy))<=radius);
  return [...companions,...others];
 }
 return ctx.clickedAlly?[ctx.clickedAlly]:[];
}
function applyEffectComponent(id,comp,ctx){
 const d=effectSourceDef(id),p=game.player,lvl=effectSourceLevel(id);
 // Merges the enclosing skill's own top-level fields (type/resource, used
 // only for the "Automática" no-stat-chosen fallback) with this specific
 // component's own dmgStat/dmgStatMode/dmgStatCoef, so an enemy-facing hit
 // below scales off the stat actually configured on the component instead of
 // silently falling back to skillDefs[id]'s unrelated top-level dmgStat (or
 // the wrong bonus entirely, since most composable skills leave that unset).
 const statDefLike={...(d||{}),...comp};
 if(comp.kind==='dmg'){
  if(comp.target==='self'){
   const power=dicePowerFor(comp,8+lvl*2,p);
   p.hp=Math.max(1,p.hp-power);floating(`-${power}`,p.x,p.y,'#ff8888');effect('flash');
   return true
  }
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:undefined;
  for(const e of targets)attack(e,0,{skillId:id,dice:expr,multiplier:comp.multiplier||(comp.target==='area'?.85:1),statDefLike});
  return true
 }
 if(comp.kind==='dot'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  for(const e of targets){attack(e,0,{skillId:id,multiplier:.7});addEnemyStatus(e,comp.flavor||'dot',comp.turns??4,dotPowerFor(comp,2+lvl*.7),d.name)}
  return true
 }
 if(comp.kind==='buff'){
  const stat=comp.stat||'strength',mode=comp.mode||'add',value=comp.value??(mode==='mult'?1.2:5),turns=comp.turns??(6+Math.floor(lvl/2));
  applyBuff(`${id}:${stat}`,d.name,turns,{[stat]:{mode,value}});
  return true
 }
 if(comp.kind==='debuff'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  const mode=comp.mode||'add',value=comp.value??(mode==='mult'?.8:2),turns=comp.turns??(2+Math.floor(lvl/3));
  for(const e of targets){attack(e,0,{skillId:id,multiplier:.7});if(comp.stat)applyEnemyStatDebuff(e,comp.stat,mode,value,turns,d.name);else e.weakened=turns}
  return true
 }
 if(comp.kind==='ascend'){
  // Buff-typology effect: while active, changes what a fraction of the
  // player's own skill casts cost (see skillCostMultiplier(), read from
  // useSkill()). comp.value is the resulting % of the normal cost (100 = no
  // change), not an additive bonus. Can also swap the hero's rendered icon
  // for its own author-picked one (activePlayerIconOverride, read from
  // heroSprite()), same as 'transform'.
  const turns=comp.turns??(6+Math.floor(lvl/2)),mult=Math.max(0,(comp.value??150)/100);
  applyBuff(`${id}:ascend`,d.name,turns,{ascendMult:mult,ascendResource:comp.resource||'any',ascendIcon:comp.iconImage||'',blockSkills:comp.allowSkills===false});
  return true
 }
 if(comp.kind==='transform'){
  // Buff-typology effect: swaps the hero's rendered icon (activePlayerIconOverride,
  // read from heroSprite()) and applies %-based damage/armor/max-HP changes
  // for the duration, reusing the same buff-multiplier plumbing as 'buff'
  // (total('damage')/total('armor')) and the existing flat maxHp buff slot
  // (recomputeDerived already folds b.effects.maxHp in as a flat bonus, so a
  // % here is just converted to a flat amount once at cast time). Can also
  // be authored to block casting any other skill for the duration.
  const turns=comp.turns??(8+Math.floor(lvl/2));
  const dmgMult=1+(comp.damagePct??0)/100,armorMult=1+(comp.armorPct??0)/100;
  const hpBonus=Math.round((p.maxHp||0)*(comp.hpPct??0)/100);
  applyBuff(`${id}:transform`,d.name,turns,{damage:{mode:'mult',value:dmgMult},armor:{mode:'mult',value:armorMult},maxHp:hpBonus,transformIcon:comp.iconImage||'',blockSkills:comp.allowSkills===false});
  return true
 }
 if(comp.kind==='heal'){
  const power=dicePowerFor(comp,8+lvl*3,p),resource=comp.resource||'hp';
  if(comp.target==='area'){
   restoreEntityResource(p,resource,power*2);
   for(const ally of resolveComponentAllyTargets(comp,ctx)){
    restoreEntityResource(ally,resource,power*2,ally.x,ally.y);
    if(ally.pjId)sendMpAction('ally_heal',{targetId:ally.pjId,hpAmount:resource==='hp'?power*2:0,resAmount:resource==='hp'?0:power*2,resType:resource,id:crypto.randomUUID()});
   }
  }else if(comp.target==='ally'&&ctx.clickedAlly){
   restoreEntityResource(ctx.clickedAlly,resource,power*2,ctx.clickedAlly.x,ctx.clickedAlly.y);
   sendMpAction('ally_heal',{targetId:ctx.clickedAlly.pjId,hpAmount:resource==='hp'?power*2:0,resAmount:resource==='hp'?0:power*2,resType:resource,id:crypto.randomUUID()});
  }else restoreEntityResource(p,resource,power*2);
  return true
 }
 if(comp.kind==='move'){
  const range=Math.max(1,comp.range||3);
  if(comp.mode==='teleport'){
   // Enemy-targeted cast (clicked an enemy, or auto-picked the nearest one
   // in the self-cast flow): the enemy's own tile is always occupied, so
   // blink onto a free tile touching it instead of requiring the exact
   // clicked cell to be free - this is what makes a stacked teleport+damage
   // skill behave like "teleport next to the enemy and hit it". A pure
   // area-targeted cast (no enemy under the cursor) keeps porting to the
   // exact clicked tile, unchanged.
   if(ctx.clickedEnemy){const spot=openTileAdjacentTo(ctx.clickedEnemy);if(!spot)return false;return teleportPlayerTo(spot.x,spot.y)}
   if(blocked(ctx.x,ctx.y)||game.enemies.some(e=>e.hp>0&&e.x===ctx.x&&e.y===ctx.y))return false;
   return teleportPlayerTo(ctx.x,ctx.y)
  }
  const dashTarget=ctx.clickedEnemy||ctx.nearest;if(!dashTarget)return false;
  const dx=Math.sign(dashTarget.x-p.x),dy=Math.sign(dashTarget.y-p.y);
  for(let i=0;i<range;i++){const nx=p.x+dx,ny=p.y+dy;if(blocked(nx,ny)||game.enemies.some(e=>e!==dashTarget&&e.x===nx&&e.y===ny)||(dashTarget.x===nx&&dashTarget.y===ny))break;p.x=nx;p.y=ny}
  reveal(p.x,p.y);attack(dashTarget,0,{skillId:id,multiplier:comp.multiplier||1});
  return true
 }
 if(comp.kind==='cc'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  for(const e of targets){attack(e,0,{skillId:id,multiplier:.75});addEnemyStatus(e,comp.type||'stun',comp.turns??2,0,d.name)}
  return true
 }
 if(comp.kind==='drain'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  const power=dicePowerFor(comp,5+lvl*2,p);
  for(const e of targets)attack(e,0,{skillId:id,multiplier:.8});
  // The target always loses HP via the attack() above (the only pool
  // enemies have); the resource picker only controls what the CASTER gets
  // back, independent of the skill's own casting resource.
  const resource=comp.resource||'hp';
  if(resource==='mana')p.mana=Math.min(p.maxMana,p.mana+power);
  else if(resource==='stamina')p.stamina=Math.min(p.maxStamina,p.stamina+power);
  else healEntity(p,power);
  return true
 }
 if(comp.kind==='aoe'){
  const radius=Math.max(1,comp.range||2);
  const targets=game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-ctx.x),Math.abs(e.y-ctx.y))<=radius&&hasLineOfSight(p,e));
  if(!targets.length)return false;
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:undefined;
  for(const e of targets)attack(e,0,{skillId:id,dice:expr,multiplier:comp.multiplier||.85,statDefLike});
  return true
 }
 if(comp.kind==='multihit'){
  const target=ctx.clickedEnemy||ctx.nearest;if(!target)return false;
  const hits=Math.max(1,comp.hits||3);
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:undefined;
  // Paced like consecutive attacks (one every 0.5s) instead of all landing
  // in the same tick, same staggered-setTimeout idiom used elsewhere
  // (chest loot toasts, mp action replay) rather than a synchronous loop.
  for(let i=0;i<hits;i++)setTimeout(()=>{
   if(target.hp<=0)return;
   attack(target,0,{skillId:id,dice:expr,multiplier:comp.multiplier||.6,statDefLike});
   draw();updateUI();
  },i*500);
  return true
 }
 if(comp.kind==='mark'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  const turns=comp.turns??4,power=(comp.value??25)/100;
  for(const e of targets)addEnemyStatus(e,'mark',turns,power,d.name);
  return true
 }
 if(comp.kind==='summon'){
  const atk=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:'1d4';
  if([...(game.companions||[]),...(game.player.dismissedCompanions||[])].some(c=>c.sourceSkillId===id)){log(`${d.name} ya está invocado.`,'sys');return false}
  if(comp.permanent){
   // Permanent companion (pet): only one instance per skill. This branch
   // only ever runs for the FIRST cast - useSkill() intercepts every
   // subsequent press of this same skill straight into
   // issueCompanionCommand() while the pet is alive, so it never reaches
   // here again (and, being invulnerable now, it shouldn't go down either -
   // reviveCompanion() stays only as a safety net).
   const existing=(game.companions||[]).find(c=>c.sourceSkillId===id);
   if(existing)return existing.hp>0?false:reviveCompanion(existing);
   return !!summonCompanion('custom',Infinity,1,{hp:comp.hp??20,atk,range:comp.range||0,skillName:comp.skillName||'',skillEffects:Array.isArray(comp.skillEffects)?comp.skillEffects:[],dmgStat:comp.dmgStat||'',dmgStatMode:comp.dmgStatMode||'add',dmgStatCoef:comp.dmgStatCoef??1,name:d.name,effectType:comp.effectType||'damage',actionsPerTurn:Math.max(1,Math.round((comp.ap??10)/10)),effectTurns:comp.effectTurns??2,iconImage:comp.iconImage||'',permanent:true,sourceSkillId:id,commandResource:comp.commandResource||'mana',commandCost:comp.commandCost??0,reviveResource:comp.reviveResource||'hp',reviveAmount:comp.reviveAmount??20,targetable:comp.targetable,hitByAoe:comp.hitByAoe,stance:comp.stance,buffStat:comp.stat,buffMode:comp.mode,buffValue:comp.value,reserveResource:comp.reserveResource,reservePct:comp.reservePct,sourceName:d.name});
  }
  summonCompanion('custom',comp.turns??8,1,{hp:comp.hp??20,atk,range:comp.range||0,skillName:comp.skillName||'',skillEffects:Array.isArray(comp.skillEffects)?comp.skillEffects:[],dmgStat:comp.dmgStat||'',dmgStatMode:comp.dmgStatMode||'add',dmgStatCoef:comp.dmgStatCoef??1,name:d.name,effectType:comp.effectType||'damage',actionsPerTurn:Math.max(1,Math.round((comp.ap??10)/10)),effectTurns:comp.effectTurns??2,iconImage:comp.iconImage||'',targetable:comp.targetable,hitByAoe:comp.hitByAoe,stance:comp.stance,buffStat:comp.stat,buffMode:comp.mode,buffValue:comp.value,spawnAt:{x:ctx.x,y:ctx.y}});
  return true
 }
 if(comp.kind==='summonturret'){
  const atk=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:'1d6+2';
  summonCompanion('custom',comp.turns??8,1,{hp:comp.hp??16,atk,range:Math.max(1,comp.range||7),skillName:comp.skillName||'',skillEffects:Array.isArray(comp.skillEffects)?comp.skillEffects:[],dmgStat:comp.dmgStat||'',dmgStatMode:comp.dmgStatMode||'add',dmgStatCoef:comp.dmgStatCoef??1,name:d.name,effectType:comp.effectType||'damage',damageMode:comp.damageMode||'nearest',actionsPerTurn:Math.max(1,Math.round((comp.ap??10)/10)),effectTurns:comp.effectTurns??2,stationary:true,buffStat:comp.stat,buffMode:comp.mode,buffValue:comp.value,iconImage:comp.iconImage||'',spawnAt:{x:ctx.x,y:ctx.y}});
  return true
 }
 if(comp.kind==='utility'){
  const mode=comp.mode||'reveal';
  if(mode==='reveal'){
   const radius=Math.max(1,comp.value||10);
   for(let y=Math.max(0,p.y-radius);y<Math.min(ROWS,p.y+radius+1);y++)for(let x=Math.max(0,p.x-radius);x<Math.min(COLS,p.x+radius+1);x++)if(Math.hypot(x-p.x,y-p.y)<=radius)game.seen[y][x]=true;
   return true
  }
  if(mode==='stealth'){game.player.shadowVeil=1;return true}
  if(mode==='shield'){game.player.shield+=Math.max(1,comp.value||10);return true}
  // comp.resource lets this specific component pick mana/stamina on its own
  // (needed for a potion, which has no enclosing skill resource to fall
  // back on) - falls back to the enclosing skill's own resource, same as before.
  if(mode==='resource'){const res=comp.resource||d.resource||'stamina',max=res==='mana'?'maxMana':'maxStamina';p[res]=Math.min(p[max],p[res]+Math.max(1,comp.value||10));return true}
  return false
 }
 if(comp.kind==='invisible'){
  p.invisibleTurns=Math.max(1,comp.turns??2);
  p.invisibleBreaksOnAttack=comp.breakOnAttack!==false;
  return true
 }
 if(comp.kind==='hot'){
  p.hots=p.hots||[];
  const power=dicePowerFor(comp,3+lvl,p),turns=comp.turns??4;
  const resource=comp.resource||'hp';p.hots.push({turns,power,resource});
  if(comp.target==='area'){
   for(const ally of resolveComponentAllyTargets(comp,ctx)){
    if(ally.pjId){
     // Remote players have no live per-turn HOT-tick channel over the
     // network yet, so their share is one upfront instant heal covering the
     // whole duration instead of ticking turn by turn like companions/self.
     const total=Math.max(1,Math.round(power*turns));
     healEntity(ally,total,ally.x,ally.y);
     sendMpAction('ally_heal',{targetId:ally.pjId,hpAmount:total,resAmount:0,resType:d.resource,id:crypto.randomUUID()});
    }else{
     ally.hots=ally.hots||[];
     ally.hots.push({turns,power,resource});
    }
   }
  }
  return true
 }
 if(comp.kind==='execute'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  const threshold=(comp.threshold??35)/100,execMult=comp.execMultiplier??2.5;
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:undefined;
  for(const e of targets)attack(e,0,{skillId:id,dice:expr,multiplier:(e.hp/e.maxHp)<threshold?execMult:(comp.multiplier||1),statDefLike});
  return true
 }
 if(comp.kind==='pullroot'){
  const targets=resolveComponentEnemyTargets(comp,ctx);if(!targets.length)return false;
  for(const e of targets){
   attack(e,0,{skillId:id,multiplier:comp.multiplier||.8});
   const dx=Math.sign(p.x-e.x),dy=Math.sign(p.y-e.y),nx=e.x+dx,ny=e.y+dy;
   if(!blocked(nx,ny)&&!game.enemies.some(o=>o!==e&&o.x===nx&&o.y===ny)){e.x=nx;e.y=ny}
   addEnemyStatus(e,'root',comp.turns??2,0,d.name);
  }
  return true
 }
 if(comp.kind==='counter'){
  p.shield+=Math.max(0,comp.shield??10);
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:'1d8';
  p.counterReady={turns:comp.turns??5,damage:expr};
  return true
 }
 if(comp.kind==='cheatdeath'){
  p.cheatDeathTurns=Math.max(1,comp.turns??5);
  return true
 }
 if(comp.kind==='holyshield'){
  // Absorb-shield pool: consumed by damagePlayer() before HP, separate from
  // the flat armor-boost p.shield used elsewhere. Same dice/stat-scaling
  // idiom as dicePowerFor/dotPowerFor: mode 'mult' scales the base value by
  // statVal*coef instead of just adding it.
  const statVal=comp.stat?statValueFor(p,comp.stat):0,coef=comp.statCoef??1,base=Math.max(0,comp.value??20);
  const contribution=comp.mode==='mult'?base*(statVal*coef):statVal*coef;
  const amount=Math.max(1,Math.round(base+contribution));
  p.holyShield=(p.holyShield||0)+amount;
  if(comp.turns)p.holyShieldTurns=Math.max(p.holyShieldTurns||0,comp.turns);
  return true
 }
 if(comp.kind==='lineshot'){
  const targets=resolveLineEnemyTargets(comp,ctx);if(!targets.length)return false;
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:undefined;
  for(const e of targets)attack(e,0,{skillId:id,dice:expr,multiplier:comp.multiplier||.8,statDefLike});
  return true
 }
 if(comp.kind==='trap'){
  const power=dicePowerFor(comp,4+lvl*1.5,p);
  addSkillObject('trap',id,ctx.x,ctx.y,Math.max(1,comp.turns??8),power,Math.max(1,comp.range||1));
  return true
 }
 if(comp.kind==='clones'){
  const atk=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:'1d4+1';
  const count=Math.max(1,Math.min(4,comp.count||2));
  for(let i=0;i<count;i++)summonCompanion('custom',comp.turns??8,1,{hp:comp.hp??14,atk,range:comp.range||0,skillName:comp.skillName||'',skillEffects:Array.isArray(comp.skillEffects)?comp.skillEffects:[],dmgStat:comp.dmgStat||'',dmgStatMode:comp.dmgStatMode||'add',dmgStatCoef:comp.dmgStatCoef??1,name:d.name,effectType:comp.effectType||'damage',effectTurns:comp.effectTurns??2,actionsPerTurn:Math.max(1,Math.round((comp.ap??10)/10)),iconImage:comp.iconImage||'',buffStat:comp.stat,buffMode:comp.mode,buffValue:comp.value,spawnAt:{x:ctx.x,y:ctx.y}});
  return true
 }
 if(comp.kind==='linkdamage'){
  const first=ctx.clickedEnemy||ctx.nearest;if(!first||first.hp<=0)return false;
  const expr=comp.dmgDice>0?`${comp.dmgDice}d${comp.dmgDie||6}`:undefined;
  const jumps=Math.max(0,comp.jumps??3),falloff=Math.max(0,Math.min(95,comp.falloff??25))/100,jumpRange=Math.max(1,comp.range||4);
  const hit=new Set([first]);
  let current=first,mult=1;
  attack(current,0,{skillId:id,dice:expr,multiplier:comp.multiplier||1,statDefLike});
  for(let j=0;j<jumps;j++){
   mult*=1-falloff;
   const next=game.enemies.filter(e=>e.hp>0&&!hit.has(e)&&gridDistance(current,e)<=jumpRange).sort((a,b)=>gridDistance(current,a)-gridDistance(current,b))[0];
   if(!next)break;
   hit.add(next);attack(next,0,{skillId:id,dice:expr,multiplier:(comp.multiplier||1)*mult,statDefLike});current=next;
  }
  return true
 }
 return false
}
// Runs every component in def.effects against a shared cast context; a
// skill "succeeds" (consumes cost/cooldown) if ANY component actually did
// something, matching the existing used-flag convention.
// Any 'move' (teleport/dash) component always resolves before every other
// component, regardless of the order the author placed them in the JSON
// editor: a stacked teleport/dash + damage skill must land next to the
// enemy first and only then roll damage. Once a move component lands, ctx.x/
// ctx.y are synced to the player's actual post-move position, so a
// following area-style component (aoe, or a dmg/dot/debuff/cc aimed at
// 'area') centers on the caster's new spot instead of the pre-move click.
function applySkillEffectsList(id,ctx){
 const list=effectSourceDef(id)?.effects||[];
 const ordered=[...list].sort((a,b)=>(a.kind==='move'?0:1)-(b.kind==='move'?0:1));
 let used=false;
 for(const comp of ordered){
  if(applyEffectComponent(id,comp,ctx))used=true;
  if(comp.kind==='move'){ctx.x=game.player.x;ctx.y=game.player.y}
 }
 return used
}

// ---- Action-point turn system ------------------------------------------------
// Always on in multiplayer; opt-in per dungeon in single player (world param
// apMode). A turn is a pool of points: attack/skill 10, move 5. The turn only
// passes via the PASAR TURNO button; enemies get their own pool (20 + AGI).
const AP_COSTS={move:5,attack:10,skill:10};
// Flat PA bonus on top of an enemy's normal agility-based pool: megaboss
// and boss get a fixed edge over regular enemies, and elites get half that,
// so tougher fights consistently get more actions per turn instead of just
// more raw stats.
function enemyBonusAp(e){return e.megaboss?15:e.boss?10:e.elite?5:0}
// Per-skill AP variance on top of the flat 10 baseline: quick utility/mobility
// costs a bit less, wide-hitting or execute/ultimate payoffs cost a bit more.
// Keyed by classEffect so it covers both the 12 shared class-skill tags and
// the newer per-class signature effects without needing a field on every one
// of the ~240 skill entries; anything not listed (the original generic-item
// skills, the Botín pool) stays at the AP_COSTS.skill baseline.
const AP_COST_BY_EFFECT={
 dash:8,utility:8,shield:9,heal:9,buff:9,
 debuff:10,ranged:10,
 aoe:12,multihit:12,execute:12,
 ultimate:14,massive:14,
 stun:11,silence:11,doomMark:11,swapConfuse:11,
 dot:11,drain:11,holyLeech:11,echoDot:11,hookBleed:11,
 bountyRoot:11,rootBleed:11,comboMark:11,lineShot:11,
 stormTotem:12,trap:12,shadowStrike:11
};
function skillApCost(id){const d=skillDefs[id];return d?.apCost??AP_COST_BY_EFFECT[d?.classEffect]??AP_COSTS.skill}
function apModeOn(){return !!(game&&(game.multiplayer||worldParams().apMode||game.player?.combatMode==='ap'))}
function playerMaxAP(){const st=game.player.derived?.finalStats||game.player.stats||{};const base=30+Math.ceil((st.agility||0)/2);return Math.max(1,Math.round(base*activeBuffMultFactor('ap')+activeBuffFlatBonus('ap')))}
// Also refills every companion's own PA pool and immediately resumes any
// pending permanent-pet order (companionResolveOrder) with that fresh PA -
// this runs at the very start of the new round, before the player takes any
// action in it, so a chase that couldn't finish last turn continues on its
// own right away instead of waiting for the round to end again.
function startPlayerAP(){
 if(game?.player)game.player.ap=playerMaxAP();
 for(const c of game?.companions||[]){
  if(c.hp<=0)continue;
  c.ap=companionMaxAp();
  if(c.permanent&&c.effectType&&c.orderTarget)companionResolveOrder(c);
 }
}
function apCan(kind,cost=AP_COSTS[kind]){
 if(!apModeOn())return true;
 if(game.player.ap==null)startPlayerAP();
 if(game.player.ap>=cost)return true;
 log(`Sin puntos de acción para ${kind==='move'?'moverte':'esa acción'} (${game.player.ap} PA). Pasa turno.`,'sys');
 return false;
}
// Replaces the old per-action playerFinished(): spends points and keeps the turn.
function actionDone(kind,cost=AP_COSTS[kind]){
 if(!apModeOn())return playerFinished();
 if(game.player.ap==null)startPlayerAP();
 game.player.ap=Math.max(0,game.player.ap-cost);
 busy=false;updateUI();requestAnimationFrame(animate);
 // not enough AP left for even a move (5) - force the turn to end instead of
 // leaving the player stuck staring at a "PASAR TURNO" button they still
 // have to click themselves
 if(game.player.ap<5){log('Sin puntos de acción suficientes: turno pasado automáticamente.','sys');playerFinished()}
}
function playerFinished(){
 if(document.getElementById('statPointModal')?.classList.contains('open')||document.getElementById('skillChoiceModal')?.classList.contains('open')){game.pendingPlayerFinished=true;busy=false;updateUI();draw();return}
 if(game.multiplayer){
  if(!game.myTurn){busy=true;return}
  playerFinishedMultiplayer();return;
 }
 busy=true;persistTurnState();game.turn++;tickFloorObjective();classSkillConsistencyGuard();tickBuffs();tickPlayerHots();tickPlayerRegen();tickHolyShield();tickPlayerInvisibility();tickEnemyStatuses();tickSkillObjects();companionTurn();for(const id in game.player.cooldowns)if(game.player.cooldowns[id]>0)game.player.cooldowns[id]--;tickEquipmentCooldowns();if(game.player.shield>0)game.player.shield--;
 updateUI();requestAnimationFrame(animate);
 setTimeout(()=>{enemyTurn(()=>{startPlayerAP();busy=false;updateUI();draw()})},500);
}
async function playerFinishedMultiplayer(){
 busy=true;
 if(game.over)return; // death flow persists its own state
 for(const id in game.player.cooldowns)if(game.player.cooldowns[id]>0)game.player.cooldowns[id]--;
 tickEquipmentCooldowns();
 if(game.player.shield>0)game.player.shield--;
 updateUI();requestAnimationFrame(animate);
 const order=(game.turnOrder&&game.turnOrder.length)?game.turnOrder:[game.pjId];
 const myIndex=order.findIndex(id=>String(id)===String(game.pjId));
 const isLast=myIndex===-1||myIndex===order.length-1;
 if(isLast){
  // last player in the order resolves the enemy phase, then hands the turn back to player 1
  mpSetMyTurn(false,'enemies');
  game.mpCapture=true;
  game.mpEnemyPhase=true;
  setTimeout(async()=>{
   try{
    if(!game.over){
     sendMpAction('enemy_phase_start',{});
     classSkillConsistencyGuard();tickBuffs();tickPlayerHots();tickPlayerRegen();tickHolyShield();tickPlayerInvisibility();tickEnemyStatuses();tickSkillObjects();companionTurn();
     const t0=MP_DEBUG_LATENCY?performance.now():0;
     // enemyTurn() itself now paces each action with a real delay (PA mode,
     // always on in multiplayer) - each sendMpAction call it makes goes out
     // as it happens, so enemies act consecutively for every client instead
     // of a synchronous burst followed by a separate fake local replay.
     await new Promise(resolve=>enemyTurn(resolve));
     if(MP_DEBUG_LATENCY)mpDebugEvent('enemy_phase_duration',{ms:performance.now()-t0,enemyCount:(game.enemies||[]).length});
     sendMpAction('enemy_phase_end',{});
    }
    game.mpCapture=false;
    game.turn=(game.turn||0)+1;
    tickFloorObjective();
    await mpAdvanceTurn(0);
   }finally{game.mpEnemyPhase=false}
   draw();
   if(!game.over)mpSetMyTurn(String((game.turnOrder||[])[game.activePlayerIndex||0])===String(game.pjId));
  },60);
 }else{
  mpSetMyTurn(false);
  await mpAdvanceTurn(myIndex+1);
  draw();
 }
}

// Single exit point for "my turn is over". Live mode publishes the transition
// over the channel (instant, no DB) and only checkpoints the DB every
// MP_CHECKPOINT_EVERY rounds or on events that must survive a reload. Without
// realtime it degrades to the previous behaviour: one DB write per turn.
async function mpAdvanceTurn(nextIdx){
 if(!game?.multiplayer)return;
 const live=mpLive();
 if(live){
  game.activePlayerIndex=nextIdx;
  mpPublishTurn(nextIdx);
  game.mpPendingEvents=[];
  game.mpDirty=true;
  const roundsDone=game.turn||0;
  const roundClosed=nextIdx===0; // I just resolved the enemy phase
  const mustCheckpoint=game.floor!==game.mpCheckpointFloor||(roundClosed&&roundsDone-(game.mpCheckpointTurn||0)>=MP_CHECKPOINT_EVERY);
  if(mustCheckpoint)await mpCheckpoint({advance:false});
  }else{
  await mpPersistTurnState({advance:true,includeOtherPlayers:true});
 }
}

// DB checkpoint: persists the authoritative state so a reload/reconnect can
// resume. Carries the live `seq` so peers and checkpoints stay comparable.
async function mpCheckpoint(opts={}){
 if(!game?.multiplayer||!game.dungeonStatusId)return;
 game.mpCheckpointTurn=game.turn||0;
 game.mpCheckpointFloor=game.floor;
 game.mpDirty=false;
 await mpPersistTurnState({advance:false,includeOtherPlayers:true,checkpoint:true,...opts});
}

function permanentDeath(){
 const p=game.player;game.over=true;
 if(game.testingMode){
  storyTitle.textContent='PRUEBA TERMINADA';
  storyBody.innerHTML=`<div class="narrative gameOverBox"><p class="gameOverName"><b>${p.name||'El personaje de prueba'} ha caído.</b></p><div class="gameOverStats"><div><span class="small">Nivel de prueba</span><b>${p.level}</b></div><div><span class="small">Piso</span><b>${game.floor}</b></div></div><p class="small">Modo testing: no se ha guardado nada en la base de datos.</p><div class="startActions"><button id="testingBackAfterDeath">Volver al modo testing</button></div></div>`;
  storyOverlay.classList.remove('hidden');
  setTimeout(()=>document.getElementById('testingBackAfterDeath')?.addEventListener('click',()=>{storyOverlay.classList.add('hidden');goToMainMenu()}),0);
  return;
 }
 finalizeCharacterDeath();try{localStorage.clear()}catch(e){}storyTitle.textContent='GAME OVER';storyBody.innerHTML=`<div class="narrative gameOverBox"><p class="gameOverName"><b>${p.name||'Tu personaje'} ha muerto.</b></p><div class="gameOverStats"><div><span class="small">Nivel de héroe</span><b>${p.level}</b></div><div><span class="small">Nivel de mazmorra</span><b>${game.floor}</b></div></div><p class="small">Muerte permanente: la partida se ha eliminado y no puede continuar.</p><div class="startActions"><button id="restartAfterDeath">Crear nuevo personaje</button></div></div>`;storyOverlay.classList.remove('hidden');setTimeout(()=>document.getElementById('restartAfterDeath')?.addEventListener('click',()=>location.reload()),0)
}
// onDone is called once every enemy has finished acting. In AP mode (always
// on in multiplayer, optional in single player) each individual action is
// paced with a real setTimeout gap instead of resolving the whole phase in
// one synchronous burst, so enemies visibly act one after another - single
// player sees it live, and multiplayer's actual sendMpAction calls go out
// spaced the same way, instead of all at once with a separate fake replay
// tacked on afterward.
// Enemies far enough from the player to be practically irrelevant this turn
// are "dormant": enemyTurn() skips them outright instead of running their AI
// (target pick, distance/status checks, possible move) every single turn -
// on a floor with a lot of enemies (a horda archetype especially) that
// per-turn cost was the actual slowdown, not just wasted work, since almost
// none of it could ever change anything for an enemy this far away anyway.
// Single player only: multiplayer keeps one shared/authoritative enemy
// snapshot for the whole party, so culling by distance to just this client's
// character would leave enemies near a teammate frozen for everyone.
const DORMANT_ENEMY_RANGE=10;
function isEnemyDormant(e){return !game.multiplayer&&gridDistance(e,game.player)>DORMANT_ENEMY_RANGE}
// Enemy normal-attack damage: mirrors the player's attack() - roll the
// equipped weapon's dice, add a live stat modifier off the enemy's own
// stats (enemyStatModifier), plus the flat residual equipEnemy baked in so
// the average hit stays at the same level/tier/rarity-tuned value as
// before, just with real per-turn variance instead of a frozen number.
function enemyNormalAttackDamage(e){
 const w=e.weapon;
 if(!w)return Math.max(1,Math.round(e.atk||e.damage||4));
 const roll=rollDice(w.dice||'1d4').total,statMod=enemyStatModifier(e);
 return Math.max(1,Math.round(roll+statMod+(w.atkResidual||0)));
}
function enemyTurn(onDone){if(game.over){onDone?.();return}if(isPlayerInvisible()){log('La invisibilidad evita la respuesta enemiga.','good');onDone?.();return}if(game.player.shadowVeil){game.player.shadowVeil=0;log('El velo de sombras evita la respuesta enemiga.','good');onDone?.();return}
 if(game.multiplayer)mpEnsureEnemyIds(); // per-action pings below need e.eid to already exist
 const visible=game.enemies.filter(e=>game.seen[e.y][e.x]);if(visible.filter(e=>Math.abs(e.x-game.player.x)<=1&&Math.abs(e.y-game.player.y)<=1).length>=3)unlock('crowd','Reunión multitudinaria','Ten 3 enemigos adyacentes.');
 // One decision per call; returns the AP cost (0 = nothing left to do this turn).
 const enemySingleAction=e=>{
  if(game.over)return 0;
  if(!game.seen[e.y][e.x])return 0;
  if(enemyHasStatus(e,'freeze')||enemyHasStatus(e,'stun')||enemyHasStatus(e,'root')&&gridDistance(e,game.player)>1)return 0;
  // A companion is only ever a valid target if its own "objeto de ataques"
  // toggle allows it (targetable!==false) and it wasn't summoned this same
  // turn (spawnTurn grace - see summonCompanion) - otherwise a pet could get
  // picked off the instant it appears, before it's had a turn of its own.
  // Permanent pets (c.permanent && c.effectType) are excluded outright: they
  // only follow now and are invulnerable, so enemies never consider them.
  const targetableCompanions=(game.companions||[]).filter(c=>c.hp>0&&c.targetable!==false&&game.turn-(c.spawnTurn??0)>1&&!(c.permanent&&c.effectType));
  const possibleTargets=[game.player,...targetableCompanions,...(game.otherPlayers||[]).filter(pl=>pl.hp>0)];
  let chosen=possibleTargets.sort((a,b)=>(Math.abs(e.x-a.x)+Math.abs(e.y-a.y))-(Math.abs(e.x-b.x)+Math.abs(e.y-b.y)))[0];
  // Chebyshev (max-axis) distance, not Manhattan: a diagonal neighbor is
  // exactly as adjacent as an orthogonal one, matching gridDistance() and
  // every other range/adjacency check in the game, so enemies can attack
  // (and be attacked at) diagonally instead of only up/down/left/right.
  const dist=gridDistance(e,chosen);
  const chosenRef=game.multiplayer?mpEntityRef(chosen):null;
  if(enemyUseSkill(e,dist,chosen))return AP_COSTS.skill;
  const w=e.weapon,wRanged=w&&w.kind!=='melee'&&(w.rangeMax||1)>1;
  // shoot/cast with the equipped ranged weapon
  if(wRanged&&dist>1&&dist<=w.rangeMax&&hasLineOfSight(e,chosen)&&Math.random()<.85){
   const dmg=enemyNormalAttackDamage(e);
   if(game.multiplayer&&chosenRef)sendMpAction('enemy_attack',{enemyId:e.eid,targetType:chosenRef.type,targetId:chosenRef.id,visualAmount:chosen===game.player?dmg:Math.round(dmg*.9),result:w.kind==='magic'?'spell':'ranged'});
   rangedTracer(e.x,e.y,chosen.x,chosen.y,w.kind==='magic'?'#be82ff':'#ffd27a');
   floating(w.kind==='magic'?'✦':'➶',e.x,e.y,w.kind==='magic'?'#be82ff':'#ffd27a');
   if(chosen===game.player)damagePlayer(dmg,w.kind==='magic'?'wisdom':'agility',`${e.name} dispara su ${w.name}`);
   else{const d2=Math.max(1,Math.round(dmg*.9));chosen.hp-=d2;floating(`-${d2}`,chosen.x,chosen.y,'#ff8888');log(`${e.name} dispara a ${chosen.name} con su ${w.name}.`,'combat')}
   return AP_COSTS.attack;
  }
  // ranged classes try to back away from melee contact
  if(wRanged&&dist===1&&Math.random()<.5){
   const dirs=[[1,0],[-1,0],[0,1],[0,-1]].sort(()=>Math.random()-.5);
   let stepped=false;
   for(const[mx,my]of dirs){const nx=e.x+mx,ny=e.y+my;if(gridDistance({x:nx,y:ny},chosen)>1&&!blocked(nx,ny)&&!isSafeCell(nx,ny)&&!game.enemies.some(o=>o!==e&&o.x===nx&&o.y===ny)&&!(game.player.x===nx&&game.player.y===ny)){const from={x:e.x,y:e.y};e.x=nx;e.y=ny;if(game.multiplayer)sendMpAction('enemy_move',{entityType:'enemy',entityId:e.eid,from,to:{x:nx,y:ny}});stepped=true;break}}
   if(stepped)return AP_COSTS.move;
  }
  if(dist===1&&chosen!==game.player){
   const dmg=enemyNormalAttackDamage(e);
   if(game.multiplayer&&chosenRef)sendMpAction('enemy_attack',{enemyId:e.eid,targetType:chosenRef.type,targetId:chosenRef.id,visualAmount:dmg});
   chosen.hp-=dmg;floating(`-${dmg}`,chosen.x,chosen.y,'#ff8888');log(`${e.name} golpea a ${chosen.name} por ${dmg}.`,'combat');return AP_COSTS.attack
  }
  if(dist===1){if(e.type==='orcoKamikaze'){if(game.multiplayer&&chosenRef)sendMpAction('enemy_attack',{enemyId:e.eid,targetType:chosenRef.type,targetId:chosenRef.id,visualAmount:e.atk+5,result:'explode'});floating('¡BOOM!',e.x,e.y,'#ff8b4f');damagePlayer(e.atk+5,'vitality',`${e.name} explota`);e.hp=0;kill(e);return AP_COSTS.attack}const dmg=Math.max(1,enemyNormalAttackDamage(e)-(game.player.debuff||0)-(e.weakened||0));if(game.multiplayer&&chosenRef)sendMpAction('enemy_attack',{enemyId:e.eid,targetType:chosenRef.type,targetId:chosenRef.id,visualAmount:dmg});damagePlayer(dmg,/wolf|hound|goblin|vamp/i.test(e.type)?'agility':'vitality',`${e.name} ataca`);if(e.type==='vampiro')healEntity(e,3,e.x,e.y);return AP_COSTS.attack}
  if(!w&&chosen===game.player&&['chamanGoblin','liche','licheEnloquecido','archiliche'].includes(e.type)&&dist<=5&&hasLineOfSight(e,game.player)&&Math.random()<.45){if(game.multiplayer)sendMpAction('enemy_spell',{enemyId:e.eid,origin:{x:e.x,y:e.y},target:{x:game.player.x,y:game.player.y},targetType:'player',targetId:String(game.pjId),visualAmount:e.atk,icon:'✦'});damagePlayer(e.atk,/liche|chaman|mage|priest/i.test(e.type)?'wisdom':'intelligence',`${e.name} lanza un ataque mágico`);floating('✦',e.x,e.y,'#be82ff');return AP_COSTS.attack}
  // shooters hold position while target is in range and sight
  if(wRanged&&dist<=w.rangeMax&&hasLineOfSight(e,chosen))return 0;
  if(dist<8){const opts=Math.random()<.5?[[Math.sign(chosen.x-e.x),0],[0,Math.sign(chosen.y-e.y)]]:[[0,Math.sign(chosen.y-e.y)],[Math.sign(chosen.x-e.x),0]];for(const[mx,my]of opts){const nx=e.x+mx,ny=e.y+my;if(!blocked(nx,ny)&&!isSafeCell(nx,ny)&&!game.enemies.some(o=>o!==e&&o.x===nx&&o.y===ny)&&!(game.player.x===nx&&game.player.y===ny)){const from={x:e.x,y:e.y};e.x=nx;e.y=ny;if(game.multiplayer)sendMpAction('enemy_move',{entityType:'enemy',entityId:e.eid,from,to:{x:nx,y:ny}});return AP_COSTS.move}}}
 
  return 0;
 };
 const finishEnemyTurn=()=>{
  if(game.player.hp<=0&&!game.over){game.player.hp=0;game.over=true;updateUI();draw();permanentDeath();onDone?.();return}
  onDone?.();
 };
 if(!apModeOn()){
  // classic mode: exactly one action per enemy, resolved synchronously
  // (unchanged from before - no pacing requested for this mode). Bosses/
  // megabosses/elites don't have a real AP pool to spend here, so their flat
  // PA bonus (enemyBonusAp) is translated into extra guaranteed/likely
  // actions instead: every full 10 bonus AP (one attack's worth) is a
  // guaranteed extra action, and a remaining 5 is a 50% chance at one more
  // (megaboss +15 => 1 guaranteed + 50% chance of a 2nd; boss +10 => 1
  // guaranteed; elite +5 => 50% chance of one).
  for(const e of [...game.enemies]){
   if(game.over)break;
   if(e.hp<=0)continue;
   if(isEnemyDormant(e))continue;
   enemySingleAction(e);
   const bonusAp=enemyBonusAp(e),guaranteed=Math.floor(bonusAp/10),chance=(bonusAp%10)/10;
   for(let i=0;i<guaranteed&&e.hp>0&&!game.over;i++)enemySingleAction(e);
   if(chance>0&&e.hp>0&&!game.over&&Math.random()<chance)enemySingleAction(e);
  }
  finishEnemyTurn();
  return;
 }
 // AP mode: each enemy keeps acting (in order) until its pool runs out, one
 // action at a time, with a real delay between actions so the whole phase
 // doesn't resolve in a single synchronous burst. Bosses/megabosses/elites
 // get a flat PA bonus on top of the normal agility-based pool (enemyBonusAp).
 const queue=[...game.enemies];
 const stepEnemy=(idx)=>{
  if(game.over){finishEnemyTurn();return}
  if(idx>=queue.length){finishEnemyTurn();return}
  const e=queue[idx];
  if(e.hp<=0||isEnemyDormant(e)){stepEnemy(idx+1);return}
  let ap=Math.round((20+Math.ceil(e.stats?.agility||0)+enemyBonusAp(e))*(e.apDebuffMult??1));
  const stepAction=()=>{
   if(game.over){finishEnemyTurn();return}
   if(ap<=0||e.hp<=0||!game.enemies.includes(e)){stepEnemy(idx+1);return}
   const cost=enemySingleAction(e);
   draw();updateUI();
   if(!cost){stepEnemy(idx+1);return}
   ap-=cost;
   setTimeout(stepAction,160);
  };
  stepAction();
 };
 stepEnemy(0);
}

let pendingTargetAction=null;
// Area-target skills go through an extra pick-then-confirm step: a first
// click on a valid cell just locks in pendingAreaCandidate (shows the AoE
// radius shaded there); a second click on that same cell, or the CONFIRMAR
// button, actually casts. pendingAreaHover (mousemove-driven) previews the
// radius before anything is locked in.
let pendingAreaCandidate=null,pendingAreaHover=null;
const AREA_SKILLS=new Set(['smash','quake','ironRain','scrapGrenade','chainSpark','gravityWell','holyCircuit','entropyWave','stormTotem','alchemicalNova','blackSun','worldBreaker','adminOverride','lootSingularity']);
const ENEMY_TARGET_SKILLS=new Set(['arcSlash','ironHook','manaBolt','shockTrap','toxicEdge','spiritWolf','quantumThief','charge','execute']);
function equippedWeapon(){return game?.player?.equipment?.weapon||null}
function weaponRangePresetForItem(item=equippedWeapon()){
 if(!item)return null;
 const declared=item.weaponType&&weaponTypeRanges[item.weaponType]?item.weaponType:null;
 if(declared)return weaponTypeRanges[declared];
 const text=`${item.weaponType||''} ${item.weaponCategory||''} ${item.name||''} ${item.iconShape||''}`.toLowerCase();
 if(/varita/.test(text))return weaponTypeRanges.Varitas;
 if(/arco/.test(text))return weaponTypeRanges.Arcos;
 if(/ballesta/.test(text))return weaponTypeRanges.Ballestas;
 if(/pistola|revólver|revolver/.test(text))return weaponTypeRanges.Pistolas;
 if(/rifle|fusil|carabina/.test(text))return weaponTypeRanges.Rifles;
 if(/escopeta/.test(text))return weaponTypeRanges.Escopetas;
 return null
}
function normalizeWeaponRangeValue(value,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(1,Math.round(n)):fallback}
function weaponIsRanged(item=equippedWeapon()){return !!weaponRangePresetForItem(item)}
function weaponRangeBounds(item=equippedWeapon()){
 const preset=weaponRangePresetForItem(item);
 const min=normalizeWeaponRangeValue(item?.rangeMin??item?.minRange??item?.alcanceMinimo,preset?.min||1);
 const max=normalizeWeaponRangeValue(item?.rangeMax??item?.maxRange??item?.alcanceMaximo,preset?.max||1);
 return {min:Math.min(min,max),max:Math.max(min,max)}
}
function weaponRange(item=equippedWeapon()){return weaponRangeBounds(item).max}

function rangeDamageMultiplier(range,area=false){
 range=Math.max(1,Number(range)||1);
 // Cada casilla adicional sacrifica una pequeña parte del daño. Las áreas pagan además por cobertura.
 const distancePenalty=Math.min(.32,(range-1)*.035);
 const areaPenalty=area?.10:0;
 return Math.max(.58,1-distancePenalty-areaPenalty)
}
function attackRangeLabel(){
 const weapon=equippedWeapon(),bounds=weaponRangeBounds(weapon),def=inferWeaponDefenseStat(weapon);
 const rangeText=bounds.min===bounds.max?`Alcance ${bounds.max} casilla${bounds.max===1?'':'s'}`:`Alcance ${bounds.min}-${bounds.max}`;
 return `${rangeText} · defensa: ${attackDefenseLabel(def)} · ${bounds.max>1?Math.round(rangeDamageMultiplier(bounds.max)*100)+'% daño':'daño completo'}`
}
function skillRangeLabel(id){
 const r=skillRange(id),area=skillTargetMode(id)==='area',pct=Math.round(rangeDamageMultiplier(r,area)*100);
 return `Alcance ${r} · ${area?'Área · ':''}defensa: ${attackDefenseLabel(inferSkillDefenseStat(id))} · ${pct}% daño base`
}

// Heal-flavored class skills self-target by default (unchanged for single
// player); in multiplayer, with a living ally around, they open ally-or-self
// targeting instead, since there was previously no way to ever heal a party
// member. Scoped to the classEffect:'heal' skills specifically (not the
// handful of bespoke self-only utility skills like campfire/cleanse, which
// keep their own distinct behavior untouched).
function isSelfHealSkill(id){return skillDefs[id]?.classEffect==='heal'}
function skillTargetMode(id){
 const d=skillDefs[id];if(!d)return null;
 if(hasEffectsList(id))return effectsListTargetMode(id);
 if(d.targetMode==='self')return null;
 if(d.targetMode==='area')return 'area';
 if(d.targetMode==='enemy')return 'enemy';
 if(isSelfHealSkill(id)&&game?.multiplayer&&(game.otherPlayers||[]).some(p=>p.hp>0))return 'ally';
 if(d.type==='utility')return null;
 if(d.classEffect==='multihit')return'enemy';
 if(AREA_SKILLS.has(id)||['aoe','ultimate','massive'].includes(d.classEffect))return 'area';
 if(ENEMY_TARGET_SKILLS.has(id)||d.classEffect==='ranged'||d.classEffect==='debuff'||d.classEffect==='execute'||isRangedSkill(id))return 'enemy';
 return null
}
function beginTargeting(action){
 pendingTargetAction=action;pendingAreaCandidate=null;pendingAreaHover=null;updateUI();document.getElementById('waitBtn')?.classList.add('hidden');document.getElementById('cancelTargetBtn')?.classList.remove('hidden');document.getElementById('confirmTargetBtn')?.classList.add('hidden');
 document.getElementById('gameStage')?.classList.add('targeting');
 const hint=document.getElementById('targetHint');
 if(hint){const rangeText=action.minRange&&action.minRange!==action.range?`${action.minRange}-${action.range}`:action.range;hint.textContent=action.kind==='companionCommand'?'Selecciona el enemigo para tu compañero · ESC para cancelar':action.mode==='area'?`Selecciona el centro del área · alcance ${rangeText} · ESC para cancelar`:action.mode==='ally'?`Selecciona un aliado o a ti mismo · alcance ${rangeText} · ESC para cancelar`:`Selecciona un enemigo · alcance ${rangeText} · ESC para cancelar`;hint.classList.remove('hidden')}
 closeInspect()
}
function cancelTargeting(message='Apuntado cancelado.'){
 pendingTargetAction=null;pendingAreaCandidate=null;pendingAreaHover=null;document.getElementById('waitBtn')?.classList.remove('hidden');document.getElementById('cancelTargetBtn')?.classList.add('hidden');document.getElementById('confirmTargetBtn')?.classList.add('hidden');document.getElementById('gameStage')?.classList.remove('targeting');document.getElementById('targetHint')?.classList.add('hidden');if(message)log(message,'sys')
}
// Radius (in tiles) of the pending area skill's AoE, for the candidate/hover
// shading preview - mirrors the same radius resolveTargetedSkill() will
// actually use once confirmed (effects-list "area" component's range, or the
// legacy classEffect area formula).
function pendingAreaRadius(){
 if(!pendingTargetAction)return 2;
 if(pendingTargetAction.kind==='potion'){
  const item=game.inventory.find(i=>i.id===pendingTargetAction.potionId);
  const areaComp=(item?.effects||[]).find(c=>c.target==='area');
  return areaComp?(areaComp.range||2):2;
 }
 if(pendingTargetAction.kind==='equipment'){
  const item=game.player.equipment?.[pendingTargetAction.equipSlot];
  const areaComp=(item?.effects||[]).find(c=>c.target==='area');
  return areaComp?(areaComp.range||2):2;
 }
 if(pendingTargetAction.kind!=='skill')return 2;
 const id=game.player.equippedSkills[pendingTargetAction.slot],d=skillDefs[id];if(!d)return 2;
 if(hasEffectsList(id)){const areaComp=(d.effects||[]).find(c=>c.target==='area');return areaComp?(areaComp.range||2):2}
 return Math.min(4,1+Math.floor(skillLevel(id)/4)+(d.tier===3?1:0));
}
// Second click on the same locked-in cell (or the CONFIRMAR button) actually
// casts the area skill/potion; a failed cast (e.g. no enemies in range)
// re-prompts instead of dropping targeting entirely.
function confirmAreaTarget(){
 if(!pendingTargetAction||!pendingAreaCandidate)return;
 const {x,y}=pendingAreaCandidate;
 const ok=pendingTargetAction.kind==='potion'?resolveTargetedPotion(pendingTargetAction.potionId,x,y):pendingTargetAction.kind==='equipment'?resolveTargetedEquipmentActive(pendingTargetAction.equipSlot,x,y):resolveTargetedSkill(pendingTargetAction.slot,x,y);
 pendingAreaCandidate=null;pendingAreaHover=null;
 document.getElementById('confirmTargetBtn')?.classList.add('hidden');
 if(!ok&&pendingTargetAction){
  const hint=document.getElementById('targetHint'),action=pendingTargetAction;
  if(hint){const rangeText=action.minRange&&action.minRange!==action.range?`${action.minRange}-${action.range}`:action.range;hint.textContent=`Selecciona el centro del área · alcance ${rangeText} · ESC para cancelar`}
 }
 draw();
}
function gridDistance(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))}
function validateTargetCell(x,y,range,minRange=1){const dist=gridDistance(game.player,{x,y});return game.seen?.[y]?.[x]&&dist>=minRange&&dist<=range&&hasLineOfSight(game.player,{x,y})}
function targetedSkillDamage(id){const d=skillDefs[id],lvl=skillLevel(id),stat=d.resource==='mana'?game.player.stats.intelligence+game.player.stats.wisdom/2:game.player.stats.strength+game.player.stats.agility/3;return Math.round((5+lvl*2+stat)*skillPowerMultiplier(id))}
function resolveTargetedSkill(slot,x,y){
 const id=game.player.equippedSkills[slot],d=skillDefs[id];if(!id||!d)return false;
 const range=effectiveSkillRange(id)||1,mode0=skillTargetMode(id);
 if(!validateTargetCell(x,y,range,mode0==='ally'?0:1)){log(`Objetivo fuera de alcance o sin línea de visión (${range}).`,'sys');return false}
 const cd=game.player.cooldowns[id]||0;
 if(cd>0){log('La habilidad está en enfriamiento.','sys');return false}
 if(skillsBlockedByTransform()){log('Tu transformación no permite lanzar otras habilidades.','sys');cancelTargeting('');return false}
 const targetedCost=effectiveSkillCost(d);
 if(game.player[d.resource]<targetedCost){log(`Necesitas ${targetedCost} ${d.resource==='mana'?'de maná':'de stamina'}; tienes ${game.player[d.resource]}.`,'sys');cancelTargeting('');return false}
 const mode=mode0,rangeMult=rangeDamageMultiplier(range,mode==='area'),base=Math.max(1,Math.round(targetedSkillDamage(id)*rangeMult));let used=false;
 if(game.multiplayer)sendMpAction('spell',{casterId:game.pjId,origin:{x:game.player.x,y:game.player.y},target:{x,y},spellId:id,icon:d.icon});
 if(hasEffectsList(id)){
  const clickedEnemy=enemyAtCell(x,y);
  const clickedAlly=!clickedEnemy&&game.multiplayer?(game.otherPlayers||[]).find(p=>p.hp>0&&p.x===x&&p.y===y):null;
  if(mode==='enemy'&&!clickedEnemy){log('Debes seleccionar un enemigo.','sys');return false}
  used=applySkillEffectsList(id,{x,y,clickedEnemy,nearest:clickedEnemy,clickedAlly});
  if(!used&&mode==='area')log('No hay enemigos dentro del área seleccionada.','sys');
 }else if(mode==='enemy'){
  const enemy=enemyAtCell(x,y);if(!enemy){log('Debes seleccionar un enemigo.','sys');return false}
  if(d.classId&&!GENERIC_CLASS_EFFECTS.has(d.classEffect)&&applyCreativeClassEffect(id,enemy,x,y)){used=true}
  if(used){}else{
  let mult=d.rarity==='legendary'?2.2:d.rarity==='epic'?1.75:d.rarity==='rare'?1.4:1.1;
  if(d.classEffect==='execute'||id==='execute')mult*=enemy.hp/enemy.maxHp<.4?2.35:1;
  if(d.classEffect==='multihit'){
   const hits=Math.max(2,Number(d.hits)||3);for(let i=0;i<hits;i++)setTimeout(()=>{if(enemy.hp>0){attack(enemy,0,{skillId:id,multiplier:mult*rangeMult*.6});draw();updateUI()}},i*500)
  }else attack(enemy,0,{skillId:id,multiplier:mult*rangeMult});
  if(d.classEffect==='debuff'||['shockTrap','ironHook'].includes(id)){const turns=d.debuffTurns??(2+Math.floor(skillLevel(id)/3));if(d.classEffect==='debuff'&&d.debuffStat){const mode=d.debuffStatMode||'add';applyEnemyStatDebuff(enemy,d.debuffStat,mode,d.debuffStatCoef??(mode==='mult'?.8:2),turns,d.name)}else enemy.weakened=turns;enemy.stunned=1}
  if(id==='quantumThief'){healEntity(game.player,6+skillLevel(id));game.player.mana=Math.min(game.player.maxMana,game.player.mana+5+skillLevel(id));game.player.gold+=3+skillLevel(id)}
  used=true}
 }else if(mode==='area'){
  const radius=Math.min(4,1+Math.floor(skillLevel(id)/4)+(d.tier===3?1:0));
  const targets=game.enemies.filter(e=>e.hp>0&&Math.max(Math.abs(e.x-x),Math.abs(e.y-y))<=radius&&game.seen?.[e.y]?.[e.x]&&hasLineOfSight(game.player,e));
  if(d.classId&&!GENERIC_CLASS_EFFECTS.has(d.classEffect)&&applyCreativeClassEffect(id,targets[0]||null,x,y)){used=true}
  if(!used&&!targets.length){log('No hay enemigos dentro del área seleccionada.','sys');return false}
  const mult=['blackSun','worldBreaker'].includes(id)||d.classEffect==='massive'?1.65:d.classEffect==='ultimate'?1.35:1;
  if(!used){targets.forEach(e=>attack(e,0,{skillId:id,multiplier:mult*rangeMult*.85}));floating('ÁREA',x,y,'#d989ff');used=true}
 }else if(mode==='ally'){
  const isSelf=x===game.player.x&&y===game.player.y;
  const ally=!isSelf?(game.otherPlayers||[]).find(p=>p.hp>0&&p.x===x&&p.y===y):null;
  if(!isSelf&&!ally){log('Selecciona un aliado o a ti mismo.','sys');return false}
  const hpAmount=base*2,resAmount=base;
  if(isSelf){
   healEntity(game.player,hpAmount);
   game.player[d.resource]=Math.min(game.player[d.resource==='mana'?'maxMana':'maxStamina'],game.player[d.resource]+resAmount);
  }else{
   healEntity(ally,hpAmount,ally.x,ally.y); // visual only here - the real hp change happens on the ally's own client
   sendMpAction('ally_heal',{targetId:ally.pjId,hpAmount,resAmount,resType:d.resource,id:crypto.randomUUID()});
   log('Curas a tu aliado.','good');
  }
  used=true;
 }
 if(!used)return false;
 if(!apCan('skill',skillApCost(id)))return false;
 game.player[d.resource]-=targetedCost;game.player.cooldowns[id]=Math.max(1,d.cd-Math.floor((skillLevel(id)-1)/4));gainSkillUse(id);effect('shake');cancelTargeting('');actionDone('skill',skillApCost(id));return true
}
function beginBasicAttack(){
 if(!game||busy||game.over)return;
 const weapon=equippedWeapon();
 if(weaponIsRanged(weapon)){const bounds=weaponRangeBounds(weapon);beginTargeting({kind:'attack',mode:'enemy',range:bounds.max,minRange:bounds.min});return}
 const adjacent=game.enemies.filter(e=>gridDistance(game.player,e)<=1);
 if(adjacent.length===1){if(!apCan('attack'))return;attack(adjacent[0]);actionDone('attack')}else if(adjacent.length>1){beginTargeting({kind:'attack',mode:'enemy',range:1})}else log('No hay ningún enemigo al alcance del arma.','sys')
}
function resolveBasicAttack(x,y){
 const bounds=weaponRangeBounds(),range=pendingTargetAction?.range||bounds.max,minRange=pendingTargetAction?.minRange||bounds.min,enemy=enemyAtCell(x,y);
 if(!enemy){log('Selecciona un enemigo.','sys');return false}
 if(!validateTargetCell(x,y,range,minRange)){log(`Enemigo fuera de alcance (${minRange}-${range}) o sin línea de visión.`,'sys');return false}
 if(!apCan('attack'))return false;
 attack(enemy,0,{dice:baseAttackDice(),multiplier:rangeDamageMultiplier(range,false)});cancelTargeting('');actionDone('attack');return true
}

function useSkill(slot){
 if(!game||busy||game.over)return;const id=game.player.equippedSkills[slot];if(!id)return;
 // A skill that already has a live permanent pet out is no longer "cast" at
 // all - it's that pet's command button instead (see the PERMANENT COMPANION
 // COMMANDS block above companionTurn()). No cooldown, no resource cost
 // beyond the pet's own configured commandCost, no player AP spent.
 const activeCompanion=permanentCompanionForSkill(id);
 if(activeCompanion){issueCompanionCommand(activeCompanion);return}
 const def=skillDefs[id],cd=game.player.cooldowns[id]||0;if(cd>0){log('La habilidad está en enfriamiento.','sys');return}
 if(skillsBlockedByTransform()){log('Tu transformación no permite lanzar otras habilidades.','sys');return}
 const cost=effectiveSkillCost(def);
 if(game.player[def.resource]<cost){log(`No tienes suficiente ${def.resource==='mana'?'maná':'stamina'}.`,'sys');return}
 const targetMode=skillTargetMode(id);if(targetMode){beginTargeting({kind:'skill',slot,mode:targetMode,range:effectiveSkillRange(id),minRange:targetMode==='ally'?0:1});return}
 if(game.multiplayer)sendMpAction(def.classEffect==='heal'?'heal':'spell',{casterId:game.pjId,origin:{x:game.player.x,y:game.player.y},spellId:id,icon:def.icon});
 if(hasEffectsList(id)){
  // All-self composable skill (skillTargetMode already returned null, so
  // every component targets 'self') - self-contained, returns directly
  // instead of falling into the legacy id-specific/classEffect chain below.
  const visible=visibleEnemiesInRange(def.range||8),nearest=visible.sort((a,b)=>(Math.abs(a.x-game.player.x)+Math.abs(a.y-game.player.y))-(Math.abs(b.x-game.player.x)+Math.abs(b.y-game.player.y)))[0];
  const used=applySkillEffectsList(id,{x:game.player.x,y:game.player.y,clickedEnemy:nearest,nearest});
  if(!used){log('No hay un objetivo válido.','sys');return}
  if(!apCan('skill',skillApCost(id)))return;
  game.player[def.resource]-=cost;game.player.cooldowns[id]=Math.max(1,def.cd-Math.floor((skillLevel(id)-1)/4));gainSkillUse(id);effect('shake');actionDone('skill',skillApCost(id));
  return
 }
 const near=(r)=>game.enemies.filter(e=>Math.max(Math.abs(e.x-game.player.x),Math.abs(e.y-game.player.y))<=r);
 let used=!def.classEffect&&skillDefs[id]?.unlock!=='Botín';
 const skillMult=skillPowerMultiplier(id);if(id==='smash'){const a=near(1);if(!a.length)used=false;else a.forEach(e=>attack(e,Math.round(Math.floor(total('armor')/2)*skillMult),{skillId:id}))}
 if(id==='fortify'){const turns=4+Math.floor(skillLevel(id)/2);applyBuff(id,'Fortificar',turns,{armor:.30});game.player.shield+=5+Math.floor(game.player.stats.vitality/2);used=true}
 if(id==='charge'){let target=null;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])for(let n=1;n<=3;n++){const x=game.player.x+dx*n,y=game.player.y+dy*n,e=game.enemies.find(e=>e.x===x&&e.y===y);if(e){target={e,dx,dy,n};break}if(blocked(x,y))break;if(target)break}if(!target)used=false;else{for(let n=1;n<target.n;n++){game.player.x+=target.dx;game.player.y+=target.dy}attack(target.e,Math.round((game.player.stats.strength)*skillMult),{skillId:id});reveal(game.player.x,game.player.y)}}
 if(id==='quake'){const a=near(2);if(!a.length)used=false;else a.forEach(e=>attack(e,Math.round((2+game.player.stats.intelligence+Math.floor(game.player.stats.wisdom/2))*skillMult),{skillId:id}))}
 if(id==='taunt'){const a=game.enemies.filter(e=>game.seen[e.y][e.x]);if(!a.length)used=false;else{game.player.debuff=2;a.forEach(e=>{if(Math.abs(e.x-game.player.x)>1)e.x+=Math.sign(game.player.x-e.x);if(Math.abs(e.y-game.player.y)>1)e.y+=Math.sign(game.player.y-e.y)});log('Todos te odian un poco más.','combat')}}
 if(id==='lootMagnet'){let n=0;for(const c of game.chests)if(!c.opened&&Math.abs(c.x-game.player.x)+Math.abs(c.y-game.player.y)<=3){openChest(c);n++}for(const k of [...game.keys])if(Math.abs(k.x-game.player.x)+Math.abs(k.y-game.player.y)<=3){game.keys=game.keys.filter(x=>x!==k);game.player.keys++;n++}if(!n)used=false}
 if(id==='ironRain'){const a=game.enemies.filter(e=>game.seen[e.y][e.x]);if(!a.length)used=false;else for(let i=0;i<Math.min(6,a.length+2);i++)attack(pick(a),Math.round((3+game.player.stats.intelligence+rng(6))*skillMult),{skillId:id})}
 


 if(!used&&def.classId&&def.targetMode==='self'&&!GENERIC_CLASS_EFFECTS.has(def.classEffect))used=applyCreativeClassEffect(id,null,game.player.x,game.player.y);
 if(!used&&def.classEffect){
  const lvl=skillLevel(id),visible=visibleEnemiesInRange(def.range||8),nearest=visible.sort((a,b)=>(Math.abs(a.x-game.player.x)+Math.abs(a.y-game.player.y))-(Math.abs(b.x-game.player.x)+Math.abs(b.y-game.player.y)))[0];
  const base=resolveSkillPower(id);
  if(def.classEffect==='ranged'&&nearest){attack(nearest,base,{skillId:id});used=true}
  else if(def.classEffect==='shield'){const turns=def.buffTurns??(4+Math.floor(lvl/2));applyBuff(id,def.name,turns,{armor:.22+lvl*.01});game.player.shield+=resolveSkillPower(id);used=true}
  else if(def.classEffect==='dash'&&nearest){const dx=Math.sign(nearest.x-game.player.x),dy=Math.sign(nearest.y-game.player.y);for(let i=0;i<3;i++){const nx=game.player.x+dx,ny=game.player.y+dy;if(blocked(nx,ny)||game.enemies.some(e=>e!==nearest&&e.x===nx&&e.y===ny)||nearest.x===nx&&nearest.y===ny)break;game.player.x=nx;game.player.y=ny}attack(nearest,base,{skillId:id});reveal(game.player.x,game.player.y);used=true}
  else if(def.classEffect==='debuff'&&nearest){attack(nearest,base,{skillId:id});const turns=def.debuffTurns??(2+Math.floor(lvl/3));if(def.debuffStat){const mode=def.debuffStatMode||'add';applyEnemyStatDebuff(nearest,def.debuffStat,mode,def.debuffStatCoef??(mode==='mult'?.8:2),turns,def.name)}else nearest.weakened=turns;used=true}
  else if(def.classEffect==='aoe'){const a=near(2+Math.floor(lvl/5));if(a.length){a.forEach(e=>attack(e,Math.round(base*.8),{skillId:id}));used=true}}
  else if(def.classEffect==='heal'){healEntity(game.player,base*2);game.player[def.resource]=Math.min(game.player[def.resource==='mana'?'maxMana':'maxStamina'],game.player[def.resource]+base);used=true}
  else if(def.classEffect==='multihit'&&visible.length){for(let i=0;i<Math.min(3+Math.floor(lvl/3),visible.length+1);i++)attack(pick(visible),Math.round(base*.7),{skillId:id});used=true}
  else if(def.classEffect==='utility'){const radius=7+lvl;for(let y=Math.max(0,game.player.y-radius);y<Math.min(ROWS,game.player.y+radius+1);y++)for(let x=Math.max(0,game.player.x-radius);x<Math.min(COLS,game.player.x+radius+1);x++)if(Math.hypot(x-game.player.x,y-game.player.y)<=radius)game.seen[y][x]=true;game.player.shadowVeil=1;used=true}
  else if(def.classEffect==='ultimate'&&visible.length){visible.slice(0,6+lvl).forEach(e=>attack(e,Math.round(base*1.25),{skillId:id}));used=true}
  else if(def.classEffect==='execute'&&nearest){attack(nearest,Math.round(base*(nearest.hp/nearest.maxHp<.4?2.5:1)),{skillId:id});used=true}
  else if(def.classEffect==='buff'){const turns=def.buffTurns??(6+Math.floor(lvl/2));const stat=def.buffStat||'strength';const mode=def.buffStatMode||'add';const value=def.buffStatCoef??(mode==='mult'?1.2:5);applyBuff(id,def.name,turns,{[stat]:{mode,value}});game.player.shield+=5+lvl*2;used=true}
  else if(def.classEffect==='massive'&&visible.length){visible.forEach(e=>attack(e,Math.round(base*1.7),{skillId:id}));used=true}
 }

 if(!used&&def.type==='utility'){
  const lvl=skillLevel(id);
  if(id==='arcaneLantern'){
   const radius=8+lvl*2;for(let y=Math.max(0,game.player.y-radius);y<Math.min(ROWS,game.player.y+radius+1);y++)for(let x=Math.max(0,game.player.x-radius);x<Math.min(COLS,game.player.x+radius+1);x++)if(Math.hypot(x-game.player.x,y-game.player.y)<=radius)game.seen[y][x]=true;
   log('La luz arcana revela corredores y salas cercanas.','good');used=true
  }else if(id==='phaseKey'){
   let n=0;for(const d of game.doors)if(!d.open&&Math.abs(d.x-game.player.x)+Math.abs(d.y-game.player.y)<=4+lvl){d.open=true;d.locked=false;n++}
   used=n>0;if(used)log(`Abres ${n} puerta(s) con magia de fase.`,'good')
  }else if(id==='mistStep'){
   const candidates=[];for(let y=Math.max(1,game.player.y-6);y<Math.min(ROWS-1,game.player.y+7);y++)for(let x=Math.max(1,game.player.x-6);x<Math.min(COLS-1,game.player.x+7);x++)if(game.seen[y][x]&&!blocked(x,y)&&!game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y))candidates.push({x,y,d:Math.abs(x-game.player.x)+Math.abs(y-game.player.y)});
   const dest=candidates.sort((a,b)=>b.d-a.d)[0];if(dest){game.player.x=dest.x;game.player.y=dest.y;anim.heroX=anim.targetX=dest.x;anim.heroY=anim.targetY=dest.y;reveal(dest.x,dest.y);used=true}
  }else if(id==='cleanse'){
   game.player.debuff=0;healEntity(game.player,8+lvl*3);used=true
  }else if(id==='campfire'){
   healEntity(game.player,Math.round(game.player.maxHp*(.22+lvl*.02)));
   game.player.mana=Math.min(game.player.maxMana,game.player.mana+Math.round(game.player.maxMana*.35));
   game.player.stamina=Math.min(game.player.maxStamina,game.player.stamina+Math.round(game.player.maxStamina*.45));used=true
  }else if(id==='treasureSense'){
   const r=10+lvl*2;for(const c of [...game.chests,...game.keys])if(Math.abs(c.x-game.player.x)+Math.abs(c.y-game.player.y)<=r)game.seen[c.y][c.x]=true;
   log('Percibes el rastro de cofres y llaves cercanas.','loot');used=true
  }else if(id==='shadowVeil'){
   game.player.shadowVeil=1;log('Te fundes con las sombras durante un movimiento.','good');used=true
  }else if(id==='transmute'){
   const candidates=game.inventory.filter(i=>i.type!=='potion'&&!isItemInMyTradeOffer(i.id)).sort((a,b)=>(a.score||0)-(b.score||0));const item=candidates[0];
   if(item){game.inventory=game.inventory.filter(i=>i.id!==item.id);const value=Math.max(8,Math.round((item.score||10)*1.4));game.player.gold+=value;log(`${item.name} se convierte en ${value} monedas.`,'loot');used=true}
  }else if(id==='recallRune'){
   const s=game.rooms?.[0];if(s){game.player.x=s.cx;game.player.y=s.cy;anim.heroX=anim.targetX=s.cx;anim.heroY=anim.targetY=s.cy;reveal(s.cx,s.cy);used=true}
  }else if(id==='dimensionalPocket'){
   let n=0;for(const c of game.chests)if(!c.opened&&game.seen[c.y]?.[c.x]&&n<2+Math.floor(lvl/2)){openChest(c);n++}used=n>0
  }
 }

 if(!used&&skillDefs[id]?.unlock==='Botín'&&def.type!=='utility'){
  const visible=visibleEnemiesInRange(skillRange(id));
  const nearest=visible.sort((a,b)=>(Math.abs(a.x-game.player.x)+Math.abs(a.y-game.player.y))-(Math.abs(b.x-game.player.x)+Math.abs(b.y-game.player.y)))[0];
  const lvl=skillLevel(id),base=8+lvl*3+(def.type==='magic'?game.player.stats.intelligence:game.player.stats.strength);
  if(id==='healingPulse'){healEntity(game.player,Math.round((8+lvl*4+game.player.stats.wisdom)*skillMult));used=true}
  else if(['mirrorWard','boneArmor'].includes(id)){game.player.shield+=(id==='boneArmor'?12:8)+lvl*4;used=true}
  else if(id==='bloodRush'){game.player.hp=Math.max(1,game.player.hp-5);game.player.stamina=Math.min(game.player.maxStamina,game.player.stamina+20+lvl*4);used=true}
  else if(id==='quickStep'){used=true}
  else if(nearest){
   if(['blackSun','worldBreaker','alchemicalNova','entropyWave','stormTotem','chainSpark','gravityWell','holyCircuit'].includes(id)){
    const targets=id==='blackSun'?visible:visible.slice(0,Math.min(6,2+lvl));
    targets.forEach(e=>attack(e,Math.round(base*(id==='blackSun'?2.1:1.25)*skillMult),{skillId:id}));used=true
   }else{
    attack(nearest,Math.round(base*(def.rarity==='legendary'?2.4:def.rarity==='epic'?1.8:def.rarity==='rare'?1.45:1.15)*skillMult),{skillId:id});
    if(id==='shockTrap'||id==='ironHook')nearest.stunned=1;
    if(id==='quantumThief'){healEntity(game.player,5+lvl);game.player.mana=Math.min(game.player.maxMana,game.player.mana+5+lvl);game.player.gold+=2+lvl}
    used=true
   }
  }
 }

 if(!used){log('No hay un objetivo válido.','sys');return}
 if(!apCan('skill',skillApCost(id)))return;
 game.player[def.resource]-=cost;game.player.cooldowns[id]=Math.max(1,skillDefs[id].cd-Math.floor((skillLevel(id)-1)/4));gainSkillUse(id);effect('shake');actionDone('skill',skillApCost(id));
}
function learnItemSkills(item){for(const id of item?.skillIds||[])learnSkill(id)}
// Passive gear effects: only the 'buff' kind makes sense with no target/cast
// action of its own (a thrown potion or a weapon swing has an obvious
// trigger; a permanently-worn helmet doesn't) - applied as a permanent buff
// (999999-turn sentinel, same "until explicitly reverted" convention already
// used elsewhere, e.g. the permanent-pet death penalty) the moment the item
// lands in one of these slots, removed the moment that slot's item changes.
// Weapon/trinket/ring slots use a different trigger (on-hit proc / active
// click, see maybeProcWeaponEffects/useEquipmentActive) so they're excluded here.
const PASSIVE_EQUIPMENT_SLOTS=new Set(['offhand','head','chest','hands','legs','boots']);
// Trinkets/rings carry an effects[] that's manually activated (like a potion)
// instead of passive or on-hit - gated by game.player.equipmentCooldowns[slot]
// instead of being consumed, see useEquipmentActive/tickEquipmentCooldowns.
const EQUIPMENT_ACTIVE_SLOTS=new Set(['neck','trinket1','trinket2','ring1','ring2']);
// Re-applies every passive slot's current buff from scratch - used after
// hydrating game.player.equipment from a save/session restore (where
// activeBuffs comes back from a snapshot that could predate an admin
// edit to the item's own effects) instead of trusting the persisted state.
function syncAllEquipmentPassives(){for(const slot of PASSIVE_EQUIPMENT_SLOTS)syncEquipmentSlotPassive(slot)}
function syncEquipmentSlotPassive(slot){
 const p=game.player;
 p.activeBuffs=(p.activeBuffs||[]).filter(b=>!String(b.id||'').startsWith(`equip:${slot}:`));
 if(!PASSIVE_EQUIPMENT_SLOTS.has(slot))return;
 const item=p.equipment?.[slot];
 if(item?.slot==='weapon')return;
 (item?.effects||[]).forEach((comp,i)=>{
  if(comp.kind!=='buff')return;
  const stat=comp.stat||'strength',mode=comp.mode||'add',value=comp.value??(mode==='mult'?1.2:5);
  p.activeBuffs.push({id:`equip:${slot}:${i}`,name:item.name,turns:999999,effects:{[stat]:{mode,value}}});
 });
}
function equipItem(id){
 const item=game.inventory.find(i=>i.id===id);if(!item)return;
 if(isItemInMyTradeOffer(id)){log('Este objeto está en oferta de intercambio: retíralo antes de equiparlo.','sys');return}
 learnItemSkills(item);let slot=item.slot;if(slot==='ring1'&&game.player.equipment.ring1)slot='ring2';if(slot==='trinket1'&&game.player.equipment.trinket1)slot='trinket2';
 const old=game.player.equipment[slot];if(old)game.inventory.push(old);game.player.equipment[slot]=item;game.inventory=game.inventory.filter(i=>i.id!==id);if(game.player.equipmentCooldowns)game.player.equipmentCooldowns[slot]=0;syncEquipmentSlotPassive(slot);log(`Equipado: ${item.name}.`,'loot');recomputeDerived();updateUI();draw()
}
// Lets a weapon-slot dagger be equipped in the offhand slot instead of the
// main weapon slot, for dual-wielding two real daggers - the item keeps its
// own item.slot==='weapon' (so unequipping and re-equipping normally still
// sends it back to the weapon slot), only the equipment dict key differs.
function equipItemAsOffhand(id){
 const item=game.inventory.find(i=>i.id===id);if(!item||!isDaggerWeapon(item))return;
 if(isItemInMyTradeOffer(id)){log('Este objeto está en oferta de intercambio: retíralo antes de equiparlo.','sys');return}
 learnItemSkills(item);
 const old=game.player.equipment.offhand;if(old)game.inventory.push(old);
 game.player.equipment.offhand=item;game.inventory=game.inventory.filter(i=>i.id!==id);syncEquipmentSlotPassive('offhand');
 log(`Equipado en mano izquierda: ${item.name}.`,'loot');recomputeDerived();updateUI();draw()
}
function equipSkill(id,slot){if(!game.player.knownSkills.includes(id))return;game.player.equippedSkills=game.player.equippedSkills.map(x=>x===id?null:x);game.player.equippedSkills[slot]=id;updateUI()}
function unequipItem(slot){
 const item=game.player.equipment?.[slot];if(!item)return;
 game.player.equipment[slot]=null;game.inventory.push(item);if(game.player.equipmentCooldowns)game.player.equipmentCooldowns[slot]=0;syncEquipmentSlotPassive(slot);
 storyOverlay?.classList.add('hidden');
 log(`Desequipado: ${item.name}.`,'loot');recomputeDerived();updateUI();draw();
}


function equippedSlotHtml(slot,item){
 if(!item)return`<span class="small">Vacío</span>`;
 return`<button type="button" class="equippedItemButton" onclick="showEquippedItem('${slot}')" ondblclick="event.preventDefault();unequipItem('${slot}')" title="Ver detalles de ${item.name} (doble click para desequipar)"><canvas class="equippedItemIcon" width="48" height="48" data-equipped-slot="${slot}"></canvas></button><div class="equippedItemInfo"><b class="${item.rarity}">${item.name}</b><span class="small">Nv. ${item.itemLevel||1} · Poder ${item.score||0}</span></div>`;
}
function showEquippedItem(slot){
 const item=game?.player?.equipment?.[slot];if(!item)return;
 storyTitle.textContent=`${slotNames[slot]} — ${item.name}`;
 storyBody.innerHTML=`<div class="narrative itemDetail"><canvas class="itemDetailIcon" width="48" height="48" data-detail-slot="${slot}"></canvas><div><p><b class="${item.rarity}">${item.name}</b></p><p class="small">${slotNames[item.slot]} · ${item.label} · Nivel ${item.itemLevel||1} · Poder ${item.score||0}</p>${item.weaponCategory?`<p class="small">Categoría: ${item.weaponCategory}</p>`:''}<p>${item.flavor||item.desc||''}</p>${describeItem(item)}<div class="startActions"><button id="closeItemDetail">Cerrar</button></div></div></div>`;
 storyOverlay.classList.remove('hidden');
 setTimeout(()=>{const c=document.querySelector('[data-detail-slot]');if(c)drawItemIcon(c,item);document.getElementById('closeItemDetail')?.addEventListener('click',()=>storyOverlay.classList.add('hidden'))},0)
}

function updateObjectiveHud(){
 const el=document.getElementById('floorObjective');if(!el||!game)return;
 const obj=game.objective;
 if(!obj||obj.type==='stairs'&&!game.floorArchetypeLabel){el.classList.add('hidden');return}
 el.classList.remove('hidden');
 const label=game.floorArchetypeLabel||'Piso estándar';
 let urgent=false;
 if(obj?.type==='timed'){const left=(obj.limit||0)-(obj.elapsed||0);urgent=obj.expired||left<=8}
 else if(obj?.type==='survive'&&!obj.done)urgent=true;
 el.classList.toggle('urgent',urgent);
 el.innerHTML=`${label} · <b>${objectiveText(obj)}</b>`;
}
// The "Zona:" HUD line only renders once a floor actually exists
// (game.floorTileset from generateFloor()/loadPrecomputedFloor(), or a live
// game.map) - updateUI() is also called from the class-skill-choice flow
// during character creation, before any dungeon exists, and
// currentFloorTheme()/activeFloorTileset() throws in that case if
// config_floor has no rows yet (by design, see pickFloorTilesetForLevel) -
// that used to silently abort the rest of the skill-pick handler, including
// the call that actually saves the new character to Supabase.
function updateUI(){
 if(!game)return;clampCompanionReservedResources();const p=game.player;heroName.textContent=p.name.toUpperCase();buildLabel.textContent=`${(p.raceName||raceDefs[p.race]?.name||p.race).toUpperCase()} · ${(p.className||resolveClassDef(p.cls)?.name||p.cls).toUpperCase()} · 🔑 ${p.keys}`;level.textContent=p.level;floor.textContent=game.floor;if(gameHudIdentity)gameHudIdentity.innerHTML=`<b>${p.name}</b> · Nv. ${p.level}`;damage.textContent=total('damage');armor.textContent=total('armor');gold.textContent=p.gold;const fs=p.derived?.finalStats||p.stats;strength.textContent=fs.strength;vitality.textContent=fs.vitality;agility.textContent=fs.agility;luck.textContent=fs.luck;intelligence.textContent=fs.intelligence;wisdom.textContent=fs.wisdom;if(game.floorTileset||game.map)themeLabel.textContent=`Zona: ${currentFloorTheme().name}${game.boss?' · PISO DE JEFE':''}`;updateObjectiveHud();renderTradeTab();renderShardsTab();
 equipmentMini.innerHTML=['weapon','chest','ring1','neck'].map(s=>`<div class="small">${slotNames[s]}: <b>${p.equipment[s]?.name||'—'}</b></div>`).join('');
 const equipmentItems=game.inventory.filter(i=>i.type!=='potion'),potionItems=game.inventory.filter(i=>i.type==='potion');
 inventory.innerHTML=equipmentItems.length?equipmentItems.map(i=>{const canDisenchant=i.slot!=='consumable';return `<div class="item" onclick="equipItem('${i.id}')"><canvas class="itemThumb" width="48" height="48" data-item="${i.id}"></canvas><div><b class="${i.rarity}">${i.name}</b><span class="itemLevel">${slotNames[i.slot]} · ${i.label} · Nivel ${i.itemLevel||1}</span><span class="itemScore">Poder de objeto: ${i.score||0}</span>${describeItem(i)}</div>${isDaggerWeapon(i)?`<button type="button" class="equipOffhandMiniBtn" title="Equipar en mano izquierda (dual wield)" onclick="event.stopPropagation();equipItemAsOffhand('${i.id}')">Izq.</button>`:''}${canDisenchant?`<button type="button" class="disenchantMiniBtn" title="Deshacer: 3-5 shards de ${tierDefs[i.rarity]?.label||i.rarity}" onclick="event.stopPropagation();confirmDisenchantItem('${i.id}')"><canvas class="shardTierIcon" width="16" height="16" data-shard-tier="${i.rarity}"></canvas></button>`:''}</div>`}).join(''):'<p class="small">La mochila solo contiene pelusas.</p>';
 const potionsEl=document.getElementById('potions');
 if(potionsEl)potionsEl.innerHTML=potionItems.length?potionItems.map(i=>`<div class="item" onclick="usePotion('${i.id}')"><canvas class="itemThumb" width="48" height="48" data-item="${i.id}"></canvas><div><b class="${i.rarity}">${i.name}${i.quantity>1?` x${i.quantity}`:''}</b><span class="itemLevel">Poción · ${i.label} · Nivel ${i.itemLevel||1}</span>${describeItem(i)}</div><button type="button" class="disenchantMiniBtn" title="Deshacer una poción: 1-3 shards de ${tierDefs[i.rarity]?.label||i.rarity}" onclick="event.stopPropagation();confirmDisenchantItem('${i.id}')"><canvas class="shardTierIcon" width="16" height="16" data-shard-tier="${i.rarity}"></canvas></button></div>`).join(''):'<p class="small">No llevas pociones.</p>';
 // Trinkets/rings with a configured effects[] show up here instead of the
 // inventory - they stay equipped (see useEquipmentActive), so their icon is
 // drawn via the same data-equipped-slot lookup as the paperdoll slots below.
 const activablesEl=document.getElementById('activables');
 if(activablesEl){
  const activeItems=[...EQUIPMENT_ACTIVE_SLOTS].map(slot=>({slot,item:p.equipment[slot]})).filter(x=>x.item&&Array.isArray(x.item.effects)&&x.item.effects.length);
  activablesEl.innerHTML=activeItems.length?activeItems.map(({slot,item})=>{
   const cd=p.equipmentCooldowns?.[slot]||0;
   return `<div class="item${cd?' onCooldown':''}" ${cd?'':`onclick="useEquipmentActive('${slot}')"`}><canvas class="itemThumb" width="48" height="48" data-equipped-slot="${slot}"></canvas><div><b class="${item.rarity}">${item.name}</b><span class="itemLevel">${slotNames[slot]} · ${item.label} · Nivel ${item.itemLevel||1}</span>${describeItem(item)}</div>${cd?`<span class="cooldown">${cd}</span>`:''}</div>`;
  }).join(''):'<p class="small">No tienes objetos activables equipados.</p>';
 }
 renderCompanionsTab();
 setTimeout(()=>{document.querySelectorAll('.itemThumb').forEach(c=>{const it=c.dataset.equippedSlot?p.equipment[c.dataset.equippedSlot]:game.inventory.find(x=>x.id===c.dataset.item);if(it)drawItemIcon(c,it)});document.querySelectorAll('#inventory .shardTierIcon').forEach(c=>drawShardTierIconToCanvas(c,c.dataset.shardTier))},0);
 equipment.innerHTML=`<div class="equipVisual"><canvas id="equipmentHeroCanvas" class="equipmentHeroCanvas" width="128" height="192"></canvas>${slots.map(s=>`<div class="visualSlot vs-${s}"><span class="slotName">${slotNames[s]}</span>${equippedSlotHtml(s,p.equipment[s])}</div>`).join('')}</div>`;
 skills.innerHTML=p.knownSkills.map(id=>[id,skillDefs[id]]).filter(([,d])=>d).map(([id,d])=>{const eq=p.equippedSkills.indexOf(id),iconHtml=d.iconImage?`<canvas class="skillIconImg" width="20" height="20" data-skill-icon="${id}"></canvas>`:d.icon;return`<div class="skillCard"><b>${iconHtml} ${d.name}</b><span class="small">${d.desc}<span class='rangeTag'>${d.type==='utility'?'Utilidad':skillRangeLabel(id)}</span><br>Coste: ${d.cost} ${d.resource==='mana'?'maná':'stamina'}${apModeOn()?` · ${skillApCost(id)} PA`:''} · Daño: ${diceDamageLabel(id)} · <span class='skillLevel'>Nivel ${skillLevel(id)} · ${game.player.skillProgress?.[id]?.xp||0}/${skillXpNeeded(skillLevel(id))} XP</span><div class='skillXpBar'><i style='width:${((game.player.skillProgress?.[id]?.xp||0)/skillXpNeeded(skillLevel(id))*100)}%'></i></div> Aprendida ${eq>=0?`· <span class="equippedTag">Equipada en ${eq+1}</span>`:''}</span><div>${[0,1,2,3].map(n=>`<button onclick="equipSkill('${id}',${n})">${n+1}</button>`).join(' ')}</div></div>`}).join('')||'<p class="small">Todavía no has aprendido habilidades.</p>';
 achievements.innerHTML=[['crowd','Reunión multitudinaria','Tres enemigos adyacentes.'],['chest5','Coleccionista de basura','Abrir cinco cofres.'],['firstBoss','Rey de nada','Derrotar al primer jefe.']].map(a=>`<div class="skillCard ${game.achievements[a[0]]?'':'locked'}"><b>${game.achievements[a[0]]?'✓':'?'} ${a[1]}</b><span class="small">${a[2]}</span></div>`).join('');
 setTimeout(()=>{const ec=document.getElementById('equipmentHeroCanvas');if(ec)drawPaperDoll(ec,p);document.querySelectorAll('[data-equipped-slot]').forEach(c=>{const it=p.equipment[c.dataset.equippedSlot];if(it)drawItemIcon(c,it)})},0);
 // Compact one-row cards: hotkey+icon+short cost only. Full dice/range/defense
 // detail moves into the title tooltip instead of stacking extra lines.
 mobileSkillbar.innerHTML=`<button class="mobileSkill attackSkill" ${busy?'disabled':''} onclick="beginBasicAttack()" title="Ataque básico · ${baseAttackDice()} · ${attackRangeLabel()}"><span class="slotKey">A</span><span class="icon">⚔</span><span class="skillText"><b>Atacar</b></span></button>`+p.equippedSkills.map((id,i)=>{
  if(!id)return'';
  const activeCompanion=permanentCompanionForSkill(id);
  if(activeCompanion)return companionCommandButtonHtml(activeCompanion,i);
  const d=skillDefs[id],cd=p.cooldowns[id]||0,cost=effectiveSkillCost(d),detail=`${d.name} · ${cost} ${d.resource==='mana'?'maná':'stamina'}${apModeOn()?` · ${skillApCost(id)} PA`:''} · ${diceDamageLabel(id)} · ${skillRangeLabel(id)}`,iconHtml=d.iconImage?`<canvas class="skillIconImg" width="18" height="18" data-skill-icon="${id}"></canvas>`:d.icon;
  return`<button class="mobileSkill" ${cd||busy||p[d.resource]<cost||skillsBlockedByTransform()?'disabled':''} onclick="useSkill(${i})" title="${detail}"><span class="slotKey">${i+1}</span><span class="icon">${iconHtml}</span><span class="skillText"><b>${d.name}</b><span class="costTag">${cost}${d.resource==='mana'?'✦':'⚡'}</span></span>${cd?`<span class="cooldown">${cd}</span>`:''}</button>`
 }).join('');
 setTimeout(()=>document.querySelectorAll('[data-skill-icon]').forEach(c=>{const dd=skillDefs[c.dataset.skillIcon];if(dd?.iconImage)drawSkillIconImg(c,dd.iconImage)}),0);
 document.getElementById('activeEffects').innerHTML=activeEffectsHtml();updateRestButton();updateGameHud();
}
