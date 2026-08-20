// ============================================================================
// pjlvl.js - Character leveling: XP curve, per-level HP/stamina/mana/damage/
// armor growth, class-skill-choice tiers/levels and the stat-point/skill-
// choice modals triggered on level up.
//
// Loaded BEFORE game.js (see index.html); nothing here has top-level side
// effects (pure function/const declarations), so this is purely for
// consistency with pjrace.js, which does need to load first. This file
// assumes it executes in the same top-level lexical scope as game.js (game,
// skillDefs, classSkillTrees, pick, banner, log, updateUI, draw, uiConfirm,
// uiAlert, learnSkill, recomputeDerived, enforceActiveSkillSlots,
// finishCharacterCreation, playerFinished, focusGamepadElement, partySize,
// sendMpAction, rescaleBossOnLevelUp, characterBundleFromGame, computeScore,
// xpReceivedMultiplier and the DOM element ids used by the level-up modals).
// ============================================================================

const classSkillMilestones={1:1};
// Levels at which a class skill choice is awarded after the initial pick
// (level 1 in normal mode, level 2/floor 2 in Soulseek mode - see
// soulseekCheckClassUnlock()). Shared with the tier thresholds below.
const SKILL_CHOICE_LEVELS=[5,7,10,12,15,20];
function isClassSkillChoiceLevel(level){return SKILL_CHOICE_LEVELS.includes(level)}
// Roman numerals for skill tiers I-IV, shared by every tier-label render site.
const TIER_ROMAN=['','I','II','III','IV'];
// Highest skill tier selectable at a given character level: II at 7, III at
// 12, IV at 20.
function maxSkillTierForLevel(level){return level>=20?4:level>=12?3:level>=7?2:1}

