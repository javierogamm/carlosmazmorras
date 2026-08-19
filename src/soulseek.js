// ============================================================================
// SOULSEEK MODE (Fase 1) - additive roguelite layer on top of the normal
// game. Loaded after src/game.js as a plain classic script, so it shares the
// same top-level lexical scope (game, selectedDungeonWorld, raceDefs,
// classDefs, configWorldObjects, skillDefs, WORLD_OBJECT_KINDS,
// MAIN_MENU_SCREEN_IDS, and every helper function declared there) without
// any module wiring. Nothing here is imported anywhere else - this file only
// injects a button, a few overlays, and wraps three existing functions so
// normal-mode play is completely unaffected when soulseeker.js is absent.
//
// Fase 1 scope: Soulseeker menu (PUNTUACIONES / SOUL UNLOCKS / NUEVA
// PARTIDA), classless character creation (race + sexo + nombre, every race
// unlocked), the level-2 "pick an advanced class" moment, and the death
// choice (revive with Soul Spikes as usual, or let the character die and
// bank its Soul Spikes into the account's permanent souls balance). Fase 2
// (fresh dungeon generation per floor) and Fase 3 (spending souls on
// unlocks) reuse this same file going forward.
// ============================================================================

let soulseekSelectedRace=null;
let soulseekSelectedGender='male';
let soulseekClassPickerOpen=false;

// -- styling (kept out of styles.css: this file owns everything Soulseek) --
(function injectSoulseekStyles(){
 const style=document.createElement('style');
 style.textContent=`
  .soulseekHeader{display:flex;align-items:center;justify-content:center;gap:8px;margin:-4px 0 14px;padding:8px 12px;background:#1c1224;border:2px solid #6a4d7d;color:#e8d6ff;font-size:14px}
  .soulseekHeader b{color:#ffd68b}
  .soulseekActions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:10px}
  .soulseekBadge{display:inline-block;margin-left:8px;padding:2px 8px;border:1px solid #9d6cff;color:#d8b8ff;font-size:10px;vertical-align:middle}
  .soulseekDeathBox{text-align:center;border-color:#9d6cff}
  .soulseekDeathBox .startActions{display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap}
  #soulseekClassGrid .skillChoiceCard p{margin:6px 0 0}
 `;
 document.head.appendChild(style);
})();

// -- one-time world-object catalog entry so the classless PJ icon is
// -- editable from Configuración > Objetos del mundo like any other icon.
// -- WORLD_OBJECT_KINDS/MAIN_MENU_SCREEN_IDS are declared `const` in game.js
// -- but that only freezes the binding, not the array contents.
if(typeof WORLD_OBJECT_KINDS!=='undefined'&&!WORLD_OBJECT_KINDS.some(k=>k.key==='pj_classless')){
 WORLD_OBJECT_KINDS.push({key:'pj_classless',label:'Soulseek: PJ sin clase'});
}
if(typeof MAIN_MENU_SCREEN_IDS!=='undefined'){
 for(const id of ['soulseekOverlay','soulseekScoresScreen','soulseekUnlocksOverlay','soulseekCreateOverlay'])
  if(!MAIN_MENU_SCREEN_IDS.includes(id))MAIN_MENU_SCREEN_IDS.push(id);
}

function soulseekAccountSouls(){return Math.max(0,Number(window.currentUser?.souls)||0)}
function soulseekSetAccountSouls(v){
 if(window.currentUser)window.currentUser.souls=Math.max(0,Number(v)||0);
 try{if(window.currentUser)localStorage.setItem('mazmorraUser',JSON.stringify(window.currentUser))}catch(e){}
}
function soulseekDrawMiniIcons(){
 document.querySelectorAll('[data-soulseek-soul-mini]').forEach(c=>drawSkillIconImg(c,configWorldObjects.soul_spike));
}
function soulseekSoulIconHtml(){
 return configWorldObjects.soul_spike?'<canvas class="soulMiniIcon" width="22" height="22" data-soulseek-soul-mini></canvas>':'<span class="soulMiniIcon">✦</span>';
}
function soulseekHeaderHtml(){
 return `<div class="soulseekHeader">${soulseekSoulIconHtml()} <b>${soulseekAccountSouls()}</b> Soul Spikes acumuladas</div>`;
}

