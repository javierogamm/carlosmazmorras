/* MAZMORRA // BOTÍN v0.61.1
 * Persistencia, selección de personaje, multijugador y bootstrap de eventos.
 * Carga clásica ordenada por index.html; el estado compartido pertenece al ámbito global del juego.
 */
async function fetchDungeonWorlds(){
 const status=document.getElementById('worldStatus'),list=document.getElementById('worldList');if(!status||!list)return;
 status.textContent='Cargando dungeons desde Supabase...';list.innerHTML='';
 try{const r=await fetch('/api/dungeon-worlds?light=1');const data=await r.json();if(!r.ok)throw new Error(data.error||data.message||'No se pudieron cargar las dungeons');
  if(!data.length){status.textContent='No hay dungeons guardadas. Crea una nueva.';return}
  status.textContent=`${data.length} dungeon(s) disponibles.`;
  list.innerHTML=data.map(w=>`<button type="button" class="worldCard" data-world-id="${w.id}"><b>${w.world_name||'Dungeon sin nombre'}</b><span>#${w.id} · ${new Date(w.created_at).toLocaleString()}</span></button>`).join('');
  list.querySelectorAll('[data-world-id]').forEach(btn=>btn.onclick=async()=>{
   btn.disabled=true;status.textContent='Cargando dungeon seleccionada...';
   try{
    const wr=await fetch(`/api/dungeon-worlds?id=${encodeURIComponent(btn.dataset.worldId)}`);
    const world=await wr.json();
    if(!wr.ok)throw new Error(world.error||world.message||'No se pudo cargar la dungeon');
    if(!world)throw new Error('La dungeon ya no existe.');
    selectedDungeonWorld=world;proceedAfterWorldChosen();
   }catch(e){status.textContent=`Error cargando dungeon_world: ${e.message}`;btn.disabled=false}
  });
 }catch(e){status.textContent=`Error cargando dungeon_world: ${e.message}`}
}
async function createDungeonWorld(){
 const btn=document.getElementById('createWorldBtn'),status=document.getElementById('worldStatus'),name=(document.getElementById('worldNameInput')?.value||'Dungeon sin nombre').trim(),params=readWorldParamsForm();
 btn.disabled=true;status.textContent='Cargando floors y familias desde Supabase...';
 try{if(!configFloors.length)await fetchConfigFloors();if(!configEnemyFamilies.length)await fetchEnemyConfig();if(!configItems.length)await fetchConfigItems();if(!configChests.length)await fetchConfigChests();if(!normalizedEnemyFamilies().length)throw new Error('Debes consolidar al menos una familia en enemy_family antes de crear una dungeon.');if(!normalizedSupabaseFloors().length)throw new Error('Debes consolidar al menos un floor en config_floor antes de crear una dungeon.');const world_json=createDungeonWorldJson(name,params);const r=await fetch('/api/dungeon-worlds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world_name:name,world_json})});const text=await r.text();let data;try{data=JSON.parse(text)}catch(e){throw new Error(text||'Respuesta no JSON al crear la dungeon')}if(!r.ok)throw new Error(data.error||data.message||'No se pudo crear la dungeon');
  selectedDungeonWorld=data;proceedAfterWorldChosen();
 }catch(e){status.textContent=`Error: ${e.message}`;btn.disabled=false}
}

function sumEquippedItemLevel(equipment){
 if(!equipment)return 0;
 return Object.values(equipment).reduce((sum,item)=>sum+(item?.itemLevel||item?.score||0),0);
}
function computeScore(bundle){
 const player=bundle?.player||{};
 const level=player.level||1;
 const ilvl=sumEquippedItemLevel(player.equipment);
 const maxFloor=bundle?.maxFloorReached||1;
 const gold=player.gold||0;
 return Math.round(level*100+ilvl*5+maxFloor*50+gold/10);
}
function normalizeFeats(raw={}){return {elites:Math.max(0,Number(raw?.elites)||0),bosses:Math.max(0,Number(raw?.bosses)||0),megabosses:Math.max(0,Number(raw?.megabosses)||0),dungeons:Math.max(0,Number(raw?.dungeons)||0)}}
function completeDungeon(){
 if(game.dungeonCompleted)return;
 game.dungeonCompleted=true;game.feats=normalizeFeats(game.feats);game.feats.dungeons++;
 const rarity=topRarityNameForFloor(game.floorEntryLevel||game.player.level);
 const item=makeLoot(game.floorEntryLevel||game.player.level,'dungeonReward',rarity,'equipment');
 if(item){addInventoryItem(item);lootToast(item)}
 const bundle=characterBundleFromGame();
 if(game.pjId)fetch(`/api/user-pj?id=${encodeURIComponent(game.pjId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pj_json:bundle,feats:game.feats,pj_score:computeScore(bundle),pj_name:game.player.name,last_use:new Date().toISOString()})}).catch(e=>console.error('No se pudo guardar la dungeon completada',e));
 banner(`DUNGEON COMPLETADA · ${tierDefs[rarity]?.label||rarity}`);log('Dungeon completada: recibes un objeto del tier máximo permitido para tu nivel.','loot');
}
function characterBundleFromGame(){
 return {player:game.player,inventory:game.inventory||[],achievements:game.achievements||{},feats:normalizeFeats(game.feats),bossesKilled:game.bossesKilled||0,chestsOpened:game.chestsOpened||0,maxFloorReached:Math.max(game.maxFloorReached||1,game.floor||1)};
}

async function finishCharacterCreation(){
 const bundle={player:game.player,inventory:game.inventory||[],achievements:game.achievements||{},feats:normalizeFeats(),bossesKilled:0,chestsOpened:0,maxFloorReached:1};
 const score=computeScore(bundle);
 try{
  const r=await fetch('/api/user-pj',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:window.currentUser.nombre,pj_name:bundle.player.name,pj_json:bundle,feats:bundle.feats,pj_status:'alive',pj_score:score,last_use:new Date().toISOString()})});
  const data=await r.json().catch(()=>null);
  // api/user-pj.js forwards Supabase/PostgREST's response verbatim on error,
  // whose shape is {message, details, hint, code} - not {error} - so reading
  // only data.error silently swallowed the real reason and always showed the
  // generic fallback instead. Try every field PostgREST/our own handler
  // actually uses, in order, before giving up on a real message.
  if(!r.ok)throw new Error(data?.error||data?.message||data?.details||data?.hint||`HTTP ${r.status}${r.statusText?' '+r.statusText:''}`);
  // Explicit, blocking confirmation (not just the transient on-canvas banner,
  // which can get lost across this exact screen transition) that the
  // character actually made it into Supabase before we tear down `game` and
  // navigate away - this is the "it looked like it worked but nothing got
  // created" case made impossible to miss.
  alert(`Personaje "${bundle.player.name}" creado y guardado correctamente.`);
  refreshCurrentUserProgress();
 }catch(e){
  console.error('No se pudo guardar el personaje nuevo:',e);
  alert('Error al guardar el personaje: '+e.message);
 }
 game=null;
 startOverlay.classList.add('hidden');
 app.classList.add('hidden');
 openSinglePlayerScreen();
}

function openSinglePlayerScreen(){
 if(!configItems.length)fetchConfigItems();if(!configChests.length)fetchConfigChests();if(!configClasses.length)fetchConfigClasses();if(!configWorldObjectsLoaded)fetchConfigWorldObjects();
 landingOverlay.classList.add('hidden');
 singlePlayerOverlay.classList.remove('hidden');
 document.getElementById('spListStatus')?.classList.add('hidden');
 document.getElementById('spList')?.classList.add('hidden');
}
function closeSinglePlayerScreen(){
 singlePlayerOverlay.classList.add('hidden');
 landingOverlay.classList.remove('hidden');
}

async function fetchMyCharacters(){
 const r=await fetch(`/api/user-pj?nombre=${encodeURIComponent(window.currentUser.nombre)}`);
 const data=await r.json();
 if(!r.ok)throw new Error(data.error||'No se pudieron cargar tus personajes');
 return Array.isArray(data)?data:[];
}

function openCharacterCreation(){
 landingOverlay.classList.add('hidden');
 singlePlayerOverlay.classList.add('hidden');
 app.classList.remove('hidden');
 startOverlay.classList.remove('hidden');
 nameInput.value='';
 document.getElementById('raceAccordion')?.removeAttribute('open');
 document.getElementById('classAccordion')?.removeAttribute('open');
 fetchConfigClasses();
 if(!configGatesLoaded)fetchConfigGates();else{renderRaceChoices();renderClassChoices()}
}

async function openCharacterSelection(){
 const status=document.getElementById('spListStatus'),list=document.getElementById('spList');
 status.classList.remove('hidden');list.classList.remove('hidden');
 status.textContent='Cargando tus personajes...';list.innerHTML='';
 try{
  const chars=(await fetchMyCharacters()).filter(c=>c.pj_status==='alive');
  if(!chars.length){status.textContent='No tienes personajes vivos. Crea uno nuevo.';return}
  status.textContent=`${chars.length} personaje(s) disponibles.`;
  list.innerHTML=chars.map(c=>`<button type="button" class="worldCard" data-pj-id="${c.id}"><b>${c.pj_name||'Sin nombre'}</b><span>${c.pj_json?.player?.className||''} · ${c.pj_json?.player?.raceName||''} · Nivel ${c.pj_json?.player?.level||1}</span><small>Score ${Math.round(c.pj_score||0)} · Último uso ${c.last_use?new Date(c.last_use).toLocaleString():'-'}</small></button>`).join('');
  list.querySelectorAll('[data-pj-id]').forEach(btn=>btn.onclick=()=>{
   currentCharacter=chars.find(c=>String(c.id)===btn.dataset.pjId);
   singlePlayerOverlay.classList.add('hidden');
   app.classList.remove('hidden');
   dungeonOverlay.classList.remove('hidden');
   const p=currentCharacter.pj_json?.player;
   document.getElementById('dungeonCharacterLabel').textContent=`Personaje: ${currentCharacter.pj_name} · ${p?.className||''} nivel ${p?.level||1}`;
   fetchDungeonWorlds();fetchConfigItems();fetchConfigClasses();fetchConfigFloors();fetchEnemyConfig();fetchConfigChests();if(!configWorldObjectsLoaded)fetchConfigWorldObjects();setupWorldSettings();
  });
 }catch(e){status.textContent=`Error: ${e.message}`}
}

async function openSessionContinue(){
 const status=document.getElementById('spListStatus'),list=document.getElementById('spList');
 status.classList.remove('hidden');list.classList.remove('hidden');
 status.textContent='Cargando sesiones...';list.innerHTML='';
 try{
  const [chars,sessionsRes,worldsRes]=await Promise.all([fetchMyCharacters(),fetch('/api/dungeon-status?light=1'),fetch('/api/dungeon-worlds?light=1')]);
  const myIds=new Set(chars.map(c=>String(c.id)));
  const sessions=await sessionsRes.json();
  if(!sessionsRes.ok)throw new Error(sessions.error||sessions.message||'No se pudieron cargar las sesiones');
  const worlds=await worldsRes.json();
  if(!worldsRes.ok)throw new Error(worlds.error||worlds.message||'No se pudieron cargar los mundos');
  const mine=sessions.filter(s=>{if(s.dungeon_status?.multiplayer)return false;try{return (JSON.parse(s.players_ID||'[]')||[]).some(id=>myIds.has(String(id)))}catch(e){return false}});
  if(!mine.length){status.textContent='No tienes sesiones activas.';return}
  status.textContent=`${mine.length} sesión(es) activas.`;
  list.innerHTML=mine.map(s=>{
   let ids=[];try{ids=JSON.parse(s.players_ID||'[]')}catch(e){}
   const owner=chars.find(c=>ids.map(String).includes(String(c.id)));
   const world=worlds.find(w=>String(w.id)===String(s.dungeon_world_id));
   const floor=s.dungeon_status?.currentFloor||1,turn=s.dungeon_status?.turn||0,totalFloors=world?.world_json?.params?.floors||world?.world_json?.floors?.length||'?';
   return `<button type="button" class="worldCard" data-session-id="${s.id}"><b>${world?.world_name||('Mundo #'+s.dungeon_world_id)}</b><span>${owner?.pj_name||'Sesión'} · ${totalFloors} pisos</span><small>Piso actual ${floor} · Turno ${turn} · Creada ${new Date(s.created_at).toLocaleString()}</small></button>`;
  }).join('');
  list.querySelectorAll('[data-session-id]').forEach(btn=>btn.onclick=()=>resumeSession(btn.dataset.sessionId));
 }catch(e){status.textContent=`Error: ${e.message}`}
}

async function resumeSession(sessionId){
 try{
  if(!configItems.length)fetchConfigItems();if(!configChests.length)fetchConfigChests();if(!configClasses.length)fetchConfigClasses();if(!configWorldObjectsLoaded)fetchConfigWorldObjects();
  const statusRes=await fetch(`/api/dungeon-status?id=${encodeURIComponent(sessionId)}`);
  const session=await statusRes.json();if(!statusRes.ok)throw new Error(session.error||session.message||'No se pudo cargar la sesión');
  let ids=[];try{ids=JSON.parse(session.players_ID||'[]')}catch(e){}
  const pjId=ids[0];
  const [worldRes,pjRes]=await Promise.all([fetch(`/api/dungeon-worlds?id=${encodeURIComponent(session.dungeon_world_id)}`),fetch(`/api/user-pj?id=${encodeURIComponent(pjId)}`)]);
  const world=await worldRes.json();if(!worldRes.ok)throw new Error(world.error||world.message||'No se pudieron cargar los mundos');
  if(!world)throw new Error('El mundo de esta sesión ya no existe.');
  const pj=await pjRes.json();if(!pjRes.ok)throw new Error(pj.error||pj.message||'No se pudo cargar el personaje');
  if(!pj||pj.pj_status!=='alive')throw new Error('El personaje de esta sesión ya no está vivo.');
  currentCharacter=pj;selectedDungeonWorld=world;
  const state=session.dungeon_status||{};
  const bundle=pj.pj_json||{};
  const player=bundle.player;
  const floorNum=state.currentFloor||1;
  const overlay=state.floors?.[String(floorNum)]||null;
  game={floor:floorNum,themeIndex:0,turn:state.turn||0,dungeonWorldId:world.id,dungeonWorldName:world.world_name,worldParams:normalizeWorldParams(world.world_json?.params),inventory:bundle.inventory||[],achievements:bundle.achievements||{},feats:normalizeFeats(pj.feats||bundle.feats),bossesKilled:bundle.bossesKilled||0,chestsOpened:bundle.chestsOpened||0,maxFloorReached:bundle.maxFloorReached||1,player,pjId:pj.id,dungeonStatusId:session.id,sessionFloors:state.floors||{}};
 game.player.shards=pj.shards?normalizeShards(pj.shards):(game.player.shards||{});
 game.player.customItems=pj.custom_items||game.player.customItems||[];
  singlePlayerOverlay.classList.add('hidden');
  app.classList.remove('hidden');
  if(overlay&&overlay.map){
   applyFloorSnapshot(overlay);
  }else{
   generateFloor();
   if(overlay){
    if(overlay.enemies)game.enemies=overlay.enemies;
    if(overlay.chests)game.chests=overlay.chests;
    if(overlay.doors)game.doors=overlay.doors;
    if(overlay.keys)game.keys=overlay.keys;
    if(overlay.companions)game.companions=overlay.companions;
    if(overlay.skillObjects)game.skillObjects=overlay.skillObjects;
    if(overlay.seen&&overlay.seen.length)game.seen=decodeSeen(overlay.seen);
    game.boss=game.enemies.find(e=>e.boss)||null;
   }
  }
  // The restored floor's enemies (snapshot or precomputed) may have been
  // leveled against a stale player.level - rescale them to the character's
  // current level (clamped ±2 by enemyLevelForFloor) right after loading.
  scaleFloorForPlayerLevel();scaleFloorForParty();
  const pos=state.players?.[String(pj.id)];
  if(pos){game.player.x=pos.x;game.player.y=pos.y;game.player.facing=pos.facing||game.player.facing}
  anim.heroX=anim.targetX=game.player.x;anim.heroY=anim.targetY=game.player.y;anim.t=1;reveal(game.player.x,game.player.y);
  syncAllEquipmentPassives();recomputeDerived();updateUI();draw();banner(`SESIÓN RESTAURADA · PISO ${game.floor}`);
 }catch(e){alert('Error al continuar la sesión: '+e.message)}
}

async function enterWorldWithCharacter(){
 if(!currentCharacter){banner('Selecciona un personaje primero.');return}
 dungeonOverlay.classList.add('hidden');
 const bundle=currentCharacter.pj_json||{};
 game={floor:1,themeIndex:0,turn:0,dungeonWorldId:selectedDungeonWorld?.id||null,dungeonWorldName:selectedDungeonWorld?.world_name||null,worldParams:normalizeWorldParams(selectedDungeonWorld?.world_json?.params),inventory:bundle.inventory||[],achievements:bundle.achievements||{},feats:normalizeFeats(currentCharacter.feats||bundle.feats),bossesKilled:bundle.bossesKilled||0,chestsOpened:bundle.chestsOpened||0,maxFloorReached:bundle.maxFloorReached||1,player:bundle.player,pjId:currentCharacter.id};
 // shards live in their own user_pj column (not pj_json) so they survive
 // independently of the rest of the character bundle - see persistShards()
 game.player.shards=currentCharacter.shards?normalizeShards(currentCharacter.shards):(game.player.shards||{});
 // custom-crafted items (Creator's Room) live in their own user_pj column too
 game.player.customItems=currentCharacter.custom_items||game.player.customItems||[];
 generateFloor();
 // New session with an existing character: start the run topped up,
 // regardless of what was persisted from a previous run. Resuming an
 // existing session (resumeSession()) must NOT do this - it keeps whatever
 // hp/stamina/mana was actually saved. maxHp/maxStamina/maxMana are already
 // final here since generateFloor() ran recomputeDerived() above.
 game.player.hp=game.player.maxHp;
 game.player.stamina=game.player.maxStamina;
 game.player.mana=game.player.maxMana;
 try{
  const r=await fetch('/api/dungeon-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dungeon_world_id:String(selectedDungeonWorld.id),players_ID:JSON.stringify([currentCharacter.id]),dungeon_status:{turn:0,currentFloor:1,floors:{},players:{[currentCharacter.id]:{x:game.player.x,y:game.player.y,floor:1,facing:game.player.facing||1}}}})});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||data.message||'No se pudo crear la sesión');
  game.dungeonStatusId=data.id;
 }catch(e){log(`No se pudo crear la sesión persistente: ${e.message}`,'sys')}
 banner(`ENTRAS EN ${selectedDungeonWorld.world_name} CON ${game.player.name}`);
}

function encodeSeen(seen){return (seen||[]).map(row=>row.map(v=>v?1:0).join(''))}
function decodeSeen(seen){
 if(!seen||!seen.length)return Array.from({length:ROWS},()=>Array(COLS).fill(false));
 if(typeof seen[0]==='string')return seen.map(row=>Array.from(row,ch=>ch==='1'));
 return seen;
}
function floorSnapshot(){
 return {floorEntryLevel:game.floorEntryLevel,map:game.map,rooms:game.rooms,safeRooms:game.safeRooms||[],stairs:game.stairs,floorTileset:game.floorTileset,enemyFamily:game.enemyFamily||null,enemies:game.enemies||[],chests:game.chests||[],doors:game.doors||[],keys:game.keys||[],traps:game.traps||[],altars:game.altars||[],assets:game.assets||[],companions:game.companions||[],skillObjects:game.skillObjects||[],seen:encodeSeen(game.seen),objective:game.objective||null,floorArchetype:game.floorArchetype||'standard',floorArchetypeLabel:game.floorArchetypeLabel||'',floorArchetypeDesc:game.floorArchetypeDesc||'',rewardRarityBonus:game.rewardRarityBonus||0};
}
// dynamic-only parts (the static map/rooms/tileset never change within a floor)
function floorSnapshotDynamic(){
 return {stairs:game.stairs,enemyFamily:game.enemyFamily||null,enemies:game.enemies||[],chests:game.chests||[],doors:game.doors||[],keys:game.keys||[],traps:game.traps||[],altars:game.altars||[],companions:game.companions||[],skillObjects:game.skillObjects||[],seen:encodeSeen(game.seen),objective:game.objective||null};
}
function applyFloorSnapshot(overlay){
 Object.assign(game,{floorEntryLevel:overlay.floorEntryLevel||game.floorEntryLevel||game.player?.level||1,map:overlay.map,rooms:overlay.rooms,safeRooms:overlay.safeRooms||[],stairs:overlay.stairs,floorTileset:overlay.floorTileset,enemyFamily:overlay.enemyFamily||null,enemies:overlay.enemies||[],chests:overlay.chests||[],doors:overlay.doors||[],keys:overlay.keys||[],traps:overlay.traps||[],altars:overlay.altars||[],assets:overlay.assets||[],companions:overlay.companions||[],skillObjects:overlay.skillObjects||[],seen:decodeSeen(overlay.seen),objective:overlay.objective||game.objective||null,floorArchetype:overlay.floorArchetype||game.floorArchetype||'standard',floorArchetypeLabel:overlay.floorArchetypeLabel||game.floorArchetypeLabel||'',floorArchetypeDesc:overlay.floorArchetypeDesc||game.floorArchetypeDesc||'',rewardRarityBonus:overlay.rewardRarityBonus??game.rewardRarityBonus??0});
 game.boss=(game.enemies||[]).find(e=>e.boss)||null;
}
function persistTurnState(){
 if(!game?.pjId)return;
 const bundle=characterBundleFromGame();
 game.maxFloorReached=bundle.maxFloorReached;
 // minimal:true - this fires every single turn and the response is never
 // read (fire-and-forget .catch below), so there's no reason to have Supabase
 // echo the whole character/floor blob back down on every write. See the
 // matching opt-in in api/user-pj.js and api/dungeon-status.js.
 fetch(`/api/user-pj?id=${encodeURIComponent(game.pjId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pj_json:bundle,feats:bundle.feats,pj_score:computeScore(bundle),pj_name:game.player.name,last_use:new Date().toISOString(),nombre:window.currentUser?.nombre,minimal:true})}).catch(e=>console.error('No se pudo guardar el personaje',e));
 if(!game.dungeonStatusId)return;
 const dungeonState={turn:game.turn,currentFloor:game.floor,floors:{[game.floor]:floorSnapshot()},players:{[game.pjId]:{x:game.player.x,y:game.player.y,floor:game.floor,facing:game.player.facing||1}}};
 game.sessionFloors=dungeonState.floors;
 fetch(`/api/dungeon-status?id=${encodeURIComponent(game.dungeonStatusId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({dungeon_status:dungeonState,minimal:true})}).catch(e=>console.error('No se pudo guardar la sesión',e));
}

async function finalizeCharacterDeath(){
 if(!game?.pjId)return;
 const bundle=characterBundleFromGame();
 try{
  await fetch(`/api/user-pj?id=${encodeURIComponent(game.pjId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pj_json:bundle,feats:bundle.feats,pj_score:computeScore(bundle),pj_status:'dead',last_use:new Date().toISOString()})});
 }catch(e){console.error('No se pudo marcar el personaje como muerto',e)}
 if(game.multiplayer){
  if(mpGamePollTimer){clearInterval(mpGamePollTimer);mpGamePollTimer=null}
  stopMpTradePolling();
  const deadId=String(game.pjId);
  mpClearLiveTimers();
  mpResetActionQueues();
  game.mpSeq=(game.mpSeq||0)+1; // death outranks any in-flight live turn
  game.turnOrder=(game.turnOrder||[]).filter(id=>String(id)!==deadId);
  // remove the dead player from the shared turn order and mark hp 0 so nobody waits on them
  await mpSaveSession(game.dungeonStatusId,fresh=>{
   const order=(fresh.turnOrder||[]).map(String);
   const idx=order.indexOf(deadId);
   const newOrder=(fresh.turnOrder||[]).filter(id=>String(id)!==deadId);
   let active=fresh.activePlayerIndex||0,turn=fresh.turn||0;
   if(idx>-1){
    if(idx<active)active--;
    else if(idx===active&&idx===order.length-1){active=0;turn++}
   }
   if(active<0||active>=newOrder.length)active=0;
   const players={...fresh.players};
   if(players[deadId])players[deadId]={...players[deadId],hp:0};
   return {dungeon_status:{...fresh,turnOrder:newOrder,activePlayerIndex:active,turn,players,seq:Math.max(Number(fresh.seq)||0,game.mpSeq||0)}};
  });
  return;
 }
 if(game.dungeonStatusId){
  try{await fetch(`/api/dungeon-status?id=${encodeURIComponent(game.dungeonStatusId)}`,{method:'DELETE'})}catch(e){console.error('No se pudo borrar la sesión',e)}
 }
}