let pendingClassSkillRequests=[];
function classTierForLevel(level){return classSkillMilestones[level]||0}
const CLASS_SKILL_LEVELS=[1];
function ensureSkillChoiceState(){
 const p=game.player;
 p.skillChoicesAwarded=p.skillChoicesAwarded||{};
 pendingClassSkillRequests=pendingClassSkillRequests||[];
}
function classSkillIdsForTier(tier){
 const roman=TIER_ROMAN[tier];
 return (classSkillTrees[game.player.cls]?.[roman]||[]).filter(id=>skillDefs[id]);
}
function classSkillIdsForLevelReward(level){
 const maxTier=maxSkillTierForLevel(level),tree=classSkillTrees[game.player.cls]||{};
 return Object.entries(tree).flatMap(([roman,ids])=>{
  const tier={I:1,II:2,III:3,IV:4}[roman]||0;
  return tier&&tier<=maxTier?ids:[];
 }).filter(id=>skillDefs[id]&&!game.player.knownSkills.includes(id));
}
function randomClassSkillForLevelReward(level){return pick(classSkillIdsForLevelReward(level))}
function knownClassSkillIds(){
 if(!game?.player)return [];
 const all=new Set(Object.values(classSkillTrees[game.player.cls]||{}).flat());
 return (game.player.knownSkills||[]).filter(id=>all.has(id));
}
function expectedClassSkillLevels(level=game.player.level){return CLASS_SKILL_LEVELS.filter(l=>l<=level&&classTierForLevel(l))}
function expectedClassSkillCount(level=game.player.level){
 const byTier={};
 let total=0;
 for(const l of expectedClassSkillLevels(level)){
  const tier=classTierForLevel(l);
  byTier[tier]=(byTier[tier]||0)+1;
 }
 for(const [tier,count] of Object.entries(byTier))total+=Math.min(count,classSkillIdsForTier(Number(tier)).length);
 return total;
}
function firstMissingClassSkillRequest(){
 if(!game?.player)return null;
 const known=new Set(knownClassSkillIds());
 const takenByTier={};
 for(const id of known){
  const d=skillDefs[id];
  if(d?.tier)takenByTier[d.tier]=(takenByTier[d.tier]||0)+1;
 }
 for(const level of expectedClassSkillLevels()){
  const tier=classTierForLevel(level),available=classSkillIdsForTier(tier);
  const neededUntilThisLevel=expectedClassSkillLevels(level).filter(l=>classTierForLevel(l)===tier).length;
  if(Math.min(neededUntilThisLevel,available.length)>(takenByTier[tier]||0))return{level,tier,initial:level===1&&!known.size};
 }
 return null;
}
function queueClassSkillChoice(level,initial=false){
 if(!game?.player)return;
 ensureSkillChoiceState();
 const tier=initial?classTierForLevel(level):maxSkillTierForLevel(level);
 if(!tier)return;
 const alreadyQueued=pendingClassSkillRequests.some(q=>q.level===level&&q.tier===tier);
 if(!alreadyQueued)pendingClassSkillRequests.push({level,tier,initial});
 processClassSkillChoices();
}
function queueMissingClassSkillChoices(){
 if(!game?.player)return;
 ensureSkillChoiceState();
 const expected=expectedClassSkillCount(),known=knownClassSkillIds().length;
 if(known>=expected)return;
 const missing=firstMissingClassSkillRequest();
 if(missing)queueClassSkillChoice(missing.level,missing.initial);
}
function classSkillChoicesForTier(tier){return classSkillIdsForTier(tier).filter(id=>!game.player.knownSkills.includes(id))}
function levelRewardLabel(level,skillId){
 const s=skillDefs[skillId];
 if(!s)return '';
 const tier=TIER_ROMAN[s.tier]||s.tier||'?';
 return `<div class="levelRewardSkill"><b>${s.icon} ${s.name}</b><span class="tierBadge">TIER ${tier}</span><p>${s.desc}</p><span class="small">Skill aleatoria de ${game.player.className} desbloqueada al nivel ${level}.</span></div>`
}
function processClassSkillChoices(){
 if(!game?.player)return;
 if(document.getElementById('statPointModal')?.classList.contains('open'))return;
 const modal=document.getElementById('skillChoiceModal');
 if(!modal||modal.classList.contains('open'))return;
 if(!pendingClassSkillRequests.length){
  const missing=firstMissingClassSkillRequest();
  if(missing)pendingClassSkillRequests.push(missing);
 }
 if(!pendingClassSkillRequests.length)return;
 const request=pendingClassSkillRequests.shift(),roman=TIER_ROMAN[request.tier];
 const choices=request.initial?classSkillChoicesForTier(request.tier):classSkillIdsForLevelReward(request.level);
 // A custom class with no skills configured for this tier leaves nothing to
 // pick - mark it satisfied and move on instead of leaving the request
 // stuck forever, but if this WAS the initial character-creation request,
 // still finish creating the character (save to DB, back to single player)
 // exactly like the real pick-a-skill path below does. Skipping this was
 // the "click Crear, screen goes blank, character never saved" bug: no
 // choices meant the modal never opened, so finishCharacterCreation() (only
 // ever called from inside that modal's click handler) never ran.
 if(!choices.length){game.player.skillChoicesAwarded[request.level]='complete';if(request.initial)finishCharacterCreation();else if(game.player.unspentStatPoints)showStatPointModal();processClassSkillChoices();return}
 document.getElementById('skillChoiceTitle').textContent=request.initial?'ELIGE TU PRIMERA HABILIDAD':`NUEVA HABILIDAD · NIVEL ${request.level} · TIER ${roman}`;
 document.getElementById('skillChoiceText').textContent=request.initial?`${game.player.className} · nivel 1. Elige una habilidad del pool real de tu clase.`:`${game.player.className} · nivel ${request.level}. Elige una habilidad disponible del pool de tu clase (hasta tier ${roman}).`;
 document.getElementById('skillChoiceGrid').innerHTML=choices.map(id=>{const s=skillDefs[id],skillRoman=TIER_ROMAN[s.tier]||s.tier;return `<button type="button" class="skillChoiceCard" data-pick-skill="${id}"><b>${s.icon} ${s.name}</b><span class="tierBadge">TIER ${skillRoman}</span><p>${s.desc}</p><span class="small">${s.cost} ${s.resource==='mana'?'maná':'stamina'} · CD ${s.cd} · Alcance ${s.range||0}</span></button>`}).join('');
 modal.classList.add('open');
 modal.querySelectorAll('[data-pick-skill]').forEach(b=>b.addEventListener('click',async()=>{
  // Everything below (closing the modal, saving to Supabase on the initial
  // pick) is a chain of synchronous statements - an exception thrown by any
  // one of them silently aborted the rest, which for the initial pick meant
  // finishCharacterCreation() never even got called and the click looked
  // like it did nothing. One real example: updateUI() used to unconditionally
  // compute the "Zona:" floor theme, which throws with no active floor/
  // tileset yet (character creation) and no config_floor rows configured -
  // entirely unrelated to whichever skill happened to be picked (see
  // updateUI()'s game.floorTileset/game.map guard). Surface any such
  // exception instead of swallowing it.
  try{
   const chosen=skillDefs[b.dataset.pickSkill];
   if(!await uiConfirm(`¿Confirmas que quieres aprender ${chosen?.name||'esta habilidad'}?`))return;
   learnSkill(b.dataset.pickSkill);
   game.player.skillChoicesAwarded[request.level]='chosen';
   modal.classList.remove('open');updateUI();
   if(request.initial)finishCharacterCreation();
   else if(game.player.unspentStatPoints)showStatPointModal();
   queueMissingClassSkillChoices();
   processClassSkillChoices();
   if(!request.initial&&!game.player.unspentStatPoints&&game.pendingPlayerFinished&&!document.getElementById('skillChoiceModal')?.classList.contains('open')){game.pendingPlayerFinished=false;playerFinished()}
  }catch(e){
   console.error('Fallo al elegir la habilidad de clase:',e);
   uiAlert(`Error al elegir la habilidad "${b.dataset.pickSkill}": ${e.message}`);
  }
 }))
}
function classSkillConsistencyGuard(){if(game?.turn%2===0)queueMissingClassSkillChoices()}