// ============================================================================
// DOM scaffolding - built once, appended to <body>, reused across opens.
// ============================================================================
function soulseekEnsureDom(){
 if(document.getElementById('soulseekOverlay'))return;
 const wrap=document.createElement('div');
 wrap.innerHTML=`
<div class="overlay hidden" id="soulseekOverlay">
 <div class="modal">
  <h2>SOULSEEKER MODE<span class="soulseekBadge">ROGUELITE</span></h2>
  <div id="soulseekMenuHeader"></div>
  <p class="small">Personajes sin clase que empiezan con Advanced Classes y Puntos de Acción. Elige tu clase al nivel 2 y decide, al morir, si gastas tus Soul Spikes para revivir o dejas caer al personaje y las guardas en tu cuenta para siempre.</p>
  <div class="landingActions" id="soulseekMenuActions">
   <button class="start" id="soulseekScoresBtn">PUNTUACIONES</button>
   <button class="start" id="soulseekUnlocksBtn">SHOP</button>
   <button class="start" id="soulseekNewCharBtn">NUEVA PARTIDA</button>
  </div>
  <button class="backToLanding" id="soulseekBackBtn">VOLVER</button>
 </div>
</div>

<div class="configScreen hidden" id="soulseekScoresScreen">
 <header><h1>PUNTUACIONES SOULSEEKER</h1><div class="badge">RANKING</div></header>
 <div id="soulseekScoresStatus" class="small">Cargando puntuaciones...</div>
 <div class="scoresTable" id="soulseekScoresTable"></div>
 <button class="backToLanding" id="soulseekScoresBackBtn">VOLVER</button>
</div>

<div class="overlay hidden" id="soulseekUnlocksOverlay">
 <div class="modal">
  <h2>SOUL UNLOCKS</h2>
  <div id="soulseekUnlocksHeader"></div>
  <p class="small">Aquí podrás gastar tus Soul Spikes acumuladas en desbloquear razas, clases y skills para todos tus futuros personajes Soulseeker. Disponible en la Fase 3.</p>
  <button class="backToLanding" id="soulseekUnlocksBackBtn">VOLVER</button>
 </div>
</div>

<div class="overlay hidden" id="soulseekCreateOverlay">
 <div class="modal characterWizard">
  <h2>NUEVO PERSONAJE SOULSEEKER</h2>
  <p class="small">Empieza sin clase (Advanced Classes + Puntos de Acción). Al llegar a nivel 2 elegirás tu clase avanzada. Todas las razas están desbloqueadas.</p>
  <h4>Raza</h4>
  <div class="choices raceGrid" id="soulseekRaceChoices"></div>
  <h4>Sexo</h4>
  <div class="genderChoices" id="soulseekGenderChoices">
   <button type="button" class="genderChoice selected" data-soulseek-gender="male"><canvas width="64" height="64"></canvas><b>Masculino</b><span>♂</span></button>
   <button type="button" class="genderChoice" data-soulseek-gender="female"><canvas width="64" height="64"></canvas><b>Femenino</b><span>♀</span></button>
  </div>
  <h4>Nombre</h4>
  <label>Nombre <input id="soulseekNameInput" maxlength="16" placeholder="Nombre de tu personaje" autocomplete="off"></label>
  <div class="soulseekActions">
   <button class="start" id="soulseekCreateBtn">CREAR PERSONAJE</button>
   <button class="backToLanding" id="soulseekCreateBackBtn">VOLVER</button>
  </div>
 </div>
</div>

<div class="statPointModal" id="soulseekClassModal">
 <div class="statPointBox" style="width:min(760px,100%)">
  <h2>ELIGE TU CLASE AVANZADA</h2>
  <p class="small">Nivel 2 alcanzado. Elige una clase avanzada: se aplicará de inmediato y luego elegirás tu primera habilidad de esa clase.</p>
  <div class="skillChoiceGrid" id="soulseekClassGrid"></div>
 </div>
</div>

<div class="statPointModal" id="soulseekDeathModal">
 <div class="statPointBox soulseekDeathBox">
  <h2>TU PERSONAJE HA CAÍDO</h2>
  <p class="small">Puedes gastar tus Soul Spikes para revivir como siempre, o dejar morir al personaje y guardar esas Soul Spikes para siempre en tu cuenta.</p>
  <div id="soulseekDeathSouls" class="soulReviveCount"></div>
  <div class="startActions">
   <button class="start" id="soulseekDeathReviveBtn">REVIVIR (gasta Soul Spikes)</button>
   <button id="soulseekDeathBankBtn">DEJAR MORIR Y GUARDAR SOUL SPIKES</button>
  </div>
 </div>
</div>`;
 while(wrap.firstElementChild)document.body.appendChild(wrap.firstElementChild);
}

