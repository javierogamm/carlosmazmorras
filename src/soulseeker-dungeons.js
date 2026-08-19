// ============================================================================
// SOULSEEK MODE - FASE 2: procedural, potentially-infinite dungeons.
// Loaded after src/game.js AND src/soulseek.js (classic script, same shared
// top-level scope - see soulseek.js's own header comment for why that works
// and what conventions this file follows). Nothing here touches game.js or
// soulseek.js source: every hook is either a full override of a
// soulseek.js-defined function (soulseekFinishCharacterCreation,
// openSoulseekerNewCharacter) or a wrap-the-original monkeypatch of a
// game.js function (buildFloorPlan, checkTile, kill, goToMainMenu,
// saveCurrentRun), exactly like Fase 1 did for classSkillConsistencyGuard/
// handlePlayerDeath.
//
// Design recap (see the request that shipped this file):
// - Character creation now drops the player straight into floor 1 instead
//   of back to the single-player menu (soulseekFinishCharacterCreation).
// - Floor 1 is built with the exact same rules as normal mode
//   (generateFloor()/buildFloorPlan() already generate procedurally
//   whenever there's no precomputed dungeon_world floor - i.e. whenever
//   selectedDungeonWorld is unset, which is always true for Soulseeker).
//   Floors are infinite: the DUNGEON_FLOORS=6 "end of run" check in
//   checkTile() is bypassed for soulseeker characters.
// - Every floor that's a multiple of 3 is guaranteed (not just 33%-chance,
//   like normal mode) to be a megaboss floor or a boss-chain (bossrush).
// - Enemies/tier/loot/chests are already recalculated every floor purely
//   from the player's CURRENT level (game.floorEntryLevel, read fresh at
//   the top of generateFloor()) - nothing extra needed for that part.
// - Four difficulty presets (chosen at character creation) map onto the
//   existing worldParams() multipliers plus a per-kill soul-doubling
//   chance and a per-floor guaranteed reward (1 max-tier equipment item +
//   N souls, N by difficulty).
// - No session is ever saved/resumed for a Soulseeker run: the save-run
//   button is neutralised, and leaving to the main menu kills the
//   character permanently, exactly like dying in combat.
// ============================================================================

const SOULSEEK_DIFFICULTIES={
 easy:     {label:'Easy',      pct:100, soulDoubleChance:0,   floorSouls:3},
 normal:   {label:'Normal',    pct:125, soulDoubleChance:.25, floorSouls:5},
 hard:     {label:'Hard',      pct:150, soulDoubleChance:.5,  floorSouls:7},
 nightmare:{label:'Nightmare', pct:200, soulDoubleChance:.10, floorSouls:10}
};
let soulseekSelectedDifficulty='normal';

function soulseekWorldParamsForDifficulty(id){
 const d=SOULSEEK_DIFFICULTIES[id]||SOULSEEK_DIFFICULTIES.normal;
 // Only what the request specifies (HP/daño/XP recibida) is scaled - loot
 // drop rate and enemy count stay at the normal-mode default (100).
 return {damageReceivedPct:d.pct,damageDealtPct:100,lifePct:d.pct,xpReceivedPct:d.pct,enemyCountPct:100,enemyLootPct:100,apMode:true};
}
function soulseekDifficultyConfig(){
 return SOULSEEK_DIFFICULTIES[game?.player?.soulseekDifficulty]||SOULSEEK_DIFFICULTIES.normal;
}