const LEVEL_CAP=100;
function xpNeededForLevel(level){
 level=Math.max(1,Math.min(LEVEL_CAP,level));
 return Math.round(28+level*18+Math.pow(level,1.72)*5.4);
}
function levelGrowth(level){
 return{
  hp:5+Math.floor(level/5),
  stamina:3+Math.floor(level/12),
  mana:3+Math.floor(level/12),
  damage:(level%3===0?1:0)+(level%10===0?1:0),
  armor:(level%4===0?1:0)+(level%15===0?1:0)
 };
}
function levelScalePreview(level){
 const cumulativeXp=Array.from({length:Math.max(0,level-1)},(_,i)=>xpNeededForLevel(i+1)).reduce((a,b)=>a+b,0);
 return{
  level,
  xpForNext:level<LEVEL_CAP?xpNeededForLevel(level):0,
  cumulativeXp,
  enemyHpMultiplier:+Math.pow(1.055,level-1).toFixed(2),
  enemyDamageMultiplier:+Math.pow(1.035,level-1).toFixed(2),
  lootQuality:+(1+Math.pow(level-1,0.72)*.18).toFixed(2)
 }
}
const LEVEL_100_FORECAST=[1,5,10,20,30,40,50,60,70,80,90,100].map(levelScalePreview);