// ============================================================================
// Menu navigation
// ============================================================================
function openSoulseekerMenu(){
 soulseekEnsureDom();
 fetchConfigWorldObjectDetail('soul_spike').catch(()=>{});
 fetchConfigWorldObjectDetail('pj_classless').catch(()=>{});
 landingOverlay.classList.add('hidden');
 document.getElementById('soulseekOverlay').classList.remove('hidden');
 document.getElementById('soulseekMenuHeader').innerHTML=soulseekHeaderHtml();
 setTimeout(soulseekDrawMiniIcons,0);
}
function closeSoulseekerMenu(){
 document.getElementById('soulseekOverlay').classList.add('hidden');
 landingOverlay.classList.remove('hidden');
}
async function openSoulseekerScores(){
 document.getElementById('soulseekOverlay').classList.add('hidden');
 const screen=document.getElementById('soulseekScoresScreen');
 screen.classList.remove('hidden');
 const status=document.getElementById('soulseekScoresStatus'),table=document.getElementById('soulseekScoresTable');
 status.textContent='Cargando puntuaciones...';table.innerHTML='';
 try{
  const r=await fetch('/api/user-pj?soulseeker=1');const data=await r.json();
  if(!r.ok)throw new Error(data.error||'No se pudieron cargar las puntuaciones');
  if(!data.length){status.textContent='Todavía no hay personajes Soulseeker.';return}
  status.textContent=`${data.length} personaje(s).`;
  table.innerHTML=`<table class="scoresGrid"><thead><tr><th>#</th><th>Personaje</th><th>Usuario</th><th>Estado</th><th>Clase</th><th>Raza</th><th>Nivel</th><th>Élites</th><th>Jefes</th><th>Megaboss</th><th>Dungeons</th><th>Score</th><th>Último uso</th></tr></thead><tbody>${data.map((c,i)=>{const f=normalizeFeats(c.feats);return `<tr class="${c.pj_status==='dead'?'deadRow':''}"><td>${i+1}</td><td>${c.pj_name||'-'}</td><td>${c.nombre||'-'}</td><td>${c.pj_status==='dead'?'Muerto':'Vivo'}</td><td>${c.class_name||'Sin clase'}</td><td>${c.race_name||'-'}</td><td>${c.level||1}</td><td>${f.elites}</td><td>${f.bosses}</td><td>${f.megabosses}</td><td>${f.dungeons}</td><td>${Math.round(c.pj_score||0)}</td><td>${c.last_use?new Date(c.last_use).toLocaleString():'-'}</td></tr>`}).join('')}</tbody></table>`;
 }catch(e){status.textContent=`Error: ${e.message}`}
}
function closeSoulseekerScores(){
 document.getElementById('soulseekScoresScreen').classList.add('hidden');
 openSoulseekerMenu();
}
function openSoulseekerUnlocks(){
 document.getElementById('soulseekOverlay').classList.add('hidden');
 document.getElementById('soulseekUnlocksOverlay').classList.remove('hidden');
 document.getElementById('soulseekUnlocksHeader').innerHTML=soulseekHeaderHtml();
 setTimeout(soulseekDrawMiniIcons,0);
}
function closeSoulseekerUnlocks(){
 document.getElementById('soulseekUnlocksOverlay').classList.add('hidden');
 openSoulseekerMenu();
}
async function openSoulseekerNewCharacter(){
 document.getElementById('soulseekOverlay').classList.add('hidden');
 document.getElementById('soulseekCreateOverlay').classList.remove('hidden');
 document.getElementById('soulseekNameInput').value='';
 if(!configRacesLoaded)await fetchConfigRaces();
 renderSoulseekRaceChoices();
 renderSoulseekGenderChoices();
}
function closeSoulseekerNewCharacter(){
 document.getElementById('soulseekCreateOverlay').classList.add('hidden');
 openSoulseekerMenu();
}

