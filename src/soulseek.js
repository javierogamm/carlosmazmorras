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
  .soulseekLoadoutBox{width:min(760px,94vw);max-height:88vh;overflow:auto;display:flex;flex-direction:column}
  .soulseekLoadoutStatus{text-align:center;margin:2px 0 10px;color:#c9b8d0}
  .soulseekLoadoutGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:4px}
  .soulseekLoadoutCard{background:#1c1224;border:3px solid #4d395a;padding:12px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;color:#f4ead5;font-family:inherit;font-size:inherit;cursor:pointer}
  .soulseekLoadoutCard:hover{border-color:#ffc35a}
  .soulseekLoadoutCard.selected{border-color:#ffc35a;background:#3a2748}
  .soulseekLoadoutCard canvas{width:48px;height:48px}
  .soulseekLoadoutCard b{font-size:12px;color:#ffd68b}
  .soulseekLoadoutTypeGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-top:4px}
  .soulseekRaceDetailBox{width:min(560px,100%);max-height:92vh;overflow:auto}
  .soulseekRaceDetailHead{display:flex;align-items:center;gap:14px;margin-bottom:6px}
  .soulseekRaceDetailHead h2{margin:0;color:#ffd477}
  .soulseekRaceDetailHead canvas{width:84px;height:84px;background:#1c1224;border:2px solid #59406b;flex:0 0 auto}
  .soulseekRaceDetailStats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
  .soulseekRaceDetailStats span{display:flex;justify-content:space-between;gap:8px;background:#1c1224;border:1px solid #4d395a;padding:5px 8px;font-size:12px}
  .soulseekRaceDetailStats b{color:#8dffa8}
  .soulseekRaceDetailSkill{background:#1c1224;border:2px solid #59406b;padding:10px}
  .soulseekRaceDetailSkill b{display:block;color:#ffd68b}
  .soulseekRaceDetailSkill p{margin:6px 0 0}
  @media(max-width:600px){.soulseekRaceDetailStats{grid-template-columns:1fr}}
  .soulseekLoadoutTypeCard{background:#251a2f;border:2px solid #684b7c;padding:12px;text-align:center;color:#fff;font-family:inherit;font-size:inherit;cursor:pointer}
  .soulseekLoadoutTypeCard:hover,.soulseekLoadoutTypeCard.selected{border-color:#ffc35a;background:#3a2748}
  #soulseekLoadoutConfirmBtn:disabled{opacity:.5;cursor:not-allowed}
 `;
 document.head.appendChild(style);
})();

// -- one-time world-object catalog entry so the classless PJ icon is
// -- editable from Configuración > Objetos del mundo like any other icon.
// -- WORLD_OBJECT_KINDS/MAIN_MENU_SCREEN_IDS are declared `const` in game.js
// -- but that only freezes the binding, not the array contents.
if(typeof WORLD_OBJECT_KINDS!=='undefined'){
 if(!WORLD_OBJECT_KINDS.some(k=>k.key==='pj_classless_male'))WORLD_OBJECT_KINDS.push({key:'pj_classless_male',label:'Soulseek: PJ sin clase (masculino)'});
 if(!WORLD_OBJECT_KINDS.some(k=>k.key==='pj_classless_female'))WORLD_OBJECT_KINDS.push({key:'pj_classless_female',label:'Soulseek: PJ sin clase (femenino)'});
}
// gender-aware classless map/portrait icon - falls back to the legacy
// ungendered 'pj_classless' key (pre-existing installs) so an icon already
// configured before this split isn't silently lost.
function classlessIconForGender(gender){
 return configWorldObjects[gender==='female'?'pj_classless_female':'pj_classless_male']||configWorldObjects.pj_classless||'';
}
// Race-specific classless art is exclusive to Soulseek. World-object art
// remains the fallback for races that do not configure either map icon.
function soulseekClasslessMapIcon(raceId,gender){
 const race=raceDefs[raceId]||{};
 return (gender==='female'?race.mapIconFemale:race.mapIconMale)||classlessIconForGender(gender);
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

<!-- Three-step wizard (raza -> sexo -> nombre) instead of one long column.
     Everything used to be stacked on a single screen - race grid, sexo,
     dificultad (injected by soulseeker-dungeons.js after #soulseekGenderChoices)
     and nombre - which simply did not fit. Reuses the exact same
     .characterWizard / .wizardProgress / .wizardTrack / .wizardNav markup and
     CSS as the normal character creation: fixed modal height with the race
     grid scrolling inside its own step, so nothing ever overflows.
     Element ids are deliberately unchanged (#soulseekRaceChoices,
     #soulseekGenderChoices, #soulseekNameInput, #soulseekCreateBtn,
     #soulseekCreateBackBtn) - soulseeker-dungeons.js and soulseek_shop.js
     rebind those by id and inject the difficulty picker next to the gender
     choices, so they keep working untouched. -->
<div class="overlay hidden" id="soulseekCreateOverlay">
 <div class="modal characterWizard" data-gamepad-zone="soulseek-create">
  <h2>NUEVO PERSONAJE SOULSEEKER</h2>
  <div class="wizardProgress" id="soulseekWizardProgress" aria-label="Progreso de creación"></div>
  <div class="wizardViewport"><div class="wizardTrack" id="soulseekWizardTrack">
   <section class="wizardStep">
    <h3>1. Raza</h3>
    <p class="small">Empiezas sin clase (Advanced Classes + Puntos de Acción). Al llegar a nivel 2 elegirás tu clase avanzada. Todas las razas están desbloqueadas.</p>
    <div class="choices raceGrid" id="soulseekRaceChoices"></div>
   </section>
   <section class="wizardStep">
    <h3>2. Sexo</h3>
    <p class="small">Solo cambia el icono de tu personaje.</p>
    <div class="genderChoices" id="soulseekGenderChoices">
     <button type="button" class="genderChoice selected" data-soulseek-gender="male"><canvas width="64" height="64"></canvas><b>Masculino</b><span>♂</span></button>
     <button type="button" class="genderChoice" data-soulseek-gender="female"><canvas width="64" height="64"></canvas><b>Femenino</b><span>♀</span></button>
    </div>
   </section>
   <section class="wizardStep wizardNameStep">
    <h3>3. Nombre</h3>
    <p class="small">Revisa tu identidad y ponle un nombre antes de entrar en la mazmorra.</p>
    <div id="soulseekCharacterSummary" class="characterSummary"></div>
    <label>Nombre <input id="soulseekNameInput" maxlength="16" placeholder="Nombre de tu personaje" autocomplete="off"></label>
    <button class="start" id="soulseekCreateBtn">CREAR PERSONAJE</button>
   </section>
  </div></div>
  <div class="wizardNav">
   <button type="button" class="start" id="soulseekWizardBackBtn">← ATRÁS</button>
   <button type="button" class="start" id="soulseekWizardNextBtn">SIGUIENTE →</button>
  </div>
  <button class="backToLanding" id="soulseekCreateBackBtn">VOLVER AL MENÚ</button>
 </div>
</div>

<!-- Race detail, opened by clicking a race card in step 1 of the creation
     wizard. The cards themselves stay compact so the whole roster fits in the
     grid; this is where the full stats and the racial skill are readable.
     Icon canvas is 84px: race icons are stored at up to 128px (see the icon
     editor's maxSize), so anything much larger starts to look pixelated. -->
<div class="statPointModal" id="soulseekRaceDetailModal" data-gamepad-zone="soulseek-race-detail">
 <div class="statPointBox soulseekRaceDetailBox">
  <div class="soulseekRaceDetailHead">
   <canvas id="soulseekRaceDetailIcon" width="84" height="84"></canvas>
   <div><h2 id="soulseekRaceDetailName">RAZA</h2><span class="raceTag" id="soulseekRaceDetailOrigin"></span></div>
  </div>
  <p class="small" id="soulseekRaceDetailDesc"></p>
  <h4>Atributos</h4>
  <div id="soulseekRaceDetailStats" class="soulseekRaceDetailStats"></div>
  <h4>Habilidad racial</h4>
  <div id="soulseekRaceDetailSkill" class="soulseekRaceDetailSkill"></div>
  <div class="startActions">
   <button type="button" class="start" id="soulseekRaceDetailPickBtn">ELEGIR ESTA RAZA</button>
   <button type="button" id="soulseekRaceDetailCloseBtn" data-gamepad-cancel>CERRAR</button>
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
</div>

<div class="statPointModal" id="soulseekLoadoutModal">
 <div class="statPointBox soulseekLoadoutBox" data-gamepad-zone="soulseek-loadout">
  <h2 id="soulseekLoadoutTitle">ELIGE TU EQUIPO INICIAL</h2>
  <div id="soulseekLoadoutStatus" class="small soulseekLoadoutStatus"></div>
  <div id="soulseekLoadoutBody"></div>
  <div class="soulseekActions">
   <button class="start" id="soulseekLoadoutConfirmBtn" disabled>CONFIRMAR</button>
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
 fetchConfigWorldObjectDetail('pj_classless_male').catch(()=>{});
 fetchConfigWorldObjectDetail('pj_classless_female').catch(()=>{});
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
  table.innerHTML=`<table class="scoresGrid"><thead><tr><th>#</th><th>Personaje</th><th>Usuario</th><th>Estado</th><th>Clase</th><th>Raza</th><th>Nivel</th><th>Élites</th><th>Jefes</th><th>Megaboss</th><th>Pisos terminados</th><th>Score</th><th>Último uso</th></tr></thead><tbody>${data.map((c,i)=>{const f=normalizeFeats(c.feats),completedFloors=Math.max(0,(Number(c.max_floor_reached)||1)-1);return `<tr class="${c.pj_status==='dead'?'deadRow':''}"><td>${i+1}</td><td>${c.pj_name||'-'}</td><td>${c.nombre||'-'}</td><td>${c.pj_status==='dead'?'Muerto':'Vivo'}</td><td>${c.class_name||'Sin clase'}</td><td>${c.race_name||'-'}</td><td>${c.level||1}</td><td>${f.elites}</td><td>${f.bosses}</td><td>${f.megabosses}</td><td>${completedFloors}</td><td>${Math.round(c.pj_score||0)}</td><td>${c.last_use?new Date(c.last_use).toLocaleString():'-'}</td></tr>`}).join('')}</tbody></table>`;
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
 setSoulseekWizardStep(0);
 if(!configRacesLoaded)await fetchConfigRaces();
 renderSoulseekRaceChoices();
 renderSoulseekGenderChoices();
 // Again now that the race cards exist: the first call ran against an empty
 // grid, so with a pad the focus ring would have landed on the progress tab
 // instead of on a race.
 setSoulseekWizardStep(0);
}
// ---- Three-step creation wizard (raza -> sexo -> nombre) --------------------
// Same driver as game.js's setWizardStep(): the track slides by whole steps
// and every panel that is not the active one is marked `inert`, which is what
// keeps both keyboard tabbing and the gamepad's focus walk out of the steps
// that are scrolled off-screen (see navigableElements() in joystick.js).
let soulseekWizardStep=0;
const SOULSEEK_WIZARD_LABELS=['1 · RAZA','2 · SEXO','3 · NOMBRE'];
function renderSoulseekCharacterSummary(){
 const root=document.getElementById('soulseekCharacterSummary');if(!root)return;
 const race=raceDefs[soulseekSelectedRace];
 root.innerHTML=`<canvas width="96" height="96"></canvas><b>${race?.name||'Sin raza'}</b><span>Sin clase · ${soulseekSelectedGender==='female'?'Femenino':'Masculino'}</span><small>Advanced Classes · Puntos de Acción</small>`;
 const icon=soulseekSelectedRace?raceIconForId(soulseekSelectedRace,soulseekSelectedGender):'';
 if(icon)drawSkillIconImg(root.querySelector('canvas'),icon);
}
function setSoulseekWizardStep(step){
 soulseekWizardStep=Math.max(0,Math.min(2,Number(step)||0));
 const track=document.getElementById('soulseekWizardTrack');if(!track)return;
 track.style.transform=`translateX(-${soulseekWizardStep*100}%)`;
 [...track.querySelectorAll('.wizardStep')].forEach((panel,i)=>{panel.toggleAttribute('inert',i!==soulseekWizardStep);panel.setAttribute('aria-hidden',i===soulseekWizardStep?'false':'true')});
 const progress=document.getElementById('soulseekWizardProgress');
 if(progress){
  progress.innerHTML=SOULSEEK_WIZARD_LABELS.map((label,i)=>`<button type="button" data-soulseek-wizard-step="${i}" class="${i===soulseekWizardStep?'active':i<soulseekWizardStep?'done':''}" ${i>soulseekWizardStep?'disabled':''}>${label}</button>`).join('');
  progress.querySelectorAll('[data-soulseek-wizard-step]').forEach(b=>b.onclick=()=>setSoulseekWizardStep(b.dataset.soulseekWizardStep));
 }
 // Step 1's "back" leaves the wizard: .backToLanding is position:fixed, and
 // the pad's focus walk skips fixed elements (offsetParent is null), so this
 // is the only reachable way out with a controller.
 const backBtn=document.getElementById('soulseekWizardBackBtn');
 backBtn.disabled=false;
 backBtn.textContent=soulseekWizardStep===0?'← VOLVER AL MENÚ':'← ATRÁS';
 document.getElementById('soulseekWizardNextBtn').classList.toggle('hidden',soulseekWizardStep===2);
 if(soulseekWizardStep===1)renderSoulseekGenderChoices();
 if(soulseekWizardStep===2){renderSoulseekCharacterSummary();setTimeout(()=>document.getElementById('soulseekNameInput')?.focus(),380)}
 // With a pad connected, drop the focus ring on the new step's first control:
 // otherwise it stays on SIGUIENTE (which is not destroyed by the step change,
 // so joystick.js has no reason to move it) and the player would start each
 // step already past its own choices. No-op for mouse and keyboard.
 const panel=track.querySelectorAll('.wizardStep')[soulseekWizardStep];
 const entry=panel?.querySelector('button:not([disabled]),input:not([disabled]),[data-soulseek-race]');
 track.querySelectorAll('[data-gamepad-autofocus]').forEach(el=>el.removeAttribute('data-gamepad-autofocus'));
 if(entry)entry.setAttribute('data-gamepad-autofocus','');
 if(typeof gamepadConnected!=='undefined'&&gamepadConnected&&typeof focusGamepadElement==='function'&&entry)setTimeout(()=>focusGamepadElement(entry),0);
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
 root.querySelectorAll('[data-soulseek-race]').forEach(el=>el.onclick=()=>openSoulseekRaceDetail(el.dataset.soulseekRace));
}
// Clicking a race card opens its full sheet (bigger icon, every stat bonus and
// the racial skill) instead of just selecting it silently: the cards in the
// grid stay compact so the whole roster fits, and this is where the detail
// that actually drives the choice lives.
function openSoulseekRaceDetail(id){
 const race=raceDefs[id];if(!race)return;
 const modal=document.getElementById('soulseekRaceDetailModal');if(!modal)return;
 document.getElementById('soulseekRaceDetailName').textContent=race.name||id;
 document.getElementById('soulseekRaceDetailOrigin').textContent=race.origin||'Raza configurable';
 document.getElementById('soulseekRaceDetailDesc').textContent=race.desc||'Sin descripción.';
 const stats=document.getElementById('soulseekRaceDetailStats'),bonuses=Object.entries(race.bonuses||{});
 stats.innerHTML=bonuses.length?bonuses.map(([k,v])=>`<span>${RACE_STAT_FIELDS[k]||k} <b>${v>0?'+':''}${v}</b></span>`).join(''):'<span>Sin bonificadores <b>—</b></span>';
 const skill=race.skill,skillRoot=document.getElementById('soulseekRaceDetailSkill');
 skillRoot.innerHTML=skill?`<b>${skill.icon||'✦'} ${skill.name||skill.id}</b><p class="small">${skill.desc||'Sin descripción.'}</p><p class="small">${skill.cost??0} ${skill.resource==='mana'?'maná':'stamina'} · CD ${skill.cd??0} · Alcance ${skill.range||0}</p>`:'<p class="small">Esta raza no aporta habilidad racial.</p>';
 const canvas=document.getElementById('soulseekRaceDetailIcon'),icon=raceIconForId(id,soulseekSelectedGender);
 if(icon)drawSkillIconImg(canvas,icon);else canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
 document.getElementById('soulseekRaceDetailPickBtn').onclick=()=>{
  soulseekSelectedRace=id;
  modal.classList.remove('open');
  renderSoulseekRaceChoices();renderSoulseekGenderChoices();renderSoulseekCharacterSummary();
 };
 document.getElementById('soulseekRaceDetailCloseBtn').onclick=()=>modal.classList.remove('open');
 modal.classList.add('open');
}

async function soulseekStartCharacter(){
 const nameInput=document.getElementById('soulseekNameInput'),typedName=(nameInput?.value||'').trim();
 // A blank name is allowed: the character is saved as "PJ Nº<id>" once
 // Supabase assigns the row's id (see soulseekFinishCharacterCreation),
 // since the id doesn't exist yet at creation time.
 const name=typedName||'Aventurero sin nombre';
 if(!configRacesLoaded)await fetchConfigRaces();
 if(!soulseekSelectedRace||!raceDefs[soulseekSelectedRace]){uiAlert('Selecciona una raza antes de crear el personaje.');return}
 await ensureConfigItemsHydrated();
 if(!configClasses.length)await fetchConfigClasses();
 const race=soulseekSelectedRace;
 const stats={strength:2,vitality:2,agility:2,luck:2,intelligence:2,wisdom:2};
 const maxHp=30+stats.vitality*6,maxStamina=45+stats.strength*4,maxMana=30+stats.wisdom*5+stats.intelligence*3;
 const equipment=Object.fromEntries(slots.map(s=>[s,null]));
 game={floor:1,themeIndex:0,turn:0,dungeonWorldId:selectedDungeonWorld?.id||null,dungeonWorldName:selectedDungeonWorld?.world_name||null,worldParams:normalizeWorldParams(selectedDungeonWorld?.world_json?.params),inventory:[],achievements:{},feats:normalizeFeats(),bossesKilled:0,chestsOpened:0,player:{name,autoNamed:!typedName,race,gender:soulseekSelectedGender,raceIcon:raceIconForId(race,soulseekSelectedGender),cls:null,className:'Sin clase',classIcon:soulseekClasslessMapIcon(race,soulseekSelectedGender),skillMode:'advanced',combatMode:'ap',soulseeker:true,level:1,xp:0,nextXp:xpNeededForLevel(1),hp:maxHp,maxHp,stamina:maxStamina,maxStamina,mana:maxMana,maxMana,baseDamage:2+stats.strength,baseArmor:4+Math.floor(stats.vitality/2),gold:0,keys:0,vision:4+Math.floor((stats.intelligence||0)/4),shield:0,stats,equipment,knownSkills:[],skillProgress:{},skillChoicesAwarded:{},equippedSkills:[null,null,null,null],cooldowns:{},equipmentCooldowns:{},debuff:0,shards:{},souls:0}};
 const rb=raceDefs[race]?.bonuses||{};
 game.player.raceName=raceDefs[race]?.name||race;
 game.player.raceBonuses={...rb};
 const racialSkill=raceDefs[race]?.skill;
 if(racialSkill){skillDefs[racialSkill.id]=racialSkill;game.player.knownSkills.unshift(racialSkill.id);game.player.skillProgress[racialSkill.id]={level:1,xp:0};game.player.equippedSkills[0]=racialSkill.id}
 if(rb.armor)game.player.baseArmor+=rb.armor;
 // Materialize racial stats and resource maxima before floor 1. Previously
 // they were only derived during floor generation, after the current HP,
 // stamina and mana had already been created from the flat baseline.
 recomputeDerived();
 game.player.hp=game.player.maxHp;
 game.player.stamina=game.player.maxStamina;
 game.player.mana=game.player.maxMana;
 // Always ask. Entering floor 1 must go through the loadout wizard, no
 // matter what the catalogue holds - it used to be skipped silently unless
 // there were BOTH common weapons and common potions configured, which is
 // how a run could start with nothing chosen at all. The wizard itself
 // handles an empty catalogue (see renderSoulseekLoadoutStep) and
 // soulseekFinalizeLoadout still falls back to the automatic starter gear
 // for anything that was not picked.
 await openSoulseekerLoadoutModal();
}
// ============================================================================
// Starting loadout picker - a small wizard, one question at a time so it
// always fits on screen instead of one giant multi-select grid:
//   1) weapon TYPE (the shop's own SOULSEEK_WEAPON_TYPE_GROUPS buckets)
//   2) one common weapon of that type -> confirm
//   3) one common potion -> confirm, repeated 4 times (any mix of types)
// Then the character is saved and the run starts. Reuses the same
// config_items catalog addStarterPotions()/makeStarterWeapon() draw from.
// Only shown when the catalog actually has common potions and weapons
// configured; falls back to the old automatic pick otherwise (see
// soulseekStartCharacter above).
// ============================================================================
let soulseekLoadoutStep='weaponType';
let soulseekLoadoutWeaponType=null;
let soulseekLoadoutWeaponPickId=null;
let soulseekLoadoutArmorPickId=null;
let soulseekLoadoutHelmetPickId=null;
let soulseekLoadoutRingPickId=null;
let soulseekLoadoutNecklacePickId=null;
let soulseekLoadoutPotionPickId=null;
let soulseekLoadoutChosenPotions=[];
// Ordered list of picker steps between weaponPick and the potion phase,
// built fresh each time the wizard opens (soulseekResetLoadoutSteps) from
// whichever starter packs the account owns - see soulseekArmorUnlocked/
// soulseekRingRarityCap/soulseekNecklaceRarityCap above.
let soulseekLoadoutStepOrder=['weaponPick'];
// ---- Catalogue the wizard lists from ---------------------------------------
// In Soulseek mode the ONLY thing that ever loads config_items is
// ensureConfigItemsHydrated() in soulseekStartCharacter, and that asks for
// the FULL catalogue - every configured object with its item_json, which
// carries each item's embedded icon. On a big catalogue that payload is
// enormous, and when the request fails or times out fetchConfigItems()
// swallows the error into #configStatus (a field that is not even on screen
// here), leaving configItems empty with nothing to show for it. That is how
// a catalogue full of weapons could end up reported as "no hay armas ni
// pociones".
//
// So the wizard no longer depends on that full fetch succeeding: if
// configItems is empty it falls back to the LIGHT listing
// (id/nombre/slot/tier/weapontype/type - small, and everything the picker
// needs), kept in its own array so the rest of the game still sees an empty
// configItems and behaves exactly as it does today. Only the rows actually
// CHOSEN get hydrated, one id at a time.
let soulseekLoadoutLightRows=null;
let soulseekLoadoutCatalogError='';
function soulseekLoadoutCatalogRows(){return configItems.length?configItems:(soulseekLoadoutLightRows||[])}
async function soulseekEnsureLoadoutCatalog(){
 soulseekLoadoutCatalogError='';
 if(soulseekLoadoutCatalogRows().length)return true;
 try{
  const r=await fetch('/api/config-items?light=1');
  const data=await r.json();
  if(!r.ok)throw new Error(data?.error||data?.message||`HTTP ${r.status}`);
  soulseekLoadoutLightRows=Array.isArray(data)?data:[];
 }catch(e){soulseekLoadoutLightRows=[];soulseekLoadoutCatalogError=e.message||'error desconocido'}
 return soulseekLoadoutCatalogRows().length>0;
}
// Full row for one id. A light row has no item_json, and building an item
// from it would silently produce a stripped-down weapon (no dice, no affixes,
// no icon), so the chosen rows are always hydrated before use.
async function soulseekHydrateItemRow(row){
 if(!row||row.item_json)return row||null;
 try{
  const r=await fetch(`/api/config-items?id=${encodeURIComponent(row.id)}`);
  const detail=await r.json();
  if(!r.ok||!detail||!detail.item_json)return null;
  return detail;
 }catch(e){return null}
}

// The starting loadout is ALWAYS offered, so these pools must never come back
// empty just because the catalogue happens to have nothing at 'common'.
// They prefer common and only walk up the rarity ladder when that rarity has
// nothing configured - previously they filtered hard on 'common', and an
// empty result silently skipped the whole wizard and dropped the player
// straight into floor 1 with the automatic starter gear.
const SOULSEEK_LOADOUT_RARITIES=['common','uncommon','rare','epic','legendary','artifact'];
function soulseekRowRarity(row){const it=row.item_json||row;return it.rarity||row.tier||'common'}
// Light rows spell it `weapontype` (Postgres column), hydrated ones
// `item_json.weaponType` - the picker must group both the same way.
function soulseekRowWeaponType(row){const it=row.item_json||row;return it.weaponType||it.weaponCategory||row.weapontype||''}
function soulseekLowestRarityRows(rows){
 for(const rarity of SOULSEEK_LOADOUT_RARITIES){
  const match=rows.filter(r=>soulseekRowRarity(r)===rarity);
  if(match.length)return match;
 }
 return rows;
}
function soulseekCommonPotionRows(){return soulseekLowestRarityRows(soulseekLoadoutCatalogRows().filter(isConfiguredPotionRow))}
// Like soulseekLowestRarityRows but bounded above by capRarity - used by the
// weapon/ring/necklace pickers once a starter pack has raised their rarity
// cap, so the wizard never offers something the player hasn't unlocked.
function soulseekRarityCappedRows(rows,capRarity){
 const capIdx=SOULSEEK_LOADOUT_RARITIES.indexOf(capRarity);
 for(let i=capIdx;i>=0;i--){
  const match=rows.filter(r=>soulseekRowRarity(r)===SOULSEEK_LOADOUT_RARITIES[i]);
  if(match.length)return match;
 }
 return soulseekLowestRarityRows(rows);
}
function soulseekCommonWeaponRows(){return soulseekRarityCappedRows(soulseekLoadoutCatalogRows().filter(r=>((r.item_json||r).slot||r.slot)==='weapon'),soulseekWeaponRarityCap())}
// v1.1 shop unlocks: armor+helmet (common only, unlocked - not upgraded - by
// the Común Starter pack) and ring/necklace (unlocked by the Común Advanced/
// Expert packs, rarity-capped by their higher-rarity counterparts).
function soulseekArmorRows(){return soulseekLowestRarityRows(soulseekLoadoutCatalogRows().filter(r=>((r.item_json||r).slot||r.slot)==='chest'))}
function soulseekHelmetRows(){return soulseekLowestRarityRows(soulseekLoadoutCatalogRows().filter(r=>((r.item_json||r).slot||r.slot)==='head'))}
function soulseekRingRows(){const cap=soulseekRingRarityCap();return cap?soulseekRarityCappedRows(soulseekLoadoutCatalogRows().filter(r=>{const s=(r.item_json||r).slot||r.slot;return s==='ring1'||s==='ring2'}),cap):[]}
function soulseekNecklaceRows(){const cap=soulseekNecklaceRarityCap();return cap?soulseekRarityCappedRows(soulseekLoadoutCatalogRows().filter(r=>((r.item_json||r).slot||r.slot)==='neck'),cap):[]}

// ============================================================================
// Starter pack unlocks (v1.1) - permanent account-level unlocks bought in the
// shop (soulseek_shop.js), stored as user.soulseek_starter_packs: an array of
// "<rarity>_<tier>" ids (tier 1=Starter/2=Advanced/3=Expert). Four rarity rows
// (common/uncommon/rare/epic), three tiers each. A cell requires the cell to
// its left in the same row (tier-1) AND the same tier one rarity below (the
// "equivalent" pack in the previous row) - see soulseekStarterPackPrereqOk,
// used by the buy UI in soulseek_shop.js.
// Effects applied at loadout time (see the row-fetch functions above):
//  - tier 1 (Starter): common unlocks a NEW armor+helmet pick; uncommon/rare/
//    epic instead raise the WEAPON pick's rarity cap (the weapon slot is
//    already offered for free at common - there's nothing to "unlock" there).
//  - tier 2 (Advanced): common unlocks a NEW ring pick; uncommon/rare/epic
//    raise that ring pick's rarity cap.
//  - tier 3 (Expert): common unlocks a NEW necklace pick; uncommon/rare/epic
//    raise that necklace pick's rarity cap.
// ============================================================================
const SOULSEEK_STARTER_PACK_RARITIES=['common','uncommon','rare','epic'];
const SOULSEEK_STARTER_PACK_COSTS={common:[50,100,150],uncommon:[200,250,300],rare:[350,400,450],epic:[500,550,600]};
// No dedicated column: a new soulseek_starter_packs column would need a
// Supabase migration run in production first, and api/user.js referencing a
// column that doesn't exist there yet breaks the login SELECT for every
// account, not just this feature. Starter packs are piggybacked onto the
// already-existing soulseek_classes column instead, as extra array entries
// prefixed "pack:" - real class ids never start with that prefix, so they
// can never collide. soulseek_shop.js's soulseekUnlockedClasses()/
// soulseekBuyClass() filter these back out before treating the array as
// "which classes does this account own" (cost-by-count, the "own at least
// one class" gate, etc.) - see the comment there.
const SOULSEEK_STARTER_PACK_PREFIX='pack:';
function soulseekUnlockedStarterPacks(){
 const raw=Array.isArray(window.currentUser?.soulseek_classes)?window.currentUser.soulseek_classes:[];
 return raw.filter(id=>typeof id==='string'&&id.startsWith(SOULSEEK_STARTER_PACK_PREFIX)).map(id=>id.slice(SOULSEEK_STARTER_PACK_PREFIX.length));
}
function soulseekStarterPackId(rarity,tier){return `${rarity}_${tier}`}
function soulseekStarterPackOwned(rarity,tier){return soulseekUnlockedStarterPacks().includes(soulseekStarterPackId(rarity,tier))}
function soulseekStarterPackCost(rarity,tier){return SOULSEEK_STARTER_PACK_COSTS[rarity]?.[tier-1]??0}
function soulseekStarterPackPrereqOk(rarity,tier){
 if(tier>1&&!soulseekStarterPackOwned(rarity,tier-1))return false;
 const rIdx=SOULSEEK_STARTER_PACK_RARITIES.indexOf(rarity);
 if(rIdx>0&&!soulseekStarterPackOwned(SOULSEEK_STARTER_PACK_RARITIES[rIdx-1],tier))return false;
 return true;
}
function soulseekStarterPackBestOwnedRarity(tier,rarities){
 for(let i=rarities.length-1;i>=0;i--)if(soulseekStarterPackOwned(rarities[i],tier))return rarities[i];
 return null;
}
function soulseekWeaponRarityCap(){return soulseekStarterPackBestOwnedRarity(1,['uncommon','rare','epic'])||'common'}
function soulseekArmorUnlocked(){return soulseekStarterPackOwned('common',1)}
function soulseekRingRarityCap(){return soulseekStarterPackOwned('common',2)?(soulseekStarterPackBestOwnedRarity(2,['uncommon','rare','epic'])||'common'):null}
function soulseekNecklaceRarityCap(){return soulseekStarterPackOwned('common',3)?(soulseekStarterPackBestOwnedRarity(3,['uncommon','rare','epic'])||'common'):null}
// Weapons of the type picked in step 1 (or every weapon when the catalogue
// only has one group / none at all). Shared by the render and the confirm
// step so they can never disagree about whether there is anything to pick.
function soulseekLoadoutWeaponChoices(){
 const groupFor=typeof soulseekWeaponGroupFor==='function'?soulseekWeaponGroupFor:()=>'Armas';
 return soulseekCommonWeaponRows().filter(r=>!soulseekLoadoutWeaponType||groupFor(soulseekRowWeaponType(r))===soulseekLoadoutWeaponType);
}
function soulseekLoadoutWeaponGroups(){
 // typeof guard: soulseek_shop.js (which owns soulseekWeaponGroupFor) loads
 // after this file but before any of this runs (user interaction), so it's
 // always defined by the time the wizard actually opens - this guard only
 // covers a shop-less install missing that file entirely.
 const groupFor=typeof soulseekWeaponGroupFor==='function'?soulseekWeaponGroupFor:()=>'Armas';
 return [...new Set(soulseekCommonWeaponRows().map(r=>groupFor(soulseekRowWeaponType(r))))];
}
function soulseekResetLoadoutSteps(){
 soulseekLoadoutWeaponType=null;soulseekLoadoutWeaponPickId=null;soulseekLoadoutArmorPickId=null;soulseekLoadoutHelmetPickId=null;soulseekLoadoutRingPickId=null;soulseekLoadoutNecklacePickId=null;soulseekLoadoutPotionPickId=null;soulseekLoadoutChosenPotions=[];
 soulseekLoadoutStepOrder=['weaponPick'];
 if(soulseekArmorUnlocked())soulseekLoadoutStepOrder.push('armorPick','helmetPick');
 if(soulseekRingRarityCap())soulseekLoadoutStepOrder.push('ringPick');
 if(soulseekNecklaceRarityCap())soulseekLoadoutStepOrder.push('necklacePick');
 const groups=soulseekLoadoutWeaponGroups();
 if(groups.length<=1){soulseekLoadoutWeaponType=groups[0]||null;soulseekLoadoutStep='weaponPick'}
 else soulseekLoadoutStep='weaponType';
}
// Next step after `current` in soulseekLoadoutStepOrder, or 'potion' once the
// order is exhausted (potion is always last and repeats up to 4 times, so it
// isn't itself part of the order array).
function soulseekNextLoadoutStep(current){
 const idx=soulseekLoadoutStepOrder.indexOf(current);
 return (idx===-1||idx+1>=soulseekLoadoutStepOrder.length)?'potion':soulseekLoadoutStepOrder[idx+1];
}
async function openSoulseekerLoadoutModal(){
 soulseekEnsureDom();
 // Open first, then load: on a big catalogue the request takes a moment and
 // the player should see the wizard (and any failure) rather than a frozen
 // screen followed by a run that started without asking anything.
 soulseekLoadoutStep='loading';
 renderSoulseekLoadoutStep();
 document.getElementById('soulseekLoadoutModal').classList.add('open');
 await soulseekEnsureLoadoutCatalog();
 soulseekResetLoadoutSteps();
 renderSoulseekLoadoutStep();
}
function soulseekLoadoutCardHtml(row,fallbackName){
 const it=row.item_json||row,rarity=it.rarity||row.tier||'common',name=it.name||row.nombre||fallbackName;
 return `<button type="button" class="soulseekLoadoutCard" data-soulseek-pick="${row.id}"><canvas width="48" height="48" data-soulseek-loadout-icon="${row.id}"></canvas><b style="color:${tierDefs[rarity]?.color||'#ffd68b'}">${name}</b></button>`;
}
function soulseekWireLoadoutCardIcons(root,rows){
 root.querySelectorAll('[data-soulseek-loadout-icon]').forEach(c=>{
  const row=rows.find(r=>String(r.id)===c.dataset.soulseekLoadoutIcon),it=row&&(row.item_json||row);
  if(it)drawItemIcon(c,{icon:it.icon,rarity:it.rarity||'common'});
 });
}
function renderSoulseekLoadoutStep(){
 const title=document.getElementById('soulseekLoadoutTitle'),status=document.getElementById('soulseekLoadoutStatus'),body=document.getElementById('soulseekLoadoutBody'),confirmBtn=document.getElementById('soulseekLoadoutConfirmBtn');
 if(soulseekLoadoutStep==='loading'){
  title.textContent='PREPARANDO TU EQUIPO INICIAL';
  status.textContent='Cargando el catálogo de objetos configurados...';
  body.innerHTML='<p class="small">Un momento.</p>';
  confirmBtn.classList.add('hidden');
  return;
 }
 if(soulseekLoadoutCatalogError){
  // Never silently start a run because the catalogue could not be read: say
  // what failed, offer a retry, and let the player continue with the
  // automatic starter gear only if they choose to.
  title.textContent='NO SE PUDO CARGAR EL CATÁLOGO';
  status.textContent=`No se han podido leer los objetos configurados: ${soulseekLoadoutCatalogError}`;
  body.innerHTML='<div class="soulseekLoadoutTypeGrid"><button type="button" class="soulseekLoadoutTypeCard" data-soulseek-loadout-retry>REINTENTAR</button></div>';
  body.querySelector('[data-soulseek-loadout-retry]').onclick=async()=>{
   soulseekLoadoutLightRows=null;
   soulseekLoadoutStep='loading';renderSoulseekLoadoutStep();
   await soulseekEnsureLoadoutCatalog();
   soulseekResetLoadoutSteps();renderSoulseekLoadoutStep();
  };
  confirmBtn.classList.remove('hidden');
  confirmBtn.textContent='CONTINUAR CON EQUIPO AUTOMÁTICO';
  confirmBtn.disabled=false;
  return;
 }
 if(soulseekLoadoutStep==='weaponType'){
  const groups=soulseekLoadoutWeaponGroups();
  title.textContent='ELIGE EL TIPO DE ARMA';
  status.textContent='Selecciona con qué tipo de arma quieres empezar.';
  body.innerHTML=`<div class="soulseekLoadoutTypeGrid">${groups.map(g=>`<button type="button" class="soulseekLoadoutTypeCard" data-soulseek-weapon-type="${g}">${g}</button>`).join('')}</div>`;
  body.querySelectorAll('[data-soulseek-weapon-type]').forEach(btn=>btn.onclick=()=>{
   soulseekLoadoutWeaponType=btn.dataset.soulseekWeaponType;
   soulseekLoadoutStep='weaponPick';
   renderSoulseekLoadoutStep();
  });
  confirmBtn.classList.add('hidden');
  return;
 }
 if(soulseekLoadoutStep==='weaponPick'){
  const rows=soulseekLoadoutWeaponChoices();
  title.textContent='ELIGE TU ARMA';
  status.textContent=rows.length?`Tipo: ${soulseekLoadoutWeaponType||'Armas'}. Elige un arma y confirma.`:'No hay armas configuradas en el catálogo: empezarás con el arma inicial automática.';
  body.innerHTML=rows.length?`<div class="soulseekLoadoutGrid">${rows.map(row=>soulseekLoadoutCardHtml(row,'Arma')).join('')}</div>`:'<p class="small">Sin armas disponibles.</p>';
  soulseekWireLoadoutCardIcons(body,rows);
  body.querySelectorAll('[data-soulseek-pick]').forEach(card=>card.onclick=()=>{
   soulseekLoadoutWeaponPickId=card.dataset.soulseekPick;
   body.querySelectorAll('[data-soulseek-pick]').forEach(c=>c.classList.toggle('selected',c.dataset.soulseekPick===soulseekLoadoutWeaponPickId));
   confirmBtn.disabled=false;
  });
  confirmBtn.classList.remove('hidden');
  // With nothing to pick the button becomes a plain "carry on" so an empty
  // catalogue can never strand the player on this step.
  confirmBtn.textContent=rows.length?'CONFIRMAR ARMA':'CONTINUAR';
  confirmBtn.disabled=rows.length?!soulseekLoadoutWeaponPickId:false;
  return;
 }
 // v1.1 starter-pack picks (armor/helmet/ring/necklace) - only reached when
 // soulseekResetLoadoutSteps actually put them in soulseekLoadoutStepOrder,
 // i.e. the account owns the pack that unlocks them. Same shape as weaponPick
 // above, one per slot.
 if(soulseekLoadoutStep==='armorPick'){
  const rows=soulseekArmorRows();
  title.textContent='ELIGE TU ARMADURA';
  status.textContent=rows.length?'Elige una armadura y confirma.':'No hay armaduras configuradas en el catálogo: continuarás sin ella.';
  body.innerHTML=rows.length?`<div class="soulseekLoadoutGrid">${rows.map(row=>soulseekLoadoutCardHtml(row,'Armadura')).join('')}</div>`:'<p class="small">Sin armaduras disponibles.</p>';
  soulseekWireLoadoutCardIcons(body,rows);
  body.querySelectorAll('[data-soulseek-pick]').forEach(card=>card.onclick=()=>{
   soulseekLoadoutArmorPickId=card.dataset.soulseekPick;
   body.querySelectorAll('[data-soulseek-pick]').forEach(c=>c.classList.toggle('selected',c.dataset.soulseekPick===soulseekLoadoutArmorPickId));
   confirmBtn.disabled=false;
  });
  confirmBtn.classList.remove('hidden');
  confirmBtn.textContent=rows.length?'CONFIRMAR ARMADURA':'CONTINUAR';
  confirmBtn.disabled=rows.length?!soulseekLoadoutArmorPickId:false;
  return;
 }
 if(soulseekLoadoutStep==='helmetPick'){
  const rows=soulseekHelmetRows();
  title.textContent='ELIGE TU CASCO';
  status.textContent=rows.length?'Elige un casco y confirma.':'No hay cascos configurados en el catálogo: continuarás sin él.';
  body.innerHTML=rows.length?`<div class="soulseekLoadoutGrid">${rows.map(row=>soulseekLoadoutCardHtml(row,'Casco')).join('')}</div>`:'<p class="small">Sin cascos disponibles.</p>';
  soulseekWireLoadoutCardIcons(body,rows);
  body.querySelectorAll('[data-soulseek-pick]').forEach(card=>card.onclick=()=>{
   soulseekLoadoutHelmetPickId=card.dataset.soulseekPick;
   body.querySelectorAll('[data-soulseek-pick]').forEach(c=>c.classList.toggle('selected',c.dataset.soulseekPick===soulseekLoadoutHelmetPickId));
   confirmBtn.disabled=false;
  });
  confirmBtn.classList.remove('hidden');
  confirmBtn.textContent=rows.length?'CONFIRMAR CASCO':'CONTINUAR';
  confirmBtn.disabled=rows.length?!soulseekLoadoutHelmetPickId:false;
  return;
 }
 if(soulseekLoadoutStep==='ringPick'){
  const rows=soulseekRingRows();
  title.textContent='ELIGE TU ANILLO';
  status.textContent=rows.length?'Elige un anillo y confirma.':'No hay anillos configurados en el catálogo: continuarás sin él.';
  body.innerHTML=rows.length?`<div class="soulseekLoadoutGrid">${rows.map(row=>soulseekLoadoutCardHtml(row,'Anillo')).join('')}</div>`:'<p class="small">Sin anillos disponibles.</p>';
  soulseekWireLoadoutCardIcons(body,rows);
  body.querySelectorAll('[data-soulseek-pick]').forEach(card=>card.onclick=()=>{
   soulseekLoadoutRingPickId=card.dataset.soulseekPick;
   body.querySelectorAll('[data-soulseek-pick]').forEach(c=>c.classList.toggle('selected',c.dataset.soulseekPick===soulseekLoadoutRingPickId));
   confirmBtn.disabled=false;
  });
  confirmBtn.classList.remove('hidden');
  confirmBtn.textContent=rows.length?'CONFIRMAR ANILLO':'CONTINUAR';
  confirmBtn.disabled=rows.length?!soulseekLoadoutRingPickId:false;
  return;
 }
 if(soulseekLoadoutStep==='necklacePick'){
  const rows=soulseekNecklaceRows();
  title.textContent='ELIGE TU COLGANTE';
  status.textContent=rows.length?'Elige un colgante y confirma.':'No hay colgantes configurados en el catálogo: continuarás sin él.';
  body.innerHTML=rows.length?`<div class="soulseekLoadoutGrid">${rows.map(row=>soulseekLoadoutCardHtml(row,'Colgante')).join('')}</div>`:'<p class="small">Sin colgantes disponibles.</p>';
  soulseekWireLoadoutCardIcons(body,rows);
  body.querySelectorAll('[data-soulseek-pick]').forEach(card=>card.onclick=()=>{
   soulseekLoadoutNecklacePickId=card.dataset.soulseekPick;
   body.querySelectorAll('[data-soulseek-pick]').forEach(c=>c.classList.toggle('selected',c.dataset.soulseekPick===soulseekLoadoutNecklacePickId));
   confirmBtn.disabled=false;
  });
  confirmBtn.classList.remove('hidden');
  confirmBtn.textContent=rows.length?'CONFIRMAR COLGANTE':'CONTINUAR';
  confirmBtn.disabled=rows.length?!soulseekLoadoutNecklacePickId:false;
  return;
 }
 // potion step, one at a time, up to 4
 const idx=soulseekLoadoutChosenPotions.length+1;
 const rows=soulseekCommonPotionRows();
 title.textContent=`ELIGE TU POCIÓN (${idx}/4)`;
 status.textContent=rows.length?'Elige una poción y confirma. Puedes repetir el mismo tipo.':'No hay pociones configuradas en el catálogo: empezarás con las pociones iniciales automáticas.';
 body.innerHTML=rows.length?`<div class="soulseekLoadoutGrid">${rows.map(row=>soulseekLoadoutCardHtml(row,'Poción')).join('')}</div>`:'<p class="small">Sin pociones disponibles.</p>';
 soulseekWireLoadoutCardIcons(body,rows);
 body.querySelectorAll('[data-soulseek-pick]').forEach(card=>card.onclick=()=>{
  soulseekLoadoutPotionPickId=card.dataset.soulseekPick;
  body.querySelectorAll('[data-soulseek-pick]').forEach(c=>c.classList.toggle('selected',c.dataset.soulseekPick===soulseekLoadoutPotionPickId));
  confirmBtn.disabled=false;
 });
 confirmBtn.classList.remove('hidden');
 confirmBtn.textContent=rows.length?`CONFIRMAR POCIÓN ${idx}/4`:'EMPEZAR LA PARTIDA';
 confirmBtn.disabled=rows.length?!soulseekLoadoutPotionPickId:false;
}
async function soulseekLoadoutConfirmStep(){
 if(soulseekLoadoutStep==='loading')return;
 if(soulseekLoadoutCatalogError){await soulseekFinalizeLoadout();return}
 if(soulseekLoadoutStep==='weaponPick'){
  // Nothing configured to choose from: CONTINUAR just moves on (the
  // automatic starter weapon is applied in soulseekFinalizeLoadout).
  if(!soulseekLoadoutWeaponPickId&&soulseekLoadoutWeaponChoices().length)return;
  soulseekLoadoutStep=soulseekNextLoadoutStep('weaponPick');
  renderSoulseekLoadoutStep();
  return;
 }
 if(soulseekLoadoutStep==='armorPick'){
  if(!soulseekLoadoutArmorPickId&&soulseekArmorRows().length)return;
  soulseekLoadoutStep=soulseekNextLoadoutStep('armorPick');
  renderSoulseekLoadoutStep();
  return;
 }
 if(soulseekLoadoutStep==='helmetPick'){
  if(!soulseekLoadoutHelmetPickId&&soulseekHelmetRows().length)return;
  soulseekLoadoutStep=soulseekNextLoadoutStep('helmetPick');
  renderSoulseekLoadoutStep();
  return;
 }
 if(soulseekLoadoutStep==='ringPick'){
  if(!soulseekLoadoutRingPickId&&soulseekRingRows().length)return;
  soulseekLoadoutStep=soulseekNextLoadoutStep('ringPick');
  renderSoulseekLoadoutStep();
  return;
 }
 if(soulseekLoadoutStep==='necklacePick'){
  if(!soulseekLoadoutNecklacePickId&&soulseekNecklaceRows().length)return;
  soulseekLoadoutStep=soulseekNextLoadoutStep('necklacePick');
  renderSoulseekLoadoutStep();
  return;
 }
 if(!soulseekCommonPotionRows().length){await soulseekFinalizeLoadout();return}
 if(!soulseekLoadoutPotionPickId)return;
 soulseekLoadoutChosenPotions.push(soulseekLoadoutPotionPickId);
 soulseekLoadoutPotionPickId=null;
 if(soulseekLoadoutChosenPotions.length>=4)await soulseekFinalizeLoadout();
 else renderSoulseekLoadoutStep();
}
async function soulseekFinalizeLoadout(){
 if(!game?.player)return;
 document.getElementById('soulseekLoadoutModal').classList.remove('open');
 // The slow part of creation is HERE, not in soulseekStartCharacter: hydrating
 // the chosen rows, saving the character and generating floor 1. The hourglass
 // overlay was wired around soulseekStartCharacter, which now returns as soon
 // as the loadout wizard opens, so it flashed by long before any of this and
 // the actual dungeon generation ran with no feedback at all.
 // typeof guard: soulseeker-dungeons.js owns the overlay and is optional.
 if(typeof soulseekShowLoading==='function')soulseekShowLoading('Generando mazmorra...');
 try{
  const weaponRow=await soulseekHydrateItemRow(soulseekCommonWeaponRows().find(r=>String(r.id)===soulseekLoadoutWeaponPickId));
  game.player.equipment.weapon=weaponRow?configuredItemFromRow(weaponRow,{itemLevel:{min:1,max:2}},1):makeStarterWeapon(null);
  // v1.1 starter-pack picks - only set (and only reach here) when the
  // corresponding step actually ran, i.e. soulseekLoadoutArmorPickId etc. is
  // set from a step that soulseekResetLoadoutSteps put in the wizard order.
  if(soulseekLoadoutArmorPickId){
   const row=await soulseekHydrateItemRow(soulseekArmorRows().find(r=>String(r.id)===soulseekLoadoutArmorPickId));
   if(row)game.player.equipment.chest=configuredItemFromRow(row,{itemLevel:{min:1,max:2}},1);
  }
  if(soulseekLoadoutHelmetPickId){
   const row=await soulseekHydrateItemRow(soulseekHelmetRows().find(r=>String(r.id)===soulseekLoadoutHelmetPickId));
   if(row)game.player.equipment.head=configuredItemFromRow(row,{itemLevel:{min:1,max:2}},1);
  }
  if(soulseekLoadoutRingPickId){
   const row=await soulseekHydrateItemRow(soulseekRingRows().find(r=>String(r.id)===soulseekLoadoutRingPickId));
   if(row)game.player.equipment.ring1=configuredItemFromRow(row,{itemLevel:{min:1,max:2}},1);
  }
  if(soulseekLoadoutNecklacePickId){
   const row=await soulseekHydrateItemRow(soulseekNecklaceRows().find(r=>String(r.id)===soulseekLoadoutNecklacePickId));
   if(row)game.player.equipment.neck=configuredItemFromRow(row,{itemLevel:{min:1,max:2}},1);
  }
  const potionRows=soulseekCommonPotionRows();
  let addedPotions=0;
  for(const id of soulseekLoadoutChosenPotions){
   const row=await soulseekHydrateItemRow(potionRows.find(r=>String(r.id)===id));
   if(row){addInventoryItem(configuredPotionFromRow(row,{itemLevel:{min:1,max:2}},1));addedPotions++}
  }
  if(!addedPotions)addStarterPotions(null);
  syncAllEquipmentPassives();recomputeDerived();
  await soulseekFinishCharacterCreation();
 }finally{
  if(typeof soulseekHideLoading==='function')soulseekHideLoading();
 }
}
async function soulseekFinishCharacterCreation(){
 const bundle={player:game.player,inventory:game.inventory||[],achievements:game.achievements||{},feats:normalizeFeats(),bossesKilled:0,chestsOpened:0,maxFloorReached:1};
 const score=computeScore(bundle);
 try{
  const r=await fetch('/api/user-pj',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:window.currentUser.nombre,pj_name:bundle.player.name,pj_json:bundle,feats:bundle.feats,pj_status:'alive',pj_score:score,souls:game.player.souls||0,soulseeker:true,last_use:new Date().toISOString()})});
  const data=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(data?.error||data?.message||data?.details||data?.hint||`HTTP ${r.status}${r.statusText?' '+r.statusText:''}`);
  // A blank-name character is saved with a placeholder name above (the row
  // id doesn't exist before the insert) - now that Supabase returned the
  // generated id, rename it to "PJ Nº<id>" and persist that final name.
  if(bundle.player.autoNamed&&data?.id){
   delete bundle.player.autoNamed;
   bundle.player.name=`PJ Nº${data.id}`;
   await fetch('/api/user-pj',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:data.id,pj_name:bundle.player.name,pj_json:bundle,minimal:true})}).catch(()=>{});
  }
  uiAlert(`Personaje "${bundle.player.name}" creado y guardado correctamente. Bienvenido al Soulseek Mode.`);
  refreshCurrentUserProgress();
 }catch(e){
  console.error('No se pudo guardar el personaje Soulseeker:',e);
  uiAlert('Error al guardar el personaje: '+e.message);
 }
 game=null;
 document.getElementById('soulseekCreateOverlay')?.classList.add('hidden');
 openSinglePlayerScreen();
}

// ============================================================================
// Second-floor advanced-class unlock. Hooked from the floor transition, with
// the consistency guard retained as a fallback for restored/legacy state.
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
 if(!game?.player?.soulseeker||game.player.cls||game.floor<2)return;
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
 grid.querySelectorAll('[data-soulseek-class]').forEach(btn=>btn.addEventListener('click',async()=>{
  const id=btn.dataset.soulseekClass,cls=resolveClassDef(id);
  if(!cls||!modal.classList.contains('open'))return;
  if(!await uiConfirm(`¿Confirmas que quieres convertirte en ${cls.name}?`))return;
  const p=game.player;
  p.cls=id;p.className=cls.name;p.classIcon=classIconForId(id,p.gender)||classlessIconForGender(p.gender);
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
 }));
}
function openSoulseekerSkillPicker(){
 const choices=classSkillChoicesForTier(1);
 if(!choices.length){soulseekClassPickerOpen=false;soulseekPersistAfterClassChoice();return}
 const modal=document.getElementById('skillChoiceModal');
 document.getElementById('skillChoiceTitle').textContent='ELIGE TU PRIMERA HABILIDAD DE CLASE';
 document.getElementById('skillChoiceText').textContent=`${game.player.className} · nivel ${game.player.level}. Elige una habilidad del pool real de tu clase.`;
 const grid=document.getElementById('skillChoiceGrid');
 grid.innerHTML=choices.map(id=>{const s=skillDefs[id],roman=TIER_ROMAN[s.tier]||s.tier;return `<button type="button" class="skillChoiceCard" data-soulseek-pick-skill="${id}"><b>${s.icon} ${s.name}</b><span class="tierBadge">TIER ${roman}</span><p>${s.desc}</p><span class="small">${s.cost} ${s.resource==='mana'?'maná':'stamina'} · CD ${s.cd} · Alcance ${s.range||0}</span></button>`}).join('');
 modal.classList.add('open');
 grid.querySelectorAll('[data-soulseek-pick-skill]').forEach(b=>b.addEventListener('click',async()=>{
  const id=b.dataset.soulseekPickSkill,chosen=skillDefs[id];
  if(!modal.classList.contains('open'))return;
  if(!await uiConfirm(`¿Confirmas que quieres aprender ${chosen?.name||'esta habilidad'}?`))return;
  learnSkill(id);
  game.player.skillChoicesAwarded[game.player.level]='chosen';
  modal.classList.remove('open');
  updateUI();draw();
  soulseekClassPickerOpen=false;
  soulseekPersistAfterClassChoice();
 }));
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
 // tryAutoRevive() (game.js) already had its shot at this fatal hit before
 // handlePlayerDeath() - and thus soulseekHandleDeath() - was ever called
 // (see damagePlayer/finishEnemyTurn): reaching here means no cheatdeath
 // charge or active revive buff was up, so this is a real death. This used
 // to re-check a separate configuredReviveSource() helper here, but that
 // function was removed when tryAutoRevive() replaced it upstream, leaving
 // this call throwing a ReferenceError on every Soulseeker death - the
 // skull/death-choice UI below never rendered, hp stayed frozen at 0 with
 // game.over already true (immobile), and nothing ever showed a death screen.
 // Same 2s skull as the normal game before the death choice appears.
 playDeathSkullAnimation(soulseekShowDeathChoiceModal);
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
  // Between STANDARD MODE and CONFIGURACIÓN, so the root menu reads
  // standard / soulseeker / configuración.
  mainMenuActions.insertBefore(btn,document.getElementById('menuConfigBtn'));
  btn.onclick=openSoulseekerMenu;
 }

 document.getElementById('soulseekBackBtn').onclick=closeSoulseekerMenu;
 document.getElementById('soulseekScoresBtn').onclick=openSoulseekerScores;
 document.getElementById('soulseekScoresBackBtn').onclick=closeSoulseekerScores;
 document.getElementById('soulseekUnlocksBtn').onclick=openSoulseekerUnlocks;
 document.getElementById('soulseekUnlocksBackBtn').onclick=closeSoulseekerUnlocks;
 document.getElementById('soulseekNewCharBtn').onclick=openSoulseekerNewCharacter;
 document.getElementById('soulseekCreateBackBtn').onclick=closeSoulseekerNewCharacter;
 document.getElementById('soulseekWizardBackBtn').onclick=()=>{if(soulseekWizardStep===0){closeSoulseekerNewCharacter();return}setSoulseekWizardStep(soulseekWizardStep-1)};
 document.getElementById('soulseekWizardNextBtn').onclick=()=>{
  // A race is the only hard requirement to move on; sexo already defaults to
  // masculino and an empty name is allowed (the character is saved as
  // "PJ Nº<id>" - see soulseekFinishCharacterCreation).
  if(soulseekWizardStep===0&&(!soulseekSelectedRace||!raceDefs[soulseekSelectedRace])){uiAlert('Elige una raza para continuar.');return}
  setSoulseekWizardStep(soulseekWizardStep+1);
 };
 document.getElementById('soulseekCreateBtn').onclick=soulseekStartCharacter;
 document.querySelectorAll('[data-soulseek-gender]').forEach(button=>button.onclick=()=>{soulseekSelectedGender=button.dataset.soulseekGender;renderSoulseekGenderChoices();renderSoulseekRaceChoices();renderSoulseekCharacterSummary()});
 document.getElementById('soulseekLoadoutConfirmBtn').onclick=soulseekLoadoutConfirmStep;

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