async function fetchScores(){
 const status=document.getElementById('scoresStatus'),table=document.getElementById('scoresTable');
 status.textContent='Cargando puntuaciones...';table.innerHTML='';
 try{
  const r=await fetch('/api/user-pj');const data=await r.json();
  if(!r.ok)throw new Error(data.error||'No se pudieron cargar las puntuaciones');
  if(!data.length){status.textContent='Todavía no hay personajes.';return}
  status.textContent=`${data.length} personaje(s).`;
  table.innerHTML=`<table class="scoresGrid"><thead><tr><th>#</th><th>Personaje</th><th>Usuario</th><th>Estado</th><th>Clase</th><th>Raza</th><th>Nivel</th><th>Élites</th><th>Jefes</th><th>Megaboss</th><th>Dungeons</th><th>Score</th><th>Último uso</th></tr></thead><tbody>${data.map((c,i)=>{const p=c.pj_json?.player||{},f=normalizeFeats(c.feats||c.pj_json?.feats);return `<tr class="${c.pj_status==='dead'?'deadRow':''}"><td>${i+1}</td><td>${c.pj_name||'-'}</td><td>${c.nombre||'-'}</td><td>${c.pj_status==='dead'?'Muerto':'Vivo'}</td><td>${p.className||'-'}</td><td>${p.raceName||'-'}</td><td>${p.level||1}</td><td>${f.elites}</td><td>${f.bosses}</td><td>${f.megabosses}</td><td>${f.dungeons}</td><td>${Math.round(c.pj_score||0)}</td><td>${c.last_use?new Date(c.last_use).toLocaleString():'-'}</td></tr>`}).join('')}</tbody></table>`;
 }catch(e){status.textContent=`Error: ${e.message}`}
}

function renderCharacterCards(chars){
 return chars.map(c=>`<button type="button" class="worldCard" data-pj-id="${c.id}"><b>${c.pj_name||'Sin nombre'}</b><span>${c.pj_json?.player?.className||''} · ${c.pj_json?.player?.raceName||''} · Nivel ${c.pj_json?.player?.level||1}</span><small>Score ${Math.round(c.pj_score||0)} · Último uso ${c.last_use?new Date(c.last_use).toLocaleString():'-'}</small></button>`).join('');
}

async function enterMultiplayerScreen(){
 landingOverlay.classList.add('hidden');
 multiplayerOverlay.classList.remove('hidden');
 loadRtConfig();
 if(!multiSessionId)await loginMultiSession();
 refreshOnlineUsers();
 refreshOpenSessions();
 startMultiHeartbeat();
}
function startMultiHeartbeat(){
 if(!multiHeartbeatTimer)multiHeartbeatTimer=setInterval(()=>{heartbeatMultiSession();refreshOnlineUsers();refreshOpenSessions()},8000);
}
// The 8s presence timer refetches the whole session list; during a game it
// competes with turn sync (multi-second stalls), so it must stop here.
function stopMultiHeartbeat(){
 if(multiHeartbeatTimer){clearInterval(multiHeartbeatTimer);multiHeartbeatTimer=null}
}
async function loginMultiSession(){
 try{
  const r=await fetch('/api/multi-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:window.currentUser.nombre})});
  const data=await r.json();
  if(r.ok)multiSessionId=data.id;
 }catch(e){console.error('No se pudo registrar presencia multijugador',e)}
}
function heartbeatMultiSession(){
 if(!multiSessionId)return;
 fetch(`/api/multi-session?id=${encodeURIComponent(multiSessionId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({heartbeat:true})}).catch(e=>console.error(e));
}
function logoutMultiSession(){
 if(!multiSessionId)return;
 const id=multiSessionId;multiSessionId=null;
 fetch(`/api/multi-session?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({logout:true})}).catch(e=>console.error(e));
}
const MAIN_MENU_SCREEN_IDS=['app','singlePlayerOverlay','multiplayerOverlay','mpLobbyOverlay','configScreen','scoresScreen','dungeonOverlay','dungeonPreviewOverlay','startOverlay','storyOverlay'];
function goToMainMenu(){
 // Nothing to lose in testing mode (never persisted) - skip the confirm and
 // drop straight back into Configuración > Modo Testing for fast iteration.
 const wasTesting=!!game?.testingMode;
 if(game&&!wasTesting&&!confirm('¿Volver al menú principal? Perderás el progreso no guardado de este piso.'))return;
 if(game?.multiplayer){logoutMultiSession();mpFlushCheckpointBeacon();cleanupMultiplayerRuntime()}
 if(multiHeartbeatTimer){clearInterval(multiHeartbeatTimer);multiHeartbeatTimer=null}
 if(mpLobbyPollTimer){clearInterval(mpLobbyPollTimer);mpLobbyPollTimer=null}
 if(mpGamePollTimer){clearInterval(mpGamePollTimer);mpGamePollTimer=null}
 game=null;
 for(const id of MAIN_MENU_SCREEN_IDS)document.getElementById(id)?.classList.add('hidden');
 if(wasTesting){
  if(preTestSelectedDungeonWorld!==undefined){selectedDungeonWorld=preTestSelectedDungeonWorld;preTestSelectedDungeonWorld=undefined}
  enterConfig();
  document.querySelector('[data-config-tab="testing"]')?.click();
  return;
 }
 landingOverlay.classList.remove('hidden');
 mainMenuActions?.classList.remove('hidden');
 loginForm?.classList.add('hidden');
}
document.getElementById('globalMenuBtn').onclick=goToMainMenu;
function leaveMultiplayerScreen(){
 logoutMultiSession();
 mpFlushCheckpointBeacon();
 cleanupMultiplayerRuntime();
 if(multiHeartbeatTimer){clearInterval(multiHeartbeatTimer);multiHeartbeatTimer=null}
 multiplayerOverlay.classList.add('hidden');
 landingOverlay.classList.remove('hidden');
}
async function refreshOnlineUsers(){
 const list=document.getElementById('onlineUsersList');
 try{
  const since=new Date(Date.now()-45000).toISOString();
  const r=await fetch(`/api/multi-session?online=1&since=${encodeURIComponent(since)}`);
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||'No se pudo cargar');
  const seen=new Set();
  const names=data.map(u=>u.user_id).filter(n=>{if(!n||seen.has(n))return false;seen.add(n);return true});
  list.innerHTML=names.length?names.map(n=>`<div class="onlineUserRow">${n===window.currentUser?.nombre?`<b>${n} (tú)</b>`:n}</div>`).join(''):'<p class="small">Nadie más conectado.</p>';
 }catch(e){list.innerHTML=`<p class="small">Error: ${e.message}</p>`}
}

async function refreshOpenSessions(){
 const status=document.getElementById('mpOpenStatus'),list=document.getElementById('mpOpenList');
 status.textContent='Cargando sesiones...';list.innerHTML='';
 try{
  const [chars,r]=await Promise.all([fetchMyCharacters(),fetch('/api/dungeon-status?light=1')]);
  const sessions=await r.json();
  if(!r.ok)throw new Error(sessions.error||sessions.message||'No se pudieron cargar sesiones');
  const myIds=new Set(chars.map(c=>String(c.id)));
  const open=sessions.filter(s=>{
   if(!s.dungeon_status?.multiplayer)return false;
   let ids=[];try{ids=JSON.parse(s.players_ID||'[]')||[]}catch(e){}
   return !ids.some(id=>myIds.has(String(id)));
  });
  if(!open.length){status.textContent='No hay sesiones a las que unirse. Crea una.';return}
  status.textContent=`${open.length} sesión(es) disponibles.`;
  list.innerHTML=open.map(s=>{const st=s.dungeon_status||{};const names=(st.roster||[]).map(r=>r.pjName).join(', ');return `<button type="button" class="worldCard" data-open-session="${s.id}"><b>${st.hostUser||'Anfitrión'}</b><span>${st.started?`En curso · Piso ${st.currentFloor||1}`:'Sala de espera'} · ${names}</span><small>Creada ${new Date(s.created_at).toLocaleString()}</small></button>`}).join('');
  list.querySelectorAll('[data-open-session]').forEach(btn=>btn.onclick=()=>mpStartJoinFlow(btn.dataset.openSession));
 }catch(e){status.textContent=`Error: ${e.message}`}
}

async function mpStartCreateFlow(){
 const status=document.getElementById('mpOpenStatus'),list=document.getElementById('mpOpenList');
 status.textContent='Elige un personaje para alojar la partida...';list.innerHTML='';
 try{
  const chars=(await fetchMyCharacters()).filter(c=>c.pj_status==='alive');
  if(!chars.length){status.innerHTML='No tienes personajes vivos. Ve a SINGLE PLAYER → NUEVO PERSONAJE primero.';return}
  list.innerHTML=renderCharacterCards(chars);
  list.querySelectorAll('[data-pj-id]').forEach(btn=>btn.onclick=()=>{
   currentCharacter=chars.find(c=>String(c.id)===btn.dataset.pjId);
   mpPendingAction={type:'host'};
   multiplayerOverlay.classList.add('hidden');
   app.classList.remove('hidden');
   dungeonOverlay.classList.remove('hidden');
   document.getElementById('dungeonCharacterLabel').textContent=`Personaje: ${currentCharacter.pj_name} (anfitrión multijugador)`;
   fetchDungeonWorlds();fetchConfigItems();fetchConfigClasses();fetchConfigFloors();fetchEnemyConfig();fetchConfigChests();if(!configWorldObjectsLoaded)fetchConfigWorldObjects();setupWorldSettings();
  });
 }catch(e){status.textContent=`Error: ${e.message}`}
}

const ENEMY_TIER_LABELS={i:'I',ii:'II',iii:'III',iv:'IV'};
// Reads the world's already-precomputed floors (world_json.floors, baked in
// createDungeonWorldJson) - no need to regenerate anything, this is exactly
// what will actually be used when the player enters each floor.
function buildDungeonPreviewText(worldJson){
 const floors=worldJson?.floors||[];
 if(!floors.length)return 'Esta dungeon no tiene pisos precalculados.';
 return floors.map(f=>{
  const enemyTiers={};for(const e of f.enemies||[]){const t=e.tier||'i';enemyTiers[t]=(enemyTiers[t]||0)+1}
  const enemyLine=Object.keys(ENEMY_TIER_LABELS).map(t=>`Tier ${ENEMY_TIER_LABELS[t]}: ${enemyTiers[t]||0}`).join(' · ');
  const bossLine=f.boss?` · Jefe: ${f.boss.name||'Jefe'}`:'';
  const chestTiers={},chestNames=[];
  for(const c of f.chests||[]){const t=c.chestDef?.tier||'?';chestTiers[t]=(chestTiers[t]||0)+1;if(c.chestDef?.name)chestNames.push(c.chestDef.name)}
  const chestTierLine=[1,2,3,4,5].map(t=>`Tier ${t}: ${chestTiers[t]||0}`).join(' · ');
  const nameCounts=chestNames.reduce((acc,n)=>{acc[n]=(acc[n]||0)+1;return acc},{});
  const namesLine=Object.keys(nameCounts).length?Object.entries(nameCounts).map(([n,c])=>c>1?`${n} x${c}`:n).join(', '):'Ninguno';
  return `PISO ${f.floor} (${f.themeName||''})\n Enemigos -> ${enemyLine}${bossLine}\n Cofres por tier -> ${chestTierLine}\n Cofres asignados -> ${namesLine}`;
 }).join('\n\n');
}
function proceedAfterWorldChosen(){
 const text=document.getElementById('dungeonPreviewText');
 if(text)text.textContent=buildDungeonPreviewText(selectedDungeonWorld?.world_json);
 dungeonOverlay.classList.add('hidden');
 document.getElementById('dungeonPreviewOverlay')?.classList.remove('hidden');
 document.getElementById('dungeonPreviewContinueBtn').onclick=()=>{
  document.getElementById('dungeonPreviewOverlay')?.classList.add('hidden');
  if(mpPendingAction?.type==='host'){mpCreateHostSession();return}
  enterWorldWithCharacter();
 };
 document.getElementById('dungeonPreviewBackBtn').onclick=()=>{
  document.getElementById('dungeonPreviewOverlay')?.classList.add('hidden');
  dungeonOverlay.classList.remove('hidden');
 };
}

