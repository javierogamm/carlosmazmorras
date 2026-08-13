/* MAZMORRA // BOTÍN v0.61.1
 * Inicio de partida, generación de pisos, eventos, enemigos y objetivos.
 * Carga clásica ordenada por index.html; el estado compartido pertenece al ámbito global del juego.
 */
function log(msg,cls=''){const d=document.createElement('div');d.className=cls;d.textContent=msg;document.getElementById('log').prepend(d);if(game?.multiplayer&&game.mpCapture&&cls&&cls!=='sys')game.mpPendingEvents=(game.mpPendingEvents||[]).concat({m:msg,c:cls}).slice(-8)}
function banner(text){const d=document.createElement('div');d.className='banner';d.textContent=text;document.body.appendChild(d);setTimeout(()=>d.remove(),2100)}
function camera(){return{x:Math.max(0,Math.min(COLS-visibleTiles,game.player.x-Math.floor(visibleTiles/2))),y:Math.max(0,Math.min(ROWS-visibleTiles,game.player.y-Math.floor(visibleTiles/2)))}}
function floating(text,x,y,color='#fff'){const r=canvas.getBoundingClientRect(),c=camera(),d=document.createElement('div');d.className='floatText';d.textContent=text;d.style.color=color;d.style.left=`${r.left+(x-c.x+.45)*r.width/visibleTiles}px`;d.style.top=`${r.top+(y-c.y+.25)*r.height/visibleTiles}px`;document.body.appendChild(d);setTimeout(()=>d.remove(),850)}
// Brief tracer line for any hit landed from more than 1 tile away (ranged
// weapons, ranged skills, enemy ranged attacks) - a plain DOM overlay like
// floating(), not a canvas draw, so it doesn't need to hook into the
// animate()/draw() loop to fade out on its own.
function rangedTracer(x1,y1,x2,y2,color='#9be8ff'){
 const r=canvas.getBoundingClientRect(),c=camera(),scale=r.width/visibleTiles;
 const sx1=r.left+(x1-c.x+.5)*scale,sy1=r.top+(y1-c.y+.5)*scale;
 const sx2=r.left+(x2-c.x+.5)*scale,sy2=r.top+(y2-c.y+.5)*scale;
 const dx=sx2-sx1,dy=sy2-sy1,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;
 const d=document.createElement('div');
 d.className='rangedTracer';
 d.style.left=`${sx1}px`;d.style.top=`${sy1}px`;d.style.width=`${len}px`;
 d.style.setProperty('--tracer-color',color);
 d.style.transform=`rotate(${angle}deg)`;
 document.body.appendChild(d);
 setTimeout(()=>d.remove(),260);
}

function setVisibleTiles(value){
 visibleTiles=Math.max(MIN_VISIBLE_TILES,Math.min(MAX_VISIBLE_TILES,Number(value)||8));
 localStorage.setItem('visibleTiles',String(visibleTiles));
 applyCanvasSize();
 const input=document.getElementById('zoomVisibleTiles'),label=document.getElementById('zoomVisibleTilesLabel');
 if(input)input.value=String(visibleTiles);
 if(label)label.textContent=`${visibleTiles}x${visibleTiles}`;
 if(game)draw();
}

function healEntity(entity,amount,x=entity.x??game.player.x,y=entity.y??game.player.y){
 const max=entity===game.player?companionResourceCap('hp'):Number(entity.maxHp)||0,before=Number(entity.hp)||0;
 if(max<=0||amount<=0)return 0;
 entity.hp=Math.min(max,before+Math.max(0,Math.round(amount)));
 const healed=Math.max(0,Math.round(entity.hp-before));
 if(healed>0)floating(`+${healed}`,x,y,'#70dc9b');
 return healed
}
function restoreEntityResource(entity,resource,amount,x=entity.x??game.player.x,y=entity.y??game.player.y){
 if(resource==='hp')return healEntity(entity,amount,x,y);
 const maxKey=resource==='mana'?'maxMana':'maxStamina',max=entity===game.player?companionResourceCap(resource):Number(entity[maxKey])||0,before=Number(entity[resource])||0;
 if(max<=0||amount<=0)return 0;
 entity[resource]=Math.min(max,before+Math.max(0,Math.round(amount)));
 const restored=Math.max(0,Math.round(entity[resource]-before));
 if(restored>0)floating(`+${restored} ${resource==='mana'?'M':'S'}`,x,y,resource==='mana'?'#72b9ff':'#ffd45f');
 return restored
}

function effect(cls){canvas.classList.remove(cls);void canvas.offsetWidth;canvas.classList.add(cls)}
// A NaN/undefined/zero vision radius (e.g. a custom Advanced-mode class
// whose stats object was missing agility, or any other corrupt player.vision
// value) must never silently turn this into a no-op: NaN bounds make every
// loop comparison false, so nothing gets revealed and the whole floor stays
// pitch black regardless of how far the player walks. Falls back to the
// base radius (4, matching the default character's own formula) instead.
function reveal(cx,cy,r=game.player.vision){
 if(!Number.isFinite(r)||r<=0)r=4;
 for(let y=Math.max(0,cy-r);y<=Math.min(ROWS-1,cy+r);y++)for(let x=Math.max(0,cx-r);x<=Math.min(COLS-1,cx+r);x++)if(Math.hypot(x-cx,y-cy)<=r+.4)game.seen[y][x]=true
}