// -- styling for the difficulty picker (this file owns its own DOM, same
// -- pattern as soulseek.js's injectSoulseekStyles) --
(function injectSoulseekDungeonStyles(){
 const style=document.createElement('style');
 style.textContent=`
  #soulseekDifficultyChoices{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0 14px}
  #soulseekDifficultyChoices button.selected{border-color:#ffc35a;box-shadow:0 0 10px #ffc35a55;background:#3a2748}
  @media(max-width:620px){#soulseekDifficultyChoices{grid-template-columns:repeat(2,1fr)}}
  #soulseekLoadingOverlay{position:fixed;inset:0;z-index:10500;background:#050308f0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;text-align:center}
  #soulseekLoadingOverlay.open{display:flex}
  #soulseekLoadingOverlay .soulseekHourglass{font-size:64px;animation:soulseekHourglassFlip 1.6s ease-in-out infinite}
  #soulseekLoadingOverlay .soulseekLoadingText{color:#e8d6ff;font-size:15px;letter-spacing:.04em}
  @keyframes soulseekHourglassFlip{0%,15%{transform:rotate(0)}45%,55%{transform:rotate(180deg)}85%,100%{transform:rotate(360deg)}}
 `;
 document.head.appendChild(style);
})();

// ============================================================================
// Loading overlay: shown from the moment "CREAR PERSONAJE" is clicked until
// floor 1 has actually been generated and drawn (or creation failed), so
// the player never stares at an unresponsive/black screen wondering if
// anything is happening.
// ============================================================================
function soulseekEnsureLoadingOverlay(){
 if(document.getElementById('soulseekLoadingOverlay'))return;
 const div=document.createElement('div');
 div.id='soulseekLoadingOverlay';
 div.innerHTML=`<div class="soulseekHourglass">⏳</div><div class="soulseekLoadingText" id="soulseekLoadingText">Creando personaje...</div>`;
 document.body.appendChild(div);
}
function soulseekShowLoading(text){
 soulseekEnsureLoadingOverlay();
 const text_=document.getElementById('soulseekLoadingText');
 if(text_)text_.textContent=text||'Creando personaje...';
 document.getElementById('soulseekLoadingOverlay').classList.add('open');
}
function soulseekHideLoading(){
 document.getElementById('soulseekLoadingOverlay')?.classList.remove('open');
}

// ============================================================================
// Difficulty picker: injected once into the existing #soulseekCreateOverlay
// (built by soulseek.js) right after the gender choices.
// ============================================================================
function soulseekInjectDifficultyPicker(){
 if(document.getElementById('soulseekDifficultyChoices'))return;
 const anchor=document.getElementById('soulseekGenderChoices');
 if(!anchor)return;
 const ids=Object.keys(SOULSEEK_DIFFICULTIES);
 anchor.insertAdjacentHTML('afterend',`<h4>Dificultad</h4><div id="soulseekDifficultyChoices">${ids.map(id=>`<button type="button" class="start ${id==='normal'?'selected':''}" data-soulseek-difficulty="${id}">${SOULSEEK_DIFFICULTIES[id].label.toUpperCase()}</button>`).join('')}</div>`);
 document.querySelectorAll('[data-soulseek-difficulty]').forEach(btn=>btn.onclick=()=>{
  soulseekSelectedDifficulty=btn.dataset.soulseekDifficulty;
  soulseekRenderDifficultyChoice();
 });
}
function soulseekRenderDifficultyChoice(){
 document.querySelectorAll('[data-soulseek-difficulty]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.soulseekDifficulty===soulseekSelectedDifficulty));
}
function soulseekResetDifficultyChoice(){
 soulseekSelectedDifficulty='normal';
 soulseekRenderDifficultyChoice();
}

// ============================================================================
// Character creation -> straight into floor 1. Fully replaces (not wraps)
// soulseek.js's soulseekFinishCharacterCreation: same POST-and-save logic,
// but instead of navigating back to the single-player menu it stores the
// chosen difficulty on the character, builds a from-scratch worldParams
// object for it (no dungeon_world row backing it - see soulseekWorldParamsForDifficulty),
// and generates floor 1 immediately.
// ============================================================================
async function soulseekFinishCharacterCreation(){
 const p=game.player;
 p.soulseekDifficulty=soulseekSelectedDifficulty;
 game.worldParams=normalizeWorldParams(soulseekWorldParamsForDifficulty(soulseekSelectedDifficulty));
 const bundle={player:p,inventory:game.inventory||[],achievements:game.achievements||{},feats:normalizeFeats(),bossesKilled:0,chestsOpened:0,maxFloorReached:1};
 const score=computeScore(bundle);
 try{
  const r=await fetch('/api/user-pj',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:window.currentUser.nombre,pj_name:bundle.player.name,pj_json:bundle,feats:bundle.feats,pj_status:'alive',pj_score:score,souls:p.souls||0,soulseeker:true,last_use:new Date().toISOString()})});
  const data=await r.json().catch(()=>null);
  if(!r.ok)throw new Error(data?.error||data?.message||data?.details||data?.hint||`HTTP ${r.status}${r.statusText?' '+r.statusText:''}`);
  game.pjId=data?.id??null;
  refreshCurrentUserProgress();
 }catch(e){
  console.error('No se pudo guardar el personaje Soulseeker:',e);
  uiAlert('Error al guardar el personaje: '+e.message);
  game=null;
  document.getElementById('soulseekCreateOverlay')?.classList.add('hidden');
  openSinglePlayerScreen();
  return;
 }
 document.getElementById('soulseekCreateOverlay')?.classList.add('hidden');
 try{
  await soulseekEnterDungeon();
 }catch(e){
  console.error('No se pudo generar el piso 1 del personaje Soulseeker:',e);
  uiAlert('El personaje se creó, pero no se pudo generar la mazmorra: '+e.message+'\nRevisa que haya al menos una familia de enemigos consolidada en Configuración → Enemigos.');
  game=null;
  app.classList.add('hidden');
  openSinglePlayerScreen();
 }
}