// ============================================================================
// Character creation - race + sexo + nombre only, every race unlocked.
// Mirrors start() (game.js) but with no class: baseline stats match the
// same {2,2,2,2,2,2} fallback resolveClassDef() already uses for a class
// with no configured stats, advanced skill mode + Puntos de Acción by
// default, and soulseeker:true so the rest of the game (death, level-2
// class pick) knows to treat this run differently.
// ============================================================================
function renderSoulseekGenderChoices(){
 document.querySelectorAll('[data-soulseek-gender]').forEach(button=>{
  const gender=button.dataset.soulseekGender;
  button.classList.toggle('selected',gender===soulseekSelectedGender);
  const canvas=button.querySelector('canvas'),icon=soulseekSelectedRace?raceIconForId(soulseekSelectedRace,gender):'';
  if(icon)drawSkillIconImg(canvas,icon);else canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
 });
}
function renderSoulseekRaceChoices(){
 const root=document.getElementById('soulseekRaceChoices');if(!root)return;
 const raceIds=Object.keys(raceDefs);
 if(!raceIds.length){root.innerHTML=`<p class="small">${configRacesLoaded?'No hay razas configuradas. Crea al menos una en Configuración → Razas.':'Cargando razas configuradas desde la base de datos...'}</p>`;return}
 if(!raceIds.includes(soulseekSelectedRace))soulseekSelectedRace=raceIds[0];
 root.innerHTML=raceIds.map(id=>{
  const r=raceDefs[id],icon=raceIconForId(id);
  return `<div class="choice ${id===soulseekSelectedRace?'selected':''}" data-soulseek-race="${id}">${icon?`<canvas class="raceChoiceIcon" width="42" height="42" data-soulseek-race-icon="${id}"></canvas>`:''}<div class="choiceBody"><b>${r.name}</b><p class="small">${r.desc}</p><span class="raceTag">${r.origin}</span><p class="small"><strong>Rasgo:</strong> ${r.trait}</p></div></div>`;
 }).join('');
 root.querySelectorAll('[data-soulseek-race-icon]').forEach(c=>drawSkillIconImg(c,raceIconForId(c.dataset.soulseekRaceIcon)));
 root.querySelectorAll('[data-soulseek-race]').forEach(el=>el.onclick=()=>{soulseekSelectedRace=el.dataset.soulseekRace;renderSoulseekRaceChoices();renderSoulseekGenderChoices()});
}