let pendingClassSkillRequests=[];
function classTierForLevel(level){return classSkillMilestones[level]||0}
const CLASS_SKILL_LEVELS=[1];
function ensureSkillChoiceState(){
 const p=game.player;
 p.skillChoicesAwarded=p.skillChoicesAwarded||{};
 pendingClassSkillRequests=pendingClassSkillRequests||[];
}
function classSkillIdsForTier(tier){
 const roman=['','I','II','III'][tier];
 return (classSkillTrees[game.player.cls]?.[roman]||[]).filter(id=>skillDefs[id]);
}
function classSkillIdsForLevelReward(level){
 const maxTier=level>=10?3:2,tree=classSkillTrees[game.player.cls]||{};
 return Object.entries(tree).flatMap(([roman,ids])=>{
  const tier={I:1,II:2,III:3}[roman]||0;
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
 const tier=classTierForLevel(level);
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
 const tier=['','I','II','III'][s.tier]||s.tier||'?';
 return `<div class="levelRewardSkill"><b>${s.icon} ${s.name}</b><span class="tierBadge">TIER ${tier}</span><p>${s.desc}</p><span class="small">Skill aleatoria de ${game.player.className} desbloqueada al nivel ${level}.</span></div>`
}
function processClassSkillChoices(){
 if(!game?.player)return;
 if(game.player.unspentStatPoints>0||document.getElementById('statPointModal')?.classList.contains('open'))return;
 const modal=document.getElementById('skillChoiceModal');
 if(!modal||modal.classList.contains('open'))return;
 if(!pendingClassSkillRequests.length){
  const missing=firstMissingClassSkillRequest();
  if(missing)pendingClassSkillRequests.push(missing);
 }
 if(!pendingClassSkillRequests.length)return;
 const request=pendingClassSkillRequests.shift(),roman=['','I','II','III'][request.tier],choices=classSkillChoicesForTier(request.tier);
 // A custom class with no skills configured for this tier leaves nothing to
 // pick - mark it satisfied and move on instead of leaving the request
 // stuck forever, but if this WAS the initial character-creation request,
 // still finish creating the character (save to DB, back to single player)
 // exactly like the real pick-a-skill path below does. Skipping this was
 // the "click Crear, screen goes blank, character never saved" bug: no
 // choices meant the modal never opened, so finishCharacterCreation() (only
 // ever called from inside that modal's click handler) never ran.
 if(!choices.length){game.player.skillChoicesAwarded[request.level]='complete';if(request.initial)finishCharacterCreation();processClassSkillChoices();return}
 document.getElementById('skillChoiceTitle').textContent=request.initial?'ELIGE TU PRIMERA HABILIDAD':`NUEVA HABILIDAD · NIVEL ${request.level} · TIER ${roman}`;
 document.getElementById('skillChoiceText').textContent=`${game.player.className} · nivel ${request.level}. Elige una habilidad del pool real de tu clase para tier ${roman}.`;
 document.getElementById('skillChoiceGrid').innerHTML=choices.map(id=>{const s=skillDefs[id];return `<button type="button" class="skillChoiceCard" data-pick-skill="${id}"><b>${s.icon} ${s.name}</b><span class="tierBadge">TIER ${roman}</span><p>${s.desc}</p><span class="small">${s.cost} ${s.resource==='mana'?'maná':'stamina'} · CD ${s.cd} · Alcance ${s.range||0}</span></button>`}).join('');
 modal.classList.add('open');
 modal.querySelectorAll('[data-pick-skill]').forEach(b=>b.addEventListener('click',()=>{
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
   learnSkill(b.dataset.pickSkill);
   game.player.skillChoicesAwarded[request.level]='chosen';
   modal.classList.remove('open');updateUI();
   if(request.initial)finishCharacterCreation();
   queueMissingClassSkillChoices();
   processClassSkillChoices();
  }catch(e){
   console.error('Fallo al elegir la habilidad de clase:',e);
   alert(`Error al elegir la habilidad "${b.dataset.pickSkill}": ${e.message}`);
  }
 }))
}
function classSkillConsistencyGuard(){if(game?.turn%2===0)queueMissingClassSkillChoices()}

function start(){
 if(!selectedCombatMode){alert('Elige un modo de combate (Clásico o Puntos de Acción) antes de crear el personaje.');return}
 if(!gateUnlocked('race',selectedRace)){alert('Raza bloqueada: no cumples los requisitos de desbloqueo.');return}
 if(!gateUnlocked('class',selectedClass)){alert('Clase bloqueada: no cumples los requisitos de desbloqueo.');return}
 const race=selectedRace,cls=resolveClassDef(selectedClass);
 // resolveClassDef returns null for a custom class whose config_class row
 // hasn't finished loading yet (fetchConfigClasses is async and the class-
 // choice screen can render before it resolves) - without this guard,
 // `cls.stats` below throws immediately and silently aborts start() before
 // `game` is even created, leaving the player stuck on the creation screen
 // with no feedback at all.
 if(!cls){alert('La clase todavía se está cargando; espera un segundo e inténtalo de nuevo.');return}
 const stats={...cls.stats},maxHp=30+stats.vitality*3+vitalityHpBonus(stats.vitality);
 const maxStamina=45+stats.strength*4+stats.agility*2,maxMana=30+stats.wisdom*5+stats.intelligence*3;
 const equipment=Object.fromEntries(slots.map(s=>[s,null]));equipment.weapon=makeStarterWeapon(selectedClass);
 game={floor:1,themeIndex:0,turn:0,dungeonWorldId:selectedDungeonWorld?.id||null,dungeonWorldName:selectedDungeonWorld?.world_name||null,worldParams:normalizeWorldParams(selectedDungeonWorld?.world_json?.params),inventory:[],achievements:{},feats:normalizeFeats(),bossesKilled:0,chestsOpened:0,player:{name:nameInput.value||'Sin nombre',race,cls:selectedClass,className:cls.name,classIcon:classIconForId(selectedClass),skillMode:selectedSkillMode,combatMode:selectedCombatMode,level:1,xp:0,nextXp:xpNeededForLevel(1),hp:maxHp,maxHp,stamina:maxStamina,maxStamina,mana:maxMana,maxMana,baseDamage:2+stats.strength,baseArmor:4+Math.floor(stats.vitality/2),gold:0,keys:0,vision:4+Math.floor((stats.agility||0)/4),shield:0,stats,equipment,knownSkills:[],skillProgress:{},skillChoicesAwarded:{},equippedSkills:[null,null,null,null],cooldowns:{},equipmentCooldowns:{},debuff:0,shards:{}}};
 const rb=raceDefs[race]?.bonuses||{};
 game.player.raceName=raceDefs[race]?.name||race;
 game.player.raceBonuses={...rb};
 if(rb.armor)game.player.baseArmor+=rb.armor;
 addStarterPotions(selectedClass);
 syncAllEquipmentPassives();recomputeDerived();startOverlay.classList.add('hidden');
 // A brand new character can never legitimately need the level-up modals -
 // clear any 'open' class left over from a previous character/session in
 // this same tab (e.g. a stat-point or skill-choice modal that didn't get
 // closed), since processClassSkillChoices() silently no-ops while either
 // is open and that would otherwise strand the player on a blank screen
 // right after clicking "Crear personaje", with the new character never
 // reaching finishCharacterCreation()'s DB save.
 document.getElementById('statPointModal')?.classList.remove('open');
 document.getElementById('skillChoiceModal')?.classList.remove('open');
 // Likewise, drop any request left queued from a previous/interrupted
 // creation attempt in this same tab (pendingClassSkillRequests is a
 // module-level array, never reset on its own) - a stale non-initial entry
 // sitting ahead of this character's own request in the queue would get
 // shifted out and resolved first, so picking a skill would silently do
 // nothing toward finishing THIS character's creation.
 pendingClassSkillRequests=[];
 try{
  queueClassSkillChoice(1,true);
 }catch(e){
  console.error('Fallo al iniciar la elección de habilidad inicial:',e);
  alert('Error al preparar la elección de habilidad inicial: '+e.message);
 }
}
storyContinue.onclick=()=>{storyOverlay.classList.add('hidden');if(!game.map)generateFloor();updateUI()};

// ============================================================================
// FLOOR ARCHETYPES + ROOM TYPOLOGIES
// A floor picks an archetype by weighted probability (gated by depth, expected
// enemy tier and how recently each special archetype appeared). The archetype
// then drives the layout, the room-typology weights, enemy budget, rewards,
// special conditions and how the floor is completed. Room typologies do the
// local work: size, shape, exits, encounter composition, cover, traps and loot.
// ============================================================================

// Expected enemy tier at a given depth (drives boss strength and elite mix).
function expectedTierForFloor(floor,total=20){
 const r=(balanceLevel(game?.floorEntryLevel||game?.player?.level||1)-1)/(BALANCE_LEVEL_CAP-1);
 return r<.25?1:r<.55?2:r<.8?3:4;
}

// Room dimension ranges are ~30% smaller than the original design (map grid
// shrunk from 70x70 to 49x49 to match) - room/chest/enemy counts below are
// untouched, so the same content packs into a smaller floor.
const ROOM_TYPES={
 filler:      {label:'Sala vacía',      size:[3,5],  enemies:[0,1], tier:0,  cover:.15, traps:0,   chest:.10, exits:2, event:.02},
 combat:      {label:'Sala de combate', size:[4,7],  enemies:[2,4], tier:0,  cover:.30, traps:.10, chest:.20, exits:2, event:.05},
 ambush:      {label:'Emboscada',       size:[4,6],  enemies:[3,6], tier:0,  cover:.20, traps:.25, chest:.15, exits:2, event:.08, place:'edges'},
 guardpost:   {label:'Puesto de guardia',size:[4,6], enemies:[2,3], tier:1,  cover:.35, traps:.10, chest:.45, exits:2, event:.04, place:'chokepoint'},
 eliteden:    {label:'Guarida de élite',size:[5,8], enemies:[1,3], tier:1,  cover:.30, traps:.05, chest:.65, exits:2, event:.06, elite:true},
 vault:       {label:'Cámara acorazada',size:[3,5],  enemies:[0,2], tier:0,  cover:.10, traps:.45, chest:1,   exits:1, event:.05, chests:[2,4], locked:true},
 arena:       {label:'Arena',           size:[7,11], enemies:[4,8], tier:0,  cover:.20, traps:.05, chest:.25, exits:2, event:.05, wave:true},
 hub:         {label:'Encrucijada',     size:[4,6],  enemies:[0,2], tier:0,  cover:.25, traps:.10, chest:.15, exits:4, event:.04},
 traproom:    {label:'Sala trampa',     size:[4,6],  enemies:[0,2], tier:0,  cover:.20, traps:.90, chest:.55, exits:2, event:.10, trapCount:[3,6]},
 shrine:      {label:'Altar',           size:[3,4],  enemies:[0,0], tier:0,  cover:.10, traps:0,   chest:.10, exits:2, event:.05, altar:true},
 creator:     {label:'Sala del Creador',size:[3,4],  enemies:[0,0], tier:0,  cover:.10, traps:0,   chest:.10, exits:2, event:.05, altar:true, creatorRoom:true},
 deadend:     {label:'Callejón',        size:[3,4],  enemies:[0,1], tier:0,  cover:.10, traps:.20, chest:.30, exits:1, event:.03},
 knot:        {label:'Nudo de pasillos',size:[3,4],  enemies:[0,2], tier:0,  cover:.15, traps:.15, chest:.05, exits:3, event:.02},
 bossarena:   {label:'Arena del jefe',  size:[8,11], enemies:[0,2], tier:1,  cover:.25, traps:0,   chest:.35, exits:1, event:0,  boss:true},
 megaboss:    {label:'Cámara del megajefe',size:[15,19],enemies:[0,0],tier:3, cover:.05, traps:0,   chest:.4,  exits:1, event:0,  boss:true, megaboss:true},
 prep:        {label:'Sala de preparación',size:[4,6],enemies:[0,1],tier:0,  cover:.15, traps:0,   chest:.55, exits:2, event:.03, altar:true}
};

// weight(floor,total,tier) -> relative probability. 0 disables the archetype.
const FLOOR_ARCHETYPES={
 standard:{
  label:'Piso estándar', minFloor:1, cooldown:0, objective:'stairs',
  desc:'Mezcla equilibrada de salas. Referencia de dificultad.',
  weight:()=>100,
  layout:{rooms:[26,40], size:[3,8], corridors:'normal', loops:.15, pillars:1},
  enemies:{density:1, elite:1, tierBias:0, bossOnEven:true},
  rewards:{chests:1, rarity:0},
  roomWeights:{filler:26,combat:30,ambush:10,guardpost:8,eliteden:5,vault:4,hub:6,traproom:4,shrine:3,creator:2,deadend:4,knot:4}
 },
 superboss:{
  label:'Piso de superjefe', minFloor:8, cooldown:7, objective:'bossKill', announce:true,
  desc:'Algo muy superior habita este piso. Prepárate antes de entrar en su sala.',
  weight:(f,t)=>f<8?0:6+Math.min(8,f/3),
  layout:{rooms:[18,26], size:[4,8], corridors:'normal', loops:.1, pillars:1.2},
  enemies:{density:.5, elite:.8, tierBias:0, bossOnEven:false, superBoss:true},
  rewards:{chests:1.3, rarity:2},
  roomWeights:{prep:16,shrine:10,creator:2,filler:20,combat:16,guardpost:10,eliteden:8,vault:6,hub:6,deadend:4}
 },
 laberinto:{
  label:'Piso laberinto', minFloor:3, cooldown:3, objective:'stairs',
  desc:'Pasillos, bifurcaciones y caminos falsos. La salida no está a la vista.',
  weight:(f)=>f<3?0:26,
  layout:{rooms:[40,56], size:[3,4], corridors:'maze', loops:.55, pillars:.6, deadEnds:.35},
  enemies:{density:.55, elite:.8, tierBias:0, bossOnEven:false},
  rewards:{chests:1.15, rarity:1},
  roomWeights:{knot:24,deadend:20,filler:18,hub:12,traproom:10,combat:8,vault:5,shrine:3,creator:2}
 },
 horda:{
  label:'Piso horda', minFloor:4, cooldown:3, objective:'waves',
  desc:'Oleadas continuas en salas amplias. Sobrevive a todas para abrir la salida.',
  weight:(f)=>f<4?0:22,
  layout:{rooms:[14,22], size:[6,11], corridors:'arena', loops:.3, pillars:1.4},
  enemies:{density:1.35, elite:.7, tierBias:-1, bossOnEven:false, waves:true},
  rewards:{chests:1.2, rarity:1},
  roomWeights:{arena:34,combat:24,filler:14,hub:10,ambush:8,eliteden:5,vault:5}
 },
 elites:{
  label:'Piso de élites', minFloor:5, cooldown:4, objective:'stairs',
  desc:'Pocos enemigos, casi todos de gran poder. Combates tácticos.',
  weight:(f)=>f<5?0:16,
  layout:{rooms:[16,24], size:[4,8], corridors:'normal', loops:.2, pillars:1.3},
  enemies:{density:.32, elite:6, tierBias:1, bossOnEven:false, miniboss:true},
  rewards:{chests:1.35, rarity:2},
  roomWeights:{eliteden:30,combat:20,guardpost:14,filler:12,vault:8,hub:6,shrine:5,creator:2,arena:5}
 },
 bossrush:{
  label:'Piso de asalto de jefes', minFloor:12, cooldown:9, objective:'bossKill', announce:true,
  desc:'Arenas encadenadas. Cada una guarda un jefe; el último es el más fuerte.',
  weight:(f,t)=>f<12?0:5+Math.min(7,f/4),
  layout:{rooms:[12,18], size:[6,10], corridors:'arena', loops:.15, pillars:1.1},
  enemies:{density:.3, elite:1.5, tierBias:1, bossOnEven:false, bossRush:true},
  rewards:{chests:1.5, rarity:3},
  roomWeights:{bossarena:30,prep:16,arena:16,shrine:12,creator:2,filler:12,vault:8,hub:6}
 },
 tesoro:{
  label:'Piso del tesoro', minFloor:3, cooldown:5, objective:'stairs',
  desc:'Riqueza a la vista, guardada por veteranos. Piso compacto y denso.',
  weight:(f)=>f<3?0:12,
  layout:{rooms:[4,4], size:[3,6], corridors:'normal', loops:.25, pillars:.8},
  enemies:{density:.45, elite:1.2, tierBias:0, minTier:'iii', bossOnEven:false, greedAmbush:true},
  rewards:{chests:2.8, rarity:3},
  roomWeights:{vault:30,filler:18,traproom:14,combat:12,guardpost:10,deadend:8,hub:5,shrine:3,creator:2}
 },
 supervivencia:{
  label:'Piso de supervivencia', minFloor:6, cooldown:5, objective:'survive', announce:true,
  desc:'No hay salida todavía. Aguanta: la escalera aparecerá al resistir lo suficiente.',
  weight:(f)=>f<6?0:14,
  layout:{rooms:[16,24], size:[5,9], corridors:'arena', loops:.35, pillars:1.5},
  enemies:{density:.9, elite:1.2, tierBias:0, bossOnEven:false, escalate:true},
  rewards:{chests:1.4, rarity:2},
  roomWeights:{arena:26,combat:22,filler:16,hub:12,ambush:10,eliteden:8,shrine:6,creator:2}
 },
 contrarreloj:{
  label:'Piso contrarreloj', minFloor:7, cooldown:5, objective:'timed', announce:true,
  desc:'El piso colapsa. Encuentra la salida antes de que se agote el tiempo.',
  weight:(f)=>f<7?0:13,
  layout:{rooms:[22,32], size:[4,7], corridors:'normal', loops:.4, pillars:.9},
  enemies:{density:.7, elite:1, tierBias:0, bossOnEven:false},
  rewards:{chests:1.3, rarity:2},
  roomWeights:{combat:24,filler:20,hub:16,knot:12,traproom:10,vault:8,guardpost:6,shrine:4,creator:2}
 },
 // Built by buildCityFloorPlan, not the shared room/corridor carving loop:
 // an open district with no walled rooms, just building-sized (2x2+) assets
 // laid out in a loose grid (with jitter/skips for asymmetry) plus 1x1 props
 // scattered between them. `layout`/`roomWeights` below are still used - just
 // for the unwalled bookkeeping "zones" (chests/traps/altars/enemies/safe
 // spots) rather than for carving actual walls.
 city:{
  label:'Piso ciudad', minFloor:4, cooldown:5, objective:'stairs',
  desc:'Un distrito abierto sin salas: edificios distribuidos en manzanas, con callejones y objetos pequeños entre ellos.',
  weight:(f)=>f<4?0:14,
  layout:{rooms:[16,16], size:[6,11], corridors:'open', loops:0, pillars:0},
  enemies:{density:.85, elite:1, tierBias:0, bossOnEven:true},
  rewards:{chests:1.1, rarity:1},
  roomWeights:{filler:26,combat:22,guardpost:12,vault:8,shrine:8,creator:6,hub:8,eliteden:6,traproom:4}
 }
};

// Weighted pick honouring depth gates, recency cooldowns and a hard rule that
// two heavy archetypes never chain back to back.
const HEAVY_ARCHETYPES=new Set(['superboss','bossrush']);
function pickFloorArchetype(floor,total,recent=[]){
 const tier=expectedTierForFloor(floor,total);
 const last=recent[recent.length-1];
 const entries=[];
 for(const [id,a] of Object.entries(FLOOR_ARCHETYPES)){
  if(floor<(a.minFloor||1))continue;
  if(HEAVY_ARCHETYPES.has(id)&&HEAVY_ARCHETYPES.has(last))continue;
  const since=recent.length-1-recent.lastIndexOf(id);
  if(recent.includes(id)&&since<=(a.cooldown||0))continue;
  let w=a.weight(floor,total,tier)||0;
  if(w<=0)continue;
  entries.push({id,w});
 }
 if(!entries.length)return 'standard';
 const totalW=entries.reduce((s,e)=>s+e.w,0);
 let r=Math.random()*totalW;
 for(const e of entries){r-=e.w;if(r<=0)return e.id}
 return entries[entries.length-1].id;
}

function weightedRoomType(weights){
 const entries=Object.entries(weights).filter(([id,w])=>w>0&&ROOM_TYPES[id]);
 const total=entries.reduce((s,[,w])=>s+w,0);
 let r=Math.random()*total;
 for(const [id,w] of entries){r-=w;if(r<=0)return id}
 return entries.length?entries[0][0]:'filler';
}
function randBetween(a,b){return a+rng(Math.max(1,b-a+1))}

// Objective descriptor stored on the floor and shared through the snapshot.
function buildFloorObjective(archId,floor,total){
 const a=FLOOR_ARCHETYPES[archId]||FLOOR_ARCHETYPES.standard;
 switch(a.objective){
  case 'survive':return {type:'survive',turns:12+Math.min(14,Math.floor(floor*.7)),elapsed:0,done:false,label:'Sobrevive'};
  case 'timed':return {type:'timed',limit:42+Math.min(40,floor*2),elapsed:0,expired:false,done:false,label:'Contrarreloj'};
  case 'waves':return {type:'waves',total:3+Math.min(3,Math.floor(floor/6)),done:0,pending:false,label:'Oleadas'};
  case 'bossKill':return {type:'bossKill',done:false,label:'Derrota al jefe'};
  default:return {type:'stairs',label:'Encuentra la salida'};
 }
}

// A megaboss floor is a fixed, deterministic layout - a narrow 10-tile
// corridor straight into one big central arena room - instead of the usual
// randomized multi-room dungeon, so it's built directly rather than through
// the weighted room-typology loop below. Rolled independently of
// FLOOR_ARCHETYPES (33% on every floor%3===0, see buildFloorPlan) instead of
// competing on weight/cooldown with the other archetypes.
function buildMegabossFloorPlan(floor,params){
 const total=params?.floors||DEFAULT_WORLD_PARAMS.floors;
 const map=Array.from({length:ROWS},()=>Array(COLS).fill(1));
 const spawnW=5,spawnH=5,spawnX=2,spawnY=Math.max(1,Math.floor(ROWS/2)-Math.floor(spawnH/2));
 const spawn={x:spawnX,y:spawnY,w:spawnW,h:spawnH,cx:spawnX+Math.floor(spawnW/2),cy:spawnY+Math.floor(spawnH/2),type:'filler'};
 const corridorY=spawn.cy,corridorStartX=spawnX+spawnW,corridorLen=10;
 const roomW=16,roomH=16,roomX=corridorStartX+corridorLen,roomY=Math.max(1,Math.min(ROWS-roomH-2,corridorY-Math.floor(roomH/2)));
 const bossRoom={x:roomX,y:roomY,w:roomW,h:roomH,cx:roomX+Math.floor(roomW/2),cy:roomY+Math.floor(roomH/2),type:'megaboss'};
 carve(map,spawn);carve(map,bossRoom);
 for(let x=corridorStartX;x<corridorStartX+corridorLen;x++)map[corridorY][x]=0;
 const rooms=[spawn,bossRoom],stairs={x:bossRoom.cx,y:bossRoom.cy};
 const safeRooms=[{...spawn,id:`safe-mb-${floor}`,rested:false}];
 const family=pickConfiguredFamilyForFloorWithParams(floor,params);
 const boss=upgradeToMegaboss(buildConfiguredEnemy(weightedFamilyEnemy(family,true,floor,total),{x:bossRoom.cx,y:bossRoom.cy},floor,true,megabossLevelForPlayer()));
 boss.enemyFamily=family.name;
 const freeInBossRoom=()=>{
  for(let i=0;i<40;i++){
   const x=bossRoom.x+1+rng(Math.max(1,bossRoom.w-2)),y=bossRoom.y+1+rng(Math.max(1,bossRoom.h-2));
   if(map[y]?.[x]===0&&!(x===bossRoom.cx&&y===bossRoom.cy))return{x,y};
  }
  return{x:bossRoom.cx,y:bossRoom.cy};
 };
 const chests=[];
 for(let i=0;i<3;i++){const chestDef=pickChestDefForFloor(floor);if(chestDef)chests.push({...freeInBossRoom(),opened:false,chestDef})}
 const floorTileset=floorTilesetForWorldPlan(floor,params)||pickFloorTilesetForLevel(floor);
 return {
  floor,map,rooms,safeRooms,spawn:{x:spawn.cx,y:spawn.cy},stairs,doors:[],keys:[],chests,traps:[],altars:[],event:null,
  enemies:[boss],boss,family,archetype:'megaboss',archetypeLabel:'Cámara del megajefe',
  archetypeDesc:'Un pasillo estrecho conduce a una cámara descomunal. El MEGAJEFE aguarda en el centro.',
  objective:{type:'bossKill',done:false,label:'Derrota al jefe'},tierExpected:expectedTierForFloor(floor,total),rewardRarityBonus:3,
  enemyFamily:family.name,enemyFamilyId:family.dbId||family.id||null,
  themeName:floorTileset.name,floorTileset,announce:true
 };
}

// City floor: no walled rooms - just an open district. Large (2x2+) building
// assets go down in a loose grid (row-by-row jitter + random skips break the
// checkerboard look into something asymmetric), then small 1x1 props fill the
// gaps between them. Under the hood a handful of unwalled "zones" still carry
// a room type (see rooms below) so the existing chest/trap/altar/enemy/safe-
// room systems - all keyed off ROOM_TYPES - keep working exactly as on any
// other floor; the player just never sees a wall separating them.
function buildCityFloorPlan(floor,params,{populationScale=1}={}){
 const total=params?.floors||DEFAULT_WORLD_PARAMS.floors;
 const arch=FLOOR_ARCHETYPES.city,E=arch.enemies,R=arch.rewards;
 const map=Array.from({length:ROWS},()=>Array(COLS).fill(1));
 for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)map[y][x]=0;
 const occ=new Set();

 // --- buildings (2x2+) on a loose grid, then 1x1 props in the gaps ---
 const floorAssetDefs=assetDefsForFloor(floor,params);
 const bigAssetDefs=floorAssetDefs.filter(a=>a.cols>=2&&a.rows>=2);
 const smallAssetDefs=floorAssetDefs.filter(a=>a.cols===1&&a.rows===1);
 const assetPlacements=[];
 // Shared placement attempt: places `def` with its top-left at (ox,oy) if
 // every covered cell is in-bounds and unclaimed; mirrors the mask-aware
 // blocking rule used by the walled archetypes' own asset placement.
 const tryPlaceAssetAt=(def,ox,oy)=>{
  const cellsCovered=[];
  for(let dy=0;dy<def.rows;dy++)for(let dx=0;dx<def.cols;dx++){
   const px=ox+dx,py=oy+dy;
   if(px<1||px>=COLS-1||py<1||py>=ROWS-1||occ.has(key(px,py)))return false;
   cellsCovered.push({x:px,y:py,blocked:def.mask?.[dy]?.[dx]!==false});
  }
  for(const c of cellsCovered){if(c.blocked)map[c.y][c.x]=1;occ.add(key(c.x,c.y))}
  assetPlacements.push({key:def.key,name:def.name,x:ox,y:oy,cols:def.cols,rows:def.rows});
  return true;
 };
 const margin=5;
 if(bigAssetDefs.length){
  const span=Math.max(...bigAssetDefs.map(a=>Math.max(a.cols,a.rows))),cell=span+2;
  for(let gy=margin;gy+span<ROWS-margin;gy+=cell){
   const rowShift=rng(3)-1; // a different left/right bias per row of blocks
   for(let gx=margin;gx+span<COLS-margin;gx+=cell){
    if(Math.random()<.22)continue; // gaps: plazas/lots between blocks, breaks the pure grid
    const def=pick(bigAssetDefs);
    const ox=Math.max(1,Math.min(COLS-def.cols-1,gx+rowShift+rng(3)-1));
    const oy=Math.max(1,Math.min(ROWS-def.rows-1,gy+rng(3)-1));
    tryPlaceAssetAt(def,ox,oy);
   }
  }
 }
 if(smallAssetDefs.length){
  const target=Math.max(10,Math.round(assetPlacements.length*1.5));
  let placed=0,guard=0;
  while(placed<target&&guard<800){
   guard++;
   const x=1+rng(COLS-2),y=1+rng(ROWS-2);
   if(map[y][x]!==0)continue;
   if(tryPlaceAssetAt(pick(smallAssetDefs),x,y))placed++;
  }
 }

 // --- unwalled zones: a 7x7 grid tiling the whole map, each tagged with a
 // room type purely for bookkeeping (chests/traps/altars/enemies/safe spots).
 // Sized close to a normal room (~6x6, same ballpark as ROOM_TYPES.size) on
 // purpose - a coarser grid would turn "safe room" zones into a huge chunk of
 // the map being enemy-free. No carve(), no corridors - the map is already
 // open floor everywhere except the buildings placed above. ---
 const gridN=7,zoneW=Math.floor((COLS-2)/gridN),zoneH=Math.floor((ROWS-2)/gridN);
 const rooms=[];
 for(let gy=0;gy<gridN;gy++)for(let gx=0;gx<gridN;gx++){
  const x=1+gx*zoneW,y=1+gy*zoneH;
  const w=gx===gridN-1?COLS-1-x:zoneW,h=gy===gridN-1?ROWS-1-y:zoneH;
  const typeId=weightedRoomType(arch.roomWeights);
  rooms.push({x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2),type:typeId});
 }

 // Every floor needs at least 2 Creator's Room zones, same rule as the walled archetypes.
 {
  const spawnZone=rooms[0];
  const distFromSpawn=r=>Math.abs(r.cx-spawnZone.cx)+Math.abs(r.cy-spawnZone.cy);
  const nonSpawn=rooms.filter(r=>r!==spawnZone);
  if(nonSpawn.length)[...nonSpawn].sort((a,b)=>distFromSpawn(a)-distFromSpawn(b))[0].type='creator';
  // spawnZone itself is excluded from this count even if the initial random
  // grid roll happened to tag it 'creator' - it always gets reset to
  // 'filler' below once spawn is finalized, so counting it here would let
  // that reset silently drop the floor back to just 1 real creator zone.
  const creatorRooms=rooms.filter(r=>r.type==='creator'&&r!==spawnZone);
  while(creatorRooms.length<2){
   const candidates=rooms.filter(r=>r!==spawnZone&&r.type!=='creator');
   if(!candidates.length)break;
   const r=pick(candidates);r.type='creator';creatorRooms.push(r);
  }
 }

 // A zone's center can land inside a building; snap spawn/stairs to the
 // nearest actually-open tile so the player never starts (or has to reach) a wall.
 const nearestOpenCell=(cx,cy)=>{
  if(map[cy]?.[cx]===0)return{x:cx,y:cy};
  for(let radius=1;radius<Math.max(ROWS,COLS);radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
   const x=cx+dx,y=cy+dy;
   if(x<1||y<1||x>=COLS-1||y>=ROWS-1||map[y][x]!==0)continue;
   return{x,y};
  }
  return{x:cx,y:cy};
 };
 const spawnZone=rooms[0];
 const spawnPos=nearestOpenCell(spawnZone.cx,spawnZone.cy);
 spawnZone.cx=spawnPos.x;spawnZone.cy=spawnPos.y;spawnZone.type='filler';
 const distanceFromSpawn=r=>Math.abs(r.cx-spawnZone.cx)+Math.abs(r.cy-spawnZone.cy);
 const distantRooms=[...rooms].slice(1).sort((a,b)=>distanceFromSpawn(b)-distanceFromSpawn(a));
 const stairRoom=distantRooms[0]||rooms.at(-1);
 const stairPos=nearestOpenCell(stairRoom.cx,stairRoom.cy);
 stairRoom.cx=stairPos.x;stairRoom.cy=stairPos.y;
 const bossRoom=stairRoom;
 const stairs={x:stairRoom.cx,y:stairRoom.cy};

 // The open layout has no guaranteed corridor spine like the walled
 // archetypes - flood-fill from spawn and, on the rare chance the buildings
 // sealed off the stairs, carve a straight rescue path through.
 const reachable=floodFillOpen(map,spawnZone.cx,spawnZone.cy);
 if(!reachable.has(key(stairs.x,stairs.y))){
  let x=spawnZone.cx,y=spawnZone.cy;
  while(x!==stairs.x){map[y][x]=0;x+=Math.sign(stairs.x-x)}
  while(y!==stairs.y){map[y][x]=0;y+=Math.sign(stairs.y-y)}
 }

 const occSpawnStairs=new Set([key(spawnZone.cx,spawnZone.cy),key(stairs.x,stairs.y)]);
 occSpawnStairs.forEach(k=>occ.add(k));

 const safeRoomCount=2+rng(3);
 const excludedRooms=new Set([spawnZone,stairRoom,bossRoom]);
 const safeRooms=[...rooms].filter(r=>!excludedRooms.has(r)&&distanceFromSpawn(r)>8).sort(()=>Math.random()-.5).slice(0,safeRoomCount).map((r,i)=>({...r,id:`safe-${floor}-${i}`,rested:false}));
 const safeCellKeys=new Set(safeRooms.flatMap(r=>[...roomCellSet(r)]));
 safeRooms.forEach(r=>occ.add(key(r.cx,r.cy)));

 const cells=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(map[y][x]===0&&!safeCellKeys.has(key(x,y)))cells.push({x,y});
 if(!cells.length)return null;
 // Random sampling from the static `cells` snapshot, with a bounded retry -
 // but `cells` was taken before assets/etc. reserved further tiles into
 // `occ`, so on a tight floor (few rooms, several assets) most of it can be
 // stale by the time this runs. Falls back to an exhaustive scan of what's
 // actually still free rather than giving up and returning an occupied cell;
 // under genuine full-floor saturation (an extreme enemy count on a small
 // archetype), the last-resort fallback still only ever returns a tile the
 // map itself considers walkable (map===0) - it may end up sharing a tile
 // with another entity, but it is never placed inside a wall.
 const free=()=>{
  let p,guard=0;
  do{p=pick(cells);guard++}while(occ.has(key(p.x,p.y))&&guard<400);
  if(occ.has(key(p.x,p.y))){
   const available=cells.filter(c=>!occ.has(key(c.x,c.y)));
   if(available.length)p=pick(available);
   else{
    const stillWalkable=cells.filter(c=>map[c.y][c.x]===0);
    if(stillWalkable.length)p=pick(stillWalkable);
   }
  }
  occ.add(key(p.x,p.y));
  return{...p};
 };
 const freeIn=r=>{
  for(let i=0;i<40;i++){
   const x=r.x+rng(Math.max(1,r.w)),y=r.y+rng(Math.max(1,r.h));
   if(map[y]?.[x]===0&&!occ.has(key(x,y))&&!safeCellKeys.has(key(x,y))){occ.add(key(x,y));return{x,y}}
  }
  return free();
 };
 const edgeIn=r=>{
  for(let i=0;i<40;i++){
   const onX=Math.random()<.5;
   const x=onX?(Math.random()<.5?r.x:r.x+r.w-1):r.x+rng(Math.max(1,r.w));
   const y=onX?r.y+rng(Math.max(1,r.h)):(Math.random()<.5?r.y:r.y+r.h-1);
   if(map[y]?.[x]===0&&!occ.has(key(x,y))&&!safeCellKeys.has(key(x,y))){occ.add(key(x,y));return{x,y}}
  }
  return freeIn(r);
 };

 // Guarantee: at least a handful of zones (up to 3) end up with a 2x2+
 // building even if the grid pass above happened to skip them all - same
 // "never all 1x1 clutter by bad luck" rule as the walled archetypes.
 if(bigAssetDefs.length){
  const minBig=Math.min(3,rooms.length);
  const bigCount=()=>assetPlacements.filter(a=>a.cols>=2&&a.rows>=2).length;
  const pool=[...rooms].filter(r=>r!==spawnZone&&r!==stairRoom).sort(()=>Math.random()-.5);
  for(const r of pool){
   if(bigCount()>=minBig)break;
   const fitting=bigAssetDefs.filter(a=>r.w>a.cols&&r.h>a.rows);
   if(!fitting.length)continue;
   const def=pick(fitting);
   for(let tries=0;tries<20;tries++){
    const ox=r.x+1+rng(Math.max(1,r.w-2)),oy=r.y+1+rng(Math.max(1,r.h-2));
    if(tryPlaceAssetAt(def,ox,oy))break;
   }
  }
 }

 // --- traps, altars, chests: same per-zone-type rules as the walled archetypes ---
 const traps=[],altars=[],chests=[];
 for(const r of rooms){
  const T=ROOM_TYPES[r.type]||ROOM_TYPES.filler;
  if(safeRooms.some(s=>s.x===r.x&&s.y===r.y))continue;
  if(T.traps&&Math.random()<T.traps){
   const n=T.trapCount?randBetween(T.trapCount[0],T.trapCount[1]):1+rng(2);
   for(let i=0;i<n;i++){const pos=freeIn(r);traps.push({...pos,dmg:Math.max(3,Math.round(4+floor*1.6)),revealed:false,sprung:false})}
  }
  if(T.altar&&(T.creatorRoom||Math.random()<.85)){const pos=freeIn(r);altars.push({...pos,kind:T.creatorRoom?'disenchant':pick(['heal','shield','power']),used:false})}
  const chestCount=T.chests?randBetween(T.chests[0],T.chests[1]):(Math.random()<(T.chest||0)?1:0);
  for(let i=0;i<Math.round(chestCount*(R.chests||1));i++){
   const chestDef=pickChestDefForFloor(floor);
   if(chestDef)chests.push({...freeIn(r),opened:false,locked:!!T.locked&&Math.random()<.5,chestDef});
  }
 }
 const minChests=Math.round((8+Math.floor(floor*.6))*(R.chests||1));
 while(chests.length<minChests){
  const chestDef=pickChestDefForFloor(floor);
  if(!chestDef)break;
  chests.push({...free(),opened:false,chestDef});
 }
 if(chests.length){
  const bumpTier=Math.min(5,chestTierForFloor(floor)+1),bumpCount=Math.min(chests.length,1+(Math.random()<.5?1:0));
  for(const c of [...chests].sort(()=>Math.random()-.5).slice(0,bumpCount)){
   const bumpDef=pickChestDefAtTier(bumpTier);
   if(bumpDef)c.chestDef=bumpDef;
  }
 }
 addBonusPotionChests(chests,free,floor);

 // --- enemies: same budget/composition rules as the walled archetypes ---
 const family=pickConfiguredFamilyForFloorWithParams(floor,params),enemies=[];
 const baseCount=Math.round((30+floor*4.5+rng(11))*(E.density||1)*populationScale*pctMult(params.enemyCountPct));
 const combatRooms=rooms.filter(r=>r!==spawnZone&&(ROOM_TYPES[r.type]?.enemies?.[1]||0)>0);
 let placed=0;
 for(const r of combatRooms){
  if(placed>=baseCount)break;
  const T=ROOM_TYPES[r.type];
  const n=randBetween(T.enemies[0],T.enemies[1]);
  for(let i=0;i<n&&placed<baseCount;i++){
   const pos=T.place==='edges'?edgeIn(r):freeIn(r);
   const wantElite=Math.random()<Math.min(.85,.05*(E.elite||1)*(T.elite?6:1));
   const e=buildConfiguredEnemy(weightedFamilyEnemy(family,false,floor,params.floors,E.minTier),pos,floor,false);
   e.enemyFamily=family.name;e.roomType=r.type;
   if(T.tier||E.tierBias){
    const bump=(T.tier||0)+(E.tierBias||0);
    if(bump>0){e.maxHp=e.hp=Math.round(e.hp*(1+.22*bump));e.atk=e.damage=Math.round((e.atk||e.damage||4)*(1+.15*bump));e.xp=Math.round((e.xp||8)*(1+.2*bump))}
    else if(bump<0){e.maxHp=e.hp=Math.max(4,Math.round(e.hp*.75));e.atk=e.damage=Math.max(1,Math.round((e.atk||e.damage||4)*.8))}
   }
   if(wantElite&&!e.boss){e.elite=true;e.name='Élite '+e.name;e.maxHp=e.hp=Math.round(e.hp*1.5);e.atk=e.damage=Math.round((e.atk||e.damage||4)*1.28);e.xp=Math.round((e.xp||8)*1.8);assignEnemySkills(e)}
   enemies.push(e);placed++;
  }
 }
 while(placed<baseCount){const e=buildConfiguredEnemy(weightedFamilyEnemy(family,false,floor,params.floors,E.minTier),free(),floor,false);e.enemyFamily=family.name;enemies.push(e);placed++}

 // --- boss: same bossOnEven rule as the standard archetype ---
 let boss=null;
 if(E.bossOnEven){
  const bossCount=floor%2===0?1:(Math.random()<.08?1:0);
  for(let bi=0;bi<bossCount;bi++){
   const b=buildConfiguredEnemy(weightedFamilyEnemy(family,true,floor,params.floors,E.minTier),{x:bossRoom.cx,y:bossRoom.cy},floor,true);
   b.enemyFamily=family.name;
   enemies.push(b);if(!boss)boss=b;
  }
 }

 const objective=buildFloorObjective('city',floor,total);
 if(objective.type==='bossKill'&&!boss)objective.type='stairs';
 const event=Math.random()<=.12?{id:pick(eventDefs).id}:null;
 const floorTileset=floorTilesetForWorldPlan(floor,params)||pickFloorTilesetForLevel(floor);

 return {
  floor,map,rooms,safeRooms,spawn:{x:spawnZone.cx,y:spawnZone.cy},stairs,doors:[],keys:[],chests,traps,altars,event,assets:assetPlacements,
  enemies,boss,family,archetype:'city',archetypeLabel:arch.label,archetypeDesc:arch.desc,
  objective,tierExpected:expectedTierForFloor(floor,total),rewardRarityBonus:R.rarity||0,
  enemyFamily:family.name,enemyFamilyId:family.dbId||family.id||null,
  themeName:floorTileset.name,floorTileset,announce:!!arch.announce
 };
}