const statDescriptions={strength:'Aumenta daño físico y la stamina máxima.',vitality:'Aumenta vida y resistencia.',agility:'Aumenta evasión, movilidad y los Puntos de Acción (PA).',luck:'Mejora el % de crítico, botín y eventos.',intelligence:'Aumenta poder mágico y aporta algo de maná extra.',wisdom:'Aumenta el maná máximo y mejora regeneración y percepción.'};
function animateLevelUpThen(done){const stage=document.getElementById('gameStage');stage?.classList.remove('levelUpPulse');void stage?.offsetWidth;stage?.classList.add('levelUpPulse');setTimeout(done,2000)}
function queueStatPoint(level){
 const p=game.player;p.unspentStatPoints=(p.unspentStatPoints||0)+1;p.pendingLevelUpRewards=p.pendingLevelUpRewards||[];
 p.pendingLevelUpRewards.push({level,skillChoice:isClassSkillChoiceLevel(level)});
 showStatPointModal()
}
function showStatPointModal(){
 const p=game.player;if(!p?.unspentStatPoints)return;
 const modal=document.getElementById('statPointModal'),grid=document.getElementById('statChoiceGrid'),title=document.getElementById('statPointTitle'),text=document.getElementById('statPointText'),skill=document.getElementById('statPointSkillReward'),labels={strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'};
 if(!modal||!grid)return;
 p.pendingLevelUpRewards=p.pendingLevelUpRewards||[];const reward=p.pendingLevelUpRewards[0]||{};
 if(title)title.textContent=`SUBIDA DE NIVEL${reward.level?` · NIVEL ${reward.level}`:''}`;
 if(text)text.textContent='Distribuye 1 punto en una stat principal para consolidar la subida.';
 if(skill)skill.innerHTML=reward.skillChoice?'<p class="small">Después de asignar la stat elegirás una nueva habilidad de tu clase.</p>':'';
 grid.innerHTML=Object.keys(labels).map(k=>`<button type="button" class="statChoice" data-stat-choice="${k}"><b>${labels[k]}: ${p.stats[k]}</b><span>${statDescriptions[k]}</span></button>`).join('');modal.classList.add('open');
 setTimeout(()=>focusGamepadElement(grid.querySelector('[data-stat-choice]')),0);
 grid.querySelectorAll('[data-stat-choice]').forEach(btn=>btn.addEventListener('click',async()=>{const stat=btn.dataset.statChoice;if(!await uiConfirm(`¿Confirmas +1 a ${labels[stat]}?`))return;const reward=(p.pendingLevelUpRewards||[]).shift()||{};p.stats[stat]=(p.stats[stat]||0)+1;p.unspentStatPoints--;recomputeDerived();updateUI();draw();banner(`+1 ${labels[stat].toUpperCase()}`);log(`Asignas 1 punto a ${labels[stat]}.`,'good');modal.classList.remove('open');if(reward.skillChoice){queueClassSkillChoice(reward.level)}else if(p.unspentStatPoints)showStatPointModal();else{queueMissingClassSkillChoices();processClassSkillChoices();if(game.pendingPlayerFinished&&!document.getElementById('skillChoiceModal')?.classList.contains('open')){game.pendingPlayerFinished=false;playerFinished()}}}))
}

// A race's hpGainPct/staminaGainPct/manaGainPct is a percentage delta (0 =
// unchanged, can be negative) applied to the per-level HP/stamina/mana growth
// below - e.g. +20% means each level's gain is multiplied by 1.20.
function raceLevelGainMultiplier(p,key){return 1+(Number(p.raceBonuses?.[key])||0)/100}
function grantXp(v){
 const p=game.player;if(p.level>=LEVEL_CAP)return;
 const startLevel=p.level;
 v=Math.ceil(v*(1+(Number(p.raceBonuses?.xpMult)||0)/100)*xpReceivedMultiplier());p.xp+=v;
 while(p.level<LEVEL_CAP&&p.xp>=p.nextXp){
  p.xp-=p.nextXp;p.level++;
  const g=levelGrowth(p.level);
  p.nextXp=p.level<LEVEL_CAP?xpNeededForLevel(p.level):0;
  p.maxHp+=Math.round((g.hp+p.stats.vitality)*raceLevelGainMultiplier(p,'hpGainPct'));p.hp=p.maxHp;
  p.maxStamina+=Math.round((g.stamina+Math.floor(p.stats.strength/3))*raceLevelGainMultiplier(p,'staminaGainPct'));p.stamina=p.maxStamina;
  p.maxMana+=Math.round((g.mana+Math.floor((p.stats.wisdom*2+p.stats.intelligence)/3))*raceLevelGainMultiplier(p,'manaGainPct'));p.mana=p.maxMana;
  p.baseDamage+=g.damage;p.baseArmor+=g.armor;
  if(p.level%10===0){p.stats.strength++;p.stats.vitality++;p.stats.agility++;p.stats.luck++;p.stats.intelligence++;p.stats.wisdom++}
  banner(`NIVEL ${p.level}`);animateLevelUpThen(()=>queueStatPoint(p.level));
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
  const r=await fetch(`/api/user-pj?nombre=${encodeURIComponent(window.currentUser.nombre)}&light=1`);
  const chars=await r.json();
  if(!r.ok||!Array.isArray(chars))return;
  const maxLevel=chars.reduce((m,c)=>Math.max(m,Number(c.level)||1),0);
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

function classSkillIdsForTierOf(classId,tier){const roman=TIER_ROMAN[tier];return (classSkillTrees[classId]?.[roman]||[]).filter(id=>skillDefs[id])}