async function soulseekStartCharacter(){
 const nameInput=document.getElementById('soulseekNameInput'),name=(nameInput?.value||'').trim();
 if(!name){alert('Escribe un nombre para tu personaje.');return}
 if(!configRacesLoaded)await fetchConfigRaces();
 if(!soulseekSelectedRace||!raceDefs[soulseekSelectedRace]){alert('Selecciona una raza antes de crear el personaje.');return}
 await ensureConfigItemsHydrated();
 if(!configClasses.length)await fetchConfigClasses();
 const race=soulseekSelectedRace;
 const stats={strength:2,vitality:2,agility:2,luck:2,intelligence:2,wisdom:2};
 const maxHp=30+stats.vitality*6,maxStamina=45+stats.strength*4,maxMana=30+stats.wisdom*5+stats.intelligence*3;
 const equipment=Object.fromEntries(slots.map(s=>[s,null]));equipment.weapon=makeStarterWeapon(null);
 game={floor:1,themeIndex:0,turn:0,dungeonWorldId:selectedDungeonWorld?.id||null,dungeonWorldName:selectedDungeonWorld?.world_name||null,worldParams:normalizeWorldParams(selectedDungeonWorld?.world_json?.params),inventory:[],achievements:{},feats:normalizeFeats(),bossesKilled:0,chestsOpened:0,player:{name,race,gender:soulseekSelectedGender,raceIcon:raceIconForId(race,soulseekSelectedGender),cls:null,className:'Sin clase',classIcon:configWorldObjects.pj_classless||'',skillMode:'advanced',combatMode:'ap',soulseeker:true,level:1,xp:0,nextXp:xpNeededForLevel(1),hp:maxHp,maxHp,stamina:maxStamina,maxStamina,mana:maxMana,maxMana,baseDamage:2+stats.strength,baseArmor:4+Math.floor(stats.vitality/2),gold:0,keys:0,vision:4+Math.floor((stats.intelligence||0)/4),shield:0,stats,equipment,knownSkills:[],skillProgress:{},skillChoicesAwarded:{},equippedSkills:[null,null,null,null],cooldowns:{},equipmentCooldowns:{},debuff:0,shards:{},souls:0}};
 const rb=raceDefs[race]?.bonuses||{};
 game.player.raceName=raceDefs[race]?.name||race;
 game.player.raceBonuses={...rb};
 const racialSkill=raceDefs[race]?.skill;
 if(racialSkill){skillDefs[racialSkill.id]=racialSkill;game.player.knownSkills.unshift(racialSkill.id);game.player.skillProgress[racialSkill.id]={level:1,xp:0};game.player.equippedSkills[0]=racialSkill.id}
 if(rb.armor)game.player.baseArmor+=rb.armor;
 addStarterPotions(null);
 syncAllEquipmentPassives();recomputeDerived();
 await soulseekFinishCharacterCreation();
}
async function soulseekFinishCharacterCreation(){
 const bundle={player:game.player,inventory:game.inventory||[],achievements:game.achievements||{},feats:normalizeFeats(),bossesKilled:0,chestsOpened:0,maxFloorReached:1};
 const score=computeScore(bundle);
 try{
  const r=await fetch('/api/user-pj',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:window.currentUser.nombre,pj_name:bundle.player.name,pj_json:bundle,feats:bundle.feats,pj_status:'alive',pj_score:score,souls:game.player.souls||0,soulseeker:true,last_use:new Date().toISOString()})});
  const data=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(data?.error||data?.message||data?.details||data?.hint||`HTTP ${r.status}${r.statusText?' '+r.statusText:''}`);
  alert(`Personaje "${bundle.player.name}" creado y guardado correctamente. Bienvenido al Soulseek Mode.`);
  refreshCurrentUserProgress();
 }catch(e){
  console.error('No se pudo guardar el personaje Soulseeker:',e);
  alert('Error al guardar el personaje: '+e.message);
 }
 game=null;
 document.getElementById('soulseekCreateOverlay')?.classList.add('hidden');
 openSinglePlayerScreen();
}