// Shared floor builder used by both the pre-generated world JSON and the live
// generator, so archetypes/rooms behave identically in single and multiplayer.
// Assumes `game` is set with at least {floor,player,worldParams}.
function buildFloorPlan(floor,params,{recent=[],populationScale=1}={}){
 // Testing mode (see launchTestCombat()) can force a specific archetype,
 // including the megaboss special case, bypassing minFloor/cooldown gating
 // entirely so any floor type can be tried out regardless of level/floor.
 if(game?.forcedFloorArchetype==='megaboss')return buildMegabossFloorPlan(floor,params);
 // El sexto piso es siempre el clímax: megajefe o sucesión de jefes.
 if(!game?.forcedFloorArchetype&&floor===DUNGEON_FLOORS){
  if(Math.random()<.5)return buildMegabossFloorPlan(floor,params);
  game.forcedFloorArchetype='bossrush';
 }
 // Megaboss floors are rolled independently, not as a FLOOR_ARCHETYPES entry:
 // 33% chance on every floor that's a multiple of 3, regardless of recency/
 // cooldown or the other archetypes' weights.
 if(!game?.forcedFloorArchetype&&floor%3===0&&Math.random()<.33)return buildMegabossFloorPlan(floor,params);
 const total=params?.floors||DEFAULT_WORLD_PARAMS.floors;
 const archId=(game?.forcedFloorArchetype&&FLOOR_ARCHETYPES[game.forcedFloorArchetype])?game.forcedFloorArchetype:pickFloorArchetype(floor,total,recent);
 if(floor===DUNGEON_FLOORS&&game?.forcedFloorArchetype==='bossrush')delete game.forcedFloorArchetype;
 // City floors have no walled rooms at all (open district of building assets),
 // so they can't go through the shared room/corridor carving below - built by
 // its own dedicated generator instead, same pattern as buildMegabossFloorPlan.
 if(archId==='city')return buildCityFloorPlan(floor,params,{populationScale});
 const arch=FLOOR_ARCHETYPES[archId]||FLOOR_ARCHETYPES.standard;
 const tier=expectedTierForFloor(floor,total);
 const L=arch.layout,E=arch.enemies,R=arch.rewards;
 const map=Array.from({length:ROWS},()=>Array(COLS).fill(1)),rooms=[];

 // This floor's decoration-asset pool is picked once, up front - a single
 // ambiente (pinned via the world's floor plan, or a random one so every
 // floor reads as one coherent theme instead of a mix of everything) - and
 // reused both to size rooms below and to actually place assets further
 // down, so the two stages never disagree on which assets this floor has.
 const floorAssetDefs=assetDefsForFloor(floor,params);
 const floorMaxAssetSpan=floorAssetDefs.length?Math.max(...floorAssetDefs.map(a=>Math.max(a.cols,a.rows))):0;
 // The archetype's own room-size ceiling still wins when it's already big
 // enough; only stretched when this floor's ambiente needs more room than
 // that to ever fit (so most floors/room types are unaffected).
 const layoutSizeMax=Math.min(COLS-6,Math.max(L.size[1],floorMaxAssetSpan+2));

 // --- rooms: count/size come from the archetype, shape from the room type ---
 // Every generation rolls a fresh mirror axis (vertical/horizontal/point) and,
 // for most placed rooms, also tries to carve their mirrored twin - so floors
 // read as deliberately symmetric layouts (a different symmetry each time,
 // never forced to repeat) instead of pure noise. Corridors/loops/pillars/
 // enemies/loot placed afterwards stay randomized, so the symmetry is
 // structural (room shapes/positions) without making every floor feel identical.
 const symmetryMode=pick(SYMMETRY_MODES);
 const overlapsRoom=(x,y,w,h)=>rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y);
 const roomInBounds=(x,y,w,h)=>x>=1&&y>=1&&x+w<=COLS-1&&y+h<=ROWS-1;
 const targetRooms=randBetween(L.rooms[0],L.rooms[1]);
 for(let tries=0;tries<2600&&rooms.length<targetRooms;tries++){
  const typeId=weightedRoomType(arch.roomWeights),T=ROOM_TYPES[typeId];
  const lo=Math.max(3,Math.min(T.size[0],layoutSizeMax)),hi=Math.max(lo,Math.min(T.size[1],layoutSizeMax));
  let w=randBetween(lo,hi),h=randBetween(lo,hi);
  // shape variety: some rooms are markedly rectangular
  if(Math.random()<.35){if(Math.random()<.5)w=Math.max(3,Math.round(w*1.6));else h=Math.max(3,Math.round(h*1.6))}
  w=Math.min(w,COLS-4);h=Math.min(h,ROWS-4);
  const x=1+rng(Math.max(1,COLS-w-2)),y=1+rng(Math.max(1,ROWS-h-2));
  if(overlapsRoom(x,y,w,h))continue;
  const room={x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2),type:typeId};
  rooms.push(room);carve(map,room);
  if(rooms.length<targetRooms&&Math.random()<ROOM_MIRROR_CHANCE){
   const m=mirrorRect(room,symmetryMode);
   if(roomInBounds(m.x,m.y,m.w,m.h)&&!overlapsRoom(m.x,m.y,m.w,m.h)){
    const twin={x:m.x,y:m.y,w:m.w,h:m.h,cx:m.x+Math.floor(m.w/2),cy:m.y+Math.floor(m.h/2),type:typeId};
    rooms.push(twin);carve(map,twin);
   }
  }
 }
 if(!rooms.length)return null;

 // Every floor needs at least 2 Creator's Room (craft) rooms so players can
 // always reach the shard/craft system - except archetypes that deliberately
 // omit 'creator' from their roomWeights (very special floors, e.g. 'horda').
 // One of the two is always forced onto the room closest to the entrance
 // (spawn), floor 1 included, so a craft room is never far from the start.
 if('creator' in (arch.roomWeights||{})){
  const spawnRoom=rooms[0];
  const distFromSpawn=r=>Math.abs(r.cx-spawnRoom.cx)+Math.abs(r.cy-spawnRoom.cy);
  const nonSpawn=rooms.filter(r=>r!==spawnRoom&&r.type!=='bossarena');
  if(nonSpawn.length){
   const nearest=[...nonSpawn].sort((a,b)=>distFromSpawn(a)-distFromSpawn(b))[0];
   nearest.type='creator';
  }
  // spawnRoom itself is excluded from this count even if it happened to roll
  // 'creator' at random above - it always gets reset to 'filler' once spawn
  // is finalized further down, so counting it here would let that reset
  // silently drop the floor back to just 1 real creator room.
  const creatorRooms=rooms.filter(r=>r.type==='creator'&&r!==spawnRoom);
  while(creatorRooms.length<2){
   const candidates=rooms.filter(r=>r!==spawnRoom&&r.type!=='creator'&&r.type!=='bossarena');
   if(!candidates.length)break;
   const r=pick(candidates);
   r.type='creator';
   creatorRooms.push(r);
  }
 }

 const carveCorridor=(a,b)=>{let x=a.cx,y=a.cy;if(Math.random()<.5){while(x!==b.cx){map[y][x]=0;x+=Math.sign(b.cx-x)}while(y!==b.cy){map[y][x]=0;y+=Math.sign(b.cy-y)}}else{while(y!==b.cy){map[y][x]=0;y+=Math.sign(b.cy-y)}while(x!==b.cx){map[y][x]=0;x+=Math.sign(b.cx-x)}}};
 // spine: guarantees a valid route between every room (and thus entry->exit)
 for(let i=1;i<rooms.length;i++)carveCorridor(rooms[i-1],rooms[i]);
 // loops and shortcuts: extra connections make mazes navigable and add routes
 const loopCount=Math.round(rooms.length*(L.loops||0));
 for(let i=0;i<loopCount;i++){const a=pick(rooms),b=pick(rooms);if(a!==b)carveCorridor(a,b)}
 // extra exits for hubs/knots so their typology is real, not cosmetic
 for(const r of rooms){
  const want=ROOM_TYPES[r.type]?.exits||2;
  for(let i=2;i<want;i++){const other=pick(rooms);if(other!==r)carveCorridor(r,other)}
 }
 // false paths: dead-end stubs, only for maze-like layouts (never isolated areas)
 if(L.deadEnds)for(let i=0;i<Math.round(rooms.length*L.deadEnds);i++){
  const r=pick(rooms),dir=pick([[1,0],[-1,0],[0,1],[0,-1]]),len=3+rng(7);
  let x=r.cx,y=r.cy;
  for(let n=0;n<len;n++){const nx=x+dir[0],ny=y+dir[1];if(nx<1||ny<1||nx>=COLS-1||ny>=ROWS-1)break;x=nx;y=ny;map[y][x]=0}
 }

 // --- key positions ---
 const spawn=rooms[0];
 const distanceFromSpawn=r=>Math.abs(r.cx-spawn.cx)+Math.abs(r.cy-spawn.cy);
 const distantRooms=[...rooms].slice(1).sort((a,b)=>distanceFromSpawn(b)-distanceFromSpawn(a));
 const stairRoom=distantRooms[0]||rooms.at(-1);
 // The (single-boss) boss room is always the stairs room itself, so the boss
 // is guaranteed to be waiting right where/next to where the player exits -
 // bossRush's chained arenas are a separate mechanic and don't use this.
 const bossRoom=stairRoom;
 const stairs={x:stairRoom.cx,y:stairRoom.cy};
 spawn.type='filler';

 // --- cover / pillars inside rooms (real line-of-sight blockers) ---
 const pillarMult=L.pillars??1;
 for(const r of rooms){
  if(r.w<5||r.h<5)continue;
  const density=(ROOM_TYPES[r.type]?.cover||0)*pillarMult;
  if(density<=0)continue;
  const inner=(r.w-2)*(r.h-2),n=Math.floor(inner*density*.18);
  for(let i=0;i<n;i++){
   const px=r.x+1+rng(Math.max(1,r.w-2)),py=r.y+1+rng(Math.max(1,r.h-2));
   if(px===r.cx&&py===r.cy)continue;          // never block the room centre
   if(px===spawn.cx&&py===spawn.cy)continue;
   if(px===stairs.x&&py===stairs.y)continue;
   map[py][px]=1;                              // border ring stays open: no room can be sealed
  }
 }

 const safeRoomCount=arch.objective==='survive'?1:2+rng(3);
 const excludedRooms=new Set([spawn,stairRoom,bossRoom]);
 const safeRooms=[...rooms].filter(r=>!excludedRooms.has(r)&&r.type!=='bossarena'&&distanceFromSpawn(r)>8).sort(()=>Math.random()-.5).slice(0,safeRoomCount).map((r,i)=>({...r,id:`safe-${floor}-${i}`,rested:false}));
 const safeCellKeys=new Set(safeRooms.flatMap(r=>[...roomCellSet(r)]));
 const occ=new Set([key(spawn.cx,spawn.cy),key(stairs.x,stairs.y)]);safeRooms.forEach(r=>occ.add(key(r.cx,r.cy)));
 const cells=[];for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(map[y][x]===0&&!safeCellKeys.has(key(x,y)))cells.push({x,y});
 if(!cells.length)return null;
 // Random sampling from the static `cells` snapshot, with a bounded retry -
 // but `cells` was taken before assets/etc. reserved further tiles into
 // `occ`, so on a tight floor (few rooms, several assets) most of it can be
 // stale by the time this runs. Falls back to an exhaustive scan of what's
 // actually still free rather than giving up and returning an occupied cell;
 // under genuine full-floor saturation (an extreme enemy count on a small
 // archetype), the last-resort fallback still only ever returns a tile the
 // map itself considers walkable (map===0) - it may end up sharing a tile
 // with another entity, but it is never placed inside a wall.
 const free=()=>{
  let p,guard=0;
  do{p=pick(cells);guard++}while(occ.has(key(p.x,p.y))&&guard<400);
  if(occ.has(key(p.x,p.y))){
   const available=cells.filter(c=>!occ.has(key(c.x,c.y)));
   if(available.length)p=pick(available);
   else{
    const stillWalkable=cells.filter(c=>map[c.y][c.x]===0);
    if(stillWalkable.length)p=pick(stillWalkable);
   }
  }
  occ.add(key(p.x,p.y));
  return{...p};
 };
 const freeIn=r=>{
  for(let i=0;i<40;i++){
   const x=r.x+rng(Math.max(1,r.w)),y=r.y+rng(Math.max(1,r.h));
   if(map[y]?.[x]===0&&!occ.has(key(x,y))&&!safeCellKeys.has(key(x,y))){occ.add(key(x,y));return{x,y}}
  }
  return free();
 };
 const edgeIn=r=>{
  for(let i=0;i<40;i++){
   const onX=Math.random()<.5;
   const x=onX?(Math.random()<.5?r.x:r.x+r.w-1):r.x+rng(Math.max(1,r.w));
   const y=onX?r.y+rng(Math.max(1,r.h)):(Math.random()<.5?r.y:r.y+r.h-1);
   if(map[y]?.[x]===0&&!occ.has(key(x,y))&&!safeCellKeys.has(key(x,y))){occ.add(key(x,y));return{x,y}}
  }
  return freeIn(r);
 };

 // --- decoration assets (config_world_object rows with object_key asset_*) ---
 // Scattered like the pillars/cover above: solid, multi-tile obstacles placed
 // inside a room's interior (border ring stays clear so no room gets sealed),
 // only in rooms strictly bigger than the asset's own tiles_number footprint.
 // Every candidate cell is required to already be a carved floor tile
 // (map[py][px]===0) before an asset can claim it, so assets only ever land
 // on floor - never on a wall, a pillar, or another asset/entity's tile.
 const assetPlacements=[];
 const assetDefs=floorAssetDefs;
 // Shared placement attempt: enumerates every offset where `def` fits inside
 // room `r`'s interior (rather than randomly sampling offsets and retrying -
 // for a room whose interior is only barely bigger than the asset, the room's
 // own centre tile can sit on *every* randomly-reachable offset, making a
 // fit that genuinely exists impossible to ever roll into) and picks randomly
 // among the valid ones. Honours the same floor/occupancy/safe-room/landmark-
 // tile rules everywhere an asset gets placed on this floor (the scattershot
 // pass below and the size-guarantee pass after it).
 // avoidCenter defaults on (keeps the room's centre tile - the usual walking
 // line/line-of-sight anchor - clear); the size-guarantee pass below retries
 // with it off as a last resort, since for a room whose interior is only
 // barely bigger than the asset, every valid-bounds offset can end up
 // covering the centre, which would otherwise make a genuine fit unreachable.
 const tryPlaceAsset=(r,def,avoidCenter=true)=>{
  const minOx=r.x+1,maxOx=r.x+r.w-2-def.cols+1,minOy=r.y+1,maxOy=r.y+r.h-2-def.rows+1;
  if(maxOx<minOx||maxOy<minOy)return false;
  const candidates=[];
  for(let oy=minOy;oy<=maxOy;oy++)for(let ox=minOx;ox<=maxOx;ox++){
   const cellsCovered=[];
   let ok=true;
   for(let dy=0;dy<def.rows&&ok;dy++)for(let dx=0;dx<def.cols&&ok;dx++){
    const px=ox+dx,py=oy+dy;
    if(map[py]?.[px]!==0||occ.has(key(px,py))||safeCellKeys.has(key(px,py))||(avoidCenter&&px===r.cx&&py===r.cy)||(px===spawn.cx&&py===spawn.cy)||(px===stairs.x&&py===stairs.y)){ok=false;break}
    cellsCovered.push({x:px,y:py,blocked:def.mask?.[dy]?.[dx]!==false});
   }
   if(ok)candidates.push({ox,oy,cellsCovered});
  }
  if(!candidates.length)return false;
  const choice=pick(candidates);
  for(const c of choice.cellsCovered){if(c.blocked)map[c.y][c.x]=1;occ.add(key(c.x,c.y))}
  assetPlacements.push({key:def.key,name:def.name,x:choice.ox,y:choice.oy,cols:def.cols,rows:def.rows});
  return true;
 };
 if(assetDefs.length){
  const assetRoomPool=rooms.filter(r=>r!==spawn&&r!==stairRoom&&r!==bossRoom&&!safeRooms.some(s=>s.x===r.x&&s.y===r.y)).sort(()=>Math.random()-.5);
  // Hard cap so a floor never gets carpeted with decoration: a handful of
  // rooms at most, scaling gently with how many rooms the floor even has.
  const maxAssets=Math.min(6,1+Math.floor(rooms.length/5));
  for(const r of assetRoomPool){
   if(assetPlacements.length>=maxAssets)break;
   if(Math.random()>=.25)continue; // not every eligible room gets one
   const fitting=assetDefs.filter(a=>r.w>a.cols&&r.h>a.rows);
   if(!fitting.length)continue;
   tryPlaceAsset(r,pick(fitting));
  }
  // Guarantee: any floor with at least one 2x2-or-larger asset defined always
  // lands that size in at least a handful of rooms (up to 3, or fewer on a
  // very small floor), regardless of how the ~25%-per-room roll above landed -
  // a floor should never read as "all 1x1 clutter" just by bad luck.
  const bigAssetDefs=assetDefs.filter(a=>a.cols>=2&&a.rows>=2);
  if(bigAssetDefs.length){
   const minBigAssetRooms=Math.min(3,rooms.length);
   const bigAssetCount=()=>assetPlacements.filter(a=>a.cols>=2&&a.rows>=2).length;
   const bigAssetPool=[...rooms].filter(r=>r!==spawn&&r!==stairRoom&&r!==bossRoom&&!safeRooms.some(s=>s.x===r.x&&s.y===r.y)).sort(()=>Math.random()-.5);
   for(const r of bigAssetPool){
    if(bigAssetCount()>=minBigAssetRooms)break;
    const fitting=bigAssetDefs.filter(a=>r.w>a.cols&&r.h>a.rows);
    if(!fitting.length)continue;
    const def=pick(fitting);
    if(!tryPlaceAsset(r,def))tryPlaceAsset(r,def,false);
   }
  }
 }

 // --- doors (locked ones gate vaults), keys, traps, altars, chests ---
 const doors=[];
 for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(map[y][x]===0&&!safeCellKeys.has(key(x,y))){
  const h=map[y][x-1]===0&&map[y][x+1]===0&&map[y-1][x]===1&&map[y+1][x]===1;
  const v=map[y-1][x]===0&&map[y+1][x]===0&&map[y][x-1]===1&&map[y][x+1]===1;
  if((h||v)&&Math.random()<.065&&!occ.has(key(x,y))){doors.push({x,y,open:false,locked:Math.random()<.25});occ.add(key(x,y))}
 }
 const keys=[];for(let i=0;i<Math.max(1,doors.filter(d=>d.locked).length);i++)keys.push(free());

 const traps=[],altars=[],chests=[];
 for(const r of rooms){
  const T=ROOM_TYPES[r.type]||ROOM_TYPES.filler;
  if(safeRooms.some(s=>s.x===r.x&&s.y===r.y))continue;
  if(T.traps&&Math.random()<T.traps){
   const n=T.trapCount?randBetween(T.trapCount[0],T.trapCount[1]):1+rng(2);
   for(let i=0;i<n;i++){const pos=freeIn(r);traps.push({...pos,dmg:Math.max(3,Math.round(4+floor*1.6)),revealed:false,sprung:false})}
  }
  if(T.altar&&(T.creatorRoom||Math.random()<.85)){const pos=freeIn(r);altars.push({...pos,kind:T.creatorRoom?'disenchant':pick(['heal','shield','power']),used:false})}
  const chestCount=T.chests?randBetween(T.chests[0],T.chests[1]):(Math.random()<(T.chest||0)?1:0);
  for(let i=0;i<Math.round(chestCount*(R.chests||1));i++){
   const chestDef=pickChestDefForFloor(floor);
   if(chestDef)chests.push({...freeIn(r),opened:false,locked:!!T.locked&&Math.random()<.5,chestDef});
  }
 }
 // baseline chest floor so no archetype is completely dry (only when config_chest has anything to place)
 const minChests=Math.round((8+Math.floor(floor*.6))*(R.chests||1));
 while(chests.length<minChests){
  const chestDef=pickChestDefForFloor(floor);
  if(!chestDef)break; // config_chest is completely empty: no chests get placed on this floor
  chests.push({...free(),opened:false,chestDef});
 }
 // 1-2 chests per floor are deliberately bumped one tier above the floor's
 // cap (chestTierForFloor) so a floor doesn't hand out the exact same chest
 // tier every single time - left untouched if nothing is configured at that
 // higher tier.
 if(chests.length){
  const bumpTier=Math.min(5,chestTierForFloor(floor)+1),bumpCount=Math.min(chests.length,1+(Math.random()<.5?1:0));
  for(const c of [...chests].sort(()=>Math.random()-.5).slice(0,bumpCount)){
   const bumpDef=pickChestDefAtTier(bumpTier);
   if(bumpDef)c.chestDef=bumpDef;
  }
 }
 addBonusPotionChests(chests,free,floor);

 // --- enemies: budget from the archetype, composition from the room type ---
 const family=pickConfiguredFamilyForFloorWithParams(floor,params),enemies=[];
 const baseCount=Math.round((30+floor*4.5+rng(11))*(E.density||1)*populationScale*pctMult(params.enemyCountPct));
 const combatRooms=rooms.filter(r=>r!==spawn&&(ROOM_TYPES[r.type]?.enemies?.[1]||0)>0);
 let placed=0;
 for(const r of combatRooms){
  if(placed>=baseCount)break;
  const T=ROOM_TYPES[r.type];
  let n=randBetween(T.enemies[0],T.enemies[1]);
  if(arch.objective==='waves'&&T.wave)n=Math.round(n*.6); // the rest arrive as waves
  for(let i=0;i<n&&placed<baseCount;i++){
   const pos=T.place==='edges'?edgeIn(r):freeIn(r);
   const wantElite=Math.random()<Math.min(.85,.05*(E.elite||1)*(T.elite?6:1));
   const e=buildConfiguredEnemy(weightedFamilyEnemy(family,false,floor,params.floors,E.minTier),pos,floor,false);
   e.enemyFamily=family.name;e.roomType=r.type;
   if(T.tier||E.tierBias){
    const bump=(T.tier||0)+(E.tierBias||0);
    if(bump>0){e.maxHp=e.hp=Math.round(e.hp*(1+.22*bump));e.atk=e.damage=Math.round((e.atk||e.damage||4)*(1+.15*bump));e.xp=Math.round((e.xp||8)*(1+.2*bump))}
    else if(bump<0){e.maxHp=e.hp=Math.max(4,Math.round(e.hp*.75));e.atk=e.damage=Math.max(1,Math.round((e.atk||e.damage||4)*.8))}
   }
   if(wantElite&&!e.boss){e.elite=true;e.name='Élite '+e.name;e.maxHp=e.hp=Math.round(e.hp*1.5);e.atk=e.damage=Math.round((e.atk||e.damage||4)*1.28);e.xp=Math.round((e.xp||8)*1.8);assignEnemySkills(e)}
   enemies.push(e);placed++;
  }
 }
 while(placed<baseCount){const e=buildConfiguredEnemy(weightedFamilyEnemy(family,false,floor,params.floors,E.minTier),free(),floor,false);e.enemyFamily=family.name;enemies.push(e);placed++}

 // --- bosses ---
 let boss=null;const bosses=[];
 // Boss spawn positions are always "a room's centre tile" (bossRoom, a
 // bossRush arena, a distant room for bossOnEven's extra "Campeón" bosses) -
 // usually kept clear of decoration, but the asset size-guarantee above can,
 // as a last resort, place an asset on top of a room's own centre. Snap to
 // the nearest genuinely free tile instead of trusting the centre blindly,
 // and reserve it so two bosses in the same multi-boss floor can't stack.
 const nearestFreeCellForBoss=(cx,cy)=>{
  if(map[cy]?.[cx]===0&&!occ.has(key(cx,cy)))return{x:cx,y:cy};
  for(let radius=1;radius<Math.max(ROWS,COLS);radius++)for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
   const x=cx+dx,y=cy+dy;
   if(x<1||y<1||x>=COLS-1||y>=ROWS-1||map[y][x]!==0||occ.has(key(x,y)))continue;
   return{x,y};
  }
  return{x:cx,y:cy};
 };
 const mkBoss=(pos,label,tierBonus)=>{
  const resolvedPos=nearestFreeCellForBoss(pos.x,pos.y);
  occ.add(key(resolvedPos.x,resolvedPos.y));
  const b=buildConfiguredEnemy(weightedFamilyEnemy(family,true,floor,params.floors,E.minTier),resolvedPos,floor,true);
  b.enemyFamily=family.name;
  if(tierBonus>0){
   b.maxHp=b.hp=Math.round(b.hp*(1+.45*tierBonus));
   b.atk=b.damage=Math.round((b.atk||b.damage||4)*(1+.22*tierBonus));
   b.armor=Math.round((b.armor||0)+2*tierBonus);
   b.xp=Math.round((b.xp||8)*(1+.6*tierBonus));
   b.phases=1+tierBonus;b.superBoss=true;
   assignEnemySkills(b);
  }
  if(label)b.name=`${b.name} · ${label}`;
  enemies.push(b);bosses.push(b);if(!boss)boss=b;
  return b;
 };
 if(E.superBoss){
  const bonus=1+rng(3);                               // 1..3 tiers above the usual
  mkBoss({x:bossRoom.cx,y:bossRoom.cy},`Superjefe (+${bonus})`,bonus);
 }else if(E.bossRush){
  const arenas=rooms.filter(r=>r.type==='bossarena');
  const list=(arenas.length?arenas:distantRooms.slice(0,4)).slice(0,4);
  list.forEach((r,i)=>mkBoss({x:r.cx,y:r.cy},i===list.length-1?'Jefe final':`Minijefe ${i+1}`,i===list.length-1?2:0));
 }else if(E.miniboss){
  mkBoss({x:bossRoom.cx,y:bossRoom.cy},'Minijefe',0);
 }else if(E.bossOnEven){
  const bossCount=floor%2===0?Math.min(4,1+Math.floor(floor/10)):(Math.random()<.08?1:0);
  for(let bi=0;bi<bossCount;bi++){
   const r=bi===0?bossRoom:distantRooms[Math.min(distantRooms.length-1,2+bi)]||bossRoom;
   mkBoss({x:r.cx,y:r.cy},bi?`Campeón ${bi+1}`:'',0);
  }
 }

 const objective=buildFloorObjective(archId,floor,total);
 if(objective.type==='bossKill'&&!boss)objective.type='stairs';
 const event=Math.random()<=(arch.objective==='stairs'?.12:.06)?{id:pick(eventDefs).id}:null;
 const floorTileset=floorTilesetForWorldPlan(floor,params)||pickFloorTilesetForLevel(floor);

 return {
  floor,map,rooms,safeRooms,spawn:{x:spawn.cx,y:spawn.cy},stairs,doors,keys,chests,traps,altars,event,assets:assetPlacements,
  enemies,boss,family,archetype:archId,archetypeLabel:arch.label,archetypeDesc:arch.desc,
  objective,tierExpected:tier,rewardRarityBonus:R.rarity||0,
  enemyFamily:family.name,enemyFamilyId:family.dbId||family.id||null,
  themeName:floorTileset.name,floorTileset,announce:!!arch.announce
 };
}