async function mpCreateHostSession(){
 dungeonOverlay.classList.add('hidden');
 const bundle=currentCharacter.pj_json||{};
 const roster=[{pjId:currentCharacter.id,nombre:window.currentUser.nombre,pjName:currentCharacter.pj_name,className:bundle.player?.className,level:bundle.player?.level||1}];
 const status={multiplayer:true,started:false,host:currentCharacter.id,hostUser:window.currentUser.nombre,roster,turnOrder:[currentCharacter.id],activePlayerIndex:0,turn:0,currentFloor:1,floors:{},players:{},rev:0};
 try{
  const r=await fetch('/api/dungeon-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dungeon_world_id:String(selectedDungeonWorld.id),players_ID:JSON.stringify([currentCharacter.id]),dungeon_status:status})});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||data.message||'No se pudo crear la sesión multijugador');
  mpPendingAction=null;
  openMpLobby(data.id,true);
 }catch(e){alert('Error al crear la sesión: '+e.message)}
}

async function mpStartJoinFlow(sessionId){
 const status=document.getElementById('mpOpenStatus'),list=document.getElementById('mpOpenList');
 status.textContent='Elige un personaje para unirte...';list.innerHTML='';
 try{
  const chars=(await fetchMyCharacters()).filter(c=>c.pj_status==='alive');
  if(!chars.length){status.innerHTML='No tienes personajes vivos.';return}
  list.innerHTML=renderCharacterCards(chars);
  list.querySelectorAll('[data-pj-id]').forEach(btn=>btn.onclick=()=>mpJoinSession(sessionId,chars.find(c=>String(c.id)===btn.dataset.pjId)));
 }catch(e){status.textContent=`Error: ${e.message}`}
}

function isWalkableTile(map,x,y){return !!(map&&map[y]&&map[y][x]===0)}
function mpFreeSpawnNear(map,enemies,occupiedList,base){
 if(!base)return null;
 if(!map)return {x:base.x,y:base.y};
 const occupied=occupiedList||[];
 const candidates=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]];
 for(const [dx,dy] of candidates){
  const pos={x:base.x+dx,y:base.y+dy};
  if(isWalkableTile(map,pos.x,pos.y)&&!(enemies||[]).some(e=>e.x===pos.x&&e.y===pos.y)&&!occupied.includes(`${pos.x},${pos.y}`))return pos;
 }
 return {x:base.x,y:base.y};
}

// ---- Multiplayer low-latency transport -------------------------------------
// Hot-path reads/writes go straight to Supabase REST (no serverless cold
// starts) and committed writes are pushed to the other clients via Supabase
// Realtime broadcast. /api/dungeon-status remains as fallback and polling
// stays as a 2s safety net. Correctness is unchanged: every apply and every
// write still goes through the rev optimistic lock, so a late/out-of-order
// message can never re-grant an already-passed turn.
async function loadRtConfig(){
 if(rtConfig!==undefined)return rtConfig;
 try{
  const r=await fetch('/api/rt-config');
  rtConfig=r.ok?await r.json():null;
  if(rtConfig&&!rtConfig.url)rtConfig=null;
 }catch(e){rtConfig=null}
 return rtConfig;
}
function dsHeaders(){return {apikey:rtConfig.key,Authorization:`Bearer ${rtConfig.key}`,'Content-Type':'application/json'}}
async function dsGet(id){
 if(rtConfig?.url){
  try{
   const r=await fetch(`${rtConfig.url}/rest/v1/dungeon_status?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:dsHeaders()});
   if(r.ok){const d=await r.json();return Array.isArray(d)?d[0]||null:d}
  }catch(e){}
 }
 const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(id)}`);
 const d=await r.json();
 return r.ok?d:null;
}
async function dsGetRev(id){
 if(rtConfig?.url){
  try{
   const r=await fetch(`${rtConfig.url}/rest/v1/dungeon_status?select=rev:dungeon_status->>rev&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:dsHeaders()});
   if(r.ok){const d=await r.json();return Number((Array.isArray(d)?d[0]:d)?.rev)||0}
  }catch(e){}
 }
 const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(id)}&light=1`);
 if(!r.ok)return null;
 return Number((await r.json())?.rev)||0;
}
// returns {ok,conflict,data}
// minimal=true skips the row echo in the response (saves ~50KB of download per
// write); the CAS conflict is then detected via the Content-Range count. If the
// header is missing we conservatively report a conflict so the caller re-reads
// (the retry uses the representation path, so this can never loop).
async function dsPatch(id,row,expectedRev,minimal=false){
 if(rtConfig?.url){
  try{
   let f=`id=eq.${encodeURIComponent(id)}`;
   const hasRev=expectedRev!==undefined&&expectedRev!==null;
   if(hasRev)f+=`&dungeon_status->>rev=eq.${encodeURIComponent(String(expectedRev))}`;
   const prefer=minimal?'return=minimal,count=exact':'return=representation';
   const r=await fetch(`${rtConfig.url}/rest/v1/dungeon_status?${f}`,{method:'PATCH',headers:{...dsHeaders(),Prefer:prefer},body:JSON.stringify(row)});
   if(r.ok){
    if(minimal){
     if(!hasRev)return {ok:true,data:null};
     const cr=r.headers.get('content-range');
     if(!cr||/\/0$/.test(cr))return {ok:false,conflict:true};
     return {ok:true,data:null};
    }
    const d=await r.json();
    if(hasRev&&Array.isArray(d)&&!d.length)return {ok:false,conflict:true};
    return {ok:true,data:d};
   }
  }catch(e){}
 }
 const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...row,expectedRev})});
 if(r.status===409)return {ok:false,conflict:true};
 const d=await r.json().catch(()=>null);
 return {ok:r.ok,data:d};
}
let rtConnectPromise=null;
async function mpRealtimeConnect(sessionId){
 if(rtConnectPromise)await rtConnectPromise.catch(()=>{});
 if(rtChannel&&String(rtChannelSessionId)===String(sessionId))return;
 rtConnectPromise=(async()=>{
  mpSetRealtimeStatus('connecting');
  const cfg=await loadRtConfig();
  if(!cfg||!window.supabase){mpSetRealtimeStatus('error');return}
  mpRealtimeDisconnect();
  mpSetRealtimeStatus('connecting'); // mpRealtimeDisconnect() reset it to idle
  if(!rtClient)rtClient=window.supabase.createClient(cfg.url,cfg.key);
  rtChannelSessionId=String(sessionId);
  rtChannel=rtClient.channel(`ds-${sessionId}`,{config:{broadcast:{self:false}}});
  rtChannel.on('broadcast',{event:'state'},({payload})=>mpOnRemoteBroadcast(sessionId,payload));
  rtChannel.on('broadcast',{event:'turn'},({payload})=>mpOnRemoteTurn(sessionId,payload));
  rtChannel.on('broadcast',{event:'ack'},({payload})=>mpOnAck(payload));
  rtChannel.on('broadcast',{event:'need'},({payload})=>mpOnNeed(payload));
  rtChannel.on('broadcast',{event:'full'},({payload})=>mpOnFull(payload));
  rtChannel.on('broadcast',{event:'trade'},()=>mpOnRemoteTrade(sessionId));
  rtChannel.on('broadcast',{event:'action'},({payload})=>handleMpAction(payload));
  rtChannel.subscribe(status=>{
   // Supabase statuses: SUBSCRIBED | CHANNEL_ERROR | TIMED_OUT | CLOSED
   mpSetRealtimeStatus(status==='SUBSCRIBED'?'subscribed':status==='CHANNEL_ERROR'?'error':status==='TIMED_OUT'?'degraded':status==='CLOSED'?'closed':'connecting');
  });
 })();
 try{await rtConnectPromise}finally{rtConnectPromise=null}
}
function mpRealtimeDisconnect(){
 if(rtChannel){try{rtClient?.removeChannel(rtChannel)}catch(e){}}
 rtChannel=null;rtChannelSessionId=null;
 mpSetRealtimeStatus('idle');
}
function mpBroadcastState(id,status){
 if(!rtChannel||!rtReady||String(rtChannelSessionId)!==String(id))return;
 // strip the static floor layout from the wire copy (~15KB less per message);
 // same-floor receivers never need it and floor-change receivers refetch full
 let wire=status;
 try{
  const floors=status.floors||{};
  const slim={};let changed=false;
  for(const [k,v] of Object.entries(floors)){
   if(v&&v.map){const {map,rooms,safeRooms,floorTileset,...rest}=v;slim[k]=rest;changed=true}
   else slim[k]=v;
  }
  if(changed)wire={...status,floors:slim,slimFloors:true};
 }catch(e){}
 try{rtChannel.send({type:'broadcast',event:'state',payload:{rev:status.rev,status:wire}})}catch(e){}
}
// =============================================================================
// MULTIPLAYER REALTIME VISUAL ACTIONS
// -----------------------------------------------------------------------------
// Separates FOUR concerns that used to be conflated into a single "turn"
// broadcast sent only once the whole action (and, worse, the whole enemy
// phase) had already resolved locally:
//   1. Immediate visual playback  -> ephemeral `action` broadcasts (this block)
//   2. Definitive turn state      -> `turn` broadcast, semantically `turn_commit`
//      (see mpTurnPayload/mpPublishTurn/mpOnRemoteTurn below; unchanged CAS,
//      seq, ACK, resend, need/full, checkpoint machinery)
//   3. Periodic persistence       -> mpCheckpoint (unchanged)
//   4. Recovery from loss/disconnect -> need/full + DB poll (unchanged)
//
// `action` messages are pure visual sugar: fire-and-forget, deduplicated by
// eventId, ordered best-effort per author with a short buffer/timeout, never
// written to Supabase, never authoritative. The authoritative state keeps
// arriving exactly as before via `turn`; if an `action` is lost, delayed, or
// duplicated, the worst case is a missed/doubled animation - the next
// `turn_commit` still reconciles position/HP/enemies/etc. correctly.
// =============================================================================

const MP_PROTOCOL_VERSION=2;
// Toggle from the console with: localStorage.mpDebugLatency='1' (or '0' to disable)
const MP_DEBUG_LATENCY=(()=>{try{return localStorage.getItem('mpDebugLatency')==='1'}catch(e){return false}})();

// ---- Telemetry --------------------------------------------------------------
// Centralized so latency can be localized to created->sent, sent->received,
// received->applied or applied->rendered without console.log scattered around.
const MP_TELEMETRY_MAX=300;
const mpTelemetryLog=[];
const mpTelemetryEvents=new Map();
function mpDebugEvent(stage,data){
 if(!MP_DEBUG_LATENCY)return;
 const entry={stage,...data,loggedAt:Date.now()};
 mpTelemetryLog.push(entry);
 if(mpTelemetryLog.length>MP_TELEMETRY_MAX)mpTelemetryLog.shift();
 console.debug('[mp]',stage,entry);
}
function mpTelemetryStart(eventId,base){
 if(!MP_DEBUG_LATENCY)return;
 mpTelemetryEvents.set(eventId,{eventId,...base,createdAt:Date.now()});
 if(mpTelemetryEvents.size>MP_TELEMETRY_MAX){const k=mpTelemetryEvents.keys().next().value;mpTelemetryEvents.delete(k)}
}
function mpTelemetryMark(eventId,field,extra){
 if(!MP_DEBUG_LATENCY)return;
 const rec=mpTelemetryEvents.get(eventId);if(!rec)return;
 rec[field]=Date.now();
 if(extra)Object.assign(rec,extra);
 mpDebugEvent(field,rec);
}
function mpPayloadBytes(payload){
 try{return new Blob([JSON.stringify(payload)]).size}catch(e){try{return JSON.stringify(payload).length}catch(e2){return -1}}
}
// Non-critical (visual) errors are logged and swallowed: the game must keep
// running on turn_commit even if a visual ping fails end to end.
function mpReportError(context,error,metadata){
 console.error(`[mp:${context}]`,error?.message||error,metadata||'');
 mpDebugEvent('error',{context,message:String(error?.message||error),...metadata});
}

// ---- Explicit Realtime connection state --------------------------------------
// A channel object existing is not the same as Realtime being usable: track
// the actual Supabase status so callers can tell "connecting" from "degraded".
let mpRealtimeStatus='idle'; // idle|connecting|subscribed|degraded|error|closed
let mpTransportMode='fallback'; // realtime|fallback
function mpSyncRealtimeStatusToGame(){
 if(!game)return;
 game.mpRealtimeStatus=mpRealtimeStatus;
 game.mpRealtimeReady=mpRealtimeStatus==='subscribed';
 game.mpTransportMode=mpTransportMode;
}
function mpSetRealtimeStatus(status){
 mpRealtimeStatus=status;
 mpTransportMode=status==='subscribed'?'realtime':'fallback';
 rtReady=status==='subscribed';
 mpSyncRealtimeStatusToGame();
 mpAdjustPollInterval();
 mpUpdateConnBadge();
 mpDebugEvent('realtime_status',{status,transportMode:mpTransportMode});
}
function mpUpdateConnBadge(){
 const el=document.getElementById('mpConnBadge');
 if(!el)return;
 if(!game?.multiplayer){el.classList.add('hidden');return}
 el.classList.remove('hidden');
 el.classList.toggle('mpConnDegraded',mpRealtimeStatus!=='subscribed');
 el.textContent=mpRealtimeStatus==='subscribed'?'● TIEMPO REAL':mpRealtimeStatus==='connecting'?'○ CONECTANDO...':'○ MODO DEGRADADO';
 el.title=mpRealtimeStatus==='subscribed'?'Conexión en tiempo real activa':'Sin tiempo real: usando guardado periódico como respaldo';
}

// ---- Per-author visual action queue (reorder tolerance + small stabilizer) --
const MP_ACTION_REORDER_WAIT_MS=80;
const MP_REMOTE_ACTION_BUFFER_MS=80;
const MP_PROCESSED_EVENT_TTL_MS=60_000;
const MP_PROCESSED_EVENT_MAX=500;
const processedActionIds=new Map(); // eventId -> Date.now(), capped + TTL-pruned
const mpAuthorQueues=new Map();     // author -> {expected, items:Map(actionSeq->{message,arrivedAt,dueAt})}
let mpActionSeqCounter=0;
let mpActionDrainTimer=null;

function mpNextActionSeq(){return ++mpActionSeqCounter}
function mpResetActionSeq(){mpActionSeqCounter=0}
function mpMarkActionProcessed(eventId){
 mpPruneProcessedActions();
 processedActionIds.set(eventId,Date.now());
 if(processedActionIds.size>MP_PROCESSED_EVENT_MAX){const k=processedActionIds.keys().next().value;processedActionIds.delete(k)}
}
function mpPruneProcessedActions(){
 const cutoff=Date.now()-MP_PROCESSED_EVENT_TTL_MS;
 for(const [id,t] of processedActionIds)if(t<cutoff)processedActionIds.delete(id);
}
// Queues are keyed by (author, turnSeq): actionSeq restarts at 1 every turn
// (see sendMpAction), so the "expected" counter must reset per turn too, or a
// reused actionSeq from a new turn could never satisfy a stale expectation
// left over from the previous one.
function mpQueueKey(author,turnSeq){return `${author}|${turnSeq}`}
function mpAuthorQueue(author,turnSeq){
 const key=mpQueueKey(author,turnSeq);
 let q=mpAuthorQueues.get(key);
 if(!q){q={expected:1,items:new Map()};mpAuthorQueues.set(key,q)}
 return q;
}
// Once a turn_commit for `seq` (or later) has been applied, any queued visual
// actions for turnSeq<=seq are moot - the confirmed state already supersedes
// them - so drop them instead of leaking queue entries forever.
function mpPruneActionQueuesUpTo(seq){
 for(const key of mpAuthorQueues.keys()){
  const turnSeq=Number(key.split('|')[1]);
  if(Number.isFinite(turnSeq)&&turnSeq<=seq)mpAuthorQueues.delete(key);
 }
}
// Called on floor change, resync, reconnect or leaving: stale visual actions
// must never be replayed against a state they no longer describe.
function mpResetActionQueues(){
 mpAuthorQueues.clear();
 processedActionIds.clear();
 mpResetActionSeq();
 if(mpActionDrainTimer){clearInterval(mpActionDrainTimer);mpActionDrainTimer=null}
 game&&(game.mpEnemyPhaseRemote=false);
}
function mpArmActionDrain(){
 if(mpActionDrainTimer)return;
 mpActionDrainTimer=setInterval(mpDrainActionQueues,20);
}
// Strict per-author ordering with a bounded wait for the expected actionSeq.
// If the gap-filler doesn't show up within MP_ACTION_REORDER_WAIT_MS, skip
// ahead and play what's available - turn_commit reconciles the true state
// regardless, so a permanently-stuck queue is worse than a small skip.
function mpDrainActionQueues(){
 const now=Date.now();
 let anyPending=false;
 for(const q of mpAuthorQueues.values()){
  while(true){
   const next=q.items.get(q.expected);
   if(next){
    if(next.dueAt<=now){
     mpPlayRemoteAction(next.message);
     q.items.delete(q.expected);
     q.expected++;
     continue;
    }
    anyPending=true;break;
   }
   let forced=false;
   for(const [seq,item] of q.items){
    if(seq>q.expected&&now-item.arrivedAt>=MP_ACTION_REORDER_WAIT_MS&&item.dueAt<=now){q.expected=seq;forced=true;break}
   }
   if(forced)continue;
   if(q.items.size>0)anyPending=true;
   break;
  }
 }
 if(!anyPending&&mpActionDrainTimer){clearInterval(mpActionDrainTimer);mpActionDrainTimer=null}
}