async function soulseekEnterDungeon(){
 await ensureConfigItemsHydrated();
 if(!configClasses.length)await fetchConfigClasses();
 if(!configChests.length)await fetchConfigChests();
 // generateFloor() -> buildFloorPlan() needs a consolidated enemy family to
 // populate the floor (pickConfiguredFamilyForFloor() throws otherwise).
 // Normal mode only ever loads this via loadDungeonOptionCatalogs(), called
 // from openCharacterSelection() - a screen Soulseeker's create-straight-
 // into-floor-1 flow never visits, so it has to be fetched here instead.
 // Without it, generateFloor() threw deep inside buildFloorPlan and
 // everything after it (the draw() call) never ran, leaving a black
 // canvas with no error shown to the player.
 if(!configEnemyFamilies.length)await fetchEnemyConfig({throwOnError:true});
 // Same reasoning as the enemy family fetch above: floorTilesetForWorldPlan()
 // needs config_floor rows consolidated to assign a real floor template
 // (see soulseekRollFloorPlanEntry below) instead of just falling back to
 // pickFloorTilesetForLevel()'s own internal random pick.
 if(!configFloors.length)await fetchConfigFloors();
 try{await ensureWorldObjectIcons()}catch(e){console.error('No se pudieron cargar los assets del mundo',e)}
 document.getElementById('dungeonOverlay')?.classList.add('hidden');
 document.getElementById('singlePlayerOverlay')?.classList.add('hidden');
 app.classList.remove('hidden');
 // Soulseeker runs are never saved/resumed - hide the manual save button so
 // it's never even visible to click (saveCurrentRun() is also neutralised
 // below as a defensive backstop).
 document.getElementById('saveRunBtn')?.classList.add('hidden');
 const saveStatus=document.getElementById('saveRunStatus');
 if(saveStatus)saveStatus.textContent='Soulseek Mode: sin guardado. Salir al menú mata al personaje.';
 soulseekApplyFloorPlan(game.floor);
 generateFloor();
 game.player.hp=game.player.maxHp;game.player.stamina=game.player.maxStamina;game.player.mana=game.player.maxMana;
 applyCanvasSize();updateUI();draw();
 requestAnimationFrame(()=>{applyCanvasSize();draw()});
 banner(`SOULSEEK MODE · ${SOULSEEK_DIFFICULTIES[game.player.soulseekDifficulty]?.label.toUpperCase()||'NORMAL'}`);
}