// ============================================================================
// Level-2 advanced-class unlock. Hooked from classSkillConsistencyGuard
// (called once per turn end in game.js), so it fires reliably without
// depending on level-up animation timing and never collides with the stat
// point / skill choice modals already in use.
// ============================================================================
function soulseekAdvancedClassIds(){
 let ids=classIdsForSkillMode('advanced');
 if(!ids.length)ids=Object.keys(classDefs);
 return ids;
}
function soulseekCheckClassUnlock(){
 if(!game?.player?.soulseeker||game.player.cls||game.player.level<2)return;
 if(soulseekClassPickerOpen)return;
 if(document.getElementById('statPointModal')?.classList.contains('open'))return;
 if(document.getElementById('skillChoiceModal')?.classList.contains('open'))return;
 openSoulseekerClassPicker();
}
function openSoulseekerClassPicker(){
 soulseekEnsureDom();
 soulseekClassPickerOpen=true;
 const modal=document.getElementById('soulseekClassModal'),grid=document.getElementById('soulseekClassGrid');
 const ids=soulseekAdvancedClassIds().filter(id=>resolveClassDef(id));
 grid.innerHTML=ids.map(id=>{
  const cls=resolveClassDef(id);
  return `<button type="button" class="skillChoiceCard" data-soulseek-class="${id}"><b>${cls.name}</b><p>${cls.desc}</p></button>`;
 }).join('');
 modal.classList.add('open');
 grid.querySelectorAll('[data-soulseek-class]').forEach(btn=>btn.addEventListener('click',()=>{
  const id=btn.dataset.soulseekClass,cls=resolveClassDef(id);
  if(!cls)return;
  if(!confirm(`¿Confirmas que quieres convertirte en ${cls.name}?`))return;
  const p=game.player;
  p.cls=id;p.className=cls.name;p.classIcon=classIconForId(id,p.gender)||configWorldObjects.pj_classless||'';
  // A classless Soulseek character always starts from the same flat
  // baseline (see soulseekStartCharacter) - swap it out for the class's own
  // configured stats now, as a delta on top of whatever the player already
  // has, so any stat point already spent since level 2 (strength/vitality/
  // etc picked via the normal level-up modal) isn't lost in the process.
  const SOULSEEK_CLASSLESS_BASELINE={strength:2,vitality:2,agility:2,luck:2,intelligence:2,wisdom:2};
  for(const stat of Object.keys(cls.stats||{})){
   const delta=(cls.stats[stat]||0)-(SOULSEEK_CLASSLESS_BASELINE[stat]||0);
   p.stats[stat]=(p.stats[stat]||0)+delta;
  }
  modal.classList.remove('open');
  banner(`CLASE: ${cls.name}`);
  log(`Te conviertes en ${cls.name}.`,'good');
  recomputeDerived();updateUI();draw();
  openSoulseekerSkillPicker();
 },{once:true}));
}
function openSoulseekerSkillPicker(){
 const choices=classSkillChoicesForTier(1);
 if(!choices.length){soulseekClassPickerOpen=false;soulseekPersistAfterClassChoice();return}
 const modal=document.getElementById('skillChoiceModal');
 document.getElementById('skillChoiceTitle').textContent='ELIGE TU PRIMERA HABILIDAD DE CLASE';
 document.getElementById('skillChoiceText').textContent=`${game.player.className} · nivel ${game.player.level}. Elige una habilidad del pool real de tu clase.`;
 const grid=document.getElementById('skillChoiceGrid');
 grid.innerHTML=choices.map(id=>{const s=skillDefs[id],roman=['','I','II','III'][s.tier]||s.tier;return `<button type="button" class="skillChoiceCard" data-soulseek-pick-skill="${id}"><b>${s.icon} ${s.name}</b><span class="tierBadge">TIER ${roman}</span><p>${s.desc}</p><span class="small">${s.cost} ${s.resource==='mana'?'maná':'stamina'} · CD ${s.cd} · Alcance ${s.range||0}</span></button>`}).join('');
 modal.classList.add('open');
 grid.querySelectorAll('[data-soulseek-pick-skill]').forEach(b=>b.addEventListener('click',()=>{
  const id=b.dataset.soulseekPickSkill,chosen=skillDefs[id];
  if(!confirm(`¿Confirmas que quieres aprender ${chosen?.name||'esta habilidad'}?`))return;
  learnSkill(id);
  game.player.skillChoicesAwarded[game.player.level]='chosen';
  modal.classList.remove('open');
  updateUI();draw();
  soulseekClassPickerOpen=false;
  soulseekPersistAfterClassChoice();
 },{once:true}));
}
function soulseekPersistAfterClassChoice(){
 if(!game?.pjId)return;
 const bundle=characterBundleFromGame();
 fetch(`/api/user-pj?id=${encodeURIComponent(game.pjId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pj_json:bundle,feats:bundle.feats,pj_score:computeScore(bundle),pj_name:game.player.name,last_use:new Date().toISOString()})})
  .then(()=>refreshCurrentUserProgress())
  .catch(e=>console.error('No se pudo guardar el personaje tras elegir clase',e));
}

// ============================================================================
// Death choice: revive with Soul Spikes (reuses the existing revive flow
// untouched) or let the character die and bank its Soul Spikes into the
// account's permanent balance (user.souls, separate from the per-character
// user_pj.souls stash the revive flow spends).
// ============================================================================
function soulseekHandleDeath(){
 soulseekEnsureDom();
 const automatic=configuredReviveSource();
 if(automatic){
  automatic.consume();
  if(automatic.effect.soulsCost){game.player.souls-=automatic.effect.soulsCost;persistSouls()}
  reviveAtCurrentPosition(automatic.effect.hpPercent||50);
  banner('REVIVIR');
  return;
 }
 soulseekShowDeathChoiceModal();
}
function soulseekShowDeathChoiceModal(){
 const modal=document.getElementById('soulseekDeathModal'),souls=Math.max(0,Number(game.player.souls)||0);
 const canRevive=souls>=20&&!game.multiplayer;
 document.getElementById('soulseekDeathSouls').innerHTML=`${soulseekSoulIconHtml()} <b>${souls}</b>`;
 const reviveBtn=document.getElementById('soulseekDeathReviveBtn');
 reviveBtn.disabled=!canRevive;
 reviveBtn.title=canRevive?'':'Necesitas al menos 20 Soul Spikes para revivir.';
 modal.classList.add('open');
 setTimeout(soulseekDrawMiniIcons,0);
 reviveBtn.onclick=()=>{
  if(!canRevive)return;
  modal.classList.remove('open');
  showSoulReviveModal();
 };
 document.getElementById('soulseekDeathBankBtn').onclick=()=>{
  modal.classList.remove('open');
  soulseekBankSoulsAndDie();
 };
}
async function soulseekBankSoulsAndDie(){
 const amount=Math.max(0,Number(game.player.souls)||0);
 try{
  const r=await fetch('/api/user',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:window.currentUser.nombre,soulsDelta:amount})});
  const data=await r.json().catch(()=>null);
  if(r.ok&&data)soulseekSetAccountSouls(data.souls);
 }catch(e){console.error('No se pudieron guardar las Soul Spikes en la cuenta',e)}
 game.player.souls=0;
 permanentDeath();
}

// ============================================================================
// Wiring: main-menu button + wrapping the three game.js hook points.
// Deferred to DOMContentLoaded-safe timing - game.js runs its own wiring as
// plain top-level statements while parsing, so by the time this script tag
// runs (after game.js in index.html) every element/function it touches
// already exists.
// ============================================================================
(function wireSoulseekMode(){
 soulseekEnsureDom();

 const mainMenuActions=document.getElementById('mainMenuActions');
 if(mainMenuActions&&!document.getElementById('menuSoulseekBtn')){
  const btn=document.createElement('button');
  btn.className='start';btn.id='menuSoulseekBtn';btn.type='button';btn.textContent='SOULSEEKER MODE';
  mainMenuActions.appendChild(btn);
  btn.onclick=openSoulseekerMenu;
 }

 document.getElementById('soulseekBackBtn').onclick=closeSoulseekerMenu;
 document.getElementById('soulseekScoresBtn').onclick=openSoulseekerScores;
 document.getElementById('soulseekScoresBackBtn').onclick=closeSoulseekerScores;
 document.getElementById('soulseekUnlocksBtn').onclick=openSoulseekerUnlocks;
 document.getElementById('soulseekUnlocksBackBtn').onclick=closeSoulseekerUnlocks;
 document.getElementById('soulseekNewCharBtn').onclick=openSoulseekerNewCharacter;
 document.getElementById('soulseekCreateBackBtn').onclick=closeSoulseekerNewCharacter;
 document.getElementById('soulseekCreateBtn').onclick=soulseekStartCharacter;
 document.querySelectorAll('[data-soulseek-gender]').forEach(button=>button.onclick=()=>{soulseekSelectedGender=button.dataset.soulseekGender;renderSoulseekGenderChoices();renderSoulseekRaceChoices()});

 if(typeof classSkillConsistencyGuard==='function'){
  const originalGuard=classSkillConsistencyGuard;
  classSkillConsistencyGuard=function(){originalGuard();soulseekCheckClassUnlock()};
 }
 if(typeof handlePlayerDeath==='function'){
  const originalDeath=handlePlayerDeath;
  handlePlayerDeath=function(){
   if(game?.player?.soulseeker){soulseekHandleDeath();return}
   originalDeath();
  };
 }
})();