// ---- Sending ------------------------------------------------------------
// Fire-and-forget: never awaited by callers, so a visual ping can never delay
// the local simulation or the turn_commit that follows it. kind/data shape is
// documented in the action-kind list; keep payloads small (ids+coords only).
function sendMpAction(kind,data){
 if(!game?.multiplayer)return;
 // recorded for the turn-commit replay regardless of transport; the live
 // broadcast below is best-effort and only goes out when Realtime is ready
 if(kind!=='floor_transition_start'){game.mpTurnActions=(game.mpTurnActions||[]).concat({kind,...data}).slice(-60)}
 if(!mpLive())return;
 try{
  const turnSeq=(game.mpSeq||0)+1,actionSeq=mpNextActionSeq();
  const eventId=`${game.pjId}-${turnSeq}-${actionSeq}-${Math.random().toString(36).slice(2,8)}`;
  const now=Date.now();
  const payload={protocolVersion:MP_PROTOCOL_VERSION,type:'action',sessionId:String(game.dungeonStatusId),eventId,author:String(game.pjId),turnSeq,actionSeq,createdAt:now,sentAt:now,floor:game.floor,action:{kind,...data}};
  mpTelemetryStart(eventId,{eventType:'action',sessionId:payload.sessionId,author:payload.author,turnSeq,actionSeq,channelStatus:mpRealtimeStatus,transportMode:mpTransportMode});
  const bytes=mpPayloadBytes(payload);
  mpTelemetryMark(eventId,'sentAt',{payloadBytes:bytes});
  rtChannel.send({type:'broadcast',event:'action',payload});
 }catch(e){mpReportError('sendMpAction',e,{kind})}
}

// ---- Receiving ------------------------------------------------------------
// Validates protocol/session/floor/author/eventId/entity before anything is
// queued; never applies persistent state, never writes to Supabase.
function validateMpAction(message){
 if(!message||message.type!=='action')return false;
 const ver=message.protocolVersion;
 if(ver!==undefined&&ver>MP_PROTOCOL_VERSION){mpReportError('protocol',new Error('acción con protocolo más nuevo, ignorada'),{ver});return false}
 if(!game?.multiplayer||String(message.sessionId)!==String(game.dungeonStatusId))return false;
 if(!message.eventId||!message.author||!message.action?.kind)return false;
 if(String(message.author)===String(game.pjId))return false; // never replay my own actions
 const rosterIds=new Set((game.roster||[]).map(r=>String(r.pjId)));
 if(rosterIds.size&&!rosterIds.has(String(message.author)))return false; // author must belong to this session
 if(message.floor!==undefined&&message.floor!==game.floor)return false; // stale floor: drop
 if(!MP_ACTION_RENDERERS[message.action.kind])return false; // unsupported kind: ignore, don't guess
 return true;
}
function handleMpAction(message){
 if(!validateMpAction(message))return;
 if(processedActionIds.has(message.eventId))return; // duplicate: drop, don't replay the animation
 mpMarkActionProcessed(message.eventId);
 game.mpLiveSeen=game.mpLiveSeen||{};const lk=`${message.author}|${message.turnSeq}`;game.mpLiveSeen[lk]=(game.mpLiveSeen[lk]||0)+1;
 mpTelemetryStart(message.eventId,{eventType:'action',sessionId:message.sessionId,author:message.author,turnSeq:message.turnSeq,actionSeq:message.actionSeq,sentAt:message.sentAt,channelStatus:mpRealtimeStatus,transportMode:mpTransportMode});
 mpTelemetryMark(message.eventId,'receivedAt');
 enqueueRemoteAction(message);
}
function enqueueRemoteAction(message){
 const author=String(message.author);
 const q=mpAuthorQueue(author,message.turnSeq);
 const seq=Number(message.actionSeq)||1;
 const age=Date.now()-(Number(message.sentAt)||Date.now());
 const dueAt=Date.now()+Math.max(0,MP_REMOTE_ACTION_BUFFER_MS-age);
 q.items.set(seq,{message,arrivedAt:Date.now(),dueAt});
 mpArmActionDrain();
}
function mpPlayRemoteAction(message){
 if(!game?.multiplayer||message.floor!==undefined&&message.floor!==game.floor)return; // floor moved on while queued
 mpTelemetryMark(message.eventId,'appliedAt');
 const renderer=MP_ACTION_RENDERERS[message.action.kind];
 try{renderer&&renderer(message.action,message)}catch(e){mpReportError('render',e,{kind:message.action.kind})}
 mpTelemetryMark(message.eventId,'renderedAt');
}

// ---- Renderers --------------------------------------------------------------
// Pure visual playback. Never mutate persistent/logical fields (hp, inventory,
// door/chest/trap/altar flags, gold, xp) - those flow exclusively through
// turn_commit. Movement reuses the existing prevX/prevY/animT interpolation
// layer (the same one turn_commit reconciliation already drives), which is
// the minimal visual/logical split this codebase needs: confirmed x/y/hp is
// the logical state, prevX/prevY/animT is the visual state, for both players
// and (now) enemies.
function mpFx(text,x,y,color){if(game.seen?.[y]?.[x])floating(text,x,y,color)}
function mpFindOtherPlayer(pid){return (game.otherPlayers||[]).find(r=>String(r.pjId)===String(pid))}
// Companions aren't part of the synced entity model (no shared id other
// clients can resolve), so a target/attacker that is a companion has no
// visualizable reference and is skipped rather than guessed at.
function mpEntityRef(entity){
 if(!entity)return null;
 if(entity===game.player)return {type:'player',id:String(game.pjId)};
 if(entity.pjId!==undefined)return {type:'player',id:String(entity.pjId)};
 if(entity.eid!==undefined)return {type:'enemy',id:entity.eid};
 return null;
}
function mpFindEnemy(eid){return (game.enemies||[]).find(e=>e.eid===eid)}
function mpStartEntityAnim(entity,to){
 if(!entity)return;
 if(entity.x!==to.x||entity.y!==to.y){
  if(Math.abs(entity.x-to.x)+Math.abs(entity.y-to.y)<=4){entity.prevX=entity.x;entity.prevY=entity.y;entity.animT=0}
  entity.x=to.x;entity.y=to.y;
 }
 requestAnimationFrame(mpAnimateRemote);
}
function renderRemoteMove(action){
 const entity=action.entityType==='enemy'?mpFindEnemy(action.entityId):mpFindOtherPlayer(action.entityId);
 if(!entity||!action.to)return;
 mpStartEntityAnim(entity,action.to);
 if(action.entityType!=='enemy'&&action.direction)entity.facing=action.direction;
 draw();
}
function renderRemoteAttack(action){
 const target=action.targetType==='player'?(String(action.targetId)===String(game.pjId)?game.player:mpFindOtherPlayer(action.targetId)):mpFindEnemy(action.targetId);
 if(!target)return;
 const crit=action.result==='critical';
 const attacker=action.enemyId?mpFindEnemy(action.enemyId):action.attackerType==='player'?(String(action.attackerId)===String(game.pjId)?game.player:mpFindOtherPlayer(action.attackerId)):mpFindEnemy(action.attackerId);
 if(attacker&&Math.max(Math.abs(attacker.x-target.x),Math.abs(attacker.y-target.y))>1)rangedTracer(attacker.x,attacker.y,target.x,target.y,crit?'#ffd75c':'#9be8ff');
 mpFx(action.result==='evaded'?'EVITA':`${crit?'CRIT ':''}${typeof action.visualAmount==='number'?'-'+action.visualAmount:''}`,target.x,target.y,action.result==='evaded'?'#70dc9b':crit?'#ffd75c':'#ff8888');
 effect('flash');
 draw();
}
function renderRemoteSpell(action){
 const at=action.target||action.origin;if(!at)return;
 mpFx(action.icon||'✦',at.x,at.y,'#be82ff');
 effect('flash');
 draw();
}
function renderRemoteHeal(action){
 const target=action.targetId?(String(action.targetId)===String(game.pjId)?game.player:mpFindOtherPlayer(action.targetId)):null;
 const at=target||action.origin;if(!at)return;
 mpFx(typeof action.visualAmount==='number'?`+${action.visualAmount}`:'✚',at.x,at.y,'#8dffa8');
 draw();
}
function renderRemoteInteract(action){
 if(!action.at)return;
 mpFx(action.icon||'✦',action.at.x,action.at.y,'#ffd68b');
 draw();
}
function renderRemoteTrap(action){
 if(!action.at)return;
 mpFx('¡TRAMPA!',action.at.x,action.at.y,'#ff9d4f');
 effect('shake');
 draw();
}
function renderRemoteAltar(action){
 if(!action.at)return;
 mpFx('✦',action.at.x,action.at.y,'#9be8ff');
 draw();
}
function renderRemoteDeath(action){
 const at=action.at||(action.entityType==='enemy'?mpFindEnemy(action.entityId):null);
 if(!at)return;
 mpFx('💀',at.x,at.y,'#cfc7d8');
 draw();
}
function renderRemoteEnemyDeath(action){
 const e=mpFindEnemy(action.entityId);
 mpFx('💀',(e&&e.x)??action.at?.x,(e&&e.y)??action.at?.y,'#cfc7d8');
 draw();
}
function renderEnemyPhaseStart(){
 if(!game)return;
 game.mpEnemyPhaseRemote=true;
 if(!game.myTurn)mpSetMyTurn(false,'enemies');
}
function renderEnemyPhaseEnd(){
 if(!game)return;
 game.mpEnemyPhaseRemote=false;
}
function renderRemoteXpShare(action){
 game.mpXpGrantsApplied=game.mpXpGrantsApplied||new Set();
 if(!action.id||game.mpXpGrantsApplied.has(action.id))return; // dedup: never grant the same kill's share twice
 game.mpXpGrantsApplied.add(action.id);
 if(typeof action.amount==='number')grantXp(action.amount);
 updateUI();
}
// Unlike every other action renderer (pure visual sugar), this one deliberately
// mutates real state - the caster's client never has authority over the
// ally's hp/resource, so casting a heal ON an ally has no other channel to
// actually reach them. Applies only on the intended recipient's own client,
// and only once per cast (dedup, same pattern as xp_share).
function renderRemoteAllyHeal(action){
 if(String(action.targetId)!==String(game.pjId))return;
 game.mpHealGrantsApplied=game.mpHealGrantsApplied||new Set();
 if(!action.id||game.mpHealGrantsApplied.has(action.id))return;
 game.mpHealGrantsApplied.add(action.id);
 if(typeof action.hpAmount==='number')healEntity(game.player,action.hpAmount);
 if(typeof action.resAmount==='number'&&action.resType){const maxKey=action.resType==='mana'?'maxMana':'maxStamina';game.player[action.resType]=Math.min(game.player[maxKey],game.player[action.resType]+action.resAmount)}
 log('Un aliado te ha curado.','good');updateUI();
}
function renderFloorTransitionStart(){
 if(!game)return;
 game.mpFloorTransitioning=true;
 mpResetActionQueues(); // nothing queued for the old floor should survive into the new one
}
// Closed, explicit map: never dispatch a renderer by string lookup from
// unchecked network input beyond this table (no eval, no dynamic function names).
const MP_ACTION_RENDERERS={
 move:renderRemoteMove,
 attack:renderRemoteAttack,
 ranged_attack:renderRemoteAttack,
 spell:renderRemoteSpell,
 heal:renderRemoteHeal,
 use_item:renderRemoteHeal,
 interact:renderRemoteInteract,
 open_door:renderRemoteInteract,
 close_door:renderRemoteInteract,
 open_chest:renderRemoteInteract,
 pickup:renderRemoteInteract,
 trigger_trap:renderRemoteTrap,
 activate_altar:renderRemoteAltar,
 death_animation:renderRemoteDeath,
 enemy_move:renderRemoteMove,
 enemy_attack:renderRemoteAttack,
 enemy_spell:renderRemoteSpell,
 enemy_heal:renderRemoteHeal,
 enemy_death:renderRemoteEnemyDeath,
 xp_share:renderRemoteXpShare,
 ally_heal:renderRemoteAllyHeal,
 enemy_phase_start:renderEnemyPhaseStart,
 enemy_phase_end:renderEnemyPhaseEnd,
 floor_transition_start:renderFloorTransitionStart
};

// ---- Lifecycle ---------------------------------------------------------------
// Idempotent: safe to call more than once (leaving twice, dying then leaving,
// etc.) without throwing, and it must not let a stale callback from a
// previous session touch a new one.
function cleanupMultiplayerRuntime(){
 stopMpTradePolling();
 mpClearLiveTimers();
 mpRealtimeDisconnect();
 mpResetActionQueues();
 mpSetRealtimeStatus('idle');
}


// ---- Live turn sync (ephemeral, front-to-front) -----------------------------
// Turn authority no longer needs a DB round trip. A logical clock `seq` orders
// every turn transition, and a transition is only ever authored by the player
// who was active at the previous seq. A receiver accepts a `turn` message only
// when BOTH hold:
//   1. msg.seq === localSeq + 1   (no replays, no gaps, no reordering)
//   2. msg.author === turnOrder[localActiveIndex]  (only the active player may pass)
// Because exactly one client satisfies (2) for any given seq, two clients can
// never both believe it is their turn. Duplicates (seq <= localSeq) are
// dropped; gaps (seq > localSeq+1) trigger a resync instead of being applied.
// The DB is written only as a checkpoint (see MP_CHECKPOINT_EVERY).
const MP_CHECKPOINT_EVERY=10;      // full rounds between DB checkpoints
const MP_RESEND_MS=600;            // active player re-sends its transition until acked