function createDungeonWorldJson(name,params=DEFAULT_WORLD_PARAMS){
 params=normalizeWorldParams(params);
 if(!normalizedEnemyFamilies().length)throw new Error('No hay familias en enemy_family para generar enemigos por piso.');
 if(!normalizedSupabaseFloors().length)throw new Error('No hay floors en config_floor para generar floors aleatorios.');
 const floors=[],lootTable=createLootProgressionTable(params.floors);
 const oldGame=game;
 const tempPlayer={level:1,stats:{strength:4,vitality:4,agility:3,luck:2,intelligence:2,wisdom:2},raceBonuses:{},derived:{floorShield:0},shield:0,hp:1,maxHp:1};
 const recent=[];
 for(let floor=1;floor<=params.floors;floor++){
  game={floor,player:tempPlayer,worldParams:params,worldLootTable:lootTable};
  const configuredArchetype=worldPlanEntry(params,floor)?.archetype;if(configuredArchetype)game.forcedFloorArchetype=configuredArchetype;
  let plan=null;
  for(let attempt=0;attempt<3&&!plan;attempt++)plan=buildFloorPlan(floor,params,{recent});
  if(!plan)throw new Error(`No se pudo generar el piso ${floor}.`);
  recent.push(plan.archetype);
  floors.push({
   floor,map:plan.map,rooms:plan.rooms,safeRooms:plan.safeRooms,spawn:plan.spawn,stairs:plan.stairs,
   doors:plan.doors,keys:plan.keys,chests:plan.chests,traps:plan.traps,altars:plan.altars,assets:plan.assets||[],event:plan.event,
   archetype:plan.archetype,archetypeLabel:plan.archetypeLabel,archetypeDesc:plan.archetypeDesc,
   objective:plan.objective,tierExpected:plan.tierExpected,rewardRarityBonus:plan.rewardRarityBonus,announce:plan.announce,
   enemies:plan.enemies.map(e=>compactEnemyForWorld(assignEnemySkills(e))),
   enemyFamily:plan.enemyFamily,enemyFamilyId:plan.enemyFamilyId,
   themeName:plan.themeName,floorTileset:compactFloorTilesetForWorld(plan.floorTileset),
   boss:plan.boss?compactEnemyForWorld(plan.boss):null
  });
 }
 game=oldGame;
 return {schemaVersion:4,appVersion:APP_VERSION,worldName:name,generatedAt:new Date().toISOString(),params,lootTable,floors};
}
function loadPrecomputedFloor(){
 const data=selectedDungeonWorld?.world_json?.floors?.[game.floor-1];if(!data)return false;
 if(game?.player){recomputeDerived();if(game.player.raceBonuses?.floorHeal)healEntity(game.player,game.player.raceBonuses.floorHeal);game.player.secondLifeReady=true;game.player.shield=(game.player.shield||0)+(game.player.derived?.floorShield||0)}
 const floorTileset=hydrateFloorTilesetForWorld(data.floorTileset)||pickFloorTilesetForLevel(game.floor);
 Object.assign(game,{map:data.map,rooms:data.rooms,safeRooms:data.safeRooms||[],stairs:data.stairs,doors:data.doors,keys:data.keys,chests:data.chests,traps:(data.traps||[]).map(t=>({...t})),altars:(data.altars||[]).map(a=>({...a})),assets:(data.assets||[]).map(a=>({...a})),precomputedEvent:data.event||null,enemies:(data.enemies||[]).map(e=>hydratePrecomputedEnemy(assignEnemySkills({...e}))),enemyFamily:data.enemyFamily,floorTileset,seen:Array.from({length:ROWS},()=>Array(COLS).fill(false)),boss:data.boss?hydratePrecomputedEnemy({...data.boss}):null,
  floorArchetype:data.archetype||'standard',floorArchetypeLabel:data.archetypeLabel||'Piso estándar',floorArchetypeDesc:data.archetypeDesc||'',
  objective:data.objective?{...data.objective}:{type:'stairs',label:'Encuentra la salida'},rewardRarityBonus:data.rewardRarityBonus||0,partyScaled:0});
 game.player.x=data.spawn.x;game.player.y=data.spawn.y;anim.heroX=anim.targetX=data.spawn.x;anim.heroY=anim.targetY=data.spawn.y;anim.t=1;reveal(data.spawn.x,data.spawn.y);
 scaleFloorForPlayerLevel();
 scaleFloorForParty();
 announceFloorArchetype();
 grantFloorRewardPopup();
 log(`Mundo: ${selectedDungeonWorld.world_name} (#${selectedDungeonWorld.id}).`,'story');
 updateUI();draw();rollFloorEvent();return true;
}