// ============================================================================
// Every Soulseeker floor rolls its own explicit {floorId, familyName,
// ambiente} combo - the same shape a hand-authored dungeon_world's
// per-floor plan uses (worldPlanEntry()/params.floorPlan, see
// renderWorldFloorPlan()'s admin UI) - instead of leaving the floor
// tileset, enemy family and decoration ambiente to independently roll
// their own unrelated random fallback. game.worldParams.floorPlan is
// overwritten with a single entry for the CURRENT floor right before every
// generateFloor() call; normalizeWorldParams()'s cap to DUNGEON_FLOORS
// entries (see game.js) never applies here since this is set directly on
// the live game.worldParams object, not re-normalized.
// ============================================================================
function soulseekRollFloorPlanEntry(floor){
 const floorRow=pick(normalizedConfigFloors());
 const familyRow=pick(normalizedEnemyFamilies());
 const ambientes=[...new Set(listConfigAssets().map(a=>a.ambiente).filter(Boolean))];
 return {
  floor,
  floorId:floorRow?String(floorRow.dbId??floorRow.id??floorRow.name):'',
  familyName:familyRow?familyRow.name:'',
  ambiente:ambientes.length?pick(ambientes):'',
  archetype:''
 };
}
function soulseekApplyFloorPlan(floor){
 game.worldParams=game.worldParams||{};
 game.worldParams.floorPlan=[soulseekRollFloorPlanEntry(floor)];
}

// ============================================================================
// Game-over screen: normal mode's permanentDeath() only offers "Crear nuevo
// personaje", which reloads the page straight to the login/landing screen -
// for a Soulseeker character that meant losing the Soulseeker menu context
// entirely on every death, with no way back to it short of logging in again.
// This replaces that single button with two: back to the Soulseeker menu
// (no reload - the account stays logged in for this tab) and back to the
// true main menu.
// ============================================================================
function soulseekShowGameOverScreen(){
 const p=game.player;
 game.over=true;
 finalizeCharacterDeath();
 try{localStorage.clear()}catch(e){}
 storyTitle.textContent='GAME OVER';
 storyBody.innerHTML=`<div class="narrative gameOverBox"><p class="gameOverName"><b>${p.name||'Tu personaje'} ha muerto.</b></p><div class="gameOverStats"><div><span class="small">Nivel de héroe</span><b>${p.level}</b></div><div><span class="small">Piso alcanzado</span><b>${game.floor}</b></div></div><p class="small">Muerte permanente: Soulseek Mode no guarda partidas.</p><div class="startActions"><button id="soulseekRestartAfterDeath">VOLVER AL MENÚ SOULSEEKER</button><button id="soulseekMainMenuAfterDeath">MENÚ PRINCIPAL</button></div></div>`;
 storyOverlay.classList.remove('hidden');
 setTimeout(()=>{
  document.getElementById('soulseekRestartAfterDeath')?.addEventListener('click',()=>{
   storyOverlay.classList.add('hidden');
   game=null;
   app.classList.add('hidden');
   document.getElementById('dungeonOverlay')?.classList.add('hidden');
   openSoulseekerMenu();
  });
  document.getElementById('soulseekMainMenuAfterDeath')?.addEventListener('click',()=>{
   storyOverlay.classList.add('hidden');
   game=null;
   app.classList.add('hidden');
   document.getElementById('dungeonOverlay')?.classList.add('hidden');
   for(const id of MAIN_MENU_SCREEN_IDS)document.getElementById(id)?.classList.add('hidden');
   landingOverlay.classList.remove('hidden');
  });
 },0);
}