function mpLive(){return !!(rtChannel&&rtReady&&game?.multiplayer&&String(rtChannelSessionId)===String(game.dungeonStatusId))}
function mpSend(event,payload){if(!mpLive())return false;try{rtChannel.send({type:'broadcast',event,payload});return true}catch(e){return false}}
function mpEnsureEnemyIds(){let n=0;for(const e of game.enemies||[]){if(e.eid===undefined)e.eid=`e${n}`;n++}}
function mpEnemyWire(){return (game.enemies||[]).map(e=>[e.eid,e.x,e.y,e.hp])}
function mpApplyEnemyWire(list){
 if(!Array.isArray(list))return;
 const byId=new Map((game.enemies||[]).map(e=>[e.eid,e]));
 const keep=[];
 for(const [eid,x,y,hp] of list){
  const e=byId.get(eid);
  if(!e)continue; // unknown enemy: the checkpoint/resync path will reconcile
  if(typeof hp==='number'&&hp<e.hp)floating(`-${e.hp-hp}`,e.x,e.y,'#ffd27a');
  // reconciliation: small position deltas animate the correction, large ones
  // snap - the same rule already used for other players (mpApplyLiveTurn)
  if((e.x!==x||e.y!==y)&&Math.abs(e.x-x)+Math.abs(e.y-y)<=4){e.prevX=e.x;e.prevY=e.y;e.animT=0;requestAnimationFrame(mpAnimateRemote)}
  e.x=x;e.y=y;if(typeof hp==='number')e.hp=hp;
  keep.push(e);
 }
 if(keep.length)game.enemies=keep; // enemies missing from the wire died
 game.boss=(game.enemies||[]).find(e=>e.boss)||null;
}
function mpTurnPayload(nextIdx){
 mpEnsureEnemyIds();
 return {
  protocolVersion:MP_PROTOCOL_VERSION,type:'turn_commit',
  seq:(game.mpSeq||0)+1,author:String(game.pjId),nextIdx,turn:game.turn||0,floor:game.floor,
  players:Object.fromEntries([[String(game.pjId),{x:game.player.x,y:game.player.y,facing:game.player.facing||1,hp:game.player.hp,maxHp:game.player.maxHp}],
   ...(game.otherPlayers||[]).map(p=>[String(p.pjId),{x:p.x,y:p.y,facing:p.facing,hp:p.hp,maxHp:p.maxHp}])]),
  enemies:mpEnemyWire(),
  doorsOpen:(game.doors||[]).filter(d=>d.open).map(d=>[d.x,d.y]),
  chestsOpened:(game.chests||[]).filter(c=>c.opened).map(c=>[c.x,c.y]),
  keysLeft:(game.keys||[]).map(k=>[k.x,k.y]),
  trapsHit:(game.traps||[]).filter(t=>t.sprung||t.revealed).map(t=>[t.x,t.y,t.sprung?1:0]),
  altarsUsed:(game.altars||[]).filter(a=>a.used).map(a=>[a.x,a.y]),
  objective:game.objective||null,
  actions:(game.mpTurnActions||[]).slice(-60),
  events:(game.mpPendingEvents||[]).slice(-6)
 };
}
// Called by the active player right after resolving its action (and the enemy
// phase). Publishes the transition live; the DB write is a separate concern.
function mpPublishTurn(nextIdx){
 const payload=mpTurnPayload(nextIdx);
 game.mpSeq=payload.seq;
 game.mpLastSent=payload;
 game.mpAckedBy=new Set();
 const eventId=`commit-${payload.author}-${payload.seq}`;
 mpTelemetryStart(eventId,{eventType:'turn_commit',sessionId:String(game.dungeonStatusId),author:payload.author,turnSeq:payload.seq,channelStatus:mpRealtimeStatus,transportMode:mpTransportMode});
 mpTelemetryMark(eventId,'sentAt',{payloadBytes:mpPayloadBytes(payload)});
 mpSend('turn',payload);
 game.mpTurnActions=[];
 mpScheduleResend();
 return payload;
}
function mpScheduleResend(){
 clearTimeout(game.mpResendTimer);
 game.mpResendAttempts=0;
 const tick=()=>{
  if(!game?.multiplayer||!game.mpLastSent)return;
  const need=(game.turnOrder||[]).filter(id=>String(id)!==String(game.pjId)).length;
  if((game.mpAckedBy?.size||0)>=need)return;
  if((game.mpResendAttempts||0)>=5){
   // peer never acked: persist through the DB so their poll picks it up
   console.warn('turno sin confirmar por el otro jugador: guardando checkpoint');
   mpCheckpoint();
   return;
  }
  game.mpResendAttempts++;
  mpSend('turn',game.mpLastSent);
  game.mpResendTimer=setTimeout(tick,MP_RESEND_MS);
 };
 game.mpResendTimer=setTimeout(tick,MP_RESEND_MS);
}
function mpOnRemoteTurn(sessionId,p){
 if(!game?.multiplayer||game.over||String(game.dungeonStatusId)!==String(sessionId)||!p)return;
 // Unknown-newer protocol: can't safely interpret the payload shape, so ask
 // for a resync instead of silently misapplying it. No version at all means
 // a pre-protocol-versioning peer (or an old cached tab) - still accepted.
 if(p.protocolVersion!==undefined&&p.protocolVersion>MP_PROTOCOL_VERSION){mpReportError('protocol',new Error('turn_commit con protocolo más nuevo'),{ver:p.protocolVersion});mpRequestResync('protocol');return}
 if(String(p.author)===String(game.pjId))return;
 const seq=Number(p.seq)||0,local=game.mpSeq||0;
 const eventId=`commit-${p.author}-${seq}`;
 mpTelemetryStart(eventId,{eventType:'turn_commit',sessionId,author:String(p.author),turnSeq:seq,channelStatus:mpRealtimeStatus,transportMode:mpTransportMode});
 mpTelemetryMark(eventId,'receivedAt');
 if(seq<=local){mpSend('ack',{seq,by:String(game.pjId)});return} // duplicate: re-ack and drop
 if(seq>local+1){mpRequestResync('gap');return}                  // gap: never apply out of order
 const expected=String((game.turnOrder||[])[game.activePlayerIndex||0]??'');
 if(expected&&String(p.author)!==expected){mpRequestResync('author');return} // not the active player
 game.mpSeq=seq;
 mpApplyLiveTurn(p);
 mpTelemetryMark(eventId,'appliedAt');
 mpSend('ack',{seq,by:String(game.pjId)});
 mpTelemetryMark(eventId,'renderedAt');
}
// Replays the author's recorded action sequence with pacing, then re-asserts
// the committed positions. Display-only: state was already applied by the commit.
function mpReplayTurnActions(p,{skipFinalSnap=false}={}){
 const acts=(p.actions||[]).filter(a=>MP_ACTION_RENDERERS[a.kind]);
 if(!acts.length)return;
 const lk=`${p.author||p.turnAuthor}|${p.seq}`;
 const seen=game.mpLiveSeen?.[lk]||0;
 if(game.mpLiveSeen)delete game.mpLiveSeen[lk];
 if(seen>=acts.length*.5)return; // already watched most of it live
 acts.forEach((a,i)=>setTimeout(()=>{if(!game?.multiplayer)return;try{MP_ACTION_RENDERERS[a.kind](a)}catch(e){}},i*140));
 if(skipFinalSnap)return; // caller already applied the authoritative state
 setTimeout(()=>{ // final snap back to the committed truth
  if(!game?.multiplayer)return;
  mpApplyEnemyWire(p.enemies);
  for(const [pid,pos] of Object.entries(p.players||{})){
   if(String(pid)===String(game.pjId))continue;
   const rp=(game.otherPlayers||[]).find(r=>String(r.pjId)===String(pid));
   if(rp){rp.x=pos.x;rp.y=pos.y;rp.animT=1}
  }
  draw();
 },acts.length*140+200);
}
function mpApplyLiveTurn(p){
 if(p.floor&&p.floor!==game.floor){mpRequestResync('floor');return} // floor change goes through the checkpoint
 // the round this commit closes is done: any queued ephemeral actions for it
 // (or older) are superseded by the confirmed state, and the enemy phase (if
 // any) has necessarily concluded by the time a commit lands
 mpPruneActionQueuesUpTo(game.mpSeq||0);
 game.mpEnemyPhaseRemote=false;
 game.mpFloorTransitioning=false;
 game.turn=p.turn??game.turn;
 for(const [pid,pos] of Object.entries(p.players||{})){
  if(String(pid)===String(game.pjId)){
   // only the enemy-phase resolver (nextIdx 0) is authoritative over my hp
   if(Number(p.nextIdx)===0&&typeof pos.hp==='number'&&pos.hp<game.player.hp){floating(`-${game.player.hp-pos.hp}`,game.player.x,game.player.y,'#ff8888');game.player.hp=Math.max(0,pos.hp)}
   continue;
  }
  const rp=(game.otherPlayers||[]).find(r=>String(r.pjId)===String(pid));
  if(!rp)continue;
  if(rp.x!==pos.x||rp.y!==pos.y){
   if(Math.abs(rp.x-pos.x)+Math.abs(rp.y-pos.y)<=3){rp.prevX=rp.x;rp.prevY=rp.y;rp.animT=0;requestAnimationFrame(mpAnimateRemote)}
   rp.x=pos.x;rp.y=pos.y;
  }
  rp.facing=pos.facing||rp.facing;
  if(typeof pos.hp==='number')rp.hp=pos.hp;
  if(typeof pos.maxHp==='number')rp.maxHp=pos.maxHp;
 }
 mpApplyEnemyWire(p.enemies);
 for(const [x,y] of p.doorsOpen||[]){const d=(game.doors||[]).find(d=>d.x===x&&d.y===y);if(d)d.open=true}
 for(const [x,y] of p.chestsOpened||[]){const c=(game.chests||[]).find(c=>c.x===x&&c.y===y);if(c)c.opened=true}
 if(Array.isArray(p.keysLeft))game.keys=(game.keys||[]).filter(k=>p.keysLeft.some(([x,y])=>x===k.x&&y===k.y));
 for(const [x,y,sprung] of p.trapsHit||[]){const t=(game.traps||[]).find(t=>t.x===x&&t.y===y);if(t){t.revealed=true;if(sprung)t.sprung=true}}
 for(const [x,y] of p.altarsUsed||[]){const a=(game.altars||[]).find(a=>a.x===x&&a.y===y);if(a)a.used=true}
 if(p.objective)game.objective=p.objective;
 for(const ev of p.events||[]){
  if(!ev?.m)continue;
  game.mpRecentEvents=game.mpRecentEvents||[];
  if(game.mpRecentEvents.includes(ev.m))continue;
  log(ev.m,ev.c||'combat');
  game.mpRecentEvents.push(ev.m);if(game.mpRecentEvents.length>12)game.mpRecentEvents.shift();
 }
 game.activePlayerIndex=Number(p.nextIdx)||0;
 if(game.player.hp<=0&&!game.over){game.player.hp=0;game.over=true;recomputeDerived();updateUI();draw();mpHandleDefeatWhileWaiting();return}
 recomputeDerived();
 mpSetMyTurn(String((game.turnOrder||[])[game.activePlayerIndex])===String(game.pjId));
 updateUI();draw();
 mpReplayTurnActions(p);
}
function mpOnAck(p){
 if(!game?.mpLastSent||Number(p?.seq)!==Number(game.mpLastSent.seq))return;
 game.mpAckedBy=game.mpAckedBy||new Set();
 game.mpAckedBy.add(String(p.by));
 const need=(game.turnOrder||[]).filter(id=>String(id)!==String(game.pjId)).length;
 if(game.mpAckedBy.size>=need)clearTimeout(game.mpResendTimer);
}
// Recovery: ask whoever holds a newer seq for a full live snapshot. Falls back
// to the DB checkpoint if nobody answers.
function mpRequestResync(reason){
 if(!game?.multiplayer)return;
 const now=Date.now();
 if(now-(game.mpLastResyncAt||0)<700)return;
 game.mpLastResyncAt=now;
 mpSend('need',{by:String(game.pjId),seq:game.mpSeq||0,reason});
 clearTimeout(game.mpResyncFallback);
 game.mpResyncFallback=setTimeout(()=>{if(game?.multiplayer&&!game.over)mpPollGameState()},900);
}
function mpOnNeed(p){
 if(!game?.multiplayer||!p||String(p.by)===String(game.pjId))return;
 if((game.mpSeq||0)<=(Number(p.seq)||0))return; // we are not ahead: nothing to offer
 mpSend('full',{seq:game.mpSeq||0,by:String(game.pjId),to:String(p.by),activeIdx:game.activePlayerIndex||0,turnOrder:game.turnOrder||[],state:mpTurnPayload(game.activePlayerIndex||0)});
}
function mpOnFull(p){
 if(!game?.multiplayer||!p||String(p.to)!==String(game.pjId))return;
 if(p.state?.protocolVersion!==undefined&&p.state.protocolVersion>MP_PROTOCOL_VERSION){mpReportError('protocol',new Error('full con protocolo más nuevo'),{ver:p.state.protocolVersion});return}
 const seq=Number(p.seq)||0;
 if(seq<=(game.mpSeq||0))return;
 if(Array.isArray(p.turnOrder)&&p.turnOrder.length)game.turnOrder=p.turnOrder;
 game.mpSeq=seq;
 const st=p.state||{};
 if(st.floor&&st.floor!==game.floor){mpPollGameState();return}
 mpApplyLiveTurn({...st,nextIdx:Number(p.activeIdx)||0,seq});
}
// If the player whose turn it is goes quiet (tab closed, lost packet), ask for
// a resync rather than stalling forever. Never grants a turn by itself.
function mpClearLiveTimers(){
 if(!game)return;
 clearTimeout(game.mpResendTimer);clearTimeout(game.mpResyncFallback);
 game.mpResendTimer=game.mpResyncFallback=null;
}
// Best-effort checkpoint when the tab goes away, so unsaved live turns are not
// lost. Uses keepalive + the rev CAS: if someone wrote more recently it simply
// loses, which is correct.
function mpFlushCheckpointBeacon(){
 if(!game?.multiplayer||!game.mpDirty||!game.dungeonStatusId||!game.mpStatusMirror)return;
 try{
  const st={...game.mpStatusMirror,turn:game.turn||0,currentFloor:game.floor,activePlayerIndex:game.activePlayerIndex||0,turnOrder:game.turnOrder||[],seq:game.mpSeq||0,rev:(game.mpLastRev||0)+1,
   players:{...(game.mpStatusMirror.players||{}),[game.pjId]:{x:game.player.x,y:game.player.y,floor:game.floor,facing:game.player.facing||1,hp:game.player.hp,maxHp:game.player.maxHp,cls:game.player.cls,classIcon:game.player.classIcon,name:game.player.name,nombre:window.currentUser?.nombre}},
   floors:{[game.floor]:{...(game.mpStatusMirror.floors?.[String(game.floor)]||{}),...floorSnapshotDynamic()}}};
  fetch(`/api/dungeon-status?id=${encodeURIComponent(game.dungeonStatusId)}`,{method:'PUT',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({dungeon_status:st,expectedRev:game.mpLastRev||0})});
  game.mpDirty=false;
 }catch(e){}
}
addEventListener('pagehide',mpFlushCheckpointBeacon);
addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')mpFlushCheckpointBeacon()});
// ============================================================================
// MULTIPLAYER ITEM TRADE
// One active trade at a time per session, always between exactly two
// players. State lives in dungeon_status.trade and every mutation goes
// through the same rev-guarded CAS write already used for turns
// (mpSaveSession), so:
//  - a trade can only be proposed if none is currently open (mutate returns
//    null -> aborted, if fresh.trade already exists)
//  - the actual item swap can only ever be applied once per side, because
//    the write that flips trade.applied[me]=true only succeeds if the trade
//    is still the expected one, both sides are still accepted, and my side
//    had not already applied — exactly the same pattern that keeps turns
//    from crossing.
// Items stay in each player's own inventory (and keep persisting normally
// through the regular character save) until the swap is actually applied,
// so a reload or crash mid-trade never loses an item. While offered, an
// item is only soft-locked: isItemInMyTradeOffer() blocks equipping, using
// or auto-selling it, but it is never removed from game.inventory until the
// CAS-guarded apply step commits.
// ============================================================================
function mpTradeOtherId(t=game.mpTrade){if(!t)return null;return String(t.a)===String(game.pjId)?t.b:t.a}
function isItemInMyTradeOffer(id){return (game.mpTrade?.offers?.[String(game.pjId)]||[]).some(i=>i.id===id)}
function tradeableRoster(){
 const aliveIds=new Set((game.turnOrder||[]).map(String));
 return (game.roster||[]).filter(r=>String(r.pjId)!==String(game.pjId)&&aliveIds.has(String(r.pjId)));
}
function startMpTradePolling(){
 stopMpTradePolling();
 if(!game?.multiplayer)return;
 mpRefreshTrade();
 mpTradePollTimer=setInterval(mpRefreshTrade,rtReady?2500:1500);
}
function stopMpTradePolling(){
 if(mpTradePollTimer){clearInterval(mpTradePollTimer);mpTradePollTimer=null}
}
async function mpRefreshTrade(){
 if(!game?.multiplayer||!game.dungeonStatusId)return;
 try{
  const session=await dsGet(game.dungeonStatusId);
  const st=session?.dungeon_status;
  const rev=Number(st?.rev)||0;
  // mpSaveSession() trusts game.mpStatusMirror as a CAS fast-path whenever its rev
  // matches game.mpLastRev - but trade has its own polling loop, separate from the
  // main game-state poll that normally keeps that mirror fresh. Without this, once
  // the OTHER player accepts/applies the trade, checkAndApplyTrade() here would
  // silently keep reading a stale mirror forever (the "both accepted" check inside
  // its own mutate() would see outdated data and abort every time), so the trade
  // would never actually complete on this side.
  if(st&&rev>=(game.mpLastRev||0)){game.mpStatusMirror=st;game.mpLastRev=rev}
  applyIncomingTradeState(st?.trade||null);
 }catch(e){}
}
function mpOnRemoteTrade(sessionId){
 if(!game?.multiplayer||String(game.dungeonStatusId)!==String(sessionId))return;
 mpRefreshTrade();
}
function applyIncomingTradeState(t){
 if(!game?.multiplayer)return;
 const involvesMe=t&&(String(t.a)===String(game.pjId)||String(t.b)===String(game.pjId));
 const next=involvesMe?t:null;
 const isNewProposal=next&&next.id!==game.mpTradeSeenId&&String(next.a)!==String(game.pjId);
 game.mpTrade=next;
 if(isNewProposal){
  game.mpTradeSeenId=next.id;
  const meta=(game.roster||[]).find(r=>String(r.pjId)===String(next.a));
  banner('PROPUESTA DE INTERCAMBIO');
  log(`${meta?.pjName||'Otro jugador'} te propone un intercambio.`,'sys');
 }
 renderTradeTab();
 checkAndApplyTrade();
}
async function proposeTrade(otherPjId){
 if(!game?.multiplayer||!game.dungeonStatusId)return;
 if(game.mpTrade){alert('Ya hay un intercambio en curso.');return}
 const id=crypto.randomUUID(),a=String(game.pjId),b=String(otherPjId);
 const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
  if(fresh.trade)return null; // someone else proposed one first
  return {dungeon_status:{...fresh,trade:{id,a,b,offers:{[a]:[],[b]:[]},accepted:{[a]:false,[b]:false},applied:{},createdAt:Date.now()}}};
 });
 if(!saved){alert('No se pudo proponer el intercambio (puede que ya haya uno en curso).');return}
 game.mpTradeSeenId=id;
 applyIncomingTradeState(saved.status.trade);
 mpSend('trade',{});
}
async function cancelTrade(){
 const t=game.mpTrade;if(!t)return;
 await mpSaveSession(game.dungeonStatusId,fresh=>{
  if(!fresh.trade||fresh.trade.id!==t.id)return null; // already resolved/cancelled elsewhere
  return {dungeon_status:{...fresh,trade:null}};
 });
 game.mpTrade=null;renderTradeTab();mpSend('trade',{});
}
async function addToTradeOffer(itemId){
 const t=game.mpTrade;if(!t)return;
 const item=game.inventory.find(i=>i.id===itemId);if(!item)return;
 const me=String(game.pjId);
 const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
  const ft=fresh.trade;if(!ft||ft.id!==t.id)return null;
  const mine=ft.offers?.[me]||[];
  if(mine.some(i=>i.id===itemId))return null;
  const offers={...ft.offers,[me]:[...mine,{...item}]};
  // any change to the deal invalidates both prior acceptances
  return {dungeon_status:{...fresh,trade:{...ft,offers,accepted:{[ft.a]:false,[ft.b]:false}}}};
 });
 if(!saved)return;
 applyIncomingTradeState(saved.status.trade);
 updateUI();mpSend('trade',{});
}
async function removeFromTradeOffer(itemId){
 const t=game.mpTrade;if(!t)return;
 const me=String(game.pjId);
 const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
  const ft=fresh.trade;if(!ft||ft.id!==t.id)return null;
  const mine=(ft.offers?.[me]||[]).filter(i=>i.id!==itemId);
  const offers={...ft.offers,[me]:mine};
  return {dungeon_status:{...fresh,trade:{...ft,offers,accepted:{[ft.a]:false,[ft.b]:false}}}};
 });
 if(!saved)return;
 applyIncomingTradeState(saved.status.trade);
 updateUI();mpSend('trade',{});
}
async function setTradeAccept(accept){
 const t=game.mpTrade;if(!t)return;
 const me=String(game.pjId);
 const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
  const ft=fresh.trade;if(!ft||ft.id!==t.id)return null;
  return {dungeon_status:{...fresh,trade:{...ft,accepted:{...ft.accepted,[me]:accept}}}};
 });
 if(!saved)return;
 applyIncomingTradeState(saved.status.trade);
 mpSend('trade',{});
}
// Executes the swap exactly once. The write that records my half of the
// completion only succeeds if the trade is still the one I think it is, both
// sides are still accepted, and I had not already applied it — so my
// inventory is only ever touched AFTER that write has committed. A peer who
// never comes back to observe the acceptance simply delays completion on
// their own side; it can never duplicate or destroy an item.
let mpTradeApplying=false;
async function checkAndApplyTrade(){
 const t=game.mpTrade;if(!t||mpTradeApplying)return;
 const me=String(game.pjId);
 if(!t.accepted?.[t.a]||!t.accepted?.[t.b])return;
 if(t.applied?.[me])return;
 mpTradeApplying=true;
 try{
  let capturedOffers=null;
  const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
   const ft=fresh.trade;
   if(!ft||ft.id!==t.id||!ft.accepted?.[ft.a]||!ft.accepted?.[ft.b]||ft.applied?.[me])return null;
   capturedOffers=ft.offers;
   const applied={...(ft.applied||{}),[me]:true};
   const bothDone=applied[ft.a]&&applied[ft.b];
   return {dungeon_status:{...fresh,trade:bothDone?null:{...ft,applied}}};
  });
  if(!saved||!capturedOffers)return;
  const otherId=mpTradeOtherId(t);
  const myOfferedIds=new Set((capturedOffers[me]||[]).map(i=>i.id));
  game.inventory=(game.inventory||[]).filter(i=>!myOfferedIds.has(i.id));
  for(const raw of capturedOffers[String(otherId)]||[]){
   const item={...raw,id:crypto.randomUUID()};
   addInventoryItem(item);lootToast(item);
  }
  game.mpTrade=saved.status.trade||null;
  log('Intercambio completado.','loot');banner('INTERCAMBIO COMPLETADO');
  recomputeDerived();updateUI();draw();renderTradeTab();
  // persist immediately: the given/received items must survive a reload right away
  const bundle=characterBundleFromGame();
  fetch(`/api/user-pj?id=${encodeURIComponent(game.pjId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pj_json:bundle,feats:bundle.feats,pj_score:computeScore(bundle),pj_name:game.player.name,last_use:new Date().toISOString()})}).catch(e=>console.error('No se pudo guardar el personaje tras el intercambio',e));
  mpSend('trade',{});
 }finally{mpTradeApplying=false}
}
function renderTradeTab(){
 const btn=document.querySelector('[data-tab="trade"]'),root=document.getElementById('trade');
 if(!btn||!root)return;
 if(!game?.multiplayer){
  btn.classList.add('hidden');
  if(btn.classList.contains('active'))document.querySelector('[data-tab="inventory"]')?.click();
  return;
 }
 btn.classList.remove('hidden');
 const t=game.mpTrade;
 if(!t){
  const others=tradeableRoster();
  root.innerHTML=others.length?
   `<p class="small">Elige con quién comerciar.</p>${others.map(r=>`<div class="worldCard"><b>${r.pjName}</b><span class="small">${r.nombre||''} · Nivel ${r.level||1}</span><button type="button" data-trade-propose="${r.pjId}">Proponer intercambio</button></div>`).join('')}`:
   '<p class="small">No hay otros jugadores vivos con quien comerciar.</p>';
  root.querySelectorAll('[data-trade-propose]').forEach(b=>b.onclick=()=>proposeTrade(b.dataset.tradePropose));
  return;
 }
 const me=String(game.pjId),otherId=mpTradeOtherId(t),otherMeta=(game.roster||[]).find(r=>String(r.pjId)===String(otherId));
 const myOffer=t.offers?.[me]||[],otherOffer=t.offers?.[String(otherId)]||[];
 const myAccepted=!!t.accepted?.[me],otherAccepted=!!t.accepted?.[otherId];
 const available=(game.inventory||[]).filter(i=>!myOffer.some(o=>o.id===i.id));
 const offeredRow=(i,removable)=>`<div class="item tradeItem"><canvas class="itemThumb" width="40" height="40" data-item="${i.id}"></canvas><div><b class="${i.rarity}">${i.name}${i.quantity>1?` x${i.quantity}`:''}</b><span class="itemLevel">${i.type==='potion'?'Poción':(slotNames[i.slot]||i.slot)} · Nivel ${i.itemLevel||1}</span></div>${removable?`<button type="button" data-trade-remove="${i.id}">Quitar</button>`:''}</div>`;
 const availRow=i=>`<div class="item tradeItem"><canvas class="itemThumb" width="40" height="40" data-item="${i.id}"></canvas><div><b class="${i.rarity}">${i.name}${i.quantity>1?` x${i.quantity}`:''}</b><span class="itemLevel">${i.type==='potion'?'Poción':(slotNames[i.slot]||i.slot)}</span></div><button type="button" data-trade-add="${i.id}">Ofrecer</button></div>`;
 root.innerHTML=`
  <div class="tradePanel">
   <h4>Intercambio con ${otherMeta?.pjName||'jugador'}</h4>
   <div class="tradeColumns">
    <div class="tradeCol"><b>Tu oferta ${myAccepted?'✓':''}</b>${myOffer.length?myOffer.map(i=>offeredRow(i,!myAccepted)).join(''):'<p class="small">Vacía.</p>'}</div>
    <div class="tradeCol"><b>Oferta de ${otherMeta?.pjName||'jugador'} ${otherAccepted?'✓':''}</b>${otherOffer.length?otherOffer.map(i=>offeredRow(i,false)).join(''):'<p class="small">Vacía.</p>'}</div>
   </div>
   ${!myAccepted?`<h4>Añadir de tu mochila</h4><div class="tradeAvailable">${available.length?available.map(availRow).join(''):'<p class="small">Sin objetos disponibles.</p>'}</div>`:''}
   <div class="tradeActions">
    <button type="button" id="tradeAcceptBtn">${myAccepted?'Retirar aceptación':'Aceptar intercambio'}</button>
    <button type="button" id="tradeCancelBtn">Cancelar intercambio</button>
   </div>
  </div>`;
 root.querySelectorAll('[data-item]').forEach(c=>{const it=[...myOffer,...otherOffer,...available].find(x=>x.id===c.dataset.item);if(it)drawItemIcon(c,it)});
 root.querySelectorAll('[data-trade-add]').forEach(b=>b.onclick=()=>addToTradeOffer(b.dataset.tradeAdd));
 root.querySelectorAll('[data-trade-remove]').forEach(b=>b.onclick=()=>removeFromTradeOffer(b.dataset.tradeRemove));
 document.getElementById('tradeAcceptBtn').onclick=()=>setTradeAccept(!myAccepted);
 document.getElementById('tradeCancelBtn').onclick=()=>cancelTrade();
}

function mpOnRemoteBroadcast(sessionId,payload){
 const st=payload?.status,rev=Number(payload?.rev)||0;
 if(!st||!rev)return;
 if(game?.multiplayer&&String(game.dungeonStatusId)===String(sessionId)){
  if(game.over||game.mpEnemyPhase)return; // safety net poll catches up afterwards
  if(rev<=(game.mpLastRev||0))return;
  // slim broadcasts drop the static floor layout; on a floor change we need it,
  // so fetch the full row instead of applying the slim copy
  const remoteFloor=st.currentFloor||1;
  if(st.slimFloors&&remoteFloor!==game.floor&&!(st.floors?.[String(remoteFloor)]?.map)){mpForceFullSync();return}
  game.mpLastRev=rev;
  mpApplyRemoteState(st);
 }else if(String(mpLobbySessionId||'')===String(sessionId)&&!game){
  refreshMpLobby();
 }
}
async function mpForceFullSync(){
 if(!game?.multiplayer||!game.dungeonStatusId||mpPollBusy)return;
 mpPollBusy=true;
 try{
  const session=await dsGet(game.dungeonStatusId);
  const st=session?.dungeon_status||{};
  const rev=Number(st.rev)||0;
  if(rev<=(game.mpLastRev||0))return;
  game.mpLastRev=rev;
  mpApplyRemoteState(st);
 }catch(e){console.error('mp full sync error',e)}
 finally{mpPollBusy=false}
}
function mpAdjustPollInterval(){
 if(!game?.multiplayer||!mpGamePollTimer)return;
 clearInterval(mpGamePollTimer);
 mpGamePollTimer=setInterval(mpPollGameState,rtReady?6000:400);
}
// -----------------------------------------------------------------------------

// Todas las escrituras de dungeon_status pasan por aquí: se relee el estado más
// reciente, `mutate` construye el siguiente estado a partir de ESE estado fresco
// (nunca de una copia local desfasada) y se escribe con concurrencia optimista
// (columna dungeon_status->>rev). Si otro cliente escribió mientras tanto, la API
// devuelve 409 y reintentamos desde una lectura nueva. Esto evita que un cliente
// pise con datos viejos el turno/posición que otro acaba de guardar.
async function mpSaveSession(id,mutate,{retries=6}={}){
 if(!id)return null;
 for(let attempt=0;attempt<retries;attempt++){
  let session,fresh;
  // fast path (first attempt only): reuse the last applied state instead of
  // re-reading. The rev CAS below still rejects the write if it was stale.
  const mirror=game?.mpStatusMirror;
  if(attempt===0&&game&&String(id)===String(game.dungeonStatusId)&&mirror&&(Number(mirror.rev)||0)===(game.mpLastRev||0)){
   fresh=mirror;
   session={id,dungeon_status:mirror};
  }else{
   try{
    session=await dsGet(id);
    if(!session)return null;
   }catch(e){console.error('No se pudo leer la sesión multijugador',e);return null}
   fresh=session.dungeon_status||{};
  }
  const rev=Number(fresh.rev)||0;
  const result=mutate(fresh,session);
  if(!result)return null;
  const nextStatus={...result.dungeon_status,rev:rev+1};
  const row={dungeon_status:nextStatus};
  if(result.players_ID!==undefined)row.players_ID=result.players_ID;
  try{
   const pr=await dsPatch(id,row,rev,attempt===0);
   if(pr.conflict){await new Promise(res=>setTimeout(res,60+Math.random()*120));continue}
   if(!pr.ok){console.error('No se pudo guardar la sesión multijugador',pr.data);return null}
   if(game&&String(id)===String(game.dungeonStatusId)){
    game.mpLastRev=Math.max(game.mpLastRev||0,nextStatus.rev);
    game.mpStatusMirror=nextStatus;
   }
   mpBroadcastState(id,nextStatus);
   return {session,status:nextStatus};
  }catch(e){console.error('No se pudo guardar la sesión multijugador',e);await new Promise(res=>setTimeout(res,120))}
 }
 console.error('No se pudo guardar el estado multijugador: demasiados conflictos de turno.');
 return null;
}

async function mpJoinSession(sessionId,pj){
 try{
  let startedFlag=false;
  const saved=await mpSaveSession(sessionId,(st,session)=>{
   startedFlag=!!st.started;
   let ids=[];try{ids=JSON.parse(session.players_ID||'[]')}catch(e){}
   if(!ids.map(String).includes(String(pj.id)))ids.push(pj.id);
   const roster=st.roster||[];
   if(!roster.some(r=>String(r.pjId)===String(pj.id)))roster.push({pjId:pj.id,nombre:window.currentUser.nombre,pjName:pj.pj_name,className:pj.pj_json?.player?.className,level:pj.pj_json?.player?.level||1});
   const turnOrder=st.turnOrder||[];
   if(!turnOrder.map(String).includes(String(pj.id)))turnOrder.push(pj.id);
   const next={...st,roster,turnOrder};
   if(st.started){
    const hostId=st.host,hostPos=st.players?.[String(hostId)],floorNum=st.currentFloor||1,overlay=st.floors?.[String(floorNum)];
    const base=hostPos||selectedDungeonWorld?.world_json?.floors?.[floorNum-1]?.spawn||{x:0,y:0};
    const occupied=Object.values(st.players||{}).map(p=>`${p.x},${p.y}`);
    const spawn=mpFreeSpawnNear(overlay?.map,overlay?.enemies,occupied,base);
    next.players={...st.players,[pj.id]:{x:spawn.x,y:spawn.y,floor:floorNum,facing:1,hp:pj.pj_json?.player?.hp,maxHp:pj.pj_json?.player?.maxHp,cls:pj.pj_json?.player?.cls,classIcon:pj.pj_json?.player?.classIcon,name:pj.pj_json?.player?.name,nombre:window.currentUser.nombre}};
   }
   return {dungeon_status:next,players_ID:JSON.stringify(ids)};
  });
  if(!saved)throw new Error('No se pudo unir a la sesión, inténtalo de nuevo.');
  currentCharacter=pj;
  if(startedFlag){multiplayerOverlay.classList.add('hidden');mpEnterStartedSession({id:sessionId,dungeon_world_id:saved.session.dungeon_world_id,dungeon_status:saved.status})}
  else openMpLobby(sessionId,false);
 }catch(e){alert('Error al unirte: '+e.message)}
}

function openMpLobby(sessionId,isHost,resuming=false){
 mpLobbySessionId=sessionId;
 mpLobbyResuming=resuming;
 stopMultiHeartbeat();
 mpRealtimeConnect(sessionId);
 multiplayerOverlay.classList.add('hidden');
 mpLobbyOverlay.classList.remove('hidden');
 document.getElementById('mpStartGameBtn').classList.toggle('hidden',!isHost);
 document.getElementById('mpStartGameBtn').textContent=resuming?'CONTINUAR PARTIDA':'INICIAR PARTIDA';
 document.getElementById('mpLobbyWaitMsg').classList.toggle('hidden',isHost);
 refreshMpLobby();
 if(mpLobbyPollTimer)clearInterval(mpLobbyPollTimer);
 mpLobbyPollTimer=setInterval(refreshMpLobby,2000);
}
async function refreshMpLobby(){
 if(!mpLobbySessionId)return;
 try{
  const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(mpLobbySessionId)}`);
  const session=await r.json();if(!r.ok)throw new Error(session.error||'Sesión no encontrada');
  const st=session.dungeon_status||{};
  const ready=st.resumeReady||{};
  document.getElementById('mpLobbyWorldLabel').textContent=`Mundo #${session.dungeon_world_id}`;
  document.getElementById('mpLobbyRoster').innerHTML=(st.roster||[]).map(r=>`<div class="worldCard"><b>${r.pjName}</b><span>${r.nombre} · ${r.className||''} nivel ${r.level||1}</span>${mpLobbyResuming?`<small>${ready[r.pjId]?'✓ Listo':'Esperando...'}</small>`:''}</div>`).join('');
  const allReady=!mpLobbyResuming||(st.roster||[]).every(r=>ready[r.pjId]);
  document.getElementById('mpStartGameBtn').disabled=!allReady;
  if(!mpLobbyResuming&&st.started){
   // brand-new session: auto-enter joiners the moment the host presses start
   if(mpLobbyPollTimer){clearInterval(mpLobbyPollTimer);mpLobbyPollTimer=null}
   mpLobbyOverlay.classList.add('hidden');
   mpEnterStartedSession(session);
  }
 }catch(e){console.error(e)}
}