function carve(map,r){for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)map[y][x]=0}

// Room symmetry: mirrors a {x,y,w,h} rect across the map's vertical axis
// (left<->right), horizontal axis (top<->bottom), or both at once (180°
// point symmetry) - used to grow a randomly-placed room into a symmetric
// twin. A new axis is rolled per floor (see buildFloorPlan/buildCityFloorPlan)
// so symmetry is always present but never the same shape twice.
const SYMMETRY_MODES=['vertical','horizontal','point'];
const ROOM_MIRROR_CHANCE=.62;
function mirrorRect(r,mode){
 const mx=COLS-r.w-r.x,my=ROWS-r.h-r.y;
 if(mode==='vertical')return{x:mx,y:r.y,w:r.w,h:r.h};
 if(mode==='horizontal')return{x:r.x,y:my,w:r.w,h:r.h};
 return{x:mx,y:my,w:r.w,h:r.h};
}
// Flood-fill of every map===0 cell reachable from (sx,sy), used by
// buildCityFloorPlan to guarantee the stairs are actually reachable from
// spawn (the open-plan city layout has no guaranteed corridor spine like the
// walled archetypes do).
function floodFillOpen(map,sx,sy){
 const seenSet=new Set([key(sx,sy)]),stack=[[sx,sy]];
 while(stack.length){
  const[x,y]=stack.pop();
  for(const[dx,dy] of[[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=x+dx,ny=y+dy;
   if(nx<1||ny<1||nx>=COLS-1||ny>=ROWS-1)continue;
   const k=key(nx,ny);
   if(seenSet.has(k)||map[ny][nx]!==0)continue;
   seenSet.add(k);stack.push([nx,ny]);
  }
 }
 return seenSet;
}


const eventStats=['strength','vitality','agility','luck','intelligence','wisdom'];
const eventDefs=[
 {id:'goblinHorde',type:'horde',name:'Horda de saqueadores',stat:'strength',threshold:10,
  detected:'Escuchas botas, risas y metal barato antes de que doblen la esquina.',
  hidden:'Una horda cae sobre ti desde pasadizos laterales.',
  desc:'Una banda numerosa de enemigos invade el piso.'},
 {id:'orcWarband',type:'horde',name:'Partida de guerra orca',stat:'strength',threshold:11,
  detected:'Las vibraciones del suelo delatan una marcha pesada.',
  hidden:'Una partida de guerra te rodea con entusiasmo profesional.',
  desc:'Enemigos resistentes aparecen en varias salas.'},
 {id:'shadowSwarm',type:'horde',name:'Enjambre de sombras',stat:'wisdom',threshold:12,
  detected:'Notas que las sombras se mueven un instante antes que sus dueños.',
  hidden:'Las sombras se separan de las paredes y atacan.',
  desc:'Criaturas rápidas y numerosas surgen de la oscuridad.'},
 {id:'dartHall',type:'trap',name:'Galería de dardos',stat:'strength',threshold:9,
  detected:'Ves pequeños agujeros alineados en las paredes.',
  hidden:'Un clic. Luego demasiados dardos.',
  desc:'Una trampa inflige daño y aplica ralentización.'},
 {id:'runeMine',type:'trap',name:'Mina rúnica',stat:'intelligence',threshold:11,
  detected:'Las runas del suelo forman un circuito explosivo bastante evidente.',
  hidden:'Pisas una runa. La runa parece encantada de conocerte.',
  desc:'Explosión mágica con pérdida de maná.'},
 {id:'poisonFeast',type:'trap',name:'Banquete envenenado',stat:'vitality',threshold:10,
  detected:'El asado huele demasiado bien para estar abandonado.',
  hidden:'La comida era gratis. El veneno también.',
  desc:'Pierdes vida, aunque puedes obtener una pequeña recompensa.'},
 {id:'falseTreasure',type:'trap',name:'Tesoro falso',stat:'luck',threshold:12,
  detected:'El brillo del cofre parece demasiado teatral.',
  hidden:'El cofre era una trampa con dientes.',
  desc:'Un mímico o una explosión protegen un botín menor.'},
 {id:'championGate',type:'boss',name:'Campeón de la Puerta',stat:'strength',threshold:12,
  detected:'Reconoces marcas de duelo y sangre reciente.',
  hidden:'Un campeón bloquea la salida y exige combate.',
  desc:'Aparece un jefe opcional mucho más fuerte.'},
 {id:'witchQueen',type:'boss',name:'Reina Bruja Errante',stat:'wisdom',threshold:13,
  detected:'El aire se enfría y una voz pronuncia tu nombre desde otra sala.',
  hidden:'La Reina Bruja ya te estaba esperando.',
  desc:'Jefe mágico con gran vida y daño.'},
 {id:'chromeBeast',type:'boss',name:'Bestia de Cromo',stat:'intelligence',threshold:13,
  detected:'Interferencias en el visor revelan una firma mecánica enorme.',
  hidden:'Una criatura de metal rompe la pared.',
  desc:'Jefe ciberpunk con armadura alta.'},
 {id:'dragonWhelp',type:'boss',name:'Cría de dragón hambrienta',stat:'vitality',threshold:12,
  detected:'El olor a azufre y carne chamuscada no deja lugar a dudas.',
  hidden:'Una cría de dragón decide que pareces comestible.',
  desc:'Jefe de fuego con golpes muy fuertes.'},
 {id:'fairyCache',type:'reward',name:'Alijo feérico',stat:'luck',threshold:10,
  detected:'Una hilera de luciérnagas marca una grieta en el muro.',
  hidden:'Pasas junto a un alijo oculto sin verlo.',
  desc:'Botín raro o una habilidad looteable.'},
 {id:'forgottenShrine',type:'reward',name:'Santuario olvidado',stat:'wisdom',threshold:11,
  detected:'Reconoces una oración grabada bajo el musgo.',
  hidden:'El santuario permanece silencioso mientras pasas.',
  desc:'Curación, recursos y bendición temporal.'},
 {id:'smugglerLocker',type:'reward',name:'Taquilla de contrabandista',stat:'intelligence',threshold:10,
  detected:'Un cierre electrónico barato intenta fingir que no existe.',
  hidden:'La taquilla permanece cerrada y discreta.',
  desc:'Objeto ciberpunk de alta rareza y oro.'},
 {id:'buriedArmory',type:'reward',name:'Armería enterrada',stat:'strength',threshold:11,
  detected:'Una losa demasiado pesada oculta un compartimento.',
  hidden:'No reparas en la losa sellada.',
  desc:'Armas y armaduras de buena calidad.'},
 {id:'thievesDeal',type:'reward',name:'Trato de ladrones',stat:'strength',threshold:11,
  detected:'Una marca de tiza señala una reunión clandestina.',
  hidden:'Los ladrones se marchan antes de que llegues.',
  desc:'Oro, consumibles y posibilidad de objeto épico.'}
];
function currentEventStatValue(stat){
 const fs=game.player.derived?.finalStats||game.player.stats;
 return fs[stat]||0;
}
function rollFloorEvent(){
 if(!game?.player||game.floorEventRolled)return;
 game.floorEventRolled=true;
 if(game.multiplayer)return;
 let def=null;
 if(game.precomputedEvent){def={...eventDefs.find(e=>e.id===game.precomputedEvent.id)};delete game.precomputedEvent;}
 else{if(Math.random()>.09)return;def={...pick(eventDefs)}}
 if(!def)return;
 def.threshold=Math.max(9,Math.round(def.threshold+(game.floor-1)*.65+(game.player.level-1)*.18));
 const value=currentEventStatValue(def.stat),roll=1+rng(20),total=roll+Math.floor(value/2);
 const detected=total>=def.threshold;
 game.activeEvent={...def,detected,resolved:false,detectionRoll:roll,detectionTotal:total};
 setTimeout(()=>presentFloorEvent(game.activeEvent),450);
}
function statLabel(s){return({strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'})[s]||s}
function presentFloorEvent(ev){
 if(!ev||ev.resolved)return;
 const check=`${statLabel(ev.stat)} · tirada ${ev.detectionRoll} + bonificador ${Math.floor(currentEventStatValue(ev.stat)/2)} = ${ev.detectionTotal} / dificultad ${ev.threshold}`;
 if(ev.detected){
  storyTitle.textContent=`EVENTO DETECTADO — ${ev.name}`;
  storyBody.innerHTML=`<div class="narrative"><p>${ev.detected}</p><p>${ev.desc}</p><p><b>Detección:</b> ${check}</p><div class="startActions"><button id="eventPrepare">Prepararse</button><button id="eventAvoid">Evitar</button></div></div>`;
  storyOverlay.classList.remove('hidden');
  setTimeout(()=>{
   document.getElementById('eventPrepare')?.addEventListener('click',()=>{storyOverlay.classList.add('hidden');resolveFloorEvent(ev,true)});
   document.getElementById('eventAvoid')?.addEventListener('click',()=>{storyOverlay.classList.add('hidden');if(ev.type==='reward')resolveFloorEvent(ev,true);else{ev.resolved=true;log(`Evitas ${ev.name}.`,'story')}});
  },0)
 }else{
  storyTitle.textContent=`EVENTO — ${ev.name}`;
  storyBody.innerHTML=`<div class="narrative"><p>${ev.hidden}</p><p>${ev.desc}</p><p class="small">No superaste la tirada de ${statLabel(ev.stat)} (${ev.detectionTotal}/${ev.threshold}).</p><div class="startActions"><button id="eventContinue">Continuar</button></div></div>`;
  storyOverlay.classList.remove('hidden');
  setTimeout(()=>document.getElementById('eventContinue')?.addEventListener('click',()=>{storyOverlay.classList.add('hidden');resolveFloorEvent(ev,false)}),0)
 }
}
function randomOpenTile(){
 for(let tries=0;tries<300;tries++){
  const room=pick(game.rooms||[]);if(!room)break;
  const x=room.x+rng(Math.max(1,room.w)),y=room.y+rng(Math.max(1,room.h));
  if(game.map[y]?.[x]===0&&!game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)&&Math.abs(x-game.player.x)+Math.abs(y-game.player.y)>4)return{x,y}
 }
 return{x:game.player.x+2,y:game.player.y}
}
function spawnEventEnemy(mult=1,boss=false,name='Enemigo del evento'){
 // Event enemies (hordas, jefes opcionales, mímico) go through the same
 // configured enemy-family pipeline as every other enemy in the dungeon, so
 // they get a proper tier/level-scaled build AND their family's custom icon
 // instead of falling back to the legacy pre-Supabase themes/enemyDefs
 // catalog (which has no icon and renders as a generic pixel shape).
 const pos=randomOpenTile(),family=pickConfiguredFamilyForFloorWithParams(game.floor,worldParams());
 const e=buildConfiguredEnemy(weightedFamilyEnemy(family,boss,game.floor,worldParams().floors||10),pos,game.floor,boss);
 e.enemyFamily=family.name;
 e.name=boss?name:e.name;e.maxHp=e.hp=Math.round(e.hp*mult);e.atk=e.damage=Math.round((e.atk||e.damage)*(boss?1.35:1));
 game.enemies.push(e);return e
}
function resolveFloorEvent(ev,prepared){
 if(ev.resolved)return;ev.resolved=true;
 if(ev.type==='horde'){
  const n=4+game.floor+difficultyScale().count+(prepared?0:2);
  for(let i=0;i<n;i++)spawnEventEnemy(prepared?.9:1.05,false);
  banner('¡HORDA!');log(`${ev.name}: aparecen ${n} enemigos.`,'story')
 }else if(ev.type==='trap'){
  if(ev.id==='falseTreasure'){spawnEventEnemy(prepared?1.2:1.6,true,'Mímico Rechoncho')}
  else{
   const dmg=Math.max(4,Math.round(game.player.maxHp*(prepared?.10:.22)));
   game.player.hp=Math.max(1,game.player.hp-dmg);
   if(ev.id==='runeMine')game.player.mana=Math.max(0,game.player.mana-15);
   if(ev.id==='dartHall')game.player.stamina=Math.max(0,game.player.stamina-18);
   if(ev.id==='poisonFeast'&&Math.random()<.45){game.player.gold+=20+game.floor*10}
   floating(`-${dmg}`,game.player.x,game.player.y,'#ff6666');log(`${ev.name}: sufres ${dmg} de daño.`,'story')
  }
 }else if(ev.type==='boss'){
  const names={championGate:'Campeón de Hierro',witchQueen:'Reina Bruja Errante',chromeBeast:'Bestia de Cromo',dragonWhelp:'Cría de Dragón Carmesí'};
  const b=spawnEventEnemy(prepared?1.7:2.2,true,names[ev.id]||ev.name);b.eventBoss=true;b.xp=Math.round(b.xp*2.5);
  banner('JEFE OPCIONAL');log(`${b.name} entra en combate.`,'story')
 }else if(ev.type==='reward'){
  const count=ev.id==='buriedArmory'?3:2;
  for(let i=0;i<count;i++){const item=makeLoot(game.player.level+game.floor+2,'specialReward');if(i===0&&Math.random()<.6){const row=currentLootProgressionRow(game.floor,game.player.level),pool=['rare','epic','legendary'].filter(r=>lootRarityAllowed(r,row));if(pool.length){item.rarity=pick(pool);item.label=tierDefs[item.rarity]?.label||item.rarity}}addInventoryItem(item);lootToast(item)}
  if(ev.id==='fairyCache'&&Math.random()<.21)unlockSkillLoot(randomLootableSkill());
  if(ev.id==='forgottenShrine'){game.player.hp=game.player.maxHp;game.player.mana=game.player.maxMana;game.player.stamina=game.player.maxStamina}
  if(ev.id==='smugglerLocker')game.player.gold+=40+game.floor*15;
  banner('RECOMPENSA ESPECIAL');log(`${ev.name}: encuentras una recompensa poco común.`,'loot')
 }
 updateUI();draw()
}


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

function difficultyScale(){
 const p=game.player,f=game.floor||1,l=Math.min(LEVEL_CAP,p.level||1);
 return{
  hp:Math.pow(1.055,l-1)*(1+(f-1)*.19),
  damage:Math.pow(1.035,l-1)*(1+(f-1)*.13),
  xp:1+(f-1)*.09+Math.pow(l-1,.72)*.045,
  count:Math.min(35,Math.floor((f-1)/2)+Math.floor((l-1)/7)),
  eliteChance:Math.min(.42,.025*f+.0032*l)
 };
}

function enemySkillPool(e){
 const level=game.player.level||1,maxTier=level>=30?3:level>=10?2:1;
 const all=Object.entries(skillDefs).filter(([id,s])=>s.enemyUsable&&(!s.tier||s.tier<=maxTier));
 const pref=ENEMY_CLASS_SKILL_PREF[enemyClassOf(e)];
 const filtered=pref?all.filter(([id,s])=>pref(s)):all;
 return (filtered.length?filtered:all).map(([id])=>id)
}
// ---- Enemy classes & equipment ----------------------------------------------
// Every enemy resolves to a class; on dungeon build it gets a weapon whose
// quality scales with level/floor rarity. Ranged classes shoot from distance,
// magic classes cast, support classes heal allies. Weapon data is plain JSON
// so it persists through world JSON, session snapshots and broadcasts.
// `stat` is the archetype's offensive stat: same role as a player weapon's
// defenseStat (inferWeaponDefenseStat) but for the enemy's own core stats,
// matching the bias normalizeEnemyCoreStats already gives each archetype -
// used by enemyStatModifier() to bonus the enemy's normal-attack roll.
const ENEMY_CLASS_GEAR={
 rogue:{kind:'melee',cats:['Armas blancas steampunk básicas','Espadas eléctricas iniciales'],label:'Pícaro',stat:'agility'},
 warrior:{kind:'melee',cats:['Armas pesadas steampunk','Armas de latón refinadas'],label:'Guerrero',stat:'strength'},
 tanque:{kind:'melee',cats:['Armas eléctricas pesadas','Artillería steampunk'],label:'Tanque',stat:'vitality'},
 arquero:{kind:'ranged',types:['Arcos','Ballestas','Pistolas','Escopetas'],label:'Arquero',stat:'agility'},
 francotirador:{kind:'ranged',types:['Rifles','Ballestas'],label:'Francotirador',stat:'agility'},
 caster:{kind:'magic',types:['Varitas'],label:'Mago',stat:'intelligence'},
 invocador:{kind:'magic',types:['Varitas'],label:'Invocador',stat:'intelligence'},
 clerigo:{kind:'magic',types:['Varitas'],label:'Clérigo',stat:'wisdom'},
 chaman:{kind:'magic',types:['Varitas'],label:'Chamán',stat:'wisdom'}
};
const ENEMY_WEAPON_BASENAMES={Arcos:'Arco',Ballestas:'Ballesta',Pistolas:'Pistola',Rifles:'Rifle',Escopetas:'Escopeta',Varitas:'Varita'};
const ENEMY_WEAPON_QUALITY=['de chatarra','de caza','de guerra','de élite','de leyenda','de mito'];
const ENEMY_CLASS_SKILL_PREF={
 caster:s=>s.type==='magic'&&!['heal','shield'].includes(s.classEffect),
 invocador:s=>s.type==='magic',
 chaman:s=>s.type==='magic'||['buff','debuff','aoe'].includes(s.classEffect),
 clerigo:s=>['heal','shield','buff','utility'].includes(s.classEffect),
 arquero:s=>['ranged','multihit'].includes(s.classEffect),
 francotirador:s=>['ranged','execute','ultimate'].includes(s.classEffect),
 rogue:s=>s.type==='physical'&&['dash','execute','debuff','multihit','ranged'].includes(s.classEffect),
 tanque:s=>['shield','buff','debuff'].includes(s.classEffect),
 warrior:s=>s.type==='physical'
};
// Bosses (and megabosses) get a real "classic" player class instead of the
// generic archetype skill pool - one candidate matching the boss's archetype
// (enemyClassOf), e.g. an arquero-archetype boss becomes a sniper or a
// bountyHunter. Gear/weapon assignment (equipEnemy) still keys off the
// generic archetype, only the skill kit comes from this real class.
const BOSS_CLASS_BY_ARCHETYPE={
 arquero:['sniper','bountyHunter'],
 francotirador:['sniper','bountyHunter'],
 caster:['entropyMage','necromancer','seer'],
 invocador:['necromancer','engineer'],
 clerigo:['cleric','paladin'],
 chaman:['shaman','druid'],
 rogue:['thief','jester'],
 tanque:['yunque','beastGuardian'],
 warrior:['berserker','monk','yunque']
};
function pickBossClassId(e){return pick(BOSS_CLASS_BY_ARCHETYPE[enemyClassOf(e)]||allClassIds())}
// Every classId-tagged skillDefs entry for a class, gated by tier the same
// way a player's own skills unlock (tier2 at level>=10, tier3 at level>=30) -
// using the BOSS's own level, not the player's.
function bossSkillPool(classId,level){
 const maxTier=level>=30?3:level>=10?2:1;
 return Object.entries(skillDefs).filter(([,s])=>s.classId===classId&&(!s.tier||s.tier<=maxTier)).map(([id])=>id);
}
function enemyClassOf(e){
 if(e.enemyClass)return e.enemyClass;
 if(ENEMY_CLASS_GEAR[e.type])return e.type;
 const t=String(e.type||'').toLowerCase();
 if(/arquero|archer|cazador|ballest/.test(t))return 'arquero';
 if(/francotirador|sniper/.test(t))return 'francotirador';
 if(/liche|mago|mage|caster|brujo|hechicer|arcan/.test(t))return 'caster';
 if(/chaman/.test(t))return 'chaman';
 if(/clerigo|priest|sacerdote|monje/.test(t))return 'clerigo';
 if(/invocador|necro|summon/.test(t))return 'invocador';
 if(/lobo|wolf|rata|goblin|ladron|rogue|vamp|asesin|arana|spider/.test(t))return 'rogue';
 if(/golem|tanque|guardian|coloso|troll|ogro/.test(t))return 'tanque';
 return 'warrior';
}
// Weapon damage dice by rarity for enemy normal attacks, same idea as a
// player weapon's damageDice - a real config_items weapon's own damageDice
// still wins (see equipEnemy) so this is only the synthetic/fallback table.
const ENEMY_ATTACK_DICE_BY_RARITY=['1d4','1d6','1d8','1d10','2d6','2d8'];
function diceAverage(expr){const d=parseDice(expr);return d.count*(d.sides+1)/2+d.bonus}
const ENEMY_STAT_DMG_COEF=1.4;
// Enemy-side counterpart to weaponStatDamageBonus(): bonuses the archetype's
// associated stat (ENEMY_CLASS_GEAR[cls].stat) off the enemy's own core
// stats, so a rogue swings harder with more Agilidad, a mage with more
// Inteligencia, etc. - instead of every archetype's normal attack ignoring
// e.stats entirely.
function enemyStatModifier(e,cls){
 const stat=ENEMY_CLASS_GEAR[cls||e.enemyClass||enemyClassOf(e)]?.stat||'strength';
 return Math.round((e.stats?.[stat]||0)*ENEMY_STAT_DMG_COEF);
}
function equipEnemy(e,floor=game?.floor||1){
 if(e.weapon)return e;
 const cls=enemyClassOf(e),gear=ENEMY_CLASS_GEAR[cls];
 e.enemyClass=cls;
 if(!gear)return e;
 e.enemyClassLabel=gear.label;
 const lvl=e.level||enemyLevelForFloor(floor);
 const baseAtk=e.atk||e.damage||4;
 // preferred source: config_items weapons matching the class kind
 const pool=configItems.map(r=>({row:r,item:r.item_json||r})).filter(w=>(w.item.slot||w.row.slot)==='weapon'&&configWeaponKind(w.item)===gear.kind);
 if(pool.length){
  const lr=currentLootProgressionRow(floor,lvl);
  let cands=pool.filter(w=>lootRarityAllowed(w.item.rarity||w.row.tier||'common',lr));
  if(!cands.length)cands=pool;
  cands=cands.map(w=>({...w,il:Number(w.item.itemLevel||w.row.ilvl)||1})).sort((a,b)=>Math.abs(a.il-lvl)-Math.abs(b.il-lvl));
  const w=pick(cands.slice(0,Math.max(3,Math.ceil(cands.length*.4))));
  const rarity=w.item.rarity||w.row.tier||'common',rIdx=Math.max(0,LOOT_RARITY_ORDER.indexOf(rarity));
  const preset=weaponTypeRanges[w.item.weaponType]||null;
  const rangeMin=gear.kind==='melee'?1:(Number(w.item.rangeMin)||preset?.min||1);
  const rangeMax=gear.kind==='melee'?1:(Number(w.item.rangeMax)||preset?.max||4);
  const dmgBonus=Math.max(1,Math.round(baseAtk*(.12+rIdx*.05)));
  // avgTarget (baseAtk+dmgBonus, unchanged from before) is the enemy's fully
  // level/tier/rarity-scaled intended average hit. It's decomposed into a
  // weapon dice roll + a live stat modifier (enemyStatModifier, reacts to
  // e.stats same as the player's weaponStatDamageBonus) + a flat residual
  // that absorbs the rest, so the average hit is unchanged but individual
  // hits now vary turn to turn instead of always landing on the same number.
  const avgTarget=baseAtk+dmgBonus;
  const dice=w.item.damageDice||ENEMY_ATTACK_DICE_BY_RARITY[rIdx]||'1d6';
  const statMod=enemyStatModifier(e,cls);
  const atkResidual=Math.max(0,Math.round(avgTarget-diceAverage(dice)-statMod));
  e.weapon={name:w.item.name||w.row.nombre||'Arma',kind:gear.kind,rangeMin,rangeMax,dmg:dmgBonus,dice,atkResidual,rarity,label:w.item.label||tierDefs[rarity]?.label||rarity,itemId:w.row.id};
  e.atk=avgTarget;e.damage=e.atk;
  if(cls==='tanque')e.armor=(e.armor||0)+1+Math.floor(lvl/6);
  return e;
 }
 // fallback (config_items empty or without weapons of this kind): synthetic weapon
 const rar=weightedRarity(lvl),rarIdx=Math.max(0,LOOT_RARITY_ORDER.indexOf(rar.name));
 let name,rangeMin=1,rangeMax=1;
 if(gear.kind==='melee'){
  const cat=gear.cats[rng(gear.cats.length)];
  name=weaponNameForCategory(cat,Math.max(0,Math.min(9,Math.floor(lvl/2)+rarIdx-1)));
 }else{
  const t=gear.types[rng(gear.types.length)],r=weaponTypeRanges[t]||{min:1,max:4};
  rangeMin=r.min;rangeMax=r.max;
  name=`${ENEMY_WEAPON_BASENAMES[t]||t} ${ENEMY_WEAPON_QUALITY[rarIdx]||ENEMY_WEAPON_QUALITY[0]}`;
 }
 const dmgBonus=Math.max(1,Math.round(baseAtk*(.12+rarIdx*.05)));
 const avgTarget=baseAtk+dmgBonus;
 const dice=ENEMY_ATTACK_DICE_BY_RARITY[rarIdx]||'1d6';
 const statMod=enemyStatModifier(e,cls);
 const atkResidual=Math.max(0,Math.round(avgTarget-diceAverage(dice)-statMod));
 e.weapon={name,kind:gear.kind,rangeMin,rangeMax,dmg:dmgBonus,dice,atkResidual,rarity:rar.name,label:rar.label};
 e.atk=avgTarget;e.damage=e.atk;
 if(cls==='tanque')e.armor=(e.armor||0)+1+Math.floor(lvl/6);
 return e;
}
function assignEnemySkills(e){
 e.skillCooldowns={};
 if(e.boss){
  // Bosses (and megabosses) always run a 3-skill kit from a real class
  // matching their archetype instead of the generic pool below - see
  // BOSS_CLASS_BY_ARCHETYPE/bossSkillPool. An admin-configured boss with its
  // own hand-picked skillIds still wins outright, same as before.
  if(Array.isArray(e.configuredSkillIds)&&e.configuredSkillIds.length){e.skills=[...e.configuredSkillIds];return e}
  e.bossClassId=e.bossClassId||pickBossClassId(e);
  e.enemyClassLabel=resolveClassDef(e.bossClassId)?.name||e.enemyClassLabel;
  const pool=bossSkillPool(e.bossClassId,e.level||1).sort(()=>Math.random()-.5);
  e.skills=pool.slice(0,3);
  if(e.skills.length<3){ // thin kit at low level: top up from the generic archetype pool so a boss is never under-equipped
   const fallback=enemySkillPool(e).filter(id=>!e.skills.includes(id));
   while(e.skills.length<3&&fallback.length)e.skills.push(fallback.splice(rng(fallback.length),1)[0]);
  }
  return e;
 }
 const cls=enemyClassOf(e);
 const casterClass=['caster','clerigo','chaman','invocador'].includes(cls);
 const chance=casterClass?1:e.elite?.6:(cls==='arquero'||cls==='francotirador')?.45:.18+Math.min(.22,(game?.floor||1)*.012);
 e.skills=Array.isArray(e.configuredSkillIds)?[...e.configuredSkillIds]:[];
 if(!e.skills.length&&Math.random()<chance){const pool=enemySkillPool(e),count=casterClass?1+(Math.random()<.35?1:0):1;while(e.skills.length<count&&pool.length){const id=pool.splice(rng(pool.length),1)[0];e.skills.push(id)}}
 return e
}
// Which enemy skill effects legitimately restore hp. Any type:'utility' or
// classEffect 'shield'/'buff' skill used to grant the caster an incidental
// ~90% self-heal on cast regardless of what it actually did (see the old
// version of enemyUseSkill below) - a boss whose random 3-skill kit landed
// even one non-healing utility skill (armor buff, taunt, crit buff, ...)
// could out-heal a fight indefinitely. Now only a real heal/hot/drain effect
// can put hp back on an enemy, same rule in every game (testing or not).
const ENEMY_INSTANT_HEAL_EFFECTS=new Set(['heal','healShield','cleanseHeal','bigHeal','rewind']);
const ENEMY_HOT_HEAL_EFFECTS=new Set(['regenHeal','survivalHeal','oakBuff']);
const ENEMY_DRAIN_EFFECTS=new Set(['drain','holyLeech']);
function enemyUseSkill(e,dist,target=game.player){
 if(!e.skills?.length)return false;
 for(const id of e.skills){
  e.skillCooldowns[id]=Math.max(0,(e.skillCooldowns[id]||0)-1);
  const s=skillDefs[id];if(e.skillCooldowns[id]>0)continue;
  // A companion/ally with hitByAoe===false is immune to area/multi-target-
  // flavored enemy skills specifically (still vulnerable to plain weapon
  // attacks below, and to single-target skills) - skip this one and try the
  // next skill in the list instead of picking a different target.
  if(target!==game.player&&target.hitByAoe===false&&['aoe','multihit','ultimate','massive'].includes(s.classEffect))continue;
  const ranged=isRangedSkill(id)||s.classEffect==='ranged'||s.classEffect==='multihit'||s.classEffect==='ultimate'||s.classEffect==='massive';
  if((ranged&&dist<=Math.max(4,s.range||6)&&hasLineOfSight(e,target))||(!ranged&&dist<=1)){
   const mult=e.boss?1.35:e.elite?1.15:1,statMod=skillStatModifier(id,e),amount=Math.max(2,Math.round(((e.atk||e.damage||4)+statMod)*mult*(s.tier?1+s.tier*.12:1)));
   if(ENEMY_INSTANT_HEAL_EFFECTS.has(s.classEffect)||ENEMY_HOT_HEAL_EFFECTS.has(s.classEffect)){
    const isHot=ENEMY_HOT_HEAL_EFFECTS.has(s.classEffect);
    const ally=game.enemies.filter(o=>o!==e&&o.hp>0&&o.hp<o.maxHp&&Math.abs(o.x-e.x)+Math.abs(o.y-e.y)<=4).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    const beneficiary=ally||e;
    const healNow=Math.round(amount*(isHot?.5:.9));
    if(game.multiplayer)sendMpAction('enemy_heal',{enemyId:e.eid,targetType:'enemy',targetId:beneficiary.eid,visualAmount:healNow});
    healEntity(beneficiary,healNow,beneficiary.x,beneficiary.y);floating('✚',beneficiary.x,beneficiary.y,'#8dffa8');
    if(isHot){beneficiary.statuses=beneficiary.statuses||[];beneficiary.statuses.push({type:'regen',turns:3,power:Math.max(1,Math.round(amount*.15))})}
    log(`${e.name} usa ${s.name} y cura a ${beneficiary===e?'sí mismo':beneficiary.name}.`,'combat');
   }
   else if(s.classEffect==='shield'||s.classEffect==='buff'||s.type==='utility'){if(game.multiplayer)sendMpAction('enemy_spell',{enemyId:e.eid,origin:{x:e.x,y:e.y},icon:'✦'});floating('✦',e.x,e.y,'#76e0ff');log(`${e.name} usa ${s.name}.`,'combat')}
   else if(target===game.player){
    if(game.multiplayer)sendMpAction('enemy_spell',{enemyId:e.eid,origin:{x:e.x,y:e.y},target:{x:game.player.x,y:game.player.y},icon:s.icon||'✦'});
    damagePlayer(amount,inferSkillDefenseStat(id),`${e.name} usa ${s.name}`);
    if(ENEMY_DRAIN_EFFECTS.has(s.classEffect))healEntity(e,Math.round(amount*(s.classEffect==='holyLeech'?.25:.4)),e.x,e.y);
    floating(s.icon||'✦',e.x,e.y,'#e68cff')
   }
   else{
    const ref=mpEntityRef(target);if(game.multiplayer&&ref)sendMpAction('enemy_spell',{enemyId:e.eid,origin:{x:e.x,y:e.y},target:{x:target.x,y:target.y},targetType:ref.type,targetId:ref.id,visualAmount:amount,icon:s.icon||'✦'});
    target.hp-=amount;
    if(ENEMY_DRAIN_EFFECTS.has(s.classEffect))healEntity(e,Math.round(amount*(s.classEffect==='holyLeech'?.25:.4)),e.x,e.y);
    floating(`-${amount}`,target.x,target.y,'#ff8888');log(`${e.name} usa ${s.name} contra ${target.name} por ${amount}.`,'combat')
   }
   e.skillCooldowns[id]=Math.max(2,s.cd||5);return true
  }
 }
 return false
}


function floorNarratives(){
 if(game.floor===1)return levelOneNarratives;
 if(game.floor===2)return levelTwoNarratives;
 if(game.floor===3)return levelThreeNarratives;
 return levelFourNarratives;
}
function showFloorNarrative(){
 const t=currentFloorTheme(),n=pick(floorNarratives());
 storyTitle.textContent=`NIVEL ${game.floor} — ${n.title}`;
 storyBody.innerHTML=`<div class="narrative"><p>${n.text}</p><p><b>${t.name}</b>: ${t.story}</p><p><b>Objetivo:</b> explora, sobrevive y encuentra la salida.</p><div class="startActions"><button id="continueFloorStory">Entrar</button></div></div>`;
 storyOverlay.classList.remove('hidden');
 setTimeout(()=>document.getElementById('continueFloorStory')?.addEventListener('click',()=>storyOverlay.classList.add('hidden')),0)
}


function roomCellSet(room){
 const set=new Set();for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++)set.add(key(x,y));return set
}
function isSafeCell(x,y){return(game.safeRooms||[]).some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)}
function roomTypeAt(x,y){return (game.rooms||[]).find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)?.type||null}
function safeRoomAt(x,y){return(game.safeRooms||[]).find(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h)}
function campAtPlayer(){return(game.safeRooms||[]).find(r=>r.cx===game.player.x&&r.cy===game.player.y)}
function restInSafeRoom(){
 const room=campAtPlayer();
 if(!room){log('Debes situarte junto al fuego de una sala segura.','sys');return}
 if(room.rested){log('Ya has descansado en esta sala segura.','sys');return}
 const p=game.player,before={hp:p.hp,stamina:p.stamina,mana:p.mana};
 // Downed permanent companions revive for free at full HP as part of a
 // rest, instead of needing the usual resource-cost revive (reviveCompanion
 // via move()). Lift the death debuff and recompute derived stats before
 // topping off HP/stamina/mana below, so the fresh (debuff-free) maxHp is
 // what the player actually gets restored to.
 const revived=[];
 for(const c of game.companions||[])if(c.permanent&&c.hp<=0){
  c.hp=c.maxHp;c.deathHandled=false;
  game.player.activeBuffs=(game.player.activeBuffs||[]).filter(b=>b.id!==`companionDown:${c.id}`);
  revived.push(c.name);
 }
 if(revived.length)recomputeDerived();
 p.hp=p.maxHp;p.stamina=p.maxStamina;p.mana=p.maxMana;
 room.rested=true;
 updateUI();draw();banner('DESCANSO COMPLETO');
 log(`Descansas junto al fuego: +${p.hp-before.hp} vida, +${p.stamina-before.stamina} stamina y +${p.mana-before.mana} maná.${revived.length?` ${revived.join(', ')} revive${revived.length>1?'n':''} con toda su vida.`:''}`,'good')
}
function updateRestButton(){
 const btn=document.getElementById('waitBtn');if(!btn)return;
 const room=campAtPlayer();
 if(room){btn.textContent=room.rested?'DESCANSADO':'DESCANSAR';btn.disabled=!!room.rested;btn.dataset.rest='1'}
 else if(apModeOn()){if(game.player.ap==null)startPlayerAP();btn.textContent=`PASAR TURNO (${game.player.ap} PA)`;btn.disabled=!!(game.multiplayer&&!game.myTurn);delete btn.dataset.rest}
 else{btn.textContent='ESPERAR';btn.disabled=false;delete btn.dataset.rest}
}

// A pet's pending order (see resolveCompanionCommand) references a live
// enemy object from the current floor - stale once the floor changes, so
// every companion goes back to just following instead of chasing a ghost.
function clearCompanionOrders(){for(const c of game?.companions||[])c.orderTarget=null}
function generateFloor(){clearCompanionOrders();game.floorEntryLevel=Math.max(1,game?.player?.level||1);if(loadPrecomputedFloor())return;game.floorEventRolled=false;game.activeEvent=null;if(game?.player){recomputeDerived();if(game.player.raceBonuses?.floorHeal)healEntity(game.player,game.player.raceBonuses.floorHeal);game.player.secondLifeReady=true;game.player.shield=(game.player.shield||0)+(game.player.derived?.floorShield||0)}
 busy=false;
 const params=worldParams();
 const overCap=Math.max(0,(game.floorEntryLevel||1)-BALANCE_LEVEL_CAP);
 const populationScale=1+Math.min(1.2,(balanceLevel(game.floorEntryLevel)-1)*.012)+overCap*.04;
 game.recentArchetypes=(game.recentArchetypes||[]).slice(-8);
 let plan=null;
 for(let attempt=0;attempt<3&&!plan;attempt++)plan=buildFloorPlan(game.floor,params,{recent:game.recentArchetypes,populationScale});
 if(!plan){log('No se pudo generar el piso; reintentando con el diseño estándar.','sys');plan=buildFloorPlan(game.floor,params,{recent:['superboss','bossrush'],populationScale})}
 if(!plan)return;
 game.recentArchetypes.push(plan.archetype);
 Object.assign(game,{
  map:plan.map,rooms:plan.rooms,safeRooms:plan.safeRooms,stairs:plan.stairs,doors:plan.doors,keys:plan.keys,
  chests:plan.chests,traps:plan.traps,altars:plan.altars,assets:plan.assets||[],enemies:plan.enemies,enemyFamily:plan.enemyFamily,
  floorTileset:plan.floorTileset,seen:Array.from({length:ROWS},()=>Array(COLS).fill(false)),boss:plan.boss,
  floorArchetype:plan.archetype,floorArchetypeLabel:plan.archetypeLabel,floorArchetypeDesc:plan.archetypeDesc,
  objective:plan.objective,rewardRarityBonus:plan.rewardRarityBonus,precomputedEvent:plan.event||null,partyScaled:0
 });
 game.player.x=plan.spawn.x;game.player.y=plan.spawn.y;anim.heroX=anim.targetX=plan.spawn.x;anim.heroY=anim.targetY=plan.spawn.y;anim.t=1;reveal(plan.spawn.x,plan.spawn.y);
 const extra=difficultyScale().count;
 for(let i=0;i<extra;i++){const room=pick(game.rooms||[]);if(room){const exPos={x:room.x+rng(Math.max(1,room.w)),y:room.y+rng(Math.max(1,room.h))};if(game.map[exPos.y]?.[exPos.x]===0&&!isSafeCell(exPos.x,exPos.y)){const ex=buildConfiguredEnemy(weightedFamilyEnemy(plan.family,false,game.floor,worldParams().floors||10),exPos,game.floor,false);ex.enemyFamily=plan.family.name;game.enemies.push(ex)}}}
 scaleFloorForParty();
 announceFloorArchetype();
 grantFloorRewardPopup();
 updateUI();draw();rollFloorEvent();
}

// Banner + log describing the archetype and how this floor is completed.
function announceFloorArchetype(){
 const label=game.floorArchetypeLabel||'Piso estándar';
 const obj=game.objective||{type:'stairs'};
 banner(`PISO ${game.floor} · ${label.toUpperCase()}`);
 log(`${label}: ${game.floorArchetypeDesc||''} Familia dominante: ${game.enemyFamily}. ${(game.enemies||[]).length} enemigos.`,'story');
 log(`Objetivo: ${objectiveText(obj)}`,'story');
 if(game.floorArchetype==='superboss')log('Un poder muy superior aguarda. Busca altares y prepárate antes de entrar en su sala.','combat');
 if(game.floorArchetype==='megaboss')log('Un pasillo estrecho es la única vía. Un MEGAJEFE aguarda al final. Prepárate.','combat');
}
// Rarity of the guaranteed floor-completion item: a fixed floor->tier ladder
// (unlike the ratio/level-gated progression used for regular loot), so every
// run hands out the same predictable rarity per floor: 1 común, 2-3
// infrecuente, 4-7 raro, 8-10 épico, 11-15 legendario, 16+ artefacto.
const FLOOR_REWARD_TIER_THRESHOLDS=[
 {upTo:1,rarity:'common'},
 {upTo:3,rarity:'uncommon'},
 {upTo:7,rarity:'rare'},
 {upTo:10,rarity:'epic'},
 {upTo:15,rarity:'legendary'}
]; // beyond the last threshold: artifact
function topRarityNameForFloor(floor){
 return LOOT_RARITY_ORDER[maxLootRarityIndexForProgress(1,DUNGEON_FLOORS,game?.floorEntryLevel||game?.player?.level||1)]||'common';
}
// Grants one guaranteed item at the floor's best available rarity and shows
// a dedicated floor-reward popup. Runs once per floor arrival, floor 2+.
function grantFloorRewardPopup(){
 // Conservada como punto de extensión: ya no hay recompensa al entrar en un piso.
}

function objectiveText(obj=game?.objective){
 if(!obj)return 'Encuentra la salida.';
 switch(obj.type){
  case 'survive':return `Sobrevive ${Math.max(0,(obj.turns||0)-(obj.elapsed||0))} turnos; después aparecerá la escalera.`;
  case 'timed':return `Encuentra la salida en ${Math.max(0,(obj.limit||0)-(obj.elapsed||0))} turnos.`;
  case 'waves':return `Supera ${obj.total||0} oleadas (${obj.done||0}/${obj.total||0}) para abrir la salida.`;
  case 'bossKill':return 'Derrota al jefe del piso para abrir la salida.';
  default:return 'Encuentra la salida.';
 }
}


const DEFENSE_STAT_LABELS={
 strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',
 luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'
};
// Explicit override by the weapon's own generic type (configWeaponTypes),
// set on every config-created weapon (item.weaponType) - checked before the
// flavor-name regex below so "basic attack" stat is deterministic by weapon
// type rather than dependent on whatever flavor name it happened to roll:
// daggers/claws/rifles/pistols use agility, shotguns use strength.
const WEAPON_TYPE_STAT={Dagas:'agility',Guanteletes:'agility',Rifles:'agility',Pistolas:'agility',Escopetas:'strength'};
function inferWeaponDefenseStat(item){
 // Trust the stat already resolved onto the item (configuredItemFromRow sets
 // it from WEAPON_TYPE_STAT/weaponCategoryStats at creation time) before
 // falling back to recomputing it - otherwise a flavor name that doesn't
 // match any keyword below (most of weaponRows' names) silently loses its
 // category's real stat and defaults to 'strength'.
 if(item?.defenseStat)return item.defenseStat;
 if(item?.weaponType&&WEAPON_TYPE_STAT[item.weaponType])return WEAPON_TYPE_STAT[item.weaponType];
 if(item?.weaponCategory&&weaponCategoryStats[item.weaponCategory])return weaponCategoryStats[item.weaponCategory];
 const text=`${item?.name||''} ${item?.iconShape||''} ${item?.theme||''}`.toLowerCase();
 if(/(arco|ballesta|rifle|pistola|fusil|rail|bláster|blaster|cañón|canon|daga|dagger|spear|lanza|garra|claw)/.test(text))return'agility';
 if(/(bastón|baston|staff|orbe|orb|grimorio|book|rúnic|runic|mágic|magic)/.test(text))return'intelligence';
 if(/(sagrado|holy|tótem|totem|reliquia|relic|espíritu|spirit)/.test(text))return'wisdom';
 if(/(martillo|hammer|maza|mace|hacha|axe|yunque|escudo)/.test(text))return'vitality';
 return'strength'
}
function inferSkillDefenseStat(id){
 const s=skillDefs[id]||{},text=`${id} ${s.name||''} ${s.desc||''}`.toLowerCase();
 if(s.defenseStat)return s.defenseStat;
 if(/(caos|azar|fortuna|bufón|jester|quantum|cuántic|entrop)/.test(text))return'luck';
 if(/(miedo|mente|alma|espíritu|spirit|sagrado|holy|necrom|cadáver|corpus|sombra|shadow|vacío|void|taunt|insulto)/.test(text))return'wisdom';
 if(/(arcano|mana|runa|rúnic|fuego|hielo|rayo|chispa|tormenta|gravedad|alquim|tecn|circuit|data|nulo|null)/.test(text)||s.resource==='mana')return'intelligence';
 if(/(veneno|tóxic|ácido|sangre|óxido|nube|onda|terremoto|quake|explos|granada|nova)/.test(text))return'vitality';
 if(/(disparo|tiro|flecha|proyectil|rifle|pistola|gancho|trampa|paso|blink|embestida|charge|tajo|execute)/.test(text)||isRangedSkill(id))return'agility';
 return'strength'
}
function ensureAttackDefenseMetadata(){
 for(const [id,s] of Object.entries(skillDefs))s.defenseStat=s.defenseStat||inferSkillDefenseStat(id);
 for(const item of game?.inventory||[])item.defenseStat=item.defenseStat||inferWeaponDefenseStat(item);
 for(const item of Object.values(game?.player?.equipment||{}))if(item)item.defenseStat=item.defenseStat||inferWeaponDefenseStat(item)
}