// ============================================================================
// Guaranteed per-floor completion reward: 1 non-potion item at the max
// rarity the player's current level can roll (maxLootRarityIndexForProgress
// is already exactly "tier máximo obtenible por el nivel del PJ según
// reglas actuales" - see game.js), plus a flat souls grant by difficulty,
// applied the same way an enemy-kill soul gain is (game.player.souls +
// persistSouls()).
// ============================================================================
function soulseekGrantFloorReward(){
 const p=game.player;
 const maxIdx=maxLootRarityIndexForProgress(game.floor,worldParams().floors,p.level);
 const rarityName=LOOT_RARITY_ORDER[maxIdx];
 const item=makeLoot(p.level,'normal',rarityName,'equipment');
 if(item)addInventoryItem(item);
 const cfg=soulseekDifficultyConfig();
 p.souls=Math.max(0,Number(p.souls)||0)+cfg.floorSouls;
 persistSouls();
 banner(`PISO ${game.floor} COMPLETADO · +${cfg.floorSouls} SOUL`);
 log(`Recompensa de piso: ${item?item.name:'objeto'} + ${cfg.floorSouls} Soul Spikes.`,'loot');
 updateUI();
}

// ============================================================================
// Wiring: wrap the game.js functions that need Soulseeker-specific
// behaviour. Every wrapper falls straight through to the original function
// for non-soulseeker characters, so normal mode is byte-for-byte unchanged.
// ============================================================================
(function wireSoulseekDungeons(){

 // -- floor 1 rules are the normal ones; multiples of 3 are guaranteed
 // -- megaboss/boss-chain floors instead of normal mode's 33% chance --
 const soulseekOriginalBuildFloorPlan=buildFloorPlan;
 buildFloorPlan=function(floor,params,opts){
  if(game?.player?.soulseeker&&floor%3===0&&!game?.forcedFloorArchetype){
   if(Math.random()<.5)return buildMegabossFloorPlan(floor,params);
   game.forcedFloorArchetype='bossrush';
   const plan=soulseekOriginalBuildFloorPlan(floor,params,opts);
   // Normal mode only clears this flag when floor===DUNGEON_FLOORS (the
   // fixed climax); Soulseeker forces it on every 3rd floor of an infinite
   // run, so it must always be cleared right after use or it would leak
   // into (and force bossrush on) every floor from here on.
   delete game.forcedFloorArchetype;
   return plan;
  }
  return soulseekOriginalBuildFloorPlan(floor,params,opts);
 };

 // -- infinite floors: never end the run at DUNGEON_FLOORS, grant the
 // -- guaranteed per-floor reward, then keep going --
 const soulseekOriginalCheckTile=checkTile;
 checkTile=function(){
  if(!game?.player?.soulseeker)return soulseekOriginalCheckTile();
  const p=game.player,k=game.keys.find(k=>k.x===p.x&&k.y===p.y);
  if(k){game.keys=game.keys.filter(x=>x!==k);p.keys++;log('Recoges una llave.','loot')}
  detectNearbyTraps();
  const trap=(game.traps||[]).find(t=>!t.sprung&&t.x===p.x&&t.y===p.y);if(trap)springTrap(trap);
  const altar=(game.altars||[]).find(a=>!a.used&&a.x===p.x&&a.y===p.y);if(altar)useAltar(altar);
  const c=game.chests.find(c=>!c.opened&&c.x===p.x&&c.y===p.y);if(c)openChest(c);
  if(p.x===game.stairs.x&&p.y===game.stairs.y){
   const block=stairsBlockedReason();
   if(block){log(block,'combat');return}
   soulseekGrantFloorReward();
   game.floor++;soulseekApplyFloorPlan(game.floor);generateFloor();
  }
 };

 // -- souls-doubling chance per kill, by difficulty --
 const soulseekOriginalKill=kill;
 kill=function(e){
  if(!game?.player?.soulseeker)return soulseekOriginalKill(e);
  const before=Math.max(0,Number(game.player.souls)||0);
  const result=soulseekOriginalKill(e);
  const after=Math.max(0,Number(game.player.souls)||0);
  const gained=after-before;
  if(gained>0&&Math.random()<soulseekDifficultyConfig().soulDoubleChance){
   game.player.souls=after+gained;
   persistSouls();
   floating(`+${gained} SOUL (x2)`,e.x,e.y,'#c69cff');
  }
  return result;
 };

 // -- game-over screen: permanentDeath() is invoked only as a bare
 // -- identifier call (handlePlayerDeath's death-choice modal in
 // -- soulseek.js, and goToMainMenu below), so reassigning the global is
 // -- enough - no button was ever bound directly to its old value. --
 const soulseekOriginalPermanentDeath=permanentDeath;
 permanentDeath=function(){
  if(!game?.player?.soulseeker||game?.testingMode)return soulseekOriginalPermanentDeath();
  soulseekShowGameOverScreen();
 };

 // -- no session save/resume: leaving to the main menu is permanent death.
 // -- checkTile()/kill()/buildFloorPlan() above are all invoked as bare
 // -- identifier calls inside other functions, so reassigning the global
 // -- name is enough to redirect every call site. goToMainMenu/
 // -- saveCurrentRun are different: game.js binds their buttons with
 // -- `btn.onclick=goToMainMenu`/`addEventListener('click',saveCurrentRun)`,
 // -- which copies the function VALUE at bind time - reassigning the global
 // -- afterwards would never be seen by that already-bound handler, so the
 // -- buttons themselves have to be rebound directly instead. --
 const soulseekOriginalGoToMainMenu=goToMainMenu;
 document.getElementById('globalMenuBtn').onclick=async function(){
  if(game?.player?.soulseeker&&!game.testingMode){
   if(!await uiConfirm('¿Volver al menú principal? Soulseek Mode no guarda partidas: tu personaje morirá permanentemente.'))return;
   permanentDeath();
   return;
  }
  soulseekOriginalGoToMainMenu();
 };
 // permanentDeath() itself calls goToMainMenu() (bare identifier, late-
 // bound) from the testing-mode branch, so that path is covered without
 // needing the same override - testing-mode characters are never
 // soulseeker:true in the first place (see soulseek.js's creation flow).

 // saveRunBtn's existing handler is an addEventListener (game.js:
 // `saveRunBtn?.addEventListener('click',saveCurrentRun)`), and for
 // listeners on the same element, registration order decides execution
 // order regardless of the capture flag - a second listener added here
 // could never run BEFORE that one to stop it. Cloning the node drops every
 // listener attached to the original (id/attributes are preserved), so the
 // replacement can be wired from scratch with nothing left to race against.
 const saveRunBtn=document.getElementById('saveRunBtn');
 if(saveRunBtn){
  const freshSaveRunBtn=saveRunBtn.cloneNode(true);
  saveRunBtn.replaceWith(freshSaveRunBtn);
  freshSaveRunBtn.addEventListener('click',()=>{
   if(game?.player?.soulseeker){
    const status=document.getElementById('saveRunStatus');
    if(status)status.textContent='Soulseek Mode no permite guardar partidas.';
    return;
   }
   saveCurrentRun();
  });
 }

 // -- creation wizard: difficulty picker, reset on every open. Same stale-
 // -- reference issue as above - #soulseekNewCharBtn's onclick was already
 // -- bound directly to openSoulseekerNewCharacter's function value. --
 document.getElementById('soulseekNewCharBtn').onclick=async function(){
  await openSoulseekerNewCharacter();
  soulseekInjectDifficultyPicker();
  soulseekResetDifficultyChoice();
 };

 // -- "creating character" hourglass overlay: soulseek.js already bound
 // -- #soulseekCreateBtn's onclick directly to soulseekStartCharacter's
 // -- function value (same stale-reference issue as above), so the button
 // -- is rebound here to a wrapper that shows the overlay first, then calls
 // -- soulseekStartCharacter() as a bare identifier (late-bound - still
 // -- resolves to soulseek.js's original function, only the button itself
 // -- changed). try/finally covers every exit path: a validation alert
 // -- (no name/race picked, soulseekStartCharacter returns early), a failed
 // -- save, or a successful run into soulseekEnterDungeon().
 document.getElementById('soulseekCreateBtn').onclick=async function(){
  soulseekShowLoading('Creando personaje...');
  try{
   await soulseekStartCharacter();
  }finally{
   soulseekHideLoading();
  }
 };
})();