// starter=true: the host is starting the game. The dungeon (floor 1 snapshot +
// spawn positions for the WHOLE roster) is generated and written in the SAME
// atomic write that sets started:true, so joiners always find a complete floor.
async function mpEnterStartedSession(session,starter=false){
 try{
  stopMultiHeartbeat();
  if(!configItems.length)fetchConfigItems();if(!configChests.length)fetchConfigChests();if(!configClasses.length)fetchConfigClasses();if(!configWorldObjectsLoaded)fetchConfigWorldObjects();
  await mpRealtimeConnect(session.id);
  const worldRes=await fetch(`/api/dungeon-worlds?id=${encodeURIComponent(session.dungeon_world_id)}`);
  const world=await worldRes.json();if(!worldRes.ok)throw new Error(world.error||world.message||'No se pudieron cargar los mundos');
  if(!world)throw new Error('El mundo de esta sesión ya no existe.');
  selectedDungeonWorld=world;
  const pj=currentCharacter;
  const bundle=pj.pj_json||{};
  let st=session.dungeon_status||{};
  const floorNum=starter?1:(st.currentFloor||1);
  game={floor:floorNum,themeIndex:0,turn:st.turn||0,dungeonWorldId:world.id,dungeonWorldName:world.world_name,worldParams:normalizeWorldParams(world.world_json?.params),inventory:bundle.inventory||[],achievements:bundle.achievements||{},feats:normalizeFeats(pj.feats||bundle.feats),bossesKilled:bundle.bossesKilled||0,chestsOpened:bundle.chestsOpened||0,maxFloorReached:bundle.maxFloorReached||1,player:bundle.player,pjId:pj.id,dungeonStatusId:session.id,sessionFloors:st.floors||{},multiplayer:true,turnOrder:st.turnOrder||[pj.id],activePlayerIndex:starter?0:(st.activePlayerIndex||0),hostId:st.host,roster:st.roster||[],mpLastRev:Number(st.rev)||0,mpLastEvSeq:st.evSeq||0,mpPendingEvents:[],mpSeq:Number(st.seq)||0,mpCheckpointTurn:st.turn||0,mpCheckpointFloor:starter?1:(st.currentFloor||1)};
  app.classList.remove('hidden');
  if(starter){
   if(!loadPrecomputedFloor())generateFloor();
   // Same reasoning as enterWorldWithCharacter(): a brand-new multiplayer
   // session starts the host's character topped up, before its hp gets
   // published into `players` below. Joiners (starter===false) and anyone
   // resuming an already-started session never hit this branch.
   game.player.hp=game.player.maxHp;
   game.player.stamina=game.player.maxStamina;
   game.player.mana=game.player.maxMana;
   game.floorEventRolled=true;
   // deterministic spawn cluster in turn order, host first
   const order=(st.turnOrder&&st.turnOrder.length)?st.turnOrder:[pj.id];
   const others=(st.roster||[]).filter(r=>String(r.pjId)!==String(pj.id));
   const metas=await Promise.all(others.map(async r=>{try{const res=await fetch(`/api/user-pj?id=${encodeURIComponent(r.pjId)}`);const row=await res.json();return res.ok?row:null}catch(e){return null}}));
   const base={x:game.player.x,y:game.player.y},players={},occupied=[];
   for(const id of order){
    const spot=mpFreeSpawnNear(game.map,game.enemies,occupied,base);
    occupied.push(`${spot.x},${spot.y}`);
    if(String(id)===String(pj.id)){
     game.player.x=spot.x;game.player.y=spot.y;
     players[id]={x:spot.x,y:spot.y,floor:1,facing:1,hp:game.player.hp,maxHp:game.player.maxHp,cls:game.player.cls,classIcon:game.player.classIcon,name:game.player.name,nombre:window.currentUser?.nombre};
    }else{
     const row=metas.find(m=>m&&String(m.id)===String(id)),rp=row?.pj_json?.player||{};
     players[id]={x:spot.x,y:spot.y,floor:1,facing:1,hp:rp.hp??rp.maxHp??1,maxHp:rp.maxHp??1,cls:rp.cls,classIcon:rp.classIcon,name:rp.name||row?.pj_name,nombre:row?.nombre};
    }
   }
   const snap=floorSnapshot();
   const saved=await mpSaveSession(session.id,fresh=>({dungeon_status:{...fresh,multiplayer:true,started:true,currentFloor:1,turn:0,activePlayerIndex:0,floors:{1:snap},players,evSeq:0,events:[]}}));
   if(!saved)throw new Error('No se pudo iniciar la partida, inténtalo de nuevo.');
   st=saved.status;
   game.turnOrder=st.turnOrder||game.turnOrder;game.roster=st.roster||game.roster;
  }else{
   // joiners render the floor exclusively from the shared snapshot; wait for it if needed
   let overlay=st.floors?.[String(game.floor)]||null;
   for(let i=0;i<8&&!(overlay&&overlay.map);i++){
    await new Promise(res=>setTimeout(res,500));
    try{
     const s2=await dsGet(session.id);
     if(s2?.dungeon_status){st=s2.dungeon_status;game.floor=st.currentFloor||1;game.turn=st.turn||0;game.turnOrder=st.turnOrder||game.turnOrder;game.activePlayerIndex=st.activePlayerIndex||0;game.roster=st.roster||game.roster;game.mpLastRev=Number(st.rev)||0;game.mpLastEvSeq=st.evSeq||0;overlay=st.floors?.[String(game.floor)]||null}
    }catch(e){}
   }
   if(overlay&&overlay.map)applyFloorSnapshot(overlay);
   else{game.floorEventRolled=true;if(!loadPrecomputedFloor())throw new Error('El anfitrión todavía no ha generado la mazmorra. Vuelve a intentarlo en unos segundos.')}
   const pos=st.players?.[String(pj.id)];
   if(pos&&(pos.floor||game.floor)===game.floor){
    game.player.x=pos.x;game.player.y=pos.y;game.player.facing=pos.facing||game.player.facing;
   }else{
    const hostPos=st.players?.[String(st.host)];
    const base=hostPos||selectedDungeonWorld?.world_json?.floors?.[game.floor-1]?.spawn||{x:game.player.x,y:game.player.y};
    const occupied=Object.values(st.players||{}).map(p=>`${p.x},${p.y}`);
    const spawn=mpFreeSpawnNear(game.map,game.enemies,occupied,base);
    game.player.x=spawn.x;game.player.y=spawn.y;game.player.facing=1;
    // publish only my position so others see me immediately (no floor/turn touch)
    const myEntry={x:spawn.x,y:spawn.y,floor:game.floor,facing:1,hp:game.player.hp,maxHp:game.player.maxHp,cls:game.player.cls,classIcon:game.player.classIcon,name:game.player.name,nombre:window.currentUser?.nombre};
    await mpSaveSession(session.id,fresh=>({dungeon_status:{...fresh,players:{...fresh.players,[pj.id]:myEntry}}}));
   }
  }
  anim.heroX=anim.targetX=game.player.x;anim.heroY=anim.targetY=game.player.y;anim.t=1;reveal(game.player.x,game.player.y);
  if(!game.mpStatusMirror)game.mpStatusMirror=st;
  mpSyncRealtimeStatusToGame();mpUpdateConnBadge(); // the connect above ran before `game` existed; stamp it now
  mpSyncOtherPlayers(st);
  recomputeDerived();updateUI();draw();
  mpSetMyTurn(String((game.turnOrder||[])[game.activePlayerIndex||0])===String(game.pjId));
  if(mpGamePollTimer)clearInterval(mpGamePollTimer);
  mpGamePollTimer=setInterval(mpPollGameState,rtReady?6000:400);
  mpEnsureEnemyIds();
  game.mpTrade=null;game.mpTradeSeenId=null;startMpTradePolling();
   banner(`PARTIDA MULTIJUGADOR · PISO ${game.floor}`);
 }catch(e){game=null;app.classList.add('hidden');multiplayerOverlay.classList.remove('hidden');startMultiHeartbeat();alert('Error al entrar en la partida: '+e.message)}
}

function mpSyncOtherPlayers(st){
 const players=st.players||{};
 const prev=new Map((game.otherPlayers||[]).map(p=>[String(p.pjId),p]));
 let moved=false;
 game.otherPlayers=Object.entries(players).filter(([pid,pos])=>String(pid)!==String(game.pjId)&&(pos.floor||st.currentFloor||1)===game.floor).map(([pid,pos])=>{
  const meta=(game.roster||[]).find(r=>String(r.pjId)===String(pid))||{};
  const rp={pjId:pid,x:pos.x,y:pos.y,floor:pos.floor,facing:pos.facing||1,hp:pos.hp??1,maxHp:pos.maxHp??1,name:pos.name||meta.pjName||'Jugador',nombre:pos.nombre||meta.nombre,cls:pos.cls,classIcon:pos.classIcon,equipment:{},animT:1};
  const old=prev.get(String(pid));
  if(old&&(old.x!==pos.x||old.y!==pos.y)&&Math.abs(old.x-pos.x)+Math.abs(old.y-pos.y)<=3){rp.prevX=old.x;rp.prevY=old.y;rp.animT=0;moved=true}
  return rp;
 });
 if(moved)requestAnimationFrame(mpAnimateRemote);
}
function mpAnimateRemote(){
 if(!game)return;
 let more=false;
 for(const rp of game.otherPlayers||[])if((rp.animT??1)<1){rp.animT=Math.min(1,rp.animT+.15);if(rp.animT<1)more=true}
 for(const e of game.enemies||[])if((e.animT??1)<1){e.animT=Math.min(1,e.animT+.15);if(e.animT<1)more=true}
 draw();
 if(more)requestAnimationFrame(mpAnimateRemote);
}

function mpSetMyTurn(isMine,phase){
 game.myTurn=isMine;
 game.mpCapture=isMine;
 busy=!isMine;
 if(isMine){mpResetActionSeq();startPlayerAP();game.mpTurnActions=[]} // fresh actionSeq + points + recorder
 const el=document.getElementById('mpTurnIndicator');
 if(el){
  el.classList.remove('hidden');
  el.classList.toggle('myTurn',isMine);
  if(isMine)el.textContent='¡ES TU TURNO!';
  else if(phase==='enemies'||game.mpEnemyPhaseRemote)el.textContent='Turno de los enemigos...';
  else{
   const activeId=game.turnOrder?.[game.activePlayerIndex||0];
   const meta=(game.roster||[]).find(r=>String(r.pjId)===String(activeId));
   const who=meta?(meta.nombre?`${meta.nombre} (${meta.pjName})`:meta.pjName):'otro jugador';
   el.textContent=`Esperando a ${who}...`;
  }
 }
 updateUI();
}

// High-frequency light poll: only refetch the full state when rev changed.
// Stale responses (rev <= last applied) are discarded, which is what used to
// cause crossed turns: an in-flight old read re-granting an already-passed turn.
async function mpPollGameState(){
 if(!game?.multiplayer||!game.dungeonStatusId||game.over||mpPollBusy||game.mpEnemyPhase)return;
 mpPollBusy=true;
 try{
  const id=game.dungeonStatusId;
  const liteRev=await dsGetRev(id);
  if(liteRev===null||liteRev<=(game.mpLastRev||0))return;
  const session=await dsGet(id);
  if(!session)return;
  const st=session.dungeon_status||{};
  const rev=Number(st.rev)||0;
  if(rev<=(game.mpLastRev||0))return;
  game.mpLastRev=rev;
  mpApplyRemoteState(st);
 }catch(e){console.error('poll multiplayer error',e)}
 finally{mpPollBusy=false}
}

function mpApplyRemoteState(st){
 if(st.slimFloors){st={...st};delete st.slimFloors}
 game.mpStatusMirror=st;
 // A DB checkpoint is only authoritative over the live channel when it is not
 // behind it. An older checkpoint (seq < local seq) may refresh the map/floor
 // but must never move the turn pointer back — that is what would cross turns.
 const stSeq=Number(st.seq)||0,localSeq=game.mpSeq||0;
 const turnAuthoritative=!mpLive()||stSeq>=localSeq;
 game.turnOrder=st.turnOrder&&st.turnOrder.length?st.turnOrder:game.turnOrder;
 game.roster=st.roster||game.roster;
 if(turnAuthoritative){
  game.activePlayerIndex=st.activePlayerIndex||0;
  game.turn=st.turn??game.turn;
  if(stSeq>localSeq){game.mpSeq=stSeq;mpPruneActionQueuesUpTo(stSeq);game.mpEnemyPhaseRemote=false}
 }
 game.sessionFloors=st.floors||game.sessionFloors;
 const remoteFloor=st.currentFloor||1;
 const overlay=st.floors?.[String(remoteFloor)];
 const myPos=st.players?.[String(game.pjId)];
 if(remoteFloor!==game.floor){
  // another player descended: the whole party moves to the new floor, and any
  // visual actions still queued for the old floor must never be replayed here
  mpResetActionQueues();
  game.floor=remoteFloor;
  game.floorEventRolled=true;
  game.mpFloorTransitioning=false;
  if(overlay&&overlay.map)applyFloorSnapshot(overlay);
  else loadPrecomputedFloor();
  const pos=(myPos&&(myPos.floor||remoteFloor)===remoteFloor)?myPos:(selectedDungeonWorld?.world_json?.floors?.[remoteFloor-1]?.spawn||{x:game.player.x,y:game.player.y});
  game.player.x=pos.x;game.player.y=pos.y;
  anim.heroX=anim.targetX=pos.x;anim.heroY=anim.targetY=pos.y;anim.t=1;
  reveal(pos.x,pos.y);
  banner(`PISO ${game.floor}`);
 }else if(overlay&&!game.myTurn){
  game.enemies=overlay.enemies||game.enemies;
  game.chests=overlay.chests||game.chests;
  game.doors=overlay.doors||game.doors;
  game.keys=overlay.keys||game.keys;
  game.companions=overlay.companions||game.companions;
  game.skillObjects=overlay.skillObjects||game.skillObjects;
  game.traps=overlay.traps||game.traps;
  game.altars=overlay.altars||game.altars;
  if(overlay.objective)game.objective=overlay.objective;
  game.boss=(game.enemies||[]).find(e=>e.boss)||null;
  if(overlay.seen&&overlay.seen.length){
   const remoteSeen=decodeSeen(overlay.seen);
   for(let y=0;y<remoteSeen.length;y++)for(let x=0;x<remoteSeen[y].length;x++)if(remoteSeen[y][x]&&game.seen[y])game.seen[y][x]=true;
  }
 }
 mpSyncOtherPlayers(st);
 if(myPos&&typeof myPos.hp==='number'&&!game.myTurn){
  if(myPos.hp<=0&&game.player.hp>0){game.player.hp=0;game.over=true;updateUI();draw();mpHandleDefeatWhileWaiting();return}
  if(myPos.hp>0&&myPos.hp!==game.player.hp){
   const diff=myPos.hp-game.player.hp;
   game.player.hp=Math.min(game.player.maxHp,myPos.hp);
   if(diff<0)floating(`${diff}`,game.player.x,game.player.y,'#ff8888');
  }
 }
 // replay combat events authored by the active client
 for(const ev of st.events||[])if((ev.i||0)>(game.mpLastEvSeq||0)){if(!(game.mpRecentEvents||[]).includes(ev.m))log(ev.m,ev.c||'combat');game.mpLastEvSeq=ev.i}
 // fallback (non-Realtime) path: replay the recorded action sequence too,
 // since this checkpoint is the only way this client ever sees the turn
 if(turnAuthoritative&&remoteFloor===game.floor&&st.actions?.length)mpReplayTurnActions(st,{skipFinalSnap:true});
 if(turnAuthoritative){
  const amIActive=String((game.turnOrder||[])[game.activePlayerIndex||0])===String(game.pjId);
  mpSetMyTurn(amIActive);
  }
 recomputeDerived();updateUI();draw();
}

function mpHandleDefeatWhileWaiting(){
 if(mpGamePollTimer){clearInterval(mpGamePollTimer);mpGamePollTimer=null}
 stopMpTradePolling();
 mpClearLiveTimers();
 finalizeCharacterDeath();
 storyTitle.textContent='HAS CAÍDO';
 storyBody.innerHTML='<div class="narrative gameOverBox"><p class="gameOverName"><b>Tu personaje ha muerto en la partida multijugador.</b></p></div>';
 storyOverlay.classList.remove('hidden');
}

// advance: soy el jugador activo y acabo de terminar mi acción -> avanzar el
//   turno (calculado siempre sobre el turnOrder/activePlayerIndex FRESCOS del
//   servidor, nunca sobre la copia local, que es la causa de que un cliente
//   "pisara" el turno recién avanzado por el otro).
// includeOtherPlayers: solo lo marca el cliente que acaba de resolver
//   enemyTurn() (el único momento en el que es autoritativo sobre el daño
//   recibido por los demás); solo actualiza su HP, nunca su posición, que
//   siempre se toma del estado fresco.
async function mpPersistTurnState({advance=false,includeOtherPlayers=false,checkpoint=false}={}){
 if(!game?.pjId)return;
 const bundle=characterBundleFromGame();
 game.maxFloorReached=bundle.maxFloorReached;
 // throttle the character save: every 3rd turn, on floor change or when hurt
 // badly, instead of every action (it competed with turn sync on the uplink)
 game.mpPjSaveCounter=(game.mpPjSaveCounter||0)+1;
 if(!game.multiplayer||game.mpPjSaveCounter%3===1||game.floor!==game.mpPjLastSavedFloor||game.player.hp<=game.player.maxHp*.35){
  game.mpPjLastSavedFloor=game.floor;
  fetch(`/api/user-pj?id=${encodeURIComponent(game.pjId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pj_json:bundle,feats:bundle.feats,pj_score:computeScore(bundle),pj_name:game.player.name,last_use:new Date().toISOString()})}).catch(e=>console.error('No se pudo guardar el personaje',e));
 }
 if(!game.dungeonStatusId)return;
 const floorSnap=floorSnapshot(),dynSnap=floorSnapshotDynamic();
 const myPos={x:game.player.x,y:game.player.y,floor:game.floor,facing:game.player.facing||1,hp:game.player.hp,maxHp:game.player.maxHp,cls:game.player.cls,classIcon:game.player.classIcon,name:game.player.name,nombre:window.currentUser?.nombre};
 const hpUpdates={};
 if(includeOtherPlayers)for(const op of game.otherPlayers||[])hpUpdates[op.pjId]={hp:op.hp,maxHp:op.maxHp};
 const events=(game.mpPendingEvents||[]).splice(0);
 const saved=await mpSaveSession(game.dungeonStatusId,fresh=>{
  let turnOrder=(fresh.turnOrder&&fresh.turnOrder.length)?fresh.turnOrder:(game.turnOrder||[game.pjId]);
  let turn=checkpoint?(game.turn||0):(fresh.turn||0);
  const wasActiveId=String(turnOrder[fresh.activePlayerIndex||0]??'');
  const players={...fresh.players,[game.pjId]:myPos};
  for(const [pid,upd] of Object.entries(hpUpdates)){
   const base=players[pid];
   if(base)players[pid]={...base,...upd};
  }
  // floor changed by me: relocate the whole party to the new floor spawn cluster
  const floorChanged=(fresh.currentFloor||1)!==game.floor;
  if(floorChanged){
   const occupied=[`${myPos.x},${myPos.y}`];
   for(const pid of Object.keys(players)){
    if(String(pid)===String(game.pjId))continue;
    const spot=mpFreeSpawnNear(game.map,game.enemies,occupied,{x:myPos.x,y:myPos.y});
    occupied.push(`${spot.x},${spot.y}`);
    players[pid]={...players[pid],x:spot.x,y:spot.y,floor:game.floor,facing:1};
   }
  }
  // dead players leave the turn order
  turnOrder=turnOrder.filter(id=>{const p=players[String(id)];return !p||typeof p.hp!=='number'||p.hp>0});
  if(!turnOrder.length)turnOrder=[game.pjId];
  let activePlayerIndex;
  if(checkpoint){
   // live mode: the channel already decided whose turn it is; the checkpoint
   // only records it (guarded by seq so an older checkpoint can never win)
   const idx=turnOrder.findIndex(id=>String(id)===String((game.turnOrder||[])[game.activePlayerIndex||0]));
   activePlayerIndex=idx===-1?(game.activePlayerIndex||0):idx;
   if(activePlayerIndex>=turnOrder.length)activePlayerIndex=0;
  }else if(advance&&(wasActiveId===String(game.pjId)||!wasActiveId)){
   // only the active player may advance the turn pointer (prevents crossed turns)
   const myIdx=turnOrder.findIndex(id=>String(id)===String(game.pjId));
   const isLast=myIdx===-1||myIdx===turnOrder.length-1;
   activePlayerIndex=isLast?0:myIdx+1;
   if(isLast)turn=(fresh.turn||0)+1;
  }else{
   const idx=turnOrder.findIndex(id=>String(id)===wasActiveId);
   activePlayerIndex=idx===-1?0:idx;
  }
  const evSeq=fresh.evSeq||0;
  const outEvents=events.length?((fresh.events||[]).concat(events.map((e,i)=>({...e,i:evSeq+i+1}))).slice(-12)):(fresh.events||[]);
  const roster=(fresh.roster&&fresh.roster.length)?fresh.roster:(game.roster||[]);
  // same floor: merge dynamic state over the stored static layout (much smaller write)
  const prevSnap=fresh.floors?.[String(game.floor)];
  const outSnap=(!floorChanged&&prevSnap&&prevSnap.map)?{...prevSnap,...dynSnap}:floorSnap;
  const seq=Math.max(Number(fresh.seq)||0,game.mpSeq||0);
  // carried so the fallback (non-Realtime) receiver can also replay the
  // sequence instead of only ever seeing the final snapshot
  const actions=(game.mpTurnActions||[]).slice(-60);
  return {dungeon_status:{...fresh,multiplayer:true,started:true,host:fresh.host||game.hostId,hostUser:fresh.hostUser||(roster.find(r=>String(r.pjId)===String(fresh.host||game.hostId))?.nombre),roster,turnOrder,activePlayerIndex,turn,currentFloor:game.floor,floors:{[game.floor]:outSnap},players,evSeq:evSeq+events.length,events:outEvents,seq,actions,turnAuthor:String(game.pjId)}};
 });
 if(advance&&saved)game.mpTurnActions=[]; // this write committed the turn: start recording fresh
 if(saved){
  const written=saved.status;
  game.turnOrder=written.turnOrder||game.turnOrder;
  game.activePlayerIndex=written.activePlayerIndex??game.activePlayerIndex;
  game.turn=written.turn??game.turn;
  game.roster=written.roster||game.roster;
  game.sessionFloors=written.floors||game.sessionFloors;
  game.mpLastEvSeq=Math.max(game.mpLastEvSeq||0,written.evSeq||0);
  mpSyncOtherPlayers(written);
 }}

async function mpOpenContinueList(){
 const status=document.getElementById('mpOpenStatus'),list=document.getElementById('mpOpenList');
 status.textContent='Cargando tus sesiones multijugador...';list.innerHTML='';
 try{
  const chars=await fetchMyCharacters();
  const myIds=new Set(chars.map(c=>String(c.id)));
  const r=await fetch('/api/dungeon-status?light=1');const sessions=await r.json();
  if(!r.ok)throw new Error(sessions.error||sessions.message||'No se pudieron cargar sesiones');
  const mine=sessions.filter(s=>{if(!s.dungeon_status?.multiplayer)return false;try{return (JSON.parse(s.players_ID||'[]')||[]).some(id=>myIds.has(String(id)))}catch(e){return false}});
  if(!mine.length){status.textContent='No tienes sesiones multijugador propias.';return}
  status.textContent=`${mine.length} sesión(es).`;
  list.innerHTML=mine.map(s=>{const st=s.dungeon_status||{};const names=(st.roster||[]).map(r=>r.pjName).join(', ');return `<button type="button" class="worldCard" data-mp-session="${s.id}"><b>${st.hostUser||'Sesión'}</b><span>${st.started?'En curso':'Sala de espera'} · Piso ${st.currentFloor||1}</span><small>${names}</small></button>`}).join('');
  list.querySelectorAll('[data-mp-session]').forEach(btn=>btn.onclick=()=>mpResumeSession(btn.dataset.mpSession,chars));
 }catch(e){status.textContent=`Error: ${e.message}`}
}

async function mpResumeSession(sessionId,chars){
 try{
  const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(sessionId)}`);
  const session=await r.json();if(!r.ok)throw new Error(session.error||'No se pudo cargar la sesión');
  const st=session.dungeon_status||{};
  let ids=[];try{ids=JSON.parse(session.players_ID||'[]')}catch(e){}
  const myChar=chars.find(c=>ids.map(String).includes(String(c.id)));
  if(!myChar)throw new Error('No participas en esta sesión.');
  if(myChar.pj_status!=='alive')throw new Error('Tu personaje en esta sesión ya no está vivo.');
  currentCharacter=myChar;
  const isHost=String(st.host)===String(myChar.id);
  if(st.started){
   // resuming an already-started session: wait in the lobby for every party
   // member to come back online instead of barging straight into the dungeon
   // solo, so both players enter together
   await mpSaveSession(sessionId,fresh=>({dungeon_status:{...fresh,resumeReady:{...(fresh.resumeReady||{}),[myChar.id]:true}}}));
   openMpLobby(sessionId,isHost,true);
  }else openMpLobby(sessionId,isHost);
 }catch(e){alert('Error al continuar la sesión: '+e.message)}
}

menuMultiBtn.onclick=enterMultiplayerScreen;
document.getElementById('backFromMultiplayerBtn').onclick=leaveMultiplayerScreen;
document.getElementById('mpCreateBtn').onclick=mpStartCreateFlow;
document.getElementById('mpContinueBtn').onclick=mpOpenContinueList;
document.getElementById('mpStartGameBtn').onclick=async()=>{
 try{
  // the dungeon is generated and written BEFORE started:true becomes visible to joiners
  const r=await fetch(`/api/dungeon-status?id=${encodeURIComponent(mpLobbySessionId)}`);
  const session=await r.json();if(!r.ok)throw new Error(session.error||'Sesión no encontrada');
  if(mpLobbyPollTimer){clearInterval(mpLobbyPollTimer);mpLobbyPollTimer=null}
  mpLobbyOverlay.classList.add('hidden');
  // resuming an already-started session must NOT regenerate floor 1 (starter=true
  // is only for a brand-new session's very first launch)
  await mpEnterStartedSession(session,!mpLobbyResuming);
 }catch(e){alert('Error al iniciar: '+e.message)}
};
document.getElementById('backFromLobbyBtn').onclick=()=>{
 if(mpLobbyPollTimer){clearInterval(mpLobbyPollTimer);mpLobbyPollTimer=null}
 mpLobbySessionId=null;
 cleanupMultiplayerRuntime();
 mpLobbyOverlay.classList.add('hidden');
 multiplayerOverlay.classList.remove('hidden');
 refreshOpenSessions();
 startMultiHeartbeat();
};

document.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const[x,y]=b.dataset.move.split(',').map(Number);move(x,y)});waitBtn.onclick=()=>{if(waitBtn.dataset.rest==='1')restInSafeRoom();else playerFinished()};cancelTargetBtn.onclick=()=>cancelTargeting();zoomVisibleTiles.oninput=e=>setVisibleTiles(e.target.value);setVisibleTiles(visibleTiles);startBtn.onclick=start;createWorldBtn.onclick=createDungeonWorld;document.getElementById('disenchantCloseBtn')?.addEventListener('click',()=>document.getElementById('disenchantOverlay')?.classList.add('hidden'));
document.querySelectorAll('.craftTabBtn').forEach(b=>b.addEventListener('click',()=>switchCraftTab(b.dataset.craftTab)));
const enterConfig=()=>{landingOverlay.classList.add('hidden');configScreen.classList.remove('hidden');setupConfigTabs();setupConfigMode();setupConfigPotionMode();setupClassConfigMode();setupTilesetConfigMode();setupEnemyConfigMode();setupChestConfigMode();setupConfigWorldObjectsMode();setupConfigAssetsMode();setupConfigGatesMode();setupDungeonConfigMode();setupTestingMode();fetchConfigItems();fetchConfigClasses();fetchConfigFloors();fetchEnemyConfig();fetchConfigChests();setupWorldSettings()};
menuScoresBtn.onclick=()=>{landingOverlay.classList.add('hidden');scoresScreen.classList.remove('hidden');fetchScores()};
document.getElementById('backFromScoresBtn').onclick=()=>{scoresScreen.classList.add('hidden');landingOverlay.classList.remove('hidden')};
menuSingleBtn.onclick=openSinglePlayerScreen;
document.getElementById('backFromSingleBtn').onclick=closeSinglePlayerScreen;
document.getElementById('spSelectCharBtn').onclick=openCharacterSelection;
document.getElementById('spNewCharBtn').onclick=openCharacterCreation;
document.getElementById('spContinueBtn').onclick=openSessionContinue;
menuConfigBtn.onclick=()=>{if(!window.currentUser?.admin){alert('Solo administradores pueden acceder a Configurar.');return}enterConfig()};
loginForm.onsubmit=async e=>{e.preventDefault();loginBtn.disabled=true;loginStatus.textContent='Entrando...';try{const r=await fetch('/api/user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:loginName.value,pass:loginPass.value})}),data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo iniciar sesión');window.currentUser=data;try{localStorage.setItem('mazmorraUser',JSON.stringify(data))}catch(err){}loginStatus.textContent=`Sesión iniciada: ${data.nombre}${data.admin?' · admin':''}`;const statsEl=document.getElementById('userProgressStats');if(statsEl){statsEl.textContent=`Nivel máximo de PJ: ${data.max_pj_lv||0} · PUNTUACIÓN: ${Math.round(data.accumulated_points||0)}`;statsEl.classList.remove('hidden')}mainMenuActions.classList.remove('hidden');loginForm.classList.add('hidden')}catch(err){loginStatus.textContent=err.message}finally{loginBtn.disabled=false}};
backToLandingBtn.onclick=()=>{configScreen.classList.add('hidden');landingOverlay.classList.remove('hidden');mainMenuActions.classList.remove('hidden');loginForm.classList.add('hidden')};



function renderRaceChoices(){
 const root=document.getElementById('raceChoices');if(!root)return;
 const raceIds=sortByGate('race',Object.keys(raceDefs));
 if(!raceIds.includes(selectedRace))selectedRace=raceIds.find(id=>gateUnlocked('race',id))||raceIds[0];
 root.innerHTML=raceIds.map(id=>{
  const r=raceDefs[id],unlocked=gateUnlocked('race',id),g=gateFor('race',id);
  // Locked races have no icon of their own today - the padlock takes that slot.
  const lockIcon=unlocked?'':`<canvas class="choiceLockIcon" width="40" height="40" data-gate-lock></canvas>`;
  const lockNote=unlocked?'':`<p class="small gateLockNote">Requiere Nivel PJ ${g.min_level||0} y ${g.min_points||0} puntos</p>`;
  return `<div class="choice ${id===selectedRace?'selected':''} ${unlocked?'':'locked'}" data-race="${id}" data-locked="${unlocked?'0':'1'}">${lockIcon}<div class="choiceBody"><b>${r.name}</b><p class="small">${r.desc}</p><span class="raceTag">${r.origin}</span><p class="small"><strong>Rasgo:</strong> ${r.trait}</p>${lockNote}</div></div>`;
 }).join('');
 root.querySelectorAll('[data-gate-lock]').forEach(c=>drawWorldObjectIconToCanvas(c,'reward_lock'));
 root.querySelectorAll('[data-race]').forEach(el=>el.onclick=()=>{if(el.dataset.locked==='1'){alert('Raza bloqueada: no cumples los requisitos de desbloqueo (nivel máximo de PJ / puntuación).');return}selectedRace=el.dataset.race;renderRaceChoices()});
}
renderRaceChoices();

// Advanced eligibility is the explicit config_class.advanced flag (set by
// saveConfigClass whenever a class is saved from the editor) - not whether
// the classId happens to collide with a hardcoded one, since a class can be
// a deliberate reskin/rename of a hardcoded class (same classId, different
// name/stats/skills) and still be meant purely for Advanced mode.
function classIdsForSkillMode(mode){
 if(mode==='advanced'){
  const ids=new Set();
  for(const row of configClasses){const cid=row.class_json?.classId;if(cid&&row.advanced===true)ids.add(cid)}
  return [...ids];
 }
 return Object.keys(classDefs);
}
function renderClassChoices(){
 const root=document.getElementById('classChoices'),ids=sortByGate('class',classIdsForSkillMode(selectedSkillMode));
 if(!ids.length){
  if(selectedSkillMode==='advanced'&&!configClassesLoaded){
   root.innerHTML='<p class="small">Cargando clases Advanced desde la base de datos...</p>';
   document.getElementById('classDetail').innerHTML='';
   fetchConfigClasses();
   return;
  }
  root.innerHTML='<p class="small">No hay clases Advanced configuradas todavía. Créalas en Configuración → Clases, o vuelve a Hardcode.</p>';
  document.getElementById('classDetail').innerHTML='';
  return;
 }
 if(!ids.includes(selectedClass))selectedClass=ids.find(id=>gateUnlocked('class',id))||ids[0];
 root.innerHTML=ids.map(id=>{
  const c=resolveClassDef(id),unlocked=gateUnlocked('class',id),g=gateFor('class',id);
  const lockNote=unlocked?'':`<div class="small gateLockNote">Requiere Nivel PJ ${g.min_level||0} y ${g.min_points||0} puntos</div>`;
  // Locked classes show the padlock in place of the class preview icon.
  const iconCanvas=unlocked?`<canvas width="64" height="64" data-class-preview="${id}"></canvas>`:`<canvas width="64" height="64" data-gate-lock></canvas>`;
  return `<div class="classCard ${id===selectedClass?'selected':''} ${unlocked?'':'locked'}" data-class="${id}" data-locked="${unlocked?'0':'1'}">${iconCanvas}<div class="classCopy"><b>${c.name}</b><span class="small">${c.desc}</span><div class="classStats">FUE ${c.stats.strength} · VIT ${c.stats.vitality} · AGI ${c.stats.agility} · SUE ${c.stats.luck} · INT ${c.stats.intelligence} · SAB ${c.stats.wisdom}</div>${lockNote}</div></div>`;
 }).join('');
 root.querySelectorAll('[data-class-preview]').forEach(c=>drawClassPreview(c,c.dataset.classPreview));
 root.querySelectorAll('[data-gate-lock]').forEach(c=>drawWorldObjectIconToCanvas(c,'reward_lock'));
 root.querySelectorAll('[data-class]').forEach(el=>el.onclick=()=>{if(el.dataset.locked==='1'){alert('Clase bloqueada: no cumples los requisitos de desbloqueo (nivel máximo de PJ / puntuación).');return}selectedClass=el.dataset.class;renderClassChoices()});
 const c=resolveClassDef(selectedClass);document.getElementById('classDetail').innerHTML=`<b>${c.name}</b><p>${c.desc}</p><p class="small">Al entrar elegirás una habilidad de Tier I. Después elegirás más en niveles 3, 5, 10, 15, 20, 30 y 40.</p>`;
}
renderClassChoices();
document.getElementById('skillModeHardcode')?.addEventListener('change',()=>{selectedSkillMode='hardcode';renderClassChoices()});
document.getElementById('skillModeAdvanced')?.addEventListener('change',()=>{selectedSkillMode='advanced';renderClassChoices()});
document.getElementById('combatModeClassic')?.addEventListener('change',()=>{selectedCombatMode='classic'});
document.getElementById('combatModeAp')?.addEventListener('change',()=>{selectedCombatMode='ap'});


document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.tabview').forEach(x=>x.classList.add('hidden'));document.getElementById(b.dataset.tab).classList.remove('hidden')});
function isTypingTarget(el){return ['INPUT','TEXTAREA','SELECT'].includes(el?.tagName)||el?.isContentEditable}
addEventListener('keydown',e=>{if(isTypingTarget(e.target)||!configScreen.classList.contains('hidden'))return;const k=e.key.toLowerCase(),m={arrowup:[0,-1],arrowdown:[0,1],arrowleft:[-1,0],arrowright:[1,0]};if(k==='escape'&&pendingTargetAction){cancelTargeting();return}if(m[k]){e.preventDefault();if(!pendingTargetAction)move(...m[k]);return}if('1234'.includes(k)){e.preventDefault();useSkill(Number(k)-1);return}if(k==='a'){e.preventDefault();beginBasicAttack()}if(k==='e'){e.preventDefault();waitBtn.click()}});


function gridCellFromEvent(ev){
 const canvas=ev.currentTarget,rect=canvas.getBoundingClientRect(),scaleX=canvas.width/rect.width,scaleY=canvas.height/rect.height;
 const pxX=(ev.clientX-rect.left)*scaleX,pxY=(ev.clientY-rect.top)*scaleY;
 const c=camera();
 return {x:c.x+Math.floor(pxX/TILE),y:c.y+Math.floor(pxY/TILE)};
}
document.getElementById('game').addEventListener('mousemove',ev=>{
 if(!pendingTargetAction||pendingTargetAction.mode!=='area'||pendingAreaCandidate)return;
 const {x,y}=gridCellFromEvent(ev);
 if(pendingAreaHover&&pendingAreaHover.x===x&&pendingAreaHover.y===y)return;
 pendingAreaHover={x,y};draw();
});
document.getElementById('game').addEventListener('click',ev=>{
 const {x:gx,y:gy}=gridCellFromEvent(ev);
 if(pendingTargetAction){
  if((pendingTargetAction.kind==='skill'||pendingTargetAction.kind==='potion'||pendingTargetAction.kind==='equipment')&&pendingTargetAction.mode==='area'){
   if(pendingAreaCandidate&&pendingAreaCandidate.x===gx&&pendingAreaCandidate.y===gy){confirmAreaTarget();return}
   const range=pendingTargetAction.range||1,minRange=pendingTargetAction.minRange??1;
   if(!validateTargetCell(gx,gy,range,minRange)){log(`Objetivo fuera de alcance o sin línea de visión (${range}).`,'sys');return}
   pendingAreaCandidate={x:gx,y:gy};pendingAreaHover=null;
   document.getElementById('confirmTargetBtn')?.classList.remove('hidden');
   const hint=document.getElementById('targetHint');if(hint)hint.textContent='Pulsa otra vez la misma casilla, o CONFIRMAR, para lanzar · ESC para cancelar';
   draw();
   return;
  }
  if(pendingTargetAction.kind==='companionCommand'){resolveCompanionCommand(pendingTargetAction.companionId,gx,gy);return}
  if(pendingTargetAction.kind==='skill')resolveTargetedSkill(pendingTargetAction.slot,gx,gy);
  else if(pendingTargetAction.kind==='potion')resolveTargetedPotion(pendingTargetAction.potionId,gx,gy);
  else if(pendingTargetAction.kind==='equipment')resolveTargetedEquipmentActive(pendingTargetAction.equipSlot,gx,gy);
  else resolveBasicAttack(gx,gy);
  return
 }
 showInspect(inspectedEntityAt(gx,gy),ev.clientX,ev.clientY)
});
document.getElementById('closeInspect')?.addEventListener('click',closeInspect);
document.getElementById('confirmTargetBtn')?.addEventListener('click',confirmAreaTarget);
document.getElementById('hudEquipment')?.addEventListener('click',()=>{showTab('equipment')});
document.getElementById('hudSkills')?.addEventListener('click',()=>{showTab('skills')});
document.getElementById('hudMap')?.addEventListener('click',()=>{const w=document.getElementById('minimapWrap');w.classList.toggle('minimapHidden');document.getElementById('hudMap').textContent=w.classList.contains('minimapHidden')?'🗺':'✕'});
