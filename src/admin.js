/* MAZMORRA // BOTÍN v0.61.0
 * Carga de configuración y editores administrativos.
 * Carga clásica ordenada por index.html; el estado compartido pertenece al ámbito global del juego.
 */
async function fetchConfigItems(){try{const r=await fetch('/api/config-items');const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron cargar objetos');configItems=Array.isArray(data)?data:[];renderConfigItems();renderConfigPotionsList();if(document.getElementById('configChestItemResults'))renderChestItemResults()}catch(e){const st=document.getElementById('configStatus');if(st)st.textContent=`Error cargando config_items: ${e.message}`}}

function potionTierLevel(tier){return {common:1,uncommon:2,rare:3,epic:4,legendary:5,artifact:6}[tier]||1}

function currentConfigItemJson(){
 // skillIds ("learn a skill on equip") is no longer editable from this tab -
 // equipment's own configurable effects[] superseded it. A brand-new item
 // gets none; editing an existing one keeps whatever it already had (loaded
 // into window.currentConfigItemSkillIds by loadConfigItemForEdit) instead
 // of silently wiping it just because the UI no longer exposes it.
 const skillIds=window.currentConfigItemSkillIds||[],rarity=configTier.value,ilvl=potionTierLevel(rarity),hidden=!!document.getElementById('configItemHidden')?.checked;
 const slot=configSlot.value,weaponType=slot==='weapon'?(configWeaponCategory.value||configWeaponTypes[0]):null,weaponCategory=weaponType?(configWeaponTypeCategories[weaponType]||weaponCategories[0]):null,weaponIconRow=weaponCategory?weaponRowForCategory(weaponCategory):null,weaponIconCol=weaponCategory?weaponPowerColumn(ilvl,rarity,ilvl*8):null,rangePreset=weaponTypeRanges[weaponType]||{min:1,max:1},rangeMin=slot==='weapon'?normalizeWeaponRangeValue(configRangeMin?.value,rangePreset.min):null,rangeMax=slot==='weapon'?normalizeWeaponRangeValue(configRangeMax?.value,rangePreset.max):null;
 const isActive=EQUIPMENT_ACTIVE_SLOTS.has(slot),effects=JSON.parse(JSON.stringify(window.currentEquipmentEffectsDraft||[]));
 const procChance=slot==='weapon'?Math.max(0,Math.min(100,Number(configProcChance?.value)||0)):null;
 const cooldown=isActive?Math.max(1,Number(configEquipmentCooldown?.value)||1):null;
 const range=isActive?Math.max(1,Number(configEquipmentRange?.value)||5):null;
 return {type:'equipment',name:configNombre.value.trim()||'Objeto sin nombre',slot,rarity,label:tierDefs[rarity]?.label||rarity,itemLevel:ilvl,score:ilvl*8,icon:window.currentConfigIconHex||'',damageDice:slot==='weapon'?configDamageDice.value:null,rangeMin:slot==='weapon'?Math.min(rangeMin,rangeMax):null,rangeMax:slot==='weapon'?Math.max(rangeMin,rangeMax):null,weaponType,weaponCategory,weaponIconRow,weaponIconCol,weaponIconPath:weaponCategory?weaponIconPath(weaponIconRow,weaponIconCol):null,defenseStat:weaponCategory?(weaponCategoryStats[weaponCategory]||'strength'):null,skillIds,stats:configStats.value,affixes:parseConfigStats(configStats.value),passives:[],effects,procChance,cooldown,range,hidden,desc:`Configurado · ${configStats.value||'sin stats'}${skillIds.length?` · Habilidades: ${skillIds.map(id=>skillDefs[id]?.name||id).join(', ')}`:''}`}
}
function currentConfigPotionJson(){
 const rarity=configPotionTier.value,ilvl=potionTierLevel(rarity),hidden=!!document.getElementById('configPotionHidden')?.checked;
 const name=configPotionNombre.value.trim()||'Poción sin nombre',effects=JSON.parse(JSON.stringify(window.currentPotionEffectsDraft||[])),range=Number(document.getElementById('configPotionRange')?.value)||0;
 const desc=describePotionEffects({type:'potion',effects})||'Poción configurada.';
 return {type:'potion',name,slot:'consumable',rarity,label:tierDefs[rarity]?.label||rarity,itemLevel:ilvl,score:ilvl*8,icon:window.currentConfigPotionIconHex||'',iconShape:'vial',effects,range,skillIds:[],stats:'',affixes:[],passives:[],hidden,desc}
}

async function readDeflatedZipEntry(bytes){
 if(!('DecompressionStream' in window))throw new Error('Tu navegador no permite descomprimir ZIP. Extrae el ZIP e importa los JSON sueltos.');
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 return await new Response(stream).arrayBuffer()
}
function textFromBytes(bytes){return new TextDecoder('utf-8').decode(bytes)}
async function jsonTextsFromFile(file){
 const lower=(file.name||'').toLowerCase();
 if(lower.endsWith('.zip')||file.type==='application/zip'||file.type==='application/x-zip-compressed')return await jsonTextsFromZip(file);
 return [{name:file.name||'archivo.json',text:await file.text()}]
}
async function jsonTextsFromZip(file){
 const buf=await file.arrayBuffer(),view=new DataView(buf),bytes=new Uint8Array(buf),texts=[];
 for(let pos=0;pos<view.byteLength-30;){
  if(view.getUint32(pos,true)!==0x04034b50){pos++;continue}
  const method=view.getUint16(pos+8,true),compressedSize=view.getUint32(pos+18,true),fileNameLength=view.getUint16(pos+26,true),extraLength=view.getUint16(pos+28,true);
  const name=textFromBytes(bytes.slice(pos+30,pos+30+fileNameLength)),dataStart=pos+30+fileNameLength+extraLength,dataEnd=dataStart+compressedSize;
  if(!name.endsWith('/')&&name.toLowerCase().endsWith('.json')){
   let data=bytes.slice(dataStart,dataEnd);
   if(method===8)data=new Uint8Array(await readDeflatedZipEntry(data));
   else if(method!==0)throw new Error(`ZIP no soportado (${name} usa método ${method}).`);
   texts.push({name,text:textFromBytes(data)})
  }
  pos=Math.max(dataEnd,pos+30+fileNameLength+extraLength+compressedSize)
 }
 if(!texts.length)throw new Error('El ZIP no contiene archivos .json válidos.');
 return texts
}
async function parseImportedJsonFiles(files){
 const rows=[];
 for(const f of files){
  for(const entry of await jsonTextsFromFile(f)){
   const parsed=JSON.parse(entry.text);
   rows.push(...(Array.isArray(parsed)?parsed:[parsed]))
  }
 }
 return rows
}
async function postJsonRows(url,rows,{onProgress}={}){
 const saved=[];
 for(let i=0;i<rows.length;i++){
  onProgress?.(i+1,rows.length);
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(rows[i])});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||`No se pudo guardar el registro ${i+1}/${rows.length}`);
  saved.push(data)
 }
 return saved
}
async function saveConfigItems(items){const data=await postJsonRows('/api/config-items',items);await fetchConfigItems();return data}
async function updateConfigItem(id,item){const r=await fetch(`/api/config-items?id=${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...item,id,item_json:item})});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo actualizar');await fetchConfigItems();return data}
async function deleteConfigItem(id){const r=await fetch(`/api/config-items?id=${encodeURIComponent(id)}`,{method:'DELETE'});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo borrar');await fetchConfigItems();return data}
function skillNames(ids=[]){return ids.map(id=>skillDefs[id]?.name||id).join(', ')}
// skills_json on a config_class row overrides/extends skillDefs by id (adds
// new ones, replaces fields on existing ones); classSkillTrees is synthesized
// from the bag's `tier` field for any class without a hardcoded tree already
// (custom classes created purely in the editor). The engine always reads
// skillDefs/classSkillTrees directly elsewhere, so merging here is enough to
// make every other call site "read the DB first, fall back to the hardcoded
// system" for free.
const HARDCODED_CLASS_SKILL_TREE_IDS=new Set(Object.keys(classSkillTrees));
// A skills_json row saved before the buff/debuff add-or-multiply rework
// carries a buffStatCoef/debuffStatCoef written under the OLD percentage
// semantics (e.g. 0.15 meaning "+15%") but has no buffStatMode/debuffStatMode
// key at all, since that field didn't exist yet. Blindly merging it in would
// silently reintroduce the "buffs round down to +0" bug that motivated this
// fix - the stale coefficient wins over the already-corrected hardcoded
// default. Strip it so the merge falls back to the current hardcoded value.
function stripStaleCoefficients(override){
 const o={...override};
 if(o.buffStatCoef!=null&&!('buffStatMode' in override))delete o.buffStatCoef;
 if(o.debuffStatCoef!=null&&!('debuffStatMode' in override))delete o.debuffStatCoef;
 return o;
}
function applyClassSkillOverrides(){
 for(const row of configClasses){
  const bag=row.skills_json;if(!bag||typeof bag!=='object')continue;
  const classId=row.class_json?.classId||normalizeClassName(row.nombre);
  for(const [skillId,override] of Object.entries(bag))skillDefs[skillId]={...(skillDefs[skillId]||{}),...stripStaleCoefficients(override)};
  // classes without a hardcoded tree get theirs (re)synthesized every time,
  // so editing a custom class's skill tiers takes effect on the next load
  if(!HARDCODED_CLASS_SKILL_TREE_IDS.has(classId)){
   const tiers={I:[],II:[],III:[]};
   for(const [skillId,s] of Object.entries(bag))tiers[s.tier===3?'III':s.tier===2?'II':'I'].push(skillId);
   classSkillTrees[classId]=tiers;
  }
 }
}
// Advanced-mode character creation depends on config_class being loaded,
// but the class-choice screen can render before anything ever triggers
// this fetch (it's normally only pulled in when the admin Configuración
// screen opens). configClassesLoaded/configClassesFetchInFlight let
// renderClassChoices() self-heal: fetch once, dedupe concurrent callers,
// and tell "still loading" apart from "genuinely no rows yet".
async function fetchConfigClasses(){
 if(configClassesFetchInFlight)return configClassesFetchInFlight;
 configClassesFetchInFlight=(async()=>{
  try{const r=await fetch('/api/config-class');const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron cargar clases');configClasses=Array.isArray(data)?data:[];applyClassSkillOverrides();renderConfigClasses()}
  catch(e){const st=document.getElementById('configClassStatus')||document.getElementById('configStatus');if(st)st.textContent=`Error cargando config_class: ${e.message}`}
  // set the "loaded" flag before the self-healing render below, or a
  // genuinely-empty result would re-trigger the loading state forever
  // (renderClassChoices only re-fetches while configClassesLoaded is false)
  configClassesLoaded=true;configClassesFetchInFlight=null;
  renderClassChoices();
  renderTestClassChoices();
  if(configGatesLoaded)renderConfigGatesLists();
 })();
 return configClassesFetchInFlight;
}
function selectedGameClassId(){return configClassSelect?.value||selectedClass}
// ---- Class/skill editor (config_class, skills_json) ----------------------
// 'bleed'/'burn' are intentionally absent: any periodic-damage effect is
// authored as 'dot' now (they behaved identically to 'dot' anyway - same
// tick handling in tickEnemyStatuses - so the split tags only added
// confusion in this dropdown). Still recognized by the engine if an old
// save or a hand-written skills_json override still uses them.
const ALL_CLASS_EFFECTS=['ranged','shield','dash','debuff','aoe','heal','multihit','utility','ultimate','execute','buff','massive','root','pullRoot','rootBleed','bountyRoot','freeze','delayedFreeze','poison','dot','decayDot','echoDot','delayedPoison','drain','holyLeech','steal','stun','silence','age','wither','doomMark','mark','bountyMark','holyMark','shadowStrike','holyDash','leapBuff','hookBleed','combo','comboMark','markedExecute','bountyExecute','packExecute','pierce','lineShot','ricochet','chain','blinkChain','swapConfuse','teleportDecoy','teleportBuff','randomTeleport','freeTeleport','teleportShield','teleportClones','trap','rootZone','consecrate','stormTotem','areaDot','summon','summonTurret','summonHealer','summonTank','summonScanner','summonElite','multiSummon','clones','clone','cleanseHeal','bigHeal','regenHeal','survivalHeal','healShield','buffArmor','counter','bloodBuff','lifestealBuff','rampage','overcharge','fortress','holyShield','holyAvatar','randomBuff','luckBuff','sniperBuff','stealthShot','shapeShift','lichBuff','implantBuff','mechBuff','wisdomBuff','martyrBuff','oakBuff','resourceRegen','reflect','monkAvatar','tauntBuff','beastAvatar','cheatDeath','cheatDeathHeal','rewind'];
function slugifyClassName(name){return 'custom_'+String(name||'clase').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'')+'_'+Math.random().toString(36).slice(2,6)}
// The editable skill bag for a class: its own skills_json if it has one,
// else synthesized from the hardcoded classSkillTrees+skillDefs so editing
// an unmodified class starts from its real current data.
function classSkillBagFor(id){
 const row=configClassRowForId(id);
 if(row?.skills_json&&Object.keys(row.skills_json).length)return JSON.parse(JSON.stringify(row.skills_json));
 const tree=classSkillTrees[id];if(!tree)return {};
 const bag={};
 for(const [roman,ids] of Object.entries(tree)){const tierNum=roman==='III'?3:roman==='II'?2:1;for(const sid of ids)if(skillDefs[sid])bag[sid]={...skillDefs[sid],tier:tierNum}}
 return bag;
}
function renderClassSkillSelect(){
 const sel=document.getElementById('configClassSkillSelect');if(!sel)return;
 const bag=window.currentClassSkillsDraft||{};
 const ids=Object.keys(bag).sort((a,b)=>(bag[a].tier||1)-(bag[b].tier||1)||a.localeCompare(b));
 sel.innerHTML=ids.map(id=>`<option value="${id}">T${bag[id].tier||1} · ${bag[id].name||id}</option>`).join('')||'<option value="">Sin skills</option>';
 if(ids.length)loadSkillIntoForm(ids.includes(sel.value)?sel.value:ids[0]);
 renderClassSkillsSummaryTable();
}
// Short human tag for one stacked effect component, used by the class
// summary table (e.g. "Daño área", "HOT a uno mismo", "Root").
function effectSummaryTag(comp){
 const targetLabel={self:'a uno mismo',enemy:'a enemigo',area:'área',ally:'a aliado'}[comp.target]||'';
 const withTarget=base=>targetLabel?`${base} ${targetLabel}`:base;
 switch(comp.kind){
  case 'dmg':return withTarget('Daño');
  case 'dot':return `DOT (${({bleed:'sangrado',burn:'quemadura',poison:'veneno',dot:'genérico'})[comp.flavor||'dot']})`;
  case 'buff':return `Buff ${STAT_LABELS_ES[comp.stat]||comp.stat||''}`.trim();
  case 'debuff':return `Debuff ${STAT_LABELS_ES[comp.stat]||comp.stat||''}`.trim();
  case 'heal':return withTarget('Curación');
  case 'move':return comp.mode==='teleport'?'Teletransporte':'Dash';
  case 'cc':return ({stun:'Aturdir',freeze:'Congelar',silence:'Silenciar',root:'Root'})[comp.type]||'Control';
  case 'drain':return `Drenaje (${({hp:'Vida',mana:'Maná',stamina:'Stamina'})[comp.resource||'hp']})`;
  case 'aoe':return 'Daño área';
  case 'multihit':return `Multihit x${comp.hits||3}`;
  case 'mark':return 'Marca';
  case 'summon':{
   const et={damage:'daño',heal:'curación',root:'raíz',buff:'buff',debuff:'debuff'}[comp.effectType]||'daño';
   return `${comp.permanent?'Compañero (permanente)':'Invocación'} · ${et}${comp.stance==='passive'?' · pasivo':''}${comp.targetable===false?' · no atacable':''}${comp.hitByAoe===false?' · inmune a AOE':''}`;
  }
  case 'summonturret':{
   const et=comp.effectType||'damage';
   if(et==='heal')return 'Invocación-torreta (curación en área)';
   if(et==='buff')return `Invocación-torreta (buff ${STAT_LABELS_ES[comp.stat]||comp.stat||''})`.trim();
   if(et==='root')return 'Invocación-torreta (raíz)';
   if(et==='debuff')return `Invocación-torreta (debuff ${STAT_LABELS_ES[comp.stat]||comp.stat||''})`.trim();
   return `Invocación-torreta (daño ${comp.damageMode==='area'?'en área':'al más cercano'})`;
  }
  case 'utility':return 'Utilidad';
  case 'hot':return withTarget('HOT');
  case 'execute':return 'Ejecutar';
  case 'pullroot':return 'Atraer+Root';
  case 'counter':return 'Contraataque';
  case 'cheatdeath':return 'Desafiar muerte';
  case 'holyshield':return 'Escudo';
  case 'lineshot':return `Línea (perfora, alcance ${comp.range||6})`;
  case 'trap':return 'Trampa';
  case 'clones':{
   const et={damage:'daño',heal:'curación',root:'raíz',buff:'buff',debuff:'debuff'}[comp.effectType]||'daño';
   return `Clones x${comp.count||2} · ${et}`;
  }
  case 'linkdamage':return `Cadena x${(comp.jumps??3)+1} (-${comp.falloff??25}%/salto)`;
  case 'invisible':return `Invisibilidad ${comp.turns??2}T${comp.breakOnAttack!==false?' (se rompe al atacar)':''}`;
  case 'ascend':return `Ascensión (${comp.value??150}% coste${comp.resource&&comp.resource!=='any'?` de ${comp.resource==='mana'?'maná':'stamina'}`:''})${comp.allowSkills===false?' · sin skills':''}`;
  case 'transform':return `Transformación (${(comp.damagePct??0)>=0?'+':''}${comp.damagePct??0}% dmg, ${(comp.hpPct??0)>=0?'+':''}${comp.hpPct??0}% vida)${comp.allowSkills===false?' · sin skills':''}`;
  default:return effectKindLabel(comp.kind);
 }
}
const SKILL_TYPE_LABELS_ES={physical:'Físico',magic:'Mágico',utility:'Utilidad'};
function renderClassSkillsSummaryTable(){
 const wrap=document.getElementById('configClassSkillsSummaryTable');if(!wrap)return;
 const bag=window.currentClassSkillsDraft||{};
 const ids=Object.keys(bag).sort((a,b)=>(bag[a].tier||1)-(bag[b].tier||1)||(bag[a].name||a).localeCompare(bag[b].name||b));
 if(!ids.length){wrap.innerHTML='<p class="small">Sin skills en esta clase todavía.</p>';return}
 const rows=ids.map(id=>{
  const s=bag[id];
  const effects=(s.effects&&s.effects.length)?s.effects:legacyEffectsFromSkill(s);
  const effectsHtml=effects.length?effects.map(c=>`<span class="summaryEffectTag">${effectSummaryTag(c)}</span>`).join(''):'<span class="small">Sin efectos</span>';
  const resourceLabel=s.resource==='mana'?'Maná':'Stamina';
  return `<tr><td>T${s.tier||1} · ${s.name||id}</td><td>${SKILL_TYPE_LABELS_ES[s.type]||s.type||''}</td><td class="summaryEffectsCell">${effectsHtml}</td><td>${s.cost??0} ${resourceLabel} · ${s.apCost??0} PA</td></tr>`;
 }).join('');
 wrap.innerHTML=`<table class="configSummaryTable"><thead><tr><th>Nombre skill</th><th>Tipo</th><th>Efectos apilables</th><th>Coste y PA</th></tr></thead><tbody>${rows}</tbody></table>`;
}
// ---- Composable effects list editor (admin) --------------------------------
const STAT_KEYS_CORE=['strength','vitality','agility','luck','intelligence','wisdom'];
const STAT_LABELS_ES={strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría',armor:'Armadura',damage:'Daño',ap:'PA',dodge:'Esquiva',critChance:'Crítico',blockChance:'Bloqueo',manaRegen:'Regen. maná',staminaRegen:'Regen. stamina'};
function statOptionsHtml(selected,extra=[]){return [...STAT_KEYS_CORE,...extra].map(s=>`<option value="${s}" ${selected===s?'selected':''}>${STAT_LABELS_ES[s]||s}</option>`).join('')}
function defaultComponentFor(kind){
 const base={kind};
 if(kind==='dmg')return {...base,target:'enemy',dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1};
 if(kind==='dot')return {...base,target:'enemy',dotDice:1,dotDie:6,dotStat:'strength',dotStatMode:'add',dotStatCoef:.5,turns:4,flavor:'dot'};
 if(kind==='buff')return {...base,target:'self',stat:'strength',mode:'add',value:5,turns:6};
 if(kind==='debuff')return {...base,target:'enemy',stat:'strength',mode:'add',value:2,turns:3};
 if(kind==='heal')return {...base,target:'self',resource:'hp',dmgDice:2,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:1};
 if(kind==='move')return {...base,mode:'dash',range:3};
 if(kind==='cc')return {...base,target:'enemy',type:'stun',turns:2};
 if(kind==='drain')return {...base,target:'enemy',resource:'hp',dmgDice:2,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1};
 if(kind==='aoe')return {...base,dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,range:2};
 if(kind==='multihit')return {...base,target:'enemy',hits:3,dmgDice:1,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:.6};
 if(kind==='mark')return {...base,target:'enemy',value:25,turns:4};
 if(kind==='summon')return {...base,target:'area',hp:20,turns:8,ap:10,effectType:'damage',dmgDice:1,dmgDie:6,dmgStat:'',dmgStatMode:'add',dmgStatCoef:1,effectTurns:2,stat:'strength',mode:'add',value:5,iconImage:'',permanent:false,commandResource:'mana',commandCost:0,reviveResource:'hp',reviveAmount:20,targetable:true,hitByAoe:true,stance:'aggressive'};
 if(kind==='summonturret')return {...base,target:'area',hp:16,turns:8,ap:10,range:7,effectType:'damage',damageMode:'nearest',dmgDice:1,dmgDie:6,dmgStat:'',dmgStatMode:'add',dmgStatCoef:1,stat:'strength',mode:'add',value:5,effectTurns:2,iconImage:''};
 if(kind==='lineshot')return {...base,dmgDice:2,dmgDie:6,dmgStat:'agility',dmgStatMode:'add',dmgStatCoef:1,range:6};
 if(kind==='trap')return {...base,target:'area',dmgDice:2,dmgDie:6,dmgStat:'',dmgStatMode:'add',dmgStatCoef:1,turns:8,range:1};
 if(kind==='clones')return {...base,target:'area',count:2,hp:14,turns:8,ap:10,effectType:'damage',dmgDice:1,dmgDie:6,dmgStat:'',dmgStatMode:'add',dmgStatCoef:1,effectTurns:2,stat:'strength',mode:'add',value:5,iconImage:''};
 if(kind==='linkdamage')return {...base,dmgDice:2,dmgDie:6,dmgStat:'intelligence',dmgStatMode:'add',dmgStatCoef:1,jumps:3,falloff:25,range:4};
 if(kind==='utility')return {...base,mode:'reveal',value:10};
 if(kind==='hot')return {...base,target:'self',resource:'hp',dmgDice:1,dmgDie:6,dmgStat:'wisdom',dmgStatMode:'add',dmgStatCoef:.5,turns:4};
 if(kind==='execute')return {...base,target:'enemy',dmgDice:2,dmgDie:6,dmgStat:'strength',dmgStatMode:'add',dmgStatCoef:1,threshold:35,execMultiplier:2.5};
 if(kind==='pullroot')return {...base,target:'enemy',turns:2};
 if(kind==='counter')return {...base,shield:10,dmgDice:1,dmgDie:8,dmgStat:'',dmgStatMode:'add',dmgStatCoef:1,turns:5};
 if(kind==='cheatdeath')return {...base,turns:5};
 if(kind==='holyshield')return {...base,target:'self',value:20,stat:'',mode:'add',statCoef:1,turns:0};
 if(kind==='invisible')return {...base,turns:2,breakOnAttack:true};
 if(kind==='ascend')return {...base,resource:'any',value:150,turns:6,allowSkills:true,iconImage:''};
 if(kind==='transform')return {...base,turns:8,damagePct:0,armorPct:0,hpPct:0,allowSkills:true,iconImage:''};
 return base;
}
function effectComponentTargetOptions(kind){
 if(kind==='dmg')return [{v:'enemy',l:'Enemigo'},{v:'area',l:'Área'},{v:'self',l:'A ti mismo (daño propio)'}];
 if(kind==='dot'||kind==='cc'||kind==='drain'||kind==='mark'||kind==='execute'||kind==='pullroot')return [{v:'enemy',l:'Enemigo'},{v:'area',l:'Área'}];
 if(kind==='heal')return [{v:'self',l:'A ti mismo'},{v:'ally',l:'Aliado (multijugador)'},{v:'area',l:'Área (aliados cercanos)'}];
 if(kind==='multihit')return [{v:'enemy',l:'Enemigo'}];
 if(kind==='hot')return [{v:'self',l:'A ti mismo'},{v:'area',l:'Área (aliados cercanos)'}];
 return null
}
// The 'skill' summon effectType doesn't reference an existing skillDefs
// entry - it carries its own tiny stackable-effects list (skillName +
// skillEffects[]), authored inline the same way the main skill's own
// `effects` are, just restricted to the kinds that make sense as something
// an autonomous companion fires at a single target it's already fighting
// (no move/summon/self-only-utility kinds - those don't apply to an
// invocation's own sub-skill).
const COMPANION_SKILL_EFFECT_KINDS=['dmg','dot','debuff','cc','buff','heal','drain','mark'];
// Same dice-block markup as effectDiceFieldsHtml, but addressed with
// data-sub-parent/data-sub-idx/data-sub-field instead of data-effect-idx/
// data-effect-field, so its change events route to a component's own
// nested `skillEffects[j]` (see renderSkillEffectsList's sub-effect wiring)
// instead of colliding with the top-level effects-list handler.
function subEffectDiceFieldsHtml(comp,pIdx,j,prefix='dmg'){
 const f=k=>`${prefix}${k}`,dice=comp[f('Dice')],die=comp[f('Die')],stat=comp[f('Stat')],mode=comp[f('StatMode')],coef=comp[f('StatCoef')];
 const attr=field=>`data-sub-parent="${pIdx}" data-sub-idx="${j}" data-sub-field="${field}"`;
 return `<label>Nº de dados <input type="number" min="0" value="${dice||0}" ${attr(f('Dice'))}></label>
 <label>Dado <select ${attr(f('Die'))}>${[4,6,8,10,12,20].map(n=>`<option value="${n}" ${Number(die)===n?'selected':''}>d${n}</option>`).join('')}</select></label>
 <label>Stat <select ${attr(f('Stat'))}><option value="">Automática</option>${statOptionsHtml(stat)}</select></label>
 <label>Modo <select ${attr(f('StatMode'))}><option value="add" ${mode!=='mult'?'selected':''}>Sumatorio</option><option value="mult" ${mode==='mult'?'selected':''}>Multiplicador</option></select></label>
 <label>Coeficiente <input type="number" step="0.1" value="${coef??1}" ${attr(f('StatCoef'))}></label>`;
}
function subEffectFieldsHtml(comp,pIdx,j){
 const attr=field=>`data-sub-parent="${pIdx}" data-sub-idx="${j}" data-sub-field="${field}"`;
 if(comp.kind==='dmg'||comp.kind==='heal')return subEffectDiceFieldsHtml(comp,pIdx,j);
 if(comp.kind==='drain'){
  const resource=comp.resource||'hp';
  return `${subEffectDiceFieldsHtml(comp,pIdx,j)}<label>Recurso que absorbe la invocación <select ${attr('resource')}><option value="hp" ${resource==='hp'?'selected':''}>Vida (HP)</option><option value="mana" ${resource==='mana'?'selected':''}>Maná</option><option value="stamina" ${resource==='stamina'?'selected':''}>Stamina</option></select></label>`;
 }
 if(comp.kind==='dot')return `${subEffectDiceFieldsHtml(comp,pIdx,j,'dot')}<label>Turnos <input type="number" min="1" value="${comp.turns??4}" ${attr('turns')}></label>`;
 if(comp.kind==='buff'||comp.kind==='debuff')return `<label>Stat <select ${attr('stat')}>${statOptionsHtml(comp.stat,comp.kind==='buff'?['armor','damage']:['damage'])}</select></label><label>Modo <select ${attr('mode')}><option value="add" ${comp.mode!=='mult'?'selected':''}>Sumatorio (+N)</option><option value="mult" ${comp.mode==='mult'?'selected':''}>Multiplicador (×N)</option></select></label><label>Valor <input type="number" step="0.1" value="${comp.value??(comp.kind==='buff'?5:2)}" ${attr('value')}></label><label>Turnos <input type="number" min="1" value="${comp.turns??(comp.kind==='buff'?6:3)}" ${attr('turns')}></label>`;
 if(comp.kind==='cc')return `<label>Tipo <select ${attr('type')}><option value="stun" ${comp.type==='stun'?'selected':''}>Aturdir</option><option value="freeze" ${comp.type==='freeze'?'selected':''}>Congelar</option><option value="silence" ${comp.type==='silence'?'selected':''}>Silenciar</option><option value="root" ${comp.type==='root'?'selected':''}>Enraizar</option></select></label><label>Turnos <input type="number" min="1" value="${comp.turns??2}" ${attr('turns')}></label>`;
 if(comp.kind==='mark')return `<label>% de daño adicional recibido <input type="number" min="1" value="${comp.value??25}" ${attr('value')}></label><label>Turnos <input type="number" min="1" value="${comp.turns??4}" ${attr('turns')}></label>`;
 return '';
}
function subEffectCardHtml(comp,pIdx,j){
 return `<details class="effectCard" open><summary class="effectCardHead"><b>${j+1}. ${effectKindLabel(comp.kind)}</b><button type="button" data-remove-sub-effect data-sub-parent="${pIdx}" data-sub-idx="${j}">Quitar</button></summary><div class="configForm">${subEffectFieldsHtml(comp,pIdx,j)}</div></details>`;
}
// Inline mini stackable-effects editor rendered inside a summon/summonturret/
// clones card whenever its effectType is "skill" - just a name plus its own
// effects[] built from COMPANION_SKILL_EFFECT_KINDS, not a picker referencing
// an existing skillDefs entry.
function subEffectsListHtml(parentComp,pIdx){
 const list=parentComp.skillEffects||[];
 const kindOptions=COMPANION_SKILL_EFFECT_KINDS.map(k=>`<option value="${k}">${effectKindLabel(k)}</option>`).join('');
 return `<div class="configForm subEffectsWrap" style="grid-column:1/-1">
  <label style="grid-column:1/-1">Nombre de la habilidad <input type="text" value="${parentComp.skillName||''}" placeholder="Ej: Zarpazo" data-effect-idx="${pIdx}" data-effect-field="skillName"></label>
  <div class="effectsList" style="grid-column:1/-1">${list.map((c,j)=>subEffectCardHtml(c,pIdx,j)).join('')||'<p class="small">Sin efectos añadidos todavía a esta habilidad.</p>'}</div>
  <label>Añadir efecto <select data-sub-add-kind data-sub-parent="${pIdx}">${kindOptions}</select></label>
  <button type="button" data-add-sub-effect="${pIdx}">Añadir efecto a la habilidad</button>
 </div>`;
}
function effectDiceFieldsHtml(comp,i,prefix='dmg'){
 const f=k=>`${prefix}${k}`,dice=comp[f('Dice')],die=comp[f('Die')],stat=comp[f('Stat')],mode=comp[f('StatMode')],coef=comp[f('StatCoef')];
 return `<label>Nº de dados <input type="number" min="0" value="${dice||0}" data-effect-idx="${i}" data-effect-field="${f('Dice')}"></label>
 <label>Dado <select data-effect-idx="${i}" data-effect-field="${f('Die')}">${[4,6,8,10,12,20].map(n=>`<option value="${n}" ${Number(die)===n?'selected':''}>d${n}</option>`).join('')}</select></label>
 <label>Stat <select data-effect-idx="${i}" data-effect-field="${f('Stat')}"><option value="">Automática</option>${statOptionsHtml(stat)}</select></label>
 <label>Modo <select data-effect-idx="${i}" data-effect-field="${f('StatMode')}"><option value="add" ${mode!=='mult'?'selected':''}>Sumatorio</option><option value="mult" ${mode==='mult'?'selected':''}>Multiplicador</option></select></label>
 <label>Coeficiente <input type="number" step="0.1" value="${coef??1}" data-effect-idx="${i}" data-effect-field="${f('StatCoef')}"></label>`
}
function effectComponentCardHtml(comp,i){
 const targetOpts=effectComponentTargetOptions(comp.kind);
 const targetHtml=targetOpts?`<label>Objetivo <select data-effect-idx="${i}" data-effect-field="target">${targetOpts.map(o=>`<option value="${o.v}" ${comp.target===o.v?'selected':''}>${o.l}</option>`).join('')}</select></label>`:'';
 let fields='';
 if(comp.kind==='dmg')fields=effectDiceFieldsHtml(comp,i);
 else if(comp.kind==='heal')fields=`<label>Recurso curado <select data-effect-idx="${i}" data-effect-field="resource"><option value="hp" ${!comp.resource||comp.resource==='hp'?'selected':''}>Vida</option><option value="mana" ${comp.resource==='mana'?'selected':''}>Maná</option><option value="stamina" ${comp.resource==='stamina'?'selected':''}>Stamina</option></select></label>${effectDiceFieldsHtml(comp,i)}`;
 else if(comp.kind==='drain'){
  const resource=comp.resource||'hp';
  fields=`${effectDiceFieldsHtml(comp,i)}<label>Recurso que absorbes <select data-effect-idx="${i}" data-effect-field="resource"><option value="hp" ${resource==='hp'?'selected':''}>Vida (HP)</option><option value="mana" ${resource==='mana'?'selected':''}>Maná</option><option value="stamina" ${resource==='stamina'?'selected':''}>Stamina</option></select></label><span class="small">El objetivo pierde vida por el golpe; tú ganas el recurso elegido (no hace falta que coincida con el coste de la skill).</span>`;
 }
 else if(comp.kind==='dot')fields=`${effectDiceFieldsHtml(comp,i,'dot')}<label>Turnos <input type="number" min="1" value="${comp.turns??4}" data-effect-idx="${i}" data-effect-field="turns"></label><label>Etiqueta visual <select data-effect-idx="${i}" data-effect-field="flavor"><option value="dot" ${comp.flavor==='dot'?'selected':''}>Genérico</option><option value="bleed" ${comp.flavor==='bleed'?'selected':''}>Sangrado</option><option value="burn" ${comp.flavor==='burn'?'selected':''}>Quemadura</option><option value="poison" ${comp.flavor==='poison'?'selected':''}>Veneno</option></select></label>`;
 else if(comp.kind==='buff'||comp.kind==='debuff')fields=`<label>Stat <select data-effect-idx="${i}" data-effect-field="stat">${statOptionsHtml(comp.stat,comp.kind==='buff'?['armor','damage','ap','dodge','critChance','blockChance','manaRegen','staminaRegen']:['damage','ap'])}</select></label><label>Modo <select data-effect-idx="${i}" data-effect-field="mode"><option value="add" ${comp.mode!=='mult'?'selected':''}>Sumatorio (+N)</option><option value="mult" ${comp.mode==='mult'?'selected':''}>Multiplicador (×N)</option></select></label><label>Valor <input type="number" step="0.1" value="${comp.value??(comp.kind==='buff'?5:2)}" data-effect-idx="${i}" data-effect-field="value"></label><label>Turnos <input type="number" min="1" value="${comp.turns??(comp.kind==='buff'?6:3)}" data-effect-idx="${i}" data-effect-field="turns"></label>${comp.kind==='debuff'&&comp.stat==='ap'?'<span class="small">En modo Sumatorio el valor son puntos porcentuales de PA (p.ej. 15 = -15% PA).</span>':''}${comp.kind==='buff'&&['dodge','critChance','blockChance'].includes(comp.stat)?'<span class="small">Solo en modo Sumatorio: el valor son puntos porcentuales (p.ej. 10 = +10%).</span>':''}`;
 else if(comp.kind==='move')fields=`<label>Tipo <select data-effect-idx="${i}" data-effect-field="mode"><option value="dash" ${comp.mode!=='teleport'?'selected':''}>Dash (avanza y golpea)</option><option value="teleport" ${comp.mode==='teleport'?'selected':''}>Teletransporte</option></select></label><label>Alcance (casillas) <input type="number" min="1" value="${comp.range||3}" data-effect-idx="${i}" data-effect-field="range"></label>`;
 else if(comp.kind==='cc')fields=`<label>Tipo <select data-effect-idx="${i}" data-effect-field="type"><option value="stun" ${comp.type==='stun'?'selected':''}>Aturdir</option><option value="freeze" ${comp.type==='freeze'?'selected':''}>Congelar</option><option value="silence" ${comp.type==='silence'?'selected':''}>Silenciar</option><option value="root" ${comp.type==='root'?'selected':''}>Enraizar</option></select></label><label>Turnos <input type="number" min="1" value="${comp.turns??2}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='aoe')fields=`${effectDiceFieldsHtml(comp,i)}<label>Radio de área (casillas) <input type="number" min="1" value="${comp.range??2}" data-effect-idx="${i}" data-effect-field="range"></label>`;
 else if(comp.kind==='multihit')fields=`<label>Nº de impactos <input type="number" min="1" value="${comp.hits??3}" data-effect-idx="${i}" data-effect-field="hits"></label>${effectDiceFieldsHtml(comp,i)}`;
 else if(comp.kind==='mark')fields=`<label>% de daño adicional recibido <input type="number" min="1" value="${comp.value??25}" data-effect-idx="${i}" data-effect-field="value"></label><label>Turnos <input type="number" min="1" value="${comp.turns??4}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='summon'){
  const effectType=comp.effectType||'damage',permanent=!!comp.permanent;
  fields=`<label>HP de la invocación <input type="number" min="1" value="${comp.hp??20}" data-effect-idx="${i}" data-effect-field="hp"></label>
  <label>STAT reservado <select data-effect-idx="${i}" data-effect-field="reserveResource"><option value="mana" ${(!comp.reserveResource||comp.reserveResource==='mana')?'selected':''}>Maná</option><option value="stamina" ${comp.reserveResource==='stamina'?'selected':''}>Stamina</option><option value="hp" ${comp.reserveResource==='hp'?'selected':''}>Vida</option></select></label>
  <label>Reserva (%) <input type="number" min="1" max="100" value="${comp.reservePct??20}" data-effect-idx="${i}" data-effect-field="reservePct"></label>
  <p class="small">Las invocaciones quedan vinculadas hasta desinvocarlas desde la pestaña Compañeros.</p>
  ${!permanent?`<label>Turnos de vida <input type="number" min="1" value="${comp.turns??8}" data-effect-idx="${i}" data-effect-field="turns"></label>
  <label>PA de la invocación (cada 10 = 1 acción/turno) <input type="number" min="10" step="10" value="${comp.ap??10}" data-effect-idx="${i}" data-effect-field="ap"></label>`:`<div class="configForm">
   <label>Recurso de uso del compañero <select data-effect-idx="${i}" data-effect-field="commandResource"><option value="mana" ${(!comp.commandResource||comp.commandResource==='mana')?'selected':''}>Maná</option><option value="stamina" ${comp.commandResource==='stamina'?'selected':''}>Stamina</option></select></label>
   <label>Coste de uso del compañero <input type="number" min="0" value="${comp.commandCost??0}" data-effect-idx="${i}" data-effect-field="commandCost"></label>
   <p class="small">Un compañero permanente ya no lucha por su cuenta: solo te sigue y es invulnerable. Mientras esté vivo, su misma skill se convierte en el botón para ordenarle atacar/curar/usar su habilidad (sin gastar tu PA); este es el coste de recurso que pagas cada vez que le das esa orden.</p>
   <label>Recurso para revivirlo <select data-effect-idx="${i}" data-effect-field="reviveResource"><option value="hp" ${(!comp.reviveResource||comp.reviveResource==='hp')?'selected':''}>Vida (HP)</option><option value="stamina" ${comp.reviveResource==='stamina'?'selected':''}>Stamina</option><option value="mana" ${comp.reviveResource==='mana'?'selected':''}>Maná</option></select></label>
   <label>Cantidad para revivirlo <input type="number" min="1" value="${comp.reviveAmount??20}" data-effect-idx="${i}" data-effect-field="reviveAmount"></label>
   <p class="small">Estos dos últimos campos ya no deberían llegar a usarse (el compañero es invulnerable), pero se mantienen como red de seguridad.</p>
  </div>`}
  <label>Efecto de la invocación <select data-effect-idx="${i}" data-effect-field="effectType">
   <option value="damage" ${effectType==='damage'?'selected':''}>Daño (ataca al enemigo más cercano)</option>
   <option value="skill" ${effectType==='skill'?'selected':''}>Skill (habilidad propia configurable, efectos apilables)</option>
   <option value="heal" ${effectType==='heal'?'selected':''}>Curación (te cura cada acción)</option>
   <option value="root" ${effectType==='root'?'selected':''}>Raíz (enraíza al enemigo más cercano)</option>
   <option value="buff" ${effectType==='buff'?'selected':''}>Buff (te da un buff mientras esté viva)</option>
   <option value="debuff" ${effectType==='debuff'?'selected':''}>Debuff (empeora al enemigo más cercano)</option>
  </select></label>
  ${['damage','skill'].includes(effectType)?`<label>Alcance (casillas, 0 o vacío = cuerpo a cuerpo) <input type="number" min="0" value="${comp.range??0}" data-effect-idx="${i}" data-effect-field="range"></label>`:''}
  ${effectType==='skill'?subEffectsListHtml(comp,i):''}
  ${effectType==='root'?`<label>Turnos de raíz por acción <input type="number" min="1" value="${comp.effectTurns??2}" data-effect-idx="${i}" data-effect-field="effectTurns"></label>`:''}
  ${effectType==='buff'?`<label>Stat <select data-effect-idx="${i}" data-effect-field="stat">${statOptionsHtml(comp.stat,['armor','damage','ap'])}</select></label>
   <label>Modo <select data-effect-idx="${i}" data-effect-field="mode"><option value="add" ${comp.mode!=='mult'?'selected':''}>Sumatorio (+N)</option><option value="mult" ${comp.mode==='mult'?'selected':''}>Multiplicador (×N)</option></select></label>
   <label>Valor <input type="number" step="0.1" value="${comp.value??5}" data-effect-idx="${i}" data-effect-field="value"></label>
   <span class="small">El buff se mantiene mientras la invocación siga viva.</span>`:''}
  ${effectType==='debuff'?`<label>Stat <select data-effect-idx="${i}" data-effect-field="stat">${statOptionsHtml(comp.stat,['damage','ap'])}</select></label>
   <label>Modo <select data-effect-idx="${i}" data-effect-field="mode"><option value="add" ${comp.mode!=='mult'?'selected':''}>Sumatorio (+N)</option><option value="mult" ${comp.mode==='mult'?'selected':''}>Multiplicador (×N)</option></select></label>
   <label>Valor <input type="number" step="0.1" value="${comp.value??2}" data-effect-idx="${i}" data-effect-field="value"></label>
   <label>Turnos de debuff por acción <input type="number" min="1" value="${comp.effectTurns??2}" data-effect-idx="${i}" data-effect-field="effectTurns"></label>`:''}
  ${['damage','heal'].includes(effectType)?effectDiceFieldsHtml(comp,i):''}
  <label><input type="checkbox" data-effect-idx="${i}" data-effect-field="targetable" ${comp.targetable!==false?'checked':''}> Compañero objeto de ataques (los enemigos pueden elegirlo como objetivo; nunca en el mismo turno en que aparece)</label>
  <label><input type="checkbox" data-effect-idx="${i}" data-effect-field="hitByAoe" ${comp.hitByAoe!==false?'checked':''}> Recibe daño de habilidades de área/masivas enemigas (si se desmarca, sigue siendo vulnerable a ataques normales)</label>
  <label>Comportamiento <select data-effect-idx="${i}" data-effect-field="stance">
   <option value="aggressive" ${comp.stance!=='passive'?'selected':''}>Agresivo (ataca si hay enemigos; si no, te sigue)</option>
   <option value="passive" ${comp.stance==='passive'?'selected':''}>Pasivo (nunca ataca, solo te sigue)</option>
  </select></label>
  ${summonIconRowHtml(comp,i)}`;
 }
 else if(comp.kind==='summonturret'){
  const effectType=comp.effectType||'damage',damageMode=comp.damageMode||'nearest';
  fields=`<label>HP de la invocación <input type="number" min="1" value="${comp.hp??16}" data-effect-idx="${i}" data-effect-field="hp"></label>
  <label>STAT reservado <select data-effect-idx="${i}" data-effect-field="reserveResource"><option value="mana" ${(!comp.reserveResource||comp.reserveResource==='mana')?'selected':''}>Maná</option><option value="stamina" ${comp.reserveResource==='stamina'?'selected':''}>Stamina</option><option value="hp" ${comp.reserveResource==='hp'?'selected':''}>Vida</option></select></label>
  <label>Reserva (%) <input type="number" min="1" max="100" value="${comp.reservePct??20}" data-effect-idx="${i}" data-effect-field="reservePct"></label>
  <label>Turnos de vida <input type="number" min="1" value="${comp.turns??8}" data-effect-idx="${i}" data-effect-field="turns"></label>
  <label>PA de la invocación (cada 10 = 1 acción/turno) <input type="number" min="10" step="10" value="${comp.ap??10}" data-effect-idx="${i}" data-effect-field="ap"></label>
  <label>Tipo de torreta <select data-effect-idx="${i}" data-effect-field="effectType">
   <option value="damage" ${effectType==='damage'?'selected':''}>Daño</option>
   <option value="skill" ${effectType==='skill'?'selected':''}>Skill (habilidad propia configurable, efectos apilables)</option>
   <option value="heal" ${effectType==='heal'?'selected':''}>Curación</option>
   <option value="buff" ${effectType==='buff'?'selected':''}>Buff</option>
   <option value="root" ${effectType==='root'?'selected':''}>Raíz (enraíza al enemigo más cercano)</option>
   <option value="debuff" ${effectType==='debuff'?'selected':''}>Debuff (empeora al enemigo más cercano)</option>
  </select></label>
  ${effectType==='damage'?`<label>Objetivo del daño <select data-effect-idx="${i}" data-effect-field="damageMode">
    <option value="nearest" ${damageMode!=='area'?'selected':''}>Enemigo más cercano</option>
    <option value="area" ${damageMode==='area'?'selected':''}>Área alrededor de la torreta</option>
   </select></label>
   <label>${damageMode==='area'?'Radio de área (casillas)':'Alcance de detección (casillas)'} <input type="number" min="1" value="${comp.range??7}" data-effect-idx="${i}" data-effect-field="range"></label>
   ${effectDiceFieldsHtml(comp,i)}`:''}
  ${effectType==='skill'?`<label>Alcance de detección (casillas) <input type="number" min="1" value="${comp.range??7}" data-effect-idx="${i}" data-effect-field="range"></label>
   ${subEffectsListHtml(comp,i)}`:''}
  ${effectType==='heal'?`<label>Radio de área (casillas) <input type="number" min="1" value="${comp.range??3}" data-effect-idx="${i}" data-effect-field="range"></label>
   ${effectDiceFieldsHtml(comp,i)}
   <span class="small">Cura a ti y a tus invocaciones dentro del radio, cada turno que la torreta siga viva.</span>`:''}
  ${effectType==='buff'?`<label>Stat <select data-effect-idx="${i}" data-effect-field="stat">${statOptionsHtml(comp.stat,['armor','damage','ap'])}</select></label>
   <label>Modo <select data-effect-idx="${i}" data-effect-field="mode"><option value="add" ${comp.mode!=='mult'?'selected':''}>Sumatorio (+N)</option><option value="mult" ${comp.mode==='mult'?'selected':''}>Multiplicador (×N)</option></select></label>
   <label>Valor <input type="number" step="0.1" value="${comp.value??5}" data-effect-idx="${i}" data-effect-field="value"></label>
   <span class="small">El buff se mantiene mientras la torreta siga viva.</span>`:''}
  ${effectType==='root'?`<label>Alcance de detección (casillas) <input type="number" min="1" value="${comp.range??7}" data-effect-idx="${i}" data-effect-field="range"></label>
   <label>Turnos de raíz por acción <input type="number" min="1" value="${comp.effectTurns??2}" data-effect-idx="${i}" data-effect-field="effectTurns"></label>`:''}
  ${effectType==='debuff'?`<label>Alcance de detección (casillas) <input type="number" min="1" value="${comp.range??7}" data-effect-idx="${i}" data-effect-field="range"></label>
   <label>Stat <select data-effect-idx="${i}" data-effect-field="stat">${statOptionsHtml(comp.stat)}</select></label>
   <label>Modo <select data-effect-idx="${i}" data-effect-field="mode"><option value="add" ${comp.mode!=='mult'?'selected':''}>Sumatorio (+N)</option><option value="mult" ${comp.mode==='mult'?'selected':''}>Multiplicador (×N)</option></select></label>
   <label>Valor <input type="number" step="0.1" value="${comp.value??2}" data-effect-idx="${i}" data-effect-field="value"></label>
   <label>Turnos de debuff por acción <input type="number" min="1" value="${comp.effectTurns??2}" data-effect-idx="${i}" data-effect-field="effectTurns"></label>`:''}
  ${summonIconRowHtml(comp,i)}`;
 }
 else if(comp.kind==='lineshot'){
  fields=`<p class="small">Dispara en línea recta hacia el enemigo más cercano (o el que hayas seleccionado) y perfora, golpeando a todos los enemigos que encuentre en esa línea hasta el alcance indicado o hasta chocar con un muro.</p>${effectDiceFieldsHtml(comp,i)}<label>Alcance de la línea (casillas) <input type="number" min="1" value="${comp.range??6}" data-effect-idx="${i}" data-effect-field="range"></label>`;
 }
 else if(comp.kind==='trap'){
  fields=`<p class="small">Deja una trampa invisible en el suelo (en el punto objetivo, o a tus pies si la skill no pide objetivo). Se activa sola en cuanto un enemigo entra en su radio y desaparece tras el golpe o al agotar los turnos.</p>${effectDiceFieldsHtml(comp,i)}<label>Turnos activa antes de desaparecer <input type="number" min="1" value="${comp.turns??8}" data-effect-idx="${i}" data-effect-field="turns"></label><label>Radio de activación (casillas) <input type="number" min="1" value="${comp.range??1}" data-effect-idx="${i}" data-effect-field="range"></label>`;
 }
 else if(comp.kind==='clones'){
  const cloneEffectType=comp.effectType||'damage';
  fields=`<label>Nº de clones <input type="number" min="1" max="4" value="${comp.count??2}" data-effect-idx="${i}" data-effect-field="count"></label>
  <label>HP de cada clon <input type="number" min="1" value="${comp.hp??14}" data-effect-idx="${i}" data-effect-field="hp"></label>
  <label>STAT reservado por clon <select data-effect-idx="${i}" data-effect-field="reserveResource"><option value="mana" ${comp.reserveResource==='mana'?'selected':''}>Maná</option><option value="stamina" ${(!comp.reserveResource||comp.reserveResource==='stamina')?'selected':''}>Stamina</option><option value="hp" ${comp.reserveResource==='hp'?'selected':''}>Vida</option></select></label>
  <label>Reserva por clon (%) <input type="number" min="1" max="100" value="${comp.reservePct??10}" data-effect-idx="${i}" data-effect-field="reservePct"></label>
  <label>Turnos de vida <input type="number" min="1" value="${comp.turns??8}" data-effect-idx="${i}" data-effect-field="turns"></label>
  <label>PA del clon (cada 10 = 1 acción/turno) <input type="number" min="10" step="10" value="${comp.ap??10}" data-effect-idx="${i}" data-effect-field="ap"></label>
  <label>Efecto de cada clon <select data-effect-idx="${i}" data-effect-field="effectType">
   <option value="damage" ${cloneEffectType==='damage'?'selected':''}>Daño (ataca al enemigo más cercano)</option>
   <option value="skill" ${cloneEffectType==='skill'?'selected':''}>Skill (habilidad propia configurable, efectos apilables)</option>
   <option value="heal" ${cloneEffectType==='heal'?'selected':''}>Curación (te cura cada acción)</option>
   <option value="root" ${cloneEffectType==='root'?'selected':''}>Raíz (enraíza al enemigo más cercano)</option>
   <option value="buff" ${cloneEffectType==='buff'?'selected':''}>Buff (te da un buff mientras viva)</option>
   <option value="debuff" ${cloneEffectType==='debuff'?'selected':''}>Debuff (empeora al enemigo más cercano)</option>
  </select></label>
  ${['damage','skill'].includes(cloneEffectType)?`<label>Alcance (casillas, 0 o vacío = cuerpo a cuerpo) <input type="number" min="0" value="${comp.range??0}" data-effect-idx="${i}" data-effect-field="range"></label>`:''}
  ${cloneEffectType==='skill'?subEffectsListHtml(comp,i):''}
  ${cloneEffectType==='root'?`<label>Turnos de raíz por acción <input type="number" min="1" value="${comp.effectTurns??2}" data-effect-idx="${i}" data-effect-field="effectTurns"></label>`:''}
  ${cloneEffectType==='buff'?`<label>Stat <select data-effect-idx="${i}" data-effect-field="stat">${statOptionsHtml(comp.stat,['armor','damage','ap'])}</select></label>
   <label>Modo <select data-effect-idx="${i}" data-effect-field="mode"><option value="add" ${comp.mode!=='mult'?'selected':''}>Sumatorio (+N)</option><option value="mult" ${comp.mode==='mult'?'selected':''}>Multiplicador (×N)</option></select></label>
   <label>Valor <input type="number" step="0.1" value="${comp.value??5}" data-effect-idx="${i}" data-effect-field="value"></label>
   <span class="small">Cada clon suma su propio buff mientras viva.</span>`:''}
  ${cloneEffectType==='debuff'?`<label>Stat <select data-effect-idx="${i}" data-effect-field="stat">${statOptionsHtml(comp.stat,['damage','ap'])}</select></label>
   <label>Modo <select data-effect-idx="${i}" data-effect-field="mode"><option value="add" ${comp.mode!=='mult'?'selected':''}>Sumatorio (+N)</option><option value="mult" ${comp.mode==='mult'?'selected':''}>Multiplicador (×N)</option></select></label>
   <label>Valor <input type="number" step="0.1" value="${comp.value??2}" data-effect-idx="${i}" data-effect-field="value"></label>
   <label>Turnos de debuff por acción <input type="number" min="1" value="${comp.effectTurns??2}" data-effect-idx="${i}" data-effect-field="effectTurns"></label>`:''}
  ${['damage','heal'].includes(cloneEffectType)?effectDiceFieldsHtml(comp,i):''}
  ${summonIconRowHtml(comp,i)}`;
 }
 else if(comp.kind==='linkdamage'){
  fields=`<p class="small">Golpea al enemigo más cercano (o al que hayas seleccionado) y salta a otros enemigos cercanos, perdiendo potencia en cada salto.</p>${effectDiceFieldsHtml(comp,i)}<label>Nº de saltos adicionales <input type="number" min="0" value="${comp.jumps??3}" data-effect-idx="${i}" data-effect-field="jumps"></label><label>Reducción de daño por salto (%) <input type="number" min="0" max="95" value="${comp.falloff??25}" data-effect-idx="${i}" data-effect-field="falloff"></label><label>Alcance de salto (casillas) <input type="number" min="1" value="${comp.range??4}" data-effect-idx="${i}" data-effect-field="range"></label>`;
 }
 else if(comp.kind==='utility'){
  const mode=comp.mode||'reveal';
  fields=`<label>Tipo <select data-effect-idx="${i}" data-effect-field="mode">
   <option value="reveal" ${mode==='reveal'?'selected':''}>Revelar mapa (radio)</option>
   <option value="stealth" ${mode==='stealth'?'selected':''}>Sigilo (evita la respuesta enemiga)</option>
   <option value="shield" ${mode==='shield'?'selected':''}>Escudo plano</option>
   <option value="resource" ${mode==='resource'?'selected':''}>Restaurar recurso (maná/stamina)</option>
  </select></label>
  ${mode==='resource'?`<label>Recurso a restaurar <select data-effect-idx="${i}" data-effect-field="resource"><option value="stamina" ${(!comp.resource||comp.resource==='stamina')?'selected':''}>Stamina</option><option value="mana" ${comp.resource==='mana'?'selected':''}>Maná</option></select></label>`:''}
  ${mode!=='stealth'?`<label>${mode==='reveal'?'Radio':mode==='shield'?'Cantidad de escudo':'Cantidad restaurada'} <input type="number" min="1" value="${comp.value??10}" data-effect-idx="${i}" data-effect-field="value"></label>`:''}`;
 }
 else if(comp.kind==='hot')fields=`<label>Recurso regenerado <select data-effect-idx="${i}" data-effect-field="resource"><option value="hp" ${!comp.resource||comp.resource==='hp'?'selected':''}>Vida</option><option value="mana" ${comp.resource==='mana'?'selected':''}>Maná</option><option value="stamina" ${comp.resource==='stamina'?'selected':''}>Stamina</option></select></label>${effectDiceFieldsHtml(comp,i)}<label>Turnos <input type="number" min="1" value="${comp.turns??4}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='execute')fields=`${effectDiceFieldsHtml(comp,i)}<label>Umbral de vida del objetivo (%) <input type="number" min="1" max="99" value="${comp.threshold??35}" data-effect-idx="${i}" data-effect-field="threshold"></label><label>Multiplicador de ejecución (por debajo del umbral) <input type="number" step="0.1" min="1" value="${comp.execMultiplier??2.5}" data-effect-idx="${i}" data-effect-field="execMultiplier"></label>`;
 else if(comp.kind==='pullroot')fields=`<label>Turnos enraizado <input type="number" min="1" value="${comp.turns??2}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='counter')fields=`<label>Escudo otorgado <input type="number" min="0" value="${comp.shield??10}" data-effect-idx="${i}" data-effect-field="shield"></label>${effectDiceFieldsHtml(comp,i)}<label>Turnos de ventana (hasta el próximo golpe) <input type="number" min="1" value="${comp.turns??5}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='cheatdeath')fields=`<label>Turnos activo <input type="number" min="1" value="${comp.turns??5}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='holyshield')fields=`<label>Puntos de escudo base <input type="number" min="0" value="${comp.value??20}" data-effect-idx="${i}" data-effect-field="value"></label><label>Stat que lo potencia <select data-effect-idx="${i}" data-effect-field="stat"><option value="">Ninguna</option>${statOptionsHtml(comp.stat)}</select></label><label>Modo <select data-effect-idx="${i}" data-effect-field="mode"><option value="add" ${comp.mode!=='mult'?'selected':''}>Sumatorio (puntos + stat×coef)</option><option value="mult" ${comp.mode==='mult'?'selected':''}>Multiplicador (puntos × (1 + stat×coef))</option></select></label><label>Coeficiente de stat <input type="number" step="0.1" value="${comp.statCoef??1}" data-effect-idx="${i}" data-effect-field="statCoef"></label><label>Turnos (0 = sin límite de tiempo, dura hasta romperse) <input type="number" min="0" value="${comp.turns??0}" data-effect-idx="${i}" data-effect-field="turns"></label>`;
 else if(comp.kind==='invisible')fields=`<p class="small">Mientras esté activa, los enemigos no responden en su turno (como el sigilo). Se acaba sola al agotar los turnos, y opcionalmente también en cuanto atacas.</p><label>Turnos <input type="number" min="1" value="${comp.turns??2}" data-effect-idx="${i}" data-effect-field="turns"></label><label><input type="checkbox" data-effect-idx="${i}" data-effect-field="breakOnAttack" ${comp.breakOnAttack!==false?'checked':''}> Se rompe al atacar</label>`;
 else if(comp.kind==='ascend')fields=`<p class="small">Mientras dure, cambia lo que cuestan tus propias skills y puede sustituir tu icono en pantalla por uno propio.</p><label>Recurso afectado <select data-effect-idx="${i}" data-effect-field="resource"><option value="any" ${!comp.resource||comp.resource==='any'?'selected':''}>Cualquiera</option><option value="mana" ${comp.resource==='mana'?'selected':''}>Maná</option><option value="stamina" ${comp.resource==='stamina'?'selected':''}>Stamina</option></select></label><label>% de coste mientras dure (100 = coste normal, &lt;100 más barato, &gt;100 más caro) <input type="number" min="0" value="${comp.value??150}" data-effect-idx="${i}" data-effect-field="value"></label><label>Turnos <input type="number" min="1" value="${comp.turns??6}" data-effect-idx="${i}" data-effect-field="turns"></label><label><input type="checkbox" data-effect-idx="${i}" data-effect-field="allowSkills" ${comp.allowSkills!==false?'checked':''}> Permite lanzar otras habilidades mientras dura</label>${summonIconRowHtml(comp,i)}`;
 else if(comp.kind==='transform')fields=`<p class="small">Mientras dure, cambia tu icono en pantalla y tus stats en %. Los porcentajes pueden ser negativos.</p><label>Turnos <input type="number" min="1" value="${comp.turns??8}" data-effect-idx="${i}" data-effect-field="turns"></label><label>% de daño (+/-) <input type="number" step="1" value="${comp.damagePct??0}" data-effect-idx="${i}" data-effect-field="damagePct"></label><label>% de armadura (+/-) <input type="number" step="1" value="${comp.armorPct??0}" data-effect-idx="${i}" data-effect-field="armorPct"></label><label>% de vida máxima (+/-) <input type="number" step="1" value="${comp.hpPct??0}" data-effect-idx="${i}" data-effect-field="hpPct"></label><label><input type="checkbox" data-effect-idx="${i}" data-effect-field="allowSkills" ${comp.allowSkills!==false?'checked':''}> Permite lanzar otras habilidades mientras dura</label>${summonIconRowHtml(comp,i)}`;
 // Any component targeting 'area' (not just the dedicated 'aoe' kind) needs
 // its own configurable radius - resolveComponentEnemyTargets already reads
 // comp.range||2 for all of them, this just exposes it in the admin form.
 if(comp.target==='area'&&comp.kind!=='aoe')fields+=`<label>Radio de área (casillas) <input type="number" min="1" value="${comp.range??2}" data-effect-idx="${i}" data-effect-field="range"></label>`;
 return `<details class="effectCard" open><summary class="effectCardHead"><b>${i+1}. ${effectKindLabel(comp.kind)}</b><button type="button" data-remove-effect="${i}">Quitar</button></summary><div class="configForm">${targetHtml}${fields}</div></details>`;
}
// Icon picker row embedded inside a summon/summonturret effect card: shows
// the currently assigned image (if any) plus buttons that pull from / clear
// against the shared "Imagen de invocación" editor above (window.currentSummonIconHex).
function summonIconRowHtml(comp,i){
 return `<div class="effectIconRow">
  <canvas class="effectIconThumb" width="50" height="50" ${comp.iconImage?`data-summon-icon-idx="${i}"`:''}></canvas>
  <button type="button" data-use-summon-icon="${i}">Usar imagen del editor de arriba →</button>
  ${comp.iconImage?`<button type="button" data-clear-summon-icon="${i}">Quitar imagen</button>`:'<span class="small">Sin imagen: usará el sprite genérico de aliado.</span>'}
 </div>`;
}
// Every already-uploaded custom icon in the system (items, enemies, classes,
// skills), deduped by hex, so a summon effect can reuse one instead of the
// admin having to crop the same image again.
function summonIconOptionsList(){
 const seen=new Set(),opts=[];
 const add=(hex,label)=>{if(!hex||seen.has(hex))return;seen.add(hex);opts.push({hex,label})};
 for(const row of configItems||[]){const item=row.item_json||row;add(item.icon||row.icon,`Objeto: ${item.name||row.nombre||row.id}`)}
 for(const row of configEnemyDetails||[]){add(row.icon,`Enemigo: ${row.class||row.type||row.id}`)}
 for(const row of configClasses||[]){
  const cj=row.class_json||{};
  add(cj.icon,`Clase: ${cj.name||row.nombre||row.id}`);
  for(const [sid,s] of Object.entries(row.skills_json||{}))add(s.iconImage,`Skill: ${s.name||sid}`);
 }
 return opts;
}
function populateSummonIconExistingList(){
 const sel=document.getElementById('configSummonIconExisting');if(!sel)return;
 const current=sel.value,opts=summonIconOptionsList();
 sel.innerHTML='<option value="">— Elegir de la lista —</option>'+opts.map(o=>`<option value="${o.hex}">${o.label}</option>`).join('');
 if(opts.some(o=>o.hex===current))sel.value=current;
}
function renderSkillEffectsList(){
 const wrap=document.getElementById('configSkillEffectsList');if(!wrap)return;
 populateSummonIconExistingList();
 const list=window.currentSkillEffectsDraft||[];
 wrap.innerHTML=list.map((comp,i)=>effectComponentCardHtml(comp,i)).join('')||'<p class="small">Sin efectos apilables añadidos todavía: elige un tipo arriba y pulsa "Añadir efecto".</p>';
 wrap.querySelectorAll('[data-effect-idx]').forEach(el=>{
  el.addEventListener('change',()=>{
   const idx=Number(el.dataset.effectIdx),field=el.dataset.effectField;
   const isNumber=el.type==='number',isCheckbox=el.type==='checkbox';
   window.currentSkillEffectsDraft[idx][field]=isNumber?Number(el.value):isCheckbox?el.checked:el.value;
   // these two fields change which sub-fields the card shows, so re-render
   // that one card's layout instead of leaving stale/hidden inputs behind
   if(field==='effectType'||field==='mode'||field==='target'||field==='damageMode'||field==='permanent')renderSkillEffectsList();
  });
 });
 wrap.querySelectorAll('[data-remove-effect]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  window.currentSkillEffectsDraft.splice(Number(btn.dataset.removeEffect),1);renderSkillEffectsList();
 }));
 // Nested mini stackable-effects list for a 'skill'-typed summon/turret/
 // clone (see subEffectsListHtml) - addressed by data-sub-parent/data-sub-idx
 // instead of data-effect-idx so it never collides with the top-level
 // effects-list handlers above, even though both live in the same DOM tree.
 wrap.querySelectorAll('[data-sub-field]').forEach(el=>{
  el.addEventListener('change',()=>{
   const pIdx=Number(el.dataset.subParent),j=Number(el.dataset.subIdx),field=el.dataset.subField;
   const isNumber=el.type==='number',isCheckbox=el.type==='checkbox';
   const parent=window.currentSkillEffectsDraft[pIdx];if(!parent)return;
   parent.skillEffects=parent.skillEffects||[];
   parent.skillEffects[j][field]=isNumber?Number(el.value):isCheckbox?el.checked:el.value;
  });
 });
 wrap.querySelectorAll('[data-remove-sub-effect]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const pIdx=Number(btn.dataset.subParent),j=Number(btn.dataset.subIdx);
  window.currentSkillEffectsDraft[pIdx]?.skillEffects?.splice(j,1);
  renderSkillEffectsList();
 }));
 wrap.querySelectorAll('[data-add-sub-effect]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const pIdx=Number(btn.dataset.addSubEffect);
  const picker=wrap.querySelector(`[data-sub-add-kind][data-sub-parent="${pIdx}"]`);
  const kind=picker?.value||'dmg';
  const parent=window.currentSkillEffectsDraft[pIdx];if(!parent)return;
  parent.skillEffects=parent.skillEffects||[];
  parent.skillEffects.push(defaultComponentFor(kind));
  renderSkillEffectsList();
 }));
 wrap.querySelectorAll('[data-use-summon-icon]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const idx=Number(btn.dataset.useSummonIcon);
  if(!window.currentSummonIconHex){alert('Primero elige o recorta una imagen en "Imagen de invocación".');return}
  window.currentSkillEffectsDraft[idx].iconImage=window.currentSummonIconHex;renderSkillEffectsList();
 }));
 wrap.querySelectorAll('[data-clear-summon-icon]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  window.currentSkillEffectsDraft[Number(btn.dataset.clearSummonIcon)].iconImage='';renderSkillEffectsList();
 }));
 wrap.querySelectorAll('[data-summon-icon-idx]').forEach(c=>{
  const comp=window.currentSkillEffectsDraft[Number(c.dataset.summonIconIdx)];
  if(comp?.iconImage)drawSkillIconImg(c,comp.iconImage);
 });
}
// Old skills (authored before the stackable effects list existed) stored
// their damage/buff/debuff/dot config as flat fields on the skill itself
// instead of in `effects`. The dedicated form fields for those are gone now
// that everything routes through the stackable list, so translate them into
// the equivalent component(s) once, on load, instead of losing them.
function legacyEffectsFromSkill(s){
 const list=[],selfTarget=['buff','shield','heal','utility'].includes(s.classEffect);
 if(s.dmgDice>0)list.push({kind:'dmg',target:selfTarget?'self':'enemy',dmgDice:s.dmgDice,dmgDie:s.dmgDie||6,dmgStat:s.dmgStat||'',dmgStatMode:s.dmgStatMode||'add',dmgStatCoef:s.dmgStatCoef??1});
 if(s.buffStat)list.push({kind:'buff',target:'self',stat:s.buffStat,mode:s.buffStatMode||'add',value:s.buffStatCoef??5,turns:s.buffTurns||6});
 if(s.debuffStat)list.push({kind:'debuff',target:'enemy',stat:s.debuffStat,mode:s.debuffStatMode||'add',value:s.debuffStatCoef??2,turns:s.debuffTurns||3});
 if(s.dotDice>0)list.push({kind:'dot',target:'enemy',dotDice:s.dotDice,dotDie:s.dotDie||6,dotStat:s.dotStat||'',dotStatMode:s.dotStatMode||'add',dotStatCoef:s.dotStatCoef??1,turns:s.dotTurns||4,flavor:'dot'});
 return list;
}
function loadSkillIntoForm(skillId){
 const s=(window.currentClassSkillsDraft||{})[skillId];if(!s)return;
 window.editingConfigSkillId=skillId;
 window.currentSkillEffectsDraft=(s.effects&&s.effects.length)?JSON.parse(JSON.stringify(s.effects)):legacyEffectsFromSkill(s);
 renderSkillEffectsList();
 document.getElementById('configClassSkillSelect').value=skillId;
 document.getElementById('configSkillId').value=skillId;
 document.getElementById('configSkillName').value=s.name||'';
 document.getElementById('configSkillIconText').value=s.icon||'';
 document.getElementById('configSkillTier').value=String(s.tier||1);
 document.getElementById('configSkillResource').value=s.resource||'stamina';
 document.getElementById('configSkillCost').value=s.cost??10;
 document.getElementById('configSkillCd').value=s.cd??5;
 document.getElementById('configSkillApCost').value=s.apCost??10;
 document.getElementById('configSkillType').value=s.type||'physical';
 document.getElementById('configSkillRarity').value=s.rarity||'common';
 document.getElementById('configSkillRange').value=s.range??1;
 document.getElementById('configSkillTargetMode').value=s.targetMode||'';
 document.getElementById('configSkillEffect').value=s.classEffect||'ranged';
 document.getElementById('configSkillEnemyUsable').checked=s.enemyUsable!==false;
 document.getElementById('configSkillDesc').value=s.desc||'';
 window.currentConfigSkillIconHex=s.iconImage||'';
 renderConfigIconPreview(window.currentConfigSkillIconHex,'configSkillIconPreview','configSkillIconStatus');
 document.getElementById('configSkillIconStatus').textContent=window.currentConfigSkillIconHex?'Imagen personalizada activa.':'Sin imagen: se usa el icono de texto/emoji.';
 const st=document.getElementById('configSkillStatus');if(st)st.textContent=`Editando ${s.name||skillId}.`;
}
function currentSkillFormJson(){
 return {
  name:document.getElementById('configSkillName').value.trim()||'Skill sin nombre',
  icon:document.getElementById('configSkillIconText').value.trim()||'✦',
  iconImage:window.currentConfigSkillIconHex||'',
  desc:document.getElementById('configSkillDesc').value.trim(),
  cd:Number(document.getElementById('configSkillCd').value)||1,
  apCost:Number(document.getElementById('configSkillApCost').value)||10,
  resource:document.getElementById('configSkillResource').value,
  cost:Number(document.getElementById('configSkillCost').value)||0,
  type:document.getElementById('configSkillType').value,
  rarity:document.getElementById('configSkillRarity').value,
  range:Number(document.getElementById('configSkillRange').value)||0,
  targetMode:document.getElementById('configSkillTargetMode').value||undefined,
  classEffect:document.getElementById('configSkillEffect').value,
  tier:Number(document.getElementById('configSkillTier').value)||1,
  classId:window.pendingNewClassId||selectedGameClassId(),
  enemyUsable:document.getElementById('configSkillEnemyUsable').checked,
  effects:(window.currentSkillEffectsDraft&&window.currentSkillEffectsDraft.length)?window.currentSkillEffectsDraft:undefined,
  unlock:'Clase'
 };
}
function currentConfigClassJson(){
 const id=window.pendingNewClassId||selectedGameClassId(),base=resolveClassDef(id);
 const starterWeaponSel=document.getElementById('configClassStarterWeapon');
 return {
  classId:id,
  name:document.getElementById('configClassName').value.trim()||id,
  desc:document.getElementById('configClassDesc').value.trim()||'Clase personalizada.',
  icon:window.currentConfigClassIconHex||'',
  stats:{strength:Number(configClassStr.value)||0,vitality:Number(configClassVit.value)||0,agility:Number(configClassAgi.value)||0,luck:Number(configClassLuck.value)||0,intelligence:Number(configClassInt.value)||0,wisdom:Number(configClassWis.value)||0},
  starterSkills:base?.skills||[],
  resourceBias:base?.resourceBias||'stamina',
  starterWeaponType:starterWeaponSel?.value||'',
  starterPotionIds:[...(window.currentClassStarterPotionIds||[])]
 };
}
async function saveConfigClass(item,skillsBag){
 const row=window.pendingNewClassId?null:configClassRowForId(item.classId);
 const method=row?'PUT':'POST',url=row?`/api/config-class?id=${encodeURIComponent(row.id)}`:'/api/config-class';
 // saving a class from this editor is the explicit signal that it's ready
 // for Advanced skill mode - flips config_class.advanced to true so
 // classIdsForSkillMode('advanced') picks it up regardless of whether its
 // classId happens to reuse a hardcoded one (a reskinned/renamed class).
 const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row?.id,nombre:item.name,icon:item.icon,class_json:item,skills_json:skillsBag,advanced:true})});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar la clase');
 window.pendingNewClassId=null;
 await fetchConfigClasses();
 return data;
}
function renderConfigClasses(){
 const sel=document.getElementById('configClassSelect'),list=document.getElementById('configClassesList');if(!sel)return;
 const previous=sel.value||selectedClass,ids=allClassIds();
 sel.innerHTML=ids.map(id=>`<option value="${id}">${resolveClassDef(id)?.name||id}</option>`).join('');
 sel.value=ids.includes(previous)?previous:selectedClass;
 if(list)list.innerHTML=ids.map(id=>{const row=configClassRowForId(id),icon=row?.class_json?.icon||row?.icon||'',c=resolveClassDef(id);return `<div class="configItem"><span class="tierDot" style="background:${icon?'#8c72e8':'#4d395a'}"></span><div><b>${c.name}</b><span class="small">${c.custom?'Clase personalizada':'Clase base'} · ${row?`BDD #${row.id}`:'Sin fila BDD'} · ${icon?'Icono subido':'Pixels por defecto'}${row?.skills_json?' · Skills personalizadas':''}${row?.advanced?' · <b style="color:#ffc35a">Advanced</b>':''}</span></div></div>`}).join('');
 loadSelectedConfigClass();
}
function loadSelectedConfigClass(){
 window.pendingNewClassId=null;
 const id=selectedGameClassId(),def=resolveClassDef(id),row=configClassRowForId(id);
 configClassName.value=def?.name||id;
 document.getElementById('configClassDesc').value=def?.desc||'';
 const stats=def?.stats||{};
 configClassStr.value=stats.strength??2;configClassVit.value=stats.vitality??2;configClassAgi.value=stats.agility??2;configClassLuck.value=stats.luck??2;configClassInt.value=stats.intelligence??2;configClassWis.value=stats.wisdom??2;
 window.currentConfigClassIconHex=row?.class_json?.icon||row?.icon||'';
 renderConfigIconPreview(window.currentConfigClassIconHex,'configClassIconPreview','configClassIconStatus');
 configClassIconStatus.textContent=window.currentConfigClassIconHex?'Icono cargado para esta clase.':'Sin icono: usará los pixels por defecto.';
 // only fall back to the generic sprite preview when there's genuinely no
 // uploaded icon - drawClassPreview's own image-loading path raced with
 // renderConfigIconPreview's above and could clobber a real DB icon with
 // the default sprite while the (already-cached) image was still resolving
 if(!window.currentConfigClassIconHex)drawClassPreview(configClassIconPreview,id);
 window.currentClassSkillsDraft=classSkillBagFor(id);
 renderClassSkillSelect();
 renderConfigClassStarterGearOptions(row?.class_json?.starterWeaponType||'',row?.class_json?.starterPotionIds||[]);
}
// Populates the starter-weapon-type picker and the searchable starter-
// potions checklist for the advanced class editor, selecting whatever this
// class row already has (empty = fall back to the generic per-classId
// table / default potions at character creation, see
// makeStarterWeapon/addStarterPotions).
function renderConfigClassStarterGearOptions(selectedWeaponType='',selectedPotionIds=[]){
 const weaponSel=document.getElementById('configClassStarterWeapon');
 if(weaponSel){
  weaponSel.innerHTML='<option value="">— Automático (genérico) —</option>'+configWeaponTypes.map(t=>`<option value="${t}" ${t===selectedWeaponType?'selected':''}>${t}</option>`).join('');
 }
 window.currentClassStarterPotionIds=(selectedPotionIds||[]).map(String);
 const search=document.getElementById('configClassPotionSearch');if(search)search.value='';
 renderConfigClassPotionResults();
}
// Searchable checklist of every configured potion, mirroring the chest
// item picker (renderChestItemResults) so starter potions are actually
// visible/browsable instead of buried in a barely-usable <select multiple>.
function renderConfigClassPotionResults(){
 const root=document.getElementById('configClassPotionResults'),summary=document.getElementById('configClassPotionSummary');
 if(!root)return;
 window.currentClassStarterPotionIds=window.currentClassStarterPotionIds||[];
 const q=(document.getElementById('configClassPotionSearch')?.value||'').trim().toLowerCase();
 // Hidden potions never show up in the default (empty-search) list - they
 // only surface once the search text actually matches their name.
 const pool=configuredPotionRows().map(r=>({id:String(r.id),name:(r.item_json||r).name||r.nombre||String(r.id),hidden:!!(r.item_json||r).hidden})).filter(x=>q?x.name.toLowerCase().includes(q):!x.hidden);
 const selected=new Set(window.currentClassStarterPotionIds.map(String));
 root.innerHTML=pool.length?pool.map(x=>`<label class="configItem"><input type="checkbox" data-class-potion-pick="${x.id}" ${selected.has(x.id)?'checked':''}><span>${x.name}</span></label>`).join(''):'<p class="small">No hay pociones configuradas todavía.</p>';
 const updateSummary=()=>{if(summary)summary.textContent=window.currentClassStarterPotionIds.length?`${window.currentClassStarterPotionIds.length} poción(es) seleccionada(s) como equipo inicial.`:'Nada seleccionado: se usarán 2 unidades de una poción del catálogo configurado.'};
 root.querySelectorAll('[data-class-potion-pick]').forEach(cb=>cb.onchange=()=>{
  const id=cb.dataset.classPotionPick;
  window.currentClassStarterPotionIds=cb.checked?[...window.currentClassStarterPotionIds,id]:window.currentClassStarterPotionIds.filter(x=>x!==id);
  updateSummary();
 });
 updateSummary();
}

function renderConfigItemRow(i){const item=i.item_json||i,skills=Array.isArray(item.skillIds)?item.skillIds:[],isPotion=item.type==='potion',weaponType=item.slot==='weapon'&&(item.weaponType||item.weaponCategory)?` · ${item.weaponType||item.weaponCategory}`:'',weaponRange=item.slot==='weapon'?` · alcance ${weaponRangeBounds(item).min}-${weaponRangeBounds(item).max}`:'',potionEffectsSummary=isPotion?((item.effects||[]).map(effectSummaryTag).join(', ')||'sin efectos'):'';return `<div class="configItem"><span class="tierDot" style="background:${tierColor(i.tier)}"></span><div><b>${i.nombre||'Sin nombre'}</b><span class="small">${isPotion?'Poción · ':''}${tierDefs[item.rarity||i.tier]?.label||item.rarity||i.tier} · iLvl ${item.itemLevel||i.ilvl||1}${weaponType}${weaponRange}${isPotion?` · ${potionEffectsSummary}`:''}${skills.length?` · ${skillNames(skills)}`:''}</span><div class="configItemActions"><button type="button" data-config-edit="${i.id}">Editar</button><button type="button" data-config-duplicate="${i.id}">Duplicar</button><button type="button" data-config-delete="${i.id}">Borrar</button></div></div></div>`}
// Groups collapsed by default; window.configItemGroupsOpen remembers which
// ones the admin expanded so a re-render (e.g. right after saving an item,
// see fetchConfigItems) doesn't snap every group shut again.
function renderConfigItems(){const root=document.getElementById('configItemsList');if(!root)return;const equipmentRows=configItems.filter(i=>!isConfiguredPotionRow(i));if(!equipmentRows.length){root.innerHTML='<p class="small">No hay objetos configurados.</p>';return}
 window.configItemGroupsOpen=window.configItemGroupsOpen||{};
 root.querySelectorAll('details.configSlotGroup[data-group-key]').forEach(d=>{window.configItemGroupsOpen[d.dataset.groupKey]=d.open});
 const grouped=equipmentRows.reduce((acc,i)=>{const item=i.item_json||i,slot=i.slot||item.slot||'otros',weaponGroup=slot==='weapon'?(item.weaponType||item.weaponCategory||'Sin tipo de arma'):null,key=weaponGroup?`${slot}::${weaponGroup}`:slot;(acc[key]??={slot,weaponGroup,items:[]}).items.push(i);return acc},{}),orderedKeys=[...slots.flatMap(slot=>Object.keys(grouped).filter(key=>grouped[key].slot===slot).sort((a,b)=>(grouped[a].weaponGroup||'').localeCompare(grouped[b].weaponGroup||'','es'))),...Object.keys(grouped).filter(key=>!slots.includes(grouped[key].slot)).sort((a,b)=>a.localeCompare(b,'es'))];root.innerHTML=orderedKeys.map(key=>{const group=grouped[key],title=group.weaponGroup?`${slotNames[group.slot]||group.slot} · ${group.weaponGroup}`:(slotNames[group.slot]||group.slot),keyAttr=key.replace(/"/g,'&quot;');return `<details class="configSlotGroup" data-group-key="${keyAttr}" ${window.configItemGroupsOpen[key]?'open':''}><summary><span>${title}</span><b>${group.items.length}</b></summary><div class="configSlotItems">${group.items.map(renderConfigItemRow).join('')}</div></details>`}).join('');root.querySelectorAll('[data-config-edit]').forEach(b=>b.onclick=()=>loadConfigItemForEdit(b.dataset.configEdit));root.querySelectorAll('[data-config-duplicate]').forEach(b=>b.onclick=()=>duplicateConfigItem(b.dataset.configDuplicate));root.querySelectorAll('[data-config-delete]').forEach(b=>b.onclick=()=>removeConfigItem(b.dataset.configDelete))}
// Same "Objetos guardados" list/row markup as equipment (renderConfigItemRow
// already branches on isPotion for its own summary text), just filtered to
// potions only and wired to the potion tab's own edit/duplicate/delete
// handlers so the two tabs never touch each other's editingConfigId/form.
function renderConfigPotionsList(){const root=document.getElementById('configPotionsList');if(!root)return;const potionRows=configuredPotionRows();if(!potionRows.length){root.innerHTML='<p class="small">No hay pociones configuradas.</p>';return}root.innerHTML=potionRows.map(renderConfigItemRow).join('');root.querySelectorAll('[data-config-edit]').forEach(b=>b.onclick=()=>loadConfigPotionForEdit(b.dataset.configEdit));root.querySelectorAll('[data-config-duplicate]').forEach(b=>b.onclick=()=>duplicateConfigPotion(b.dataset.configDuplicate));root.querySelectorAll('[data-config-delete]').forEach(b=>b.onclick=()=>removeConfigPotion(b.dataset.configDelete))}
function configStatDefinitions(){const seen=new Set();return [...primaryAffixes,...secondaryAffixes].filter(def=>{if(seen.has(def.key))return false;seen.add(def.key);return true})}
function renderConfigStatsHelp(){const root=document.getElementById('configStatsHelp');if(!root)return;root.innerHTML='<p class="small"><b>Bonos disponibles:</b> pulsa uno para añadirlo a Stats.</p>'+configStatDefinitions().map(def=>`<button type="button" class="statBonusButton" data-stat-bonus="${def.key}" title="${def.label}. Slots: ${def.slots.map(s=>slotNames[s]||s).join(', ')}"><b>${def.key}</b><span>${def.label}${def.percent?' %':''}</span></button>`).join('');root.querySelectorAll('[data-stat-bonus]').forEach(btn=>btn.onclick=()=>{const sep=configStats.value.trim()? ', ':'';configStats.value+=`${sep}${btn.dataset.statBonus}:+1`;configStats.focus()})}
function addIconSilhouetteBorder(canvas,size=2,color=[0,0,0,255]){const q=canvas.getContext('2d'),w=canvas.width,h=canvas.height,orig=document.createElement('canvas');orig.width=w;orig.height=h;orig.getContext('2d').drawImage(canvas,0,0);const src=q.getImageData(0,0,w,h),border=q.createImageData(w,h),r=Math.max(1,Math.round(size));for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(src.data[i+3]>8)continue;let near=false;for(let dy=-r;dy<=r&&!near;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r)continue;const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;if(src.data[(ny*w+nx)*4+3]>8){near=true;break}}if(near){border.data[i]=color[0];border.data[i+1]=color[1];border.data[i+2]=color[2];border.data[i+3]=color[3]}}q.putImageData(border,0,0);q.drawImage(orig,0,0);return canvas}
function renderConfigIconPreview(hex,previewId='configIconPreview',statusId='configIconStatus',withBorder=!String(previewId).toLowerCase().includes('tile'),dims={w:50,h:50}){const preview=document.getElementById(previewId);if(!preview)return;preview.width=dims.w;preview.height=dims.h;const c=preview.getContext('2d');c.clearRect(0,0,dims.w,dims.h);if(!hex)return;try{const data='data:image/png;base64,'+hexToBase64(hex.startsWith('#')?hex.slice(1):hex),img=configIconImage(data);const draw=()=>{const out=document.createElement('canvas');out.width=dims.w;out.height=dims.h;const o=out.getContext('2d');o.imageSmoothingEnabled=true;o.imageSmoothingQuality='high';o.clearRect(0,0,dims.w,dims.h);o.drawImage(img,0,0,dims.w,dims.h);if(withBorder)addIconSilhouetteBorder(out,2);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.clearRect(0,0,dims.w,dims.h);c.drawImage(out,0,0)};if(img.complete&&img.naturalWidth)draw();else img.onload=draw;preview._iconEditor?.loadHex(hex)}catch(e){const st=document.getElementById(statusId);if(st)st.textContent='No se pudo previsualizar el icono guardado.'}}
function resetConfigForm(){window.editingConfigItemId=null;configNombre.value='';configTier.value='common';configSlot.value='weapon';configIlvl.value='1';if(document.getElementById('configItemHidden'))document.getElementById('configItemHidden').checked=false;configWeaponCategory.value=configWeaponTypes[0];configDamageDice.value='1d6';if(configRangeMin)configRangeMin.value='1';if(configRangeMax)configRangeMax.value='1';configStats.value='';window.currentConfigIconHex='';window.currentConfigItemSkillIds=[];configIconStatus.textContent='Sin icono';renderConfigIconPreview('');if(configProcChance)configProcChance.value='20';if(configEquipmentCooldown)configEquipmentCooldown.value='4';if(configEquipmentRange)configEquipmentRange.value='5';window.currentEquipmentEffectsDraft=[];renderEquipmentEffectsList();configStatus.textContent='Nuevo objeto.';configSlot.dispatchEvent(new Event('change'))}
function loadConfigItemForEdit(id){const row=configItems.find(i=>String(i.id)===String(id));if(!row)return;const item=row.item_json||row;window.editingConfigItemId=row.id;configNombre.value=item.name||row.nombre||'';configTier.value=item.rarity||row.tier||'common';if(document.getElementById('configItemHidden'))document.getElementById('configItemHidden').checked=!!item.hidden;configSlot.value=item.slot==='consumable'?'trinket1':(item.slot||row.slot||'trinket1');configIlvl.value=item.itemLevel||row.ilvl||1;configDamageDice.value=item.damageDice||'1d6';configWeaponCategory.value=item.weaponType||item.weaponCategory||configWeaponTypes[0];const bounds=weaponRangeBounds(item);if(configRangeMin)configRangeMin.value=bounds.min;if(configRangeMax)configRangeMax.value=bounds.max;configStats.value=item.stats||row.stats||'';window.currentConfigIconHex=item.icon||row.icon||'';window.currentConfigItemSkillIds=Array.isArray(item.skillIds)?item.skillIds:[];renderConfigIconPreview(window.currentConfigIconHex);configIconStatus.textContent=window.currentConfigIconHex?'Icono cargado desde objeto guardado.':'Sin icono';if(configProcChance)configProcChance.value=item.procChance??20;if(configEquipmentCooldown)configEquipmentCooldown.value=item.cooldown??4;if(configEquipmentRange)configEquipmentRange.value=item.range??5;window.currentEquipmentEffectsDraft=Array.isArray(item.effects)&&item.effects[0]?.kind?JSON.parse(JSON.stringify(item.effects)):[];renderEquipmentEffectsList();configSlot.dispatchEvent(new Event('change'));configStatus.textContent=`Editando #${row.id}: ${configNombre.value||'Sin nombre'}`}
function resetConfigPotionForm(){window.editingConfigPotionId=null;configPotionNombre.value='';configPotionTier.value='common';if(document.getElementById('configPotionHidden'))document.getElementById('configPotionHidden').checked=false;const potionRange=document.getElementById('configPotionRange');if(potionRange)potionRange.value='5';window.currentPotionEffectsDraft=[];renderPotionEffectsList();window.currentConfigPotionIconHex='';renderConfigIconPreview('','configPotionIconPreview','configPotionIconStatus');configPotionIconStatus.textContent='Sin icono';configPotionStatus.textContent='Nueva poción.'}
function loadConfigPotionForEdit(id){const row=configItems.find(i=>String(i.id)===String(id));if(!row)return;const item=row.item_json||row;window.editingConfigPotionId=row.id;configPotionNombre.value=item.name||row.nombre||'';configPotionTier.value=item.rarity||row.tier||'common';if(document.getElementById('configPotionHidden'))document.getElementById('configPotionHidden').checked=!!item.hidden;window.currentConfigPotionIconHex=item.icon||row.icon||'';window.currentPotionEffectsDraft=Array.isArray(item.effects)?JSON.parse(JSON.stringify(item.effects)):[];renderPotionEffectsList();const potionRange=document.getElementById('configPotionRange');if(potionRange)potionRange.value=item.range||5;renderConfigIconPreview(window.currentConfigPotionIconHex,'configPotionIconPreview','configPotionIconStatus');configPotionIconStatus.textContent=window.currentConfigPotionIconHex?'Icono cargado desde objeto guardado.':'Sin icono';configPotionStatus.textContent=`Editando #${row.id}: ${configPotionNombre.value||'Sin nombre'}`}
async function duplicateConfigItem(id){const row=configItems.find(i=>String(i.id)===String(id));if(!row)return;configStatus.textContent='Duplicando...';try{const item={...(row.item_json||row),name:`${(row.item_json||row).name||row.nombre||'Objeto'} (copia)`};await saveConfigItems([{...item,nombre:item.name,slot:item.slot,tier:item.rarity,ilvl:item.itemLevel,item_json:item}]);configStatus.textContent='Objeto duplicado.'}catch(e){configStatus.textContent=e.message}}
async function removeConfigItem(id){if(!confirm('¿Borrar este objeto configurado?'))return;configStatus.textContent='Borrando...';try{await deleteConfigItem(id);if(String(window.editingConfigItemId)===String(id))resetConfigForm();configStatus.textContent='Objeto borrado.'}catch(e){configStatus.textContent=e.message}}
async function duplicateConfigPotion(id){const row=configItems.find(i=>String(i.id)===String(id));if(!row)return;configPotionStatus.textContent='Duplicando...';try{const item={...(row.item_json||row),name:`${(row.item_json||row).name||row.nombre||'Poción'} (copia)`};await saveConfigItems([{...item,nombre:item.name,slot:item.slot,tier:item.rarity,ilvl:item.itemLevel,item_json:item}]);configPotionStatus.textContent='Poción duplicada.'}catch(e){configPotionStatus.textContent=e.message}}
async function removeConfigPotion(id){if(!confirm('¿Borrar esta poción configurada?'))return;configPotionStatus.textContent='Borrando...';try{await deleteConfigItem(id);if(String(window.editingConfigPotionId)===String(id))resetConfigPotionForm();configPotionStatus.textContent='Poción borrada.'}catch(e){configPotionStatus.textContent=e.message}}

function emptyFloorDraft(){return {name:'Caverna verdeante',story:'Cavernas húmedas cubiertas de musgo, raíces y piedra viva.',floorTiles:[],wallTiles:[],doorTiles:[]}}
function currentFloorDraft(){return window.editingConfigFloorJson||emptyFloorDraft()}
async function fetchConfigFloors(){try{const r=await fetch('/api/config-floor');const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron cargar floors');configFloors=Array.isArray(data)?data:[];renderConfigTilesets();setupWorldSettings()}catch(e){const st=document.getElementById('configTilesetStatus');if(st)st.textContent=`Error cargando config_floor: ${e.message}`}}
async function saveConfigFloorRow(floor){const id=window.editingConfigFloorId;const r=await fetch(id?`/api/config-floor?id=${encodeURIComponent(id)}`:'/api/config-floor',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({floor_name:floor.name,floor_json:floor})});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar floor');await fetchConfigFloors();setupWorldSettings();return data}
function tileLabel(t,i){return `${t.name||'Tile '+(i+1)} · ${t.type==='wall'?'Muro':t.type==='door'?'Puerta':'Suelo'}${t.direction?` · ${t.direction}`:''}`}
function renderConfigTilesets(){const floor=currentFloorDraft(),tiles=[...(floor.floorTiles||[]).map((t,i)=>({...t,_key:'floorTiles',_index:i})),...(floor.wallTiles||[]).map((t,i)=>({...t,_key:'wallTiles',_index:i})),...(floor.doorTiles||[]).map((t,i)=>({...t,_key:'doorTiles',_index:i}))];const list=document.getElementById('configTilesList'),fl=document.getElementById('configFloorsList');if(list)list.innerHTML=tiles.length?tiles.map((t,i)=>`<div class="configItem"><span class="tierDot" style="background:${t.color||'#263927'}"></span><div><b>${tileLabel(t,i)}</b><span class="small">Rotación: ${t.rotatable?'sí':'no'} · Icono: ${t.icon?'imagen':'colores'}</span><div class="configItemActions"><button type="button" data-edit-tile-key="${t._key}" data-edit-tile-index="${t._index}">Editar tile</button><button type="button" data-delete-tile-key="${t._key}" data-delete-tile-index="${t._index}">Borrar tile</button></div></div></div>`).join(''):'<p class="small">Aún no hay tiles en este floor.</p>';if(fl)fl.innerHTML=[...configFloors.map(r=>({...(r.floor_json||{}),id:r.id,name:r.floor_json?.name||r.floor_name})),...(!configFloors.length?defaultTilesetFloors:[])].map((f,i)=>`<div class="configItem"><span class="tierDot" style="background:${f.floorTiles?.[0]?.color||'#263927'}"></span><div><b>${f.name}</b><span class="small">${f.floorTiles?.length||0} suelo · ${f.wallTiles?.length||0} muro · ${f.doorTiles?.length||0} puerta</span><div class="configItemActions"><button type="button" data-load-floor="${f.id||''}" data-default-floor="${!f.id?i:''}">Editar floor</button></div></div></div>`).join('');document.querySelectorAll('[data-load-floor]').forEach(btn=>btn.onclick=()=>loadConfigFloor(btn.dataset.loadFloor,btn.dataset.defaultFloor));document.querySelectorAll('[data-edit-tile-key]').forEach(btn=>btn.onclick=()=>loadConfigTile(btn.dataset.editTileKey,Number(btn.dataset.editTileIndex)));document.querySelectorAll('[data-delete-tile-key]').forEach(btn=>btn.onclick=()=>deleteConfigTile(btn.dataset.deleteTileKey,Number(btn.dataset.deleteTileIndex)));renderTileSelects()}
function renderTileSelects(){const floor=currentFloorDraft();for(const [id,key] of [['configFloorTiles','floorTiles'],['configWallTiles','wallTiles'],['configDoorTiles','doorTiles']]){const el=document.getElementById(id);if(el)el.innerHTML=(floor[key]||[]).map((t,i)=>`<option value="${i}" selected>${t.name}</option>`).join('')}}
function selectedTilesForKey(key){return currentFloorDraft()[key]||[]}
function loadConfigFloor(id,defaultIndex){const row=configFloors.find(r=>String(r.id)===String(id));const f=row?{...(row.floor_json||{}),name:row.floor_json?.name||row.floor_name}:defaultTilesetFloors[Number(defaultIndex)]||emptyFloorDraft();window.editingConfigFloorId=row?.id||null;window.editingConfigFloorJson=JSON.parse(JSON.stringify(f));window.editingConfigTileRef=null;configFloorName.value=f.name||'';configFloorStory.value=f.story||'';configTilesetStatus.textContent=`Editando floor ${f.name}.`;resetConfigTileForm(false);renderConfigTilesets()}
function tileArrayKey(type){return type==='wall'?'wallTiles':type==='door'?'doorTiles':'floorTiles'}
function resetConfigTileForm(clearIcon=true){configTileName.value='';configTileType.value='floor';configTileColor.value='#263927';configTileAlt.value='#314832';configTileAccent.value='#8fbf63';configWallDirection.value='top';configTileRotatable.checked=true;if(clearIcon){window.currentConfigTileIconHex='';renderConfigIconPreview('','configTileIconPreview','configTileIconStatus')}configTileType.dispatchEvent(new Event('change'))}
function loadConfigTile(key,index){const floor=currentFloorDraft(),tile=floor[key]?.[index];if(!tile)return;window.editingConfigTileRef={key,index};configTileName.value=tile.name||'';configTileType.value=tile.type||({floorTiles:'floor',wallTiles:'wall',doorTiles:'door'}[key]||'floor');configTileColor.value=tile.color||'#263927';configTileAlt.value=tile.alt||tile.top||'#314832';configTileAccent.value=tile.accent||'#8fbf63';configWallDirection.value=tile.direction||'top';configTileRotatable.checked=!!tile.rotatable;window.currentConfigTileIconHex=tile.icon||'';renderConfigIconPreview(window.currentConfigTileIconHex,'configTileIconPreview','configTileIconStatus');configTileType.dispatchEvent(new Event('change'));configTilesetStatus.textContent=`Editando tile ${tile.name||index+1}. Guarda el tile para aplicar cambios al floor.`}
function deleteConfigTile(key,index){const floor=currentFloorDraft();if(!floor[key]?.[index])return;if(!confirm('¿Borrar este tile del floor actual?'))return;floor[key].splice(index,1);window.editingConfigFloorJson=floor;window.editingConfigTileRef=null;resetConfigTileForm();configTilesetStatus.textContent='Tile borrado del floor actual. Guarda el floor para consolidar en config_floor.';renderConfigTilesets()}
function setupTilesetConfigMode(){setupImageIconEditor({inputId:'configTileImageInput',canvasId:'configTileCropCanvas',previewId:'configTileIconPreview',statusId:'configTileIconStatus',zoomId:'configTileCropZoom',eraserId:'configTileMagicEraserBtn',toleranceId:'configTileMagicTolerance',hexKey:'currentConfigTileIconHex',statusPrefix:'Tile',outline:false});window.editingConfigFloorJson=window.editingConfigFloorJson||emptyFloorDraft();renderConfigTilesets();configTileType.onchange=()=>configWallDirectionWrap?.classList.toggle('hidden',configTileType.value!=='wall');configTileType.onchange();addConfigTileBtn.onclick=()=>{const floor=currentFloorDraft(),key=tileArrayKey(configTileType.value),ref=window.editingConfigTileRef,tile={name:configTileName.value.trim()||'Tile sin nombre',type:configTileType.value,direction:configTileType.value==='wall'?configWallDirection.value:'',color:configTileColor.value,alt:configTileAlt.value,top:configTileAlt.value,accent:configTileAccent.value,rotatable:configTileType.value==='wall'&&configTileRotatable.checked,icon:window.currentConfigTileIconHex||''};if(ref&&floor[ref.key]?.[ref.index]){if(ref.key!==key){floor[ref.key].splice(ref.index,1);floor[key]=floor[key]||[];floor[key].push(tile)}else floor[key][ref.index]=tile;configTilesetStatus.textContent='Tile actualizado en el floor actual. Guarda el floor para consolidarlo.'}else{floor[key]=floor[key]||[];floor[key].push(tile);configTilesetStatus.textContent='Tile añadido al floor actual. Guarda el floor para consolidarlo.'}window.editingConfigFloorJson=floor;window.editingConfigTileRef=null;resetConfigTileForm(false);renderConfigTilesets()};newConfigTileBtn.onclick=()=>{window.editingConfigTileRef=null;resetConfigTileForm();configTilesetStatus.textContent='Formulario listo para un tile nuevo.'};newConfigFloorBtn.onclick=()=>{window.editingConfigFloorId=null;window.editingConfigFloorJson=emptyFloorDraft();configFloorName.value=window.editingConfigFloorJson.name;configFloorStory.value=window.editingConfigFloorJson.story;window.editingConfigTileRef=null;resetConfigTileForm();configTilesetStatus.textContent='Nuevo floor iniciado.';renderConfigTilesets()};saveConfigFloorBtn.onclick=async()=>{const floor=currentFloorDraft();floor.name=configFloorName.value.trim()||'Floor sin nombre';floor.story=configFloorStory.value.trim();configTilesetStatus.textContent='Guardando floor en config_floor...';try{await saveConfigFloorRow(floor);configTilesetStatus.textContent='Floor guardado.'}catch(e){configTilesetStatus.textContent=e.message}};exportConfigTilesetBtn.onclick=()=>{const blob=new Blob([JSON.stringify(currentFloorDraft(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='config-floor.json';a.click();URL.revokeObjectURL(a.href)};importConfigFloorInput.onchange=async()=>{const files=[...importConfigFloorInput.files];configTilesetStatus.textContent='Leyendo floor(s) JSON/ZIP...';try{let count=0;const floorsRaw=await parseImportedJsonFiles(files);for(const raw of floorsRaw){const floor={...emptyFloorDraft(),...(raw.floor_json||raw)};floor.name=floor.name||raw.floor_name||'Floor importado';floor.floorTiles=Array.isArray(floor.floorTiles)?floor.floorTiles:[];floor.wallTiles=Array.isArray(floor.wallTiles)?floor.wallTiles:[];floor.doorTiles=Array.isArray(floor.doorTiles)?floor.doorTiles:[];window.editingConfigFloorId=null;configTilesetStatus.textContent=`Importando floor ${count+1}/${floorsRaw.length}...`;await saveConfigFloorRow(floor);count++}window.editingConfigFloorId=null;configTilesetStatus.textContent=`Importados ${count} floor(s) en config_floor.`}catch(e){configTilesetStatus.textContent=e.message}finally{importConfigFloorInput.value=''}}}


const enemyTypeStats={rogue:{hp:.9,atk:1.15,armor:0},warrior:{hp:1.1,atk:1.05,armor:1},caster:{hp:.85,atk:1.25,armor:0},invocador:{hp:1,atk:1.05,armor:0},clerigo:{hp:1.05,atk:.95,armor:1},chaman:{hp:1,atk:1.1,armor:0},arquero:{hp:.9,atk:1.15,armor:0},francotirador:{hp:.8,atk:1.35,armor:0},tanque:{hp:1.45,atk:.85,armor:3}};
const ENEMY_TIER_BORDER_COLORS={i:'#5fd97a',ii:'#5b9bff',iii:'#b26bff',iv:'#ffd24f'};
const enemyTierWeights={i:44,ii:30,iii:18,iv:8};
function parseEnemyStatsBase(v){if(!v)return{hp:12,atk:4,armor:0,xp:8};if(typeof v==='object')return{...v,hp:+v.hp||12,atk:+(v.atk??v.damage)||4,armor:+v.armor||0,xp:+v.xp||8};try{return parseEnemyStatsBase(JSON.parse(v))}catch(e){return Object.fromEntries(String(v).split(',').map(x=>x.trim().split(':')).filter(x=>x[0]).map(([k,v])=>[k,Number(v)||0]))}}
function normalizeEnemyCoreStats(v,type='warrior'){const defaults={strength:2,vitality:2,agility:2,luck:1,intelligence:1,wisdom:1},bias={rogue:{agility:3,luck:2},warrior:{strength:3,vitality:3},caster:{intelligence:4,wisdom:2},invocador:{intelligence:3,wisdom:3},clerigo:{wisdom:4,vitality:2},chaman:{wisdom:3,intelligence:2},arquero:{agility:3,strength:2},francotirador:{agility:4,luck:2},tanque:{vitality:4,strength:2}}[type]||{};let raw={...defaults,...bias};if(v){try{raw=typeof v==='object'?{...raw,...v}:{...raw,...JSON.parse(v)}}catch(e){String(v).split(',').map(x=>x.trim().split(':')).filter(x=>x[0]).forEach(([k,val])=>raw[k]=Number(val)||0)}}return Object.fromEntries(Object.entries(defaults).map(([k])=>[k,Math.max(0,Math.round(Number(raw[k])||0))]))}
function normalizeEnemyDetail(row){const stats=parseEnemyStatsBase(row.stats_base),type=row.type||'warrior',coreStats=normalizeEnemyCoreStats(stats.coreStats||stats.stats,type),boss=String(row.boss||'no').toLowerCase().startsWith('s');return{id:row.id,family:row.family||'Sin familia',name:row.class||type||'Enemigo',class:row.class||'',type,icon:row.icon||'',boss,tier:String(row.tier||'i').toLowerCase(),weaponType:row.weapon_type||'',stats:coreStats,statsBase:{hp:stats.hp||12,atk:stats.atk||stats.damage||4,armor:stats.armor||0,xp:stats.xp||8},skillIds:String(row.skill||'').split(/[,;\s]+/).map(x=>x.trim()).filter(Boolean)}}
function familyJsonFromDetails(name){return{schemaVersion:1,name,enemies:configEnemyDetails.map(normalizeEnemyDetail).filter(e=>e.family===name),weights:{tiers:enemyTierWeights,bossChance:.06},generatedAt:new Date().toISOString()}}
function enemyDetailRowFromImportedEnemy(enemy,familyName){const e=normalizeEnemyDetail({...enemy,family:enemy.family||familyName,stats_base:enemy.stats_base||enemy.statsBase||enemy.stats||null,class:enemy.class||enemy.name||'',weapon_type:enemy.weapon_type||enemy.weaponType||'',skill:enemy.skill||enemy.skillIds||''});return{family:familyName,icon:e.icon||'',class:e.class||e.name||e.type,type:e.type,boss:e.boss?'si':'no',stats_base:JSON.stringify({...e.statsBase,coreStats:e.stats}),weapon_type:e.weaponType,tier:e.tier,skill:e.skillIds.join(',')}}
function normalizedEnemyFamilies(){return configEnemyFamilies.map(r=>({...(r.family_json||{}),dbId:r.id,name:r.family_json?.name||r.family_name,source:'enemy_family'})).filter(f=>f.name&&Array.isArray(f.enemies)&&f.enemies.length)}
// Enemy level is always anchored to the player's CURRENT level (read live
// from `game`), with a modest per-floor bonus so deeper floors within the
// same dungeon still feel harder at any given character level. This makes
// fresh floor generation correct automatically; precomputed floors (baked
// once at world creation against a synthetic level-1 preview character) are
// re-anchored on load, see scaleFloorForPlayerLevel().
// Clamped to player.level±2 so deeper floors never drift arbitrarily far from
// the character's actual power - the raw floor-based formula still nudges
// enemies up within that band, it just can't escape it.
function enemyLevelForFloor(floor){const playerLevel=game?.floorEntryLevel||game?.player?.level||1;return Math.max(1,Math.round(playerLevel+rng(3)-1))}
// Bosses ignore the floor-paced formula above entirely: always the player's
// own level plus a flat 1-3 (megaboss: 2-4) bump, independent of how deep the
// floor is - recalculated on floor load (scaleFloorForPlayerLevel) and again
// the moment the player levels up mid-floor (rescaleBossOnLevelUp).
function bossLevelForPlayer(){return Math.max(1,(game?.floorEntryLevel||game?.player?.level||1)+randBetween(1,3))}
function megabossLevelForPlayer(){return Math.max(1,(game?.floorEntryLevel||game?.player?.level||1)+randBetween(2,4))}
// Enemy TIER mix shifts from mostly-weak to mostly-strong across the
// dungeon's depth (d=0 at floor 1, d=1 at the last floor), so every run
// reads as a progression on top of any room-specific tier rules, regardless
// of how many floors the world has.
function enemyTierWeightsForDepth(d){
 d=Math.max(0,Math.min(1,d));
 return {
  i:Math.max(6,72-66*d),
  ii:16+14*Math.min(1,d/.5),
  iii:46*Math.max(0,Math.min(1,(d-.08)/.6)),
  iv:56*Math.max(0,Math.min(1,(d-.45)/.55))
 };
}
const ENEMY_TIER_RANK={i:0,ii:1,iii:2,iv:3};
function weightedFamilyEnemy(family,wantBoss=false,floor=1,totalFloors=20,minTier=null){
 let pool=(family.enemies||[]).filter(e=>wantBoss?e.boss:!e.boss);if(!pool.length)pool=family.enemies||[];
 if(minTier){const minRank=ENEMY_TIER_RANK[minTier]??0,filtered=pool.filter(e=>(ENEMY_TIER_RANK[e.tier]??0)>=minRank);if(filtered.length)pool=filtered}
 const depth=(balanceLevel(game?.floorEntryLevel||game?.player?.level||1)-1)/(BALANCE_LEVEL_CAP-1),tierWeights=enemyTierWeightsForDepth(depth);
 const bag=[];pool.forEach(e=>{const w=(wantBoss?2:1)*(tierWeights[e.tier]??12);for(let i=0;i<w;i++)bag.push(e)});
 return pick(bag)||pool[0];
}
function buildConfiguredEnemy(template,pos,floor,wantBoss=false,forcedLevel=null){const boss=wantBoss||template.boss,lvl=forcedLevel||(boss?bossLevelForPlayer():enemyLevelForFloor(floor)),t=enemyTypeStats[template.type]||enemyTypeStats.warrior,base=template.statsBase||{},tierMult={i:1,ii:1.18,iii:1.38,iv:1.7}[template.tier]||1;const varMult=.88+Math.random()*.24,bossMult=boss?1.9:1;const stats=normalizeEnemyCoreStats(template.stats,template.type),statHp=1+stats.vitality*.035,statAtk=1+actorStatDamageBonus({stats},template.type==='caster'||template.type==='invocador'||template.type==='clerigo'||template.type==='chaman'?'magic':'physical')*.018,statArmor=Math.floor(stats.vitality/5)+Math.floor(stats.wisdom/7);const hp=Math.round((base.hp||12)*(1+lvl*.13)*t.hp*tierMult*bossMult*varMult*statHp*worldLifeMultiplier()*ENEMY_HP_BASE_MULT),atk=Math.round((base.atk||4)*(1+lvl*.08)*t.atk*tierMult*(boss?1.35:1)*varMult*statAtk);let e={...pos,type:template.type,name:template.name||template.class||template.type,customEnemy:true,icon:template.icon,level:lvl,tier:template.tier,boss,stats,hp,maxHp:hp,atk,damage:atk,armor:Math.round((base.armor||0)+(t.armor||0)+lvl*.08+statArmor),xp:Math.round((base.xp||8)*(1+lvl*.08)*tierMult*(boss?2.5:1)),skills:[],skillCooldowns:{}};const maxSkills=boss?Math.min(3,1+Math.floor(lvl/8)):Math.min(2,1+Math.floor(lvl/14));e.configuredSkillIds=boss?[]:(template.skillIds||[]).filter(id=>skillDefs[id]).slice(0,maxSkills);return assignEnemySkills(equipEnemy(e,floor))}
// Megaboss stat bump on top of the normal boss formula buildConfiguredEnemy
// already applied above: double HP, +50% damage, +50% core stats (relative
// to what a normal boss of the same level would have) - plus a visual/
// footprint flag used by draw()/inspectedEntityAt()/movement collision to
// occupy a 2x2 area instead of a single tile. "+25% PA" (see enemyTurn's
// AP-mode pool and the classic-mode extra-action roll) is applied where the
// enemy actually acts, not here, since it isn't a baked stat.
function upgradeToMegaboss(e){
 e.megaboss=true;e.boss=true;e.footprint=2;
 e.maxHp=e.hp=Math.round(e.maxHp*2);
 e.atk=e.damage=Math.round(e.atk*1.5);
 e.armor=Math.round((e.armor||0)*1.5);
 if(e.stats)for(const k of Object.keys(e.stats))e.stats[k]=Math.round((e.stats[k]||0)*1.5);
 return e;
}
function compactEnemyForWorld(e){const {icon,...rest}=e;return rest}
// Elite enemies get "Élite " prepended to their name at build time (before
// any world/session snapshot strips their icon to save space) - strip it
// back off here so the name still matches its family template and the icon
// can be recovered instead of silently falling back to the generic shape.
function configuredEnemyTemplateFor(e){const bareName=(e.name||'').replace(/^Élite\s+/,'');const families=normalizedEnemyFamilies(),family=families.find(f=>f.name===(e.enemyFamily||e.family))||families.find(f=>(f.enemies||[]).some(t=>t.type===e.type||t.name===bareName));return (family?.enemies||[]).find(t=>(t.type===e.type&&(!bareName||t.name===bareName||t.class===bareName))||t.name===bareName||t.class===bareName)||null}
function hydratePrecomputedEnemy(e){if(e.customEnemy&&!e.icon){const t=configuredEnemyTemplateFor(e);if(t?.icon)e.icon=t.icon}return equipEnemy(e)}
function pickConfiguredFamilyForFloor(floor){const families=normalizedEnemyFamilies();if(!families.length)throw new Error('No hay familias consolidadas en enemy_family. Crea o importa familias antes de generar la dungeon.');return pick(families)}
function applyInnerAlphaOutline(q,size,px=2){
 const img=q.getImageData(0,0,size,size),src=new Uint8ClampedArray(img.data),dst=img.data;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const idx=(y*size+x)*4;if(src[idx+3]<=8)continue;let edge=false;
  for(let oy=-px;oy<=px&&!edge;oy++)for(let ox=-px;ox<=px;ox++){
   if(Math.abs(ox)+Math.abs(oy)>px)continue;const nx=x+ox,ny=y+oy;
   if(nx<0||ny<0||nx>=size||ny>=size||src[(ny*size+nx)*4+3]<=8){edge=true;break}
  }
  if(edge){dst[idx]=0;dst[idx+1]=0;dst[idx+2]=0;dst[idx+3]=255}
 }
 q.putImageData(img,0,0)
}
function drawEnemyIconHex(hex,x,y,boss=false,mega=false){
 if(!hex)return false;
 let img=tileImageCache.get('enemy:'+hex);if(!img){img=tileImageFromHex(hex);tileImageCache.set('enemy:'+hex,img)}if(!img)return false;
 // A megaboss renders across a full 2x2 block anchored at its own (x,y) tile
 // (top-left corner), instead of centered/overflowing within one tile like a
 // regular boss - see enemyAtCell()/enemyStatusOverlay() for the matching
 // click-target and red-frame handling of that footprint.
 const size=mega?TILE*2:boss?78:58,off=mega?0:(64-size)/2,dx=x+off,dy=y+off;
 const paint=()=>{
  const layer=document.createElement('canvas');layer.width=layer.height=size;
  const lc=layer.getContext('2d');lc.imageSmoothingEnabled=true;lc.drawImage(img,0,0,size,size);
  lc.globalCompositeOperation='source-atop';
  const g=lc.createRadialGradient(size/2,size*.45,3,size/2,size/2,size*.58);
  g.addColorStop(0,boss?'#fff1a84f':'#d7c6ff42');
  g.addColorStop(.62,boss?'#ff9d2840':'#6b4cff35');
  g.addColorStop(1,'#05030858');
  lc.fillStyle=g;lc.fillRect(0,0,size,size);
  applyInnerAlphaOutline(lc,size,2);
  ctx.save();
  ctx.shadowColor=boss?'#ffb94a88':'#8e6dff77';ctx.shadowBlur=boss?10:7;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  ctx.drawImage(layer,dx,dy,size,size);
  ctx.restore();
 };
 if(img.complete){paint();return true}img.onload=()=>game&&draw();return false
}
async function fetchEnemyConfig(){try{const [f,d]=await Promise.all([fetch('/api/enemy-family').then(r=>r.json()),fetch('/api/enemy-detail').then(r=>r.json())]);configEnemyFamilies=Array.isArray(f)?f:[];configEnemyDetails=Array.isArray(d)?d:[];renderEnemyConfig();setupWorldSettings()}catch(e){configEnemyStatus&&(configEnemyStatus.textContent='No se pudo cargar configuración de enemigos: '+e.message)}}
function renderEnemySkillSelect(){const sel=document.getElementById('configEnemySkills');if(sel)sel.innerHTML='<option value="">Selecciona para añadir...</option>'+Object.entries(skillDefs).filter(([,d])=>d.enemyUsable).map(([id,d])=>`<option value="${id}">${d.icon||'•'} ${d.name}</option>`).join('')}
function selectedEnemySkills(){return [...(window.currentEnemySkillPool||[])]}
function renderEnemySkillPool(){const el=document.getElementById('configEnemySkillPool'),ids=selectedEnemySkills();if(!el)return;el.innerHTML=ids.length?ids.map(id=>{const d=skillDefs[id]||{};return`<button type="button" class="enemySkillChip" data-remove-enemy-skill="${id}">${d.icon||'•'} ${d.name||id} ×</button>`}).join(''):'<span class="small">Pool vacío.</span>';document.querySelectorAll('[data-remove-enemy-skill]').forEach(b=>b.onclick=()=>{window.currentEnemySkillPool=selectedEnemySkills().filter(id=>id!==b.dataset.removeEnemySkill);renderEnemySkillPool()})}
function addEnemySkillToPool(id){if(!id)return;const pool=selectedEnemySkills();if(!pool.includes(id))pool.push(id);window.currentEnemySkillPool=pool;configEnemySkills.value='';renderEnemySkillPool()}
function setEnemySkills(ids){window.currentEnemySkillPool=[...(ids||[])];if(configEnemySkills)configEnemySkills.value='';renderEnemySkillPool()}
function currentEnemyRow(){const stats=normalizeEnemyCoreStats({strength:+configEnemyStrength.value||0,vitality:+configEnemyVitality.value||0,agility:+configEnemyAgility.value||0,luck:+configEnemyLuck.value||0,intelligence:+configEnemyIntelligence.value||0,wisdom:+configEnemyWisdom.value||0},configEnemyType.value),statsBase={hp:+configEnemyHp.value||12,atk:+configEnemyAtk.value||4,armor:+configEnemyArmor.value||0,xp:+configEnemyXp.value||8,coreStats:stats};return{family:configEnemyFamilyName.value.trim()||'Sin familia',icon:window.currentConfigEnemyIconHex||'',class:configEnemyClass.value.trim(),type:configEnemyType.value,boss:configEnemyBoss.value,stats_base:JSON.stringify(statsBase),weapon_type:configEnemyWeaponType.value,tier:configEnemyTier.value,skill:selectedEnemySkills().join(',')}}
function resetEnemyForm(){window.editingConfigEnemyId=null;configEnemyClass.value='';configEnemyBoss.value='no';configEnemyTier.value='i';configEnemyHp.value=12;configEnemyAtk.value=4;configEnemyArmor.value=0;configEnemyXp.value=8;configEnemyStrength.value=2;configEnemyVitality.value=2;configEnemyAgility.value=2;configEnemyLuck.value=1;configEnemyIntelligence.value=1;configEnemyWisdom.value=1;setEnemySkills([]);window.currentConfigEnemyIconHex='';renderConfigIconPreview('','configEnemyIconPreview','configEnemyIconStatus');configEnemyStatus.textContent='Nuevo enemigo.'}
function loadEnemyForEdit(id){const row=configEnemyDetails.find(e=>String(e.id)===String(id));if(!row)return;const e=normalizeEnemyDetail(row);window.editingConfigEnemyId=row.id;configEnemyFamilyName.value=e.family;configEnemyClass.value=e.class;configEnemyType.value=e.type;configEnemyBoss.value=e.boss?'si':'no';configEnemyTier.value=e.tier;configEnemyWeaponType.value=e.weaponType;configEnemyHp.value=e.statsBase.hp;configEnemyAtk.value=e.statsBase.atk;configEnemyArmor.value=e.statsBase.armor;configEnemyXp.value=e.statsBase.xp;configEnemyStrength.value=e.stats.strength;configEnemyVitality.value=e.stats.vitality;configEnemyAgility.value=e.stats.agility;configEnemyLuck.value=e.stats.luck;configEnemyIntelligence.value=e.stats.intelligence;configEnemyWisdom.value=e.stats.wisdom;setEnemySkills(e.skillIds);window.currentConfigEnemyIconHex=e.icon;renderConfigIconPreview(e.icon,'configEnemyIconPreview','configEnemyIconStatus');configEnemyIconStatus.textContent=e.icon?'Icono cargado desde enemigo guardado.':'Sin icono';configEnemyStatus.textContent=`Editando enemigo #${row.id}.`}
function renderEnemyConfig(){renderEnemySkillSelect();renderEnemySkillPool();if(configEnemyWeaponType&&!configEnemyWeaponType.options.length)configEnemyWeaponType.innerHTML=configWeaponTypes.map(c=>`<option value="${c}">${c}</option>`).join('');if(configEnemyFamiliesList)configEnemyFamiliesList.innerHTML=(configEnemyFamilies.length?configEnemyFamilies.map(r=>`<div class="configItem"><span class="tierDot" style="background:#9b65d8"></span><div><b>${r.family_name}</b><span class="small">${(r.family_json?.enemies||[]).length} enemigos en JSON</span><div class="configItemActions"><button type="button" data-load-family="${r.id}">Editar familia</button></div></div></div>`).join(''):'<p class="small">No hay familias consolidadas.</p>');if(configEnemiesList){if(configEnemyDetails.length){const groups={};configEnemyDetails.map(normalizeEnemyDetail).forEach(e=>{(groups[e.family]||(groups[e.family]=[])).push(e)});configEnemiesList.innerHTML=Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).map(([family,enemies])=>`<details class="configSlotGroup" open><summary>${family}<b>${enemies.length}</b></summary><div class="configSlotItems">${enemies.map(e=>`<div class="configItem"><span class="tierDot" style="background:${e.boss?'#ffb746':'#75e39d'}"></span><div><b>${e.class||e.type}</b><span class="small">${e.type} · tier ${e.tier.toUpperCase()} · boss ${e.boss?'sí':'no'} · ${e.skillIds.length} skill(s)</span><div class="configItemActions"><button type="button" data-edit-enemy="${e.id}">Editar</button></div></div></div>`).join('')}</div></details>`).join('')}else configEnemiesList.innerHTML='<p class="small">No hay enemigos individuales.</p>'}document.querySelectorAll('[data-edit-enemy]').forEach(b=>b.onclick=()=>loadEnemyForEdit(b.dataset.editEnemy));document.querySelectorAll('[data-load-family]').forEach(b=>b.onclick=()=>{const r=configEnemyFamilies.find(x=>String(x.id)===b.dataset.loadFamily);if(r){configEnemyFamilyName.value=r.family_name;configEnemyStatus.textContent=`Familia ${r.family_name} cargada para editar enemigos.`}})}
function setupEnemyConfigMode(){setupImageIconEditor({inputId:'configEnemyImageInput',canvasId:'configEnemyCropCanvas',previewId:'configEnemyIconPreview',statusId:'configEnemyIconStatus',zoomId:'configEnemyCropZoom',eraserId:'configEnemyMagicEraserBtn',toleranceId:'configEnemyMagicTolerance',hexKey:'currentConfigEnemyIconHex',statusPrefix:'Icono enemigo'});window.currentEnemySkillPool=window.currentEnemySkillPool||[];renderEnemyConfig();configEnemySkills.onchange=()=>addEnemySkillToPool(configEnemySkills.value);saveConfigEnemyBtn.onclick=async()=>{configEnemyStatus.textContent='Guardando enemigo...';try{const row=currentEnemyRow(),id=window.editingConfigEnemyId,r=await fetch(id?`/api/enemy-detail?id=${encodeURIComponent(id)}`:'/api/enemy-detail',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(row)}),data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar enemigo');await fetchEnemyConfig();configEnemyStatus.textContent='Enemigo guardado.'}catch(e){configEnemyStatus.textContent=e.message}};newConfigEnemyBtn.onclick=resetEnemyForm;saveEnemyFamilyBtn.onclick=async()=>{try{const name=configEnemyFamilyName.value.trim()||'Sin familia',json=familyJsonFromDetails(name),existing=configEnemyFamilies.find(r=>r.family_name===name),r=await fetch(existing?`/api/enemy-family?id=${existing.id}`:'/api/enemy-family',{method:existing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({family_name:name,family_json:json})}),data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo consolidar');await fetchEnemyConfig();configEnemyStatus.textContent='Familia consolidada en enemy_family.'}catch(e){configEnemyStatus.textContent=e.message}};exportEnemyFamilyBtn.onclick=()=>{const blob=new Blob([JSON.stringify(familyJsonFromDetails(configEnemyFamilyName.value.trim()||'Sin familia'),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='enemy-family.json';a.click();URL.revokeObjectURL(a.href)};importEnemyFamilyInput.onchange=async()=>{try{let familyCount=0,enemyCount=0;const familiesRaw=await parseImportedJsonFiles([...importEnemyFamilyInput.files]);for(const raw of familiesRaw){const j=raw.family_json||raw,name=j.name||raw.family_name||'Familia importada',r=await fetch('/api/enemy-family',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({family_name:name,family_json:{...j,name}})}),data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo importar familia');familyCount++;const enemies=Array.isArray(j.enemies)?j.enemies:[];if(enemies.length){const detailRows=enemies.map(e=>enemyDetailRowFromImportedEnemy(e,name));await postJsonRows('/api/enemy-detail',detailRows);enemyCount+=detailRows.length}}await fetchEnemyConfig();configEnemyStatus.textContent=`Importadas ${familyCount} familia(s) y ${enemyCount} enemigo(s) individuales en enemy_detail.`}catch(e){configEnemyStatus.textContent=e.message}finally{importEnemyFamilyInput.value=''}}}

// ---- Treasure chest config (config_chest) --------------------------------
// A chest definition = tier (1-5, chest rarity/quality) + type (equipment/
// weapon/potion/skill) + icon + which item rarities it can drop + optionally
// a hand-picked pool of specific items/skills (empty pool = fully random
// within the selected item tiers). These replace the generic chests during
// dungeon generation; the chest TIER actually rolled depends on the floor
// (see chestTierForFloor()).
let configChests=[];
async function fetchConfigChests(){try{const r=await fetch('/api/config-chest');const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron cargar cofres');configChests=Array.isArray(data)?data:[];renderConfigChests()}catch(e){const st=document.getElementById('configChestStatus');if(st)st.textContent=`Error cargando config_chest: ${e.message}`}}
// offhand ("mano secundaria"/mano izquierda) counts as weapon type, not equipment
function chestItemMatchesType(j,type,slotFilter='all',weaponTypeFilter='all'){
 if(type==='potion')return j.type==='potion'||j.type==='consumable'||j.slot==='consumable';
 if(type==='weapon'){
  if(j.slot!=='weapon'&&j.slot!=='offhand')return false;
  if(weaponTypeFilter&&weaponTypeFilter!=='all'&&j.weaponType!==weaponTypeFilter)return false;
  return true;
 }
 if(j.type==='potion'||j.slot==='weapon'||j.slot==='offhand')return false;
 if(slotFilter&&slotFilter!=='all'&&j.slot!==slotFilter)return false;
 return true;
}
function chestSearchPool(type,slotFilter='all',weaponTypeFilter='all'){
 if(type==='skill')return Object.entries(skillDefs).map(([id,s])=>({id,label:s.name,rarity:s.rarity||'common'}));
 return configItems.filter(i=>chestItemMatchesType(i.item_json||i,type,slotFilter,weaponTypeFilter)).map(i=>({id:String(i.id),label:i.nombre||(i.item_json||i).name||'Sin nombre',rarity:(i.item_json||i).rarity||i.tier||'common',hidden:!!(i.item_json||i).hidden}));
}
function checkedChestItemTiers(){return [...document.querySelectorAll('#configChestItemTiers input[type=checkbox]:checked')].map(cb=>cb.value)}
// A special "Aleatorio" pick sits alongside the concrete items: when it's
// among the selected ids, the chest can also resolve to any item matching
// the chest's own rarity+type instead of only the hand-picked ones.
const CHEST_RANDOM_PICK_ID='__random__';
function renderChestItemResults(){
 const root=document.getElementById('configChestItemResults'),summary=document.getElementById('configChestSpecificSummary');
 if(!root)return;
 const type=document.getElementById('configChestType')?.value||'equipment',q=(document.getElementById('configChestItemSearch')?.value||'').trim().toLowerCase();
 const slotFilter=document.getElementById('configChestSlotFilter')?.value||'all',weaponTypeFilter=document.getElementById('configChestWeaponTypeFilter')?.value||'all';
 window.currentChestItemIds=window.currentChestItemIds||[];
 const tiers=checkedChestItemTiers();
 // Hidden items/potions only surface in the results once the search text
 // actually matches - never in the default (empty-search) list.
 const pool=chestSearchPool(type,slotFilter,weaponTypeFilter).filter(x=>tiers.includes(x.rarity)).filter(x=>q?x.label.toLowerCase().includes(q):!x.hidden).slice(0,60);
 const randomRow=`<label class="configItem"><input type="checkbox" data-chest-item-pick="${CHEST_RANDOM_PICK_ID}" ${window.currentChestItemIds.includes(CHEST_RANDOM_PICK_ID)?'checked':''}><span>🎲 Aleatorio (cualquier item de la rareza y tipo definidos)</span></label>`;
 root.innerHTML=randomRow+(pool.length?pool.map(x=>`<label class="configItem"><input type="checkbox" data-chest-item-pick="${x.id}" ${window.currentChestItemIds.includes(x.id)?'checked':''}><span>${x.label}</span></label>`).join(''):'<p class="small">Sin resultados para esos tiers.</p>');
 const updateSummary=()=>{if(summary)summary.textContent=window.currentChestItemIds.length?`${window.currentChestItemIds.length} opción(es) posibles al abrir (incluye aleatorio si está marcado).`:'Nada seleccionado: el cofre no soltará objeto.'};
 root.querySelectorAll('[data-chest-item-pick]').forEach(cb=>cb.onchange=()=>{
  const id=cb.dataset.chestItemPick;
  window.currentChestItemIds=cb.checked?[...window.currentChestItemIds,id]:window.currentChestItemIds.filter(x=>x!==id);
  updateSummary();
 });
 updateSummary();
}
function toggleChestTypeFields(){
 const type=document.getElementById('configChestType')?.value||'equipment';
 document.getElementById('configChestSlotFilterWrap')?.classList.toggle('hidden',type!=='equipment');
 document.getElementById('configChestWeaponTypeFilterWrap')?.classList.toggle('hidden',type!=='weapon');
}
function currentConfigChestJson(){
 const itemTiers=checkedChestItemTiers();
 return {
  name:document.getElementById('configChestName')?.value.trim()||'Cofre sin nombre',
  tier:Number(document.getElementById('configChestTier')?.value)||1,
  type:document.getElementById('configChestType')?.value||'equipment',
  slotFilter:document.getElementById('configChestSlotFilter')?.value||'all',
  weaponTypeFilter:document.getElementById('configChestWeaponTypeFilter')?.value||'all',
  icon:window.currentConfigChestIconHex||'',
  itemTiers:itemTiers.length?itemTiers:['common'],
  itemIds:[...(window.currentChestItemIds||[])]
 };
}
function resetConfigChestForm(){
 window.editingConfigChestId=null;window.currentChestItemIds=[CHEST_RANDOM_PICK_ID];window.currentConfigChestIconHex='';
 document.getElementById('configChestName').value='';
 document.getElementById('configChestTier').value='1';
 document.getElementById('configChestType').value='equipment';
 document.getElementById('configChestSlotFilter').value='all';
 document.getElementById('configChestWeaponTypeFilter').value='all';
 document.getElementById('configChestItemSearch').value='';
 document.querySelectorAll('#configChestItemTiers input[type=checkbox]').forEach(cb=>cb.checked=cb.value==='common');
 toggleChestTypeFields();
 renderConfigIconPreview('','configChestIconPreview','configChestIconStatus');
 renderChestItemResults();
 const st=document.getElementById('configChestStatus');if(st)st.textContent='Formulario listo para un cofre nuevo.';
}
function loadConfigChestForEdit(id){
 const row=configChests.find(r=>String(r.id)===String(id));if(!row)return;
 const c=row.chest_json||{};
 window.editingConfigChestId=row.id;window.currentChestItemIds=[...(c.itemIds||[])];window.currentConfigChestIconHex=c.icon||'';
 document.getElementById('configChestName').value=c.name||'';
 document.getElementById('configChestTier').value=String(c.tier||1);
 document.getElementById('configChestType').value=c.type||'equipment';
 document.getElementById('configChestSlotFilter').value=c.slotFilter||'all';
 document.getElementById('configChestWeaponTypeFilter').value=c.weaponTypeFilter||'all';
 document.getElementById('configChestItemSearch').value='';
 toggleChestTypeFields();
 document.querySelectorAll('#configChestItemTiers input[type=checkbox]').forEach(cb=>cb.checked=(c.itemTiers||['common']).includes(cb.value));
 renderConfigIconPreview(c.icon||'','configChestIconPreview','configChestIconStatus');
 renderChestItemResults();
 const st=document.getElementById('configChestStatus');if(st)st.textContent=`Editando ${c.name||'cofre'}.`;
}
async function removeConfigChest(id){
 if(!confirm('¿Borrar este cofre?'))return;
 try{const r=await fetch(`/api/config-chest?id=${encodeURIComponent(id)}`,{method:'DELETE'});const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo borrar');await fetchConfigChests();if(String(window.editingConfigChestId)===String(id))resetConfigChestForm()}catch(e){const st=document.getElementById('configChestStatus');if(st)st.textContent=e.message}
}
function renderConfigChests(){
 const root=document.getElementById('configChestsList');if(!root)return;
 if(!configChests.length){root.innerHTML='<p class="small">No hay cofres configurados.</p>';return}
 const typeLabels={equipment:'Equipo',weapon:'Arma',potion:'Poción',skill:'Habilidad'};
 const sorted=[...configChests].sort((a,b)=>(a.chest_json?.tier||1)-(b.chest_json?.tier||1)||String(a.chest_json?.type||'').localeCompare(String(b.chest_json?.type||'')));
 root.innerHTML=sorted.map(r=>{const c=r.chest_json||{},ids=c.itemIds||[],specificCount=ids.filter(id=>id!==CHEST_RANDOM_PICK_ID).length,hasRandom=!ids.length||ids.includes(CHEST_RANDOM_PICK_ID),parts=[specificCount?`${specificCount} concreto(s)`:null,hasRandom?'Aleatorio':null].filter(Boolean).join(' + ')||'Sin objetos';return `<div class="configItem"><span class="tierDot" style="background:${tierDefs[(c.itemTiers||[])[0]]?.color||'#ddd'}"></span><div><b>${c.name||'Cofre'}</b><span class="small">Tier ${c.tier||1} · ${typeLabels[c.type]||c.type} · ${parts}</span><div class="configItemActions"><button type="button" data-chest-edit="${r.id}">Editar</button><button type="button" data-chest-delete="${r.id}">Borrar</button></div></div></div>`}).join('');
 root.querySelectorAll('[data-chest-edit]').forEach(b=>b.onclick=()=>loadConfigChestForEdit(b.dataset.chestEdit));
 root.querySelectorAll('[data-chest-delete]').forEach(b=>b.onclick=()=>removeConfigChest(b.dataset.chestDelete));
}
function setupChestConfigMode(){
 setupImageIconEditor({inputId:'configChestImageInput',canvasId:'configChestCropCanvas',previewId:'configChestIconPreview',statusId:'configChestIconStatus',zoomId:'configChestCropZoom',eraserId:'configChestMagicEraserBtn',toleranceId:'configChestMagicTolerance',hexKey:'currentConfigChestIconHex',statusPrefix:'Icono cofre'});
 window.currentChestItemIds=window.currentChestItemIds||[];
 const weaponTypeSel=document.getElementById('configChestWeaponTypeFilter');
 if(weaponTypeSel&&weaponTypeSel.options.length<=1)weaponTypeSel.insertAdjacentHTML('beforeend',configWeaponTypes.map(c=>`<option value="${c}">${c}</option>`).join(''));
 toggleChestTypeFields();
 renderConfigChests();renderChestItemResults();
 document.getElementById('configChestType').onchange=()=>{toggleChestTypeFields();renderChestItemResults()};
 document.getElementById('configChestSlotFilter').onchange=renderChestItemResults;
 document.getElementById('configChestWeaponTypeFilter').onchange=renderChestItemResults;
 document.getElementById('configChestItemSearch').oninput=renderChestItemResults;
 document.querySelectorAll('#configChestItemTiers input[type=checkbox]').forEach(cb=>cb.onchange=renderChestItemResults);
 document.getElementById('saveConfigChestBtn').onclick=async()=>{
  const st=document.getElementById('configChestStatus');st.textContent='Guardando cofre...';
  try{
   const chest=currentConfigChestJson(),id=window.editingConfigChestId;
   const r=await fetch(id?`/api/config-chest?id=${encodeURIComponent(id)}`:'/api/config-chest',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chest_name:chest.name,chest_json:chest})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar el cofre');
   await fetchConfigChests();st.textContent='Cofre guardado.';
  }catch(e){st.textContent=e.message}
 };
 document.getElementById('newConfigChestBtn').onclick=resetConfigChestForm;
}
// ---- World object icons (config_world_object) ------------------------------
// A fixed, known set of non-user-created world props (altars per kind, keys,
// stairs down, traps, one marker per ROOM_TYPES entry) that can each get a
// custom icon overriding their procedural pixel sprite. Unlike every other
// config_* table, rows are upserted by object_key instead of by id, and this
// hits /api/config-floor?kind=object instead of its own serverless function
// - Vercel's Hobby plan caps a project at 12 Serverless Functions and this
// repo was already at that limit (see api/config-floor.js).
const WORLD_OBJECT_KINDS=[
 {key:'altar_heal',label:'Altar: Curación'},
 {key:'altar_shield',label:'Altar: Escudo'},
 {key:'altar_power',label:'Altar: Poder'},
 {key:'altar_disenchant',label:'Altar: Creador (deshacer objetos)'},
 {key:'key',label:'Llave'},
 {key:'stairsDown',label:'Escaleras de bajada'},
 {key:'trap',label:'Trampa'},
 {key:'reward_lock',label:'Bloqueos rewards'},
 ...LOOT_RARITY_ORDER.map(t=>({key:`shard_${t}`,label:`Shard: ${tierDefs[t]?.label||t}`})),
 ...Object.entries(ROOM_TYPES).map(([id,T])=>({key:`room_${id}`,label:`Sala: ${T.label}`}))
];
let configWorldObjects={};
let configWorldObjectRows={};
let configWorldObjectsLoaded=false;
// Decoration assets: user-created rows in config_world_object whose
// object_key starts with ASSET_KEY_PREFIX. Unlike the fixed WORLD_OBJECT_KINDS
// catalog above (icon-only overrides for system props), these carry their
// own name and a tiles_number footprint ("cols;rows") used to scatter them
// across dungeon rooms during generation - see placeRoomAssets().
const ASSET_KEY_PREFIX='asset_';
function parseTilesNumber(tn){
 const parts=String(tn||'1;1').split(';');
 const cols=Math.max(1,Math.min(ROWS,parseInt(parts[0],10)||1));
 const rows=Math.max(1,Math.min(ROWS,parseInt(parts[1],10)||1));
 return {cols,rows};
}
// Per-cell collision mask for an asset's cols x rows footprint, stored as
// rows joined by ';' and cells joined by ',' (1=blocked, 0=walkable). Missing/
// short rows or cells default to blocked (1), so assets saved before this
// mask existed keep behaving as a fully solid footprint.
function parseTilesMask(tm,cols,rows){
 const rowsArr=String(tm||'').split(';');
 const mask=[];
 for(let y=0;y<rows;y++){
  const cellsStr=rowsArr[y]?rowsArr[y].split(','):[];
  const row=[];
  for(let x=0;x<cols;x++)row.push(cellsStr[x]===undefined?true:cellsStr[x]==='1');
  mask.push(row);
 }
 return mask;
}
function serializeAssetMask(mask){return (mask||[]).map(row=>row.map(b=>b?1:0).join(',')).join(';')}
// Small stored-icon preview size: same w:h ratio as cols:rows, capped to 50px
// on the longer side (matches setupImageIconEditor's outSize() for assets).
function assetPreviewDims(cols,rows){
 const ratio=Math.max(cols,1)/Math.max(rows,1);
 let w=50,h=Math.round(50/ratio);
 if(h>50){h=50;w=Math.round(50*ratio)}
 return {w:Math.max(1,w),h:Math.max(1,h)};
}
function listConfigAssets(){
 return Object.values(configWorldObjectRows).filter(r=>r.object_key.startsWith(ASSET_KEY_PREFIX)).map(r=>{
  const {cols,rows}=parseTilesNumber(r.tiles_number);
  return {key:r.object_key,name:r.name||r.object_key,icon:r.icon||'',cols,rows,mask:parseTilesMask(r.tiles_mask,cols,rows),ambiente:r.ambiente||''};
 });
}
async function fetchConfigWorldObjects(){
 try{
  const r=await fetch('/api/config-floor?kind=object');const data=await r.json();
  if(!r.ok)throw new Error(data.error||'No se pudieron cargar los objetos del mundo');
  const rows=Array.isArray(data)?data:[];
  configWorldObjects=Object.fromEntries(rows.map(row=>[row.object_key,row.icon||'']));
  configWorldObjectRows=Object.fromEntries(rows.map(row=>[row.object_key,row]));
  configWorldObjectsLoaded=true;
  renderConfigWorldObjectsList();
  renderConfigAssetsList();
  renderWorldFloorPlan();
  if(game)draw();
 }catch(e){const st=document.getElementById('configWorldObjectStatus');if(st)st.textContent=`Error cargando config_world_object: ${e.message}`}
}
function renderConfigWorldObjectsList(){
 const root=document.getElementById('configWorldObjectsList');if(!root)return;
 root.innerHTML=WORLD_OBJECT_KINDS.map(k=>{const hex=configWorldObjects[k.key];return `<div class="configItem"><span class="tierDot" style="background:${hex?'#8c72e8':'#4d395a'}"></span><div><b>${k.label}</b><span class="small">${hex?'Icono personalizado':'Sprite por defecto'}</span><div class="configItemActions"><button type="button" data-edit-world-object="${k.key}">Editar</button></div></div></div>`}).join('');
 root.querySelectorAll('[data-edit-world-object]').forEach(b=>b.onclick=()=>loadWorldObjectForEdit(b.dataset.editWorldObject));
}
function loadWorldObjectForEdit(objectKey){
 window.editingWorldObjectKey=objectKey;
 const kind=WORLD_OBJECT_KINDS.find(k=>k.key===objectKey);
 document.getElementById('configWorldObjectSelected').textContent=`Editando: ${kind?.label||objectKey}`;
 window.currentConfigWorldObjectIconHex=configWorldObjects[objectKey]||'';
 renderConfigIconPreview(window.currentConfigWorldObjectIconHex,'configWorldObjectIconPreview','configWorldObjectIconStatus');
 document.getElementById('configWorldObjectIconStatus').textContent=window.currentConfigWorldObjectIconHex?'Icono personalizado activo.':'Sin icono: usará el sprite por defecto.';
}
function setupConfigWorldObjectsMode(){
 setupImageIconEditor({inputId:'configWorldObjectImageInput',canvasId:'configWorldObjectCropCanvas',previewId:'configWorldObjectIconPreview',statusId:'configWorldObjectIconStatus',zoomId:'configWorldObjectCropZoom',eraserId:'configWorldObjectMagicEraserBtn',toleranceId:'configWorldObjectMagicTolerance',hexKey:'currentConfigWorldObjectIconHex',statusPrefix:'Icono objeto'});
 renderConfigWorldObjectsList();
 document.getElementById('saveConfigWorldObjectBtn').onclick=async()=>{
  const st=document.getElementById('configWorldObjectStatus'),objectKey=window.editingWorldObjectKey;
  if(!objectKey){st.textContent='Elige primero un objeto de la lista.';return}
  st.textContent='Guardando icono...';
  try{
   const r=await fetch('/api/config-floor?kind=object',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({object_key:objectKey,icon:window.currentConfigWorldObjectIconHex||''})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar el icono');
   configWorldObjects[objectKey]=window.currentConfigWorldObjectIconHex||'';
   renderConfigWorldObjectsList();
   st.textContent='Icono guardado.';
   if(game)draw();
  }catch(e){st.textContent=e.message}
 };
 document.getElementById('rollbackConfigWorldObjectBtn').onclick=()=>{
  window.currentConfigWorldObjectIconHex='';
  renderConfigIconPreview('','configWorldObjectIconPreview','configWorldObjectIconStatus');
  document.getElementById('configWorldObjectIconStatus').textContent='Sin icono: usará el sprite por defecto.';
 };
}
// ---- Decoration assets (config_world_object, object_key prefix asset_) ----
function renderConfigAssetRow(a){return `<div class="configItem"><span class="tierDot" style="background:${a.icon?'#8c72e8':'#4d395a'}"></span><div><b>${a.name}</b><span class="small">${a.cols}x${a.rows} tiles</span><div class="configItemActions"><button type="button" data-edit-asset="${a.key}">Editar</button><button type="button" data-delete-asset="${a.key}">Borrar</button></div></div></div>`}
function renderConfigAssetsList(){
 const root=document.getElementById('configAssetsList');if(!root)return;
 const assets=listConfigAssets();
 if(!assets.length){root.innerHTML='<p class="small">Todavía no hay assets creados.</p>'}
 else{
  const grouped=assets.reduce((acc,a)=>{const key=a.ambiente||'Sin ambiente';(acc[key]??=[]).push(a);return acc},{});
  const orderedKeys=Object.keys(grouped).sort((a,b)=>a==='Sin ambiente'?1:b==='Sin ambiente'?-1:a.localeCompare(b,'es'));
  // Collapsed by default (unlike other config accordions): with many
  // ambientes the saved-assets panel would otherwise open fully expanded.
  root.innerHTML=orderedKeys.map(key=>`<details class="configSlotGroup"><summary><span>${key}</span><b>${grouped[key].length}</b></summary><div class="configSlotItems">${grouped[key].map(renderConfigAssetRow).join('')}</div></details>`).join('');
 }
 root.querySelectorAll('[data-edit-asset]').forEach(b=>b.onclick=()=>loadAssetForEdit(b.dataset.editAsset));
 root.querySelectorAll('[data-delete-asset]').forEach(b=>b.onclick=()=>deleteConfigAsset(b.dataset.deleteAsset));
 renderConfigAssetAmbienteOptions(assets);
}
// Datalist of every distinct ambiente already used across saved assets, so
// the field behaves as free text (type anything) with existing values
// offered as suggestions instead of a closed dropdown.
function renderConfigAssetAmbienteOptions(assets=listConfigAssets()){
 const list=document.getElementById('configAssetAmbienteList');if(!list)return;
 const values=[...new Set(assets.map(a=>a.ambiente).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 list.innerHTML=values.map(v=>`<option value="${v}">`).join('');
}
// Grid overlay letting the admin mark, per tile of the asset's cols x rows
// footprint, whether it's walkable or blocks movement (players and
// monsters alike - the mask is consumed as-is by placeRoomAssets/
// buildFloorPlan, there's no separate PJ-vs-monster distinction).
function currentAssetGridDims(){
 const cols=Math.max(1,Math.min(ROWS,parseInt(document.getElementById('configAssetCols').value,10)||1));
 const rows=Math.max(1,Math.min(ROWS,parseInt(document.getElementById('configAssetRows').value,10)||1));
 return {cols,rows};
}
function ensureConfigAssetMask(cols,rows){
 const old=window.currentConfigAssetMask||[];
 const mask=[];
 for(let y=0;y<rows;y++){
  const row=[];
  for(let x=0;x<cols;x++)row.push(old[y]?.[x]!==undefined?old[y][x]:true);
  mask.push(row);
 }
 window.currentConfigAssetMask=mask;
 return mask;
}
function renderConfigAssetGrid(){
 const canvas=document.getElementById('configAssetGridCanvas');if(!canvas)return;
 const {cols,rows}=currentAssetGridDims();
 const mask=ensureConfigAssetMask(cols,rows);
 // Real in-game size: exactly cols x rows tiles at TILE px each, so the
 // preview shows precisely how large/how it'll look on the dungeon grid.
 canvas.width=cols*TILE;canvas.height=rows*TILE;
 const g=canvas.getContext('2d');g.imageSmoothingEnabled=true;
 g.clearRect(0,0,canvas.width,canvas.height);
 const preview=document.getElementById('configAssetIconPreview');
 if(preview)g.drawImage(preview,0,0,canvas.width,canvas.height);
 const cw=canvas.width/cols,ch=canvas.height/rows;
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  g.fillStyle=mask[y][x]?'rgba(220,60,60,.4)':'rgba(70,210,140,.32)';
  g.fillRect(x*cw,y*ch,cw,ch);
  g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=1;g.strokeRect(x*cw+.5,y*ch+.5,cw-1,ch-1);
 }
 const hint=document.getElementById('configAssetGridHint');
 if(hint)hint.textContent=`${cols}x${rows} tiles. Rojo = bloqueado, verde = transitable (PJ y monstruos). Clic en una casilla para alternar.`;
}
function resetConfigAssetForm(){
 window.editingAssetKey=null;
 document.getElementById('configAssetName').value='';
 document.getElementById('configAssetCols').value='1';
 document.getElementById('configAssetRows').value='1';
 document.getElementById('configAssetAmbiente').value='';
 window.currentConfigAssetIconHex='';
 window.currentConfigAssetMask=null;
 renderConfigIconPreview('','configAssetIconPreview','configAssetIconStatus',true,assetPreviewDims(1,1));
 renderConfigAssetGrid();
 document.getElementById('configAssetSelected').textContent='Nuevo asset (aún no guardado).';
 document.getElementById('configAssetStatus').textContent='';
}
function loadAssetForEdit(objectKey){
 const asset=listConfigAssets().find(a=>a.key===objectKey);if(!asset)return;
 window.editingAssetKey=objectKey;
 document.getElementById('configAssetName').value=asset.name;
 document.getElementById('configAssetCols').value=asset.cols;
 document.getElementById('configAssetRows').value=asset.rows;
 document.getElementById('configAssetAmbiente').value=asset.ambiente||'';
 window.currentConfigAssetIconHex=asset.icon||'';
 window.currentConfigAssetMask=asset.mask;
 renderConfigIconPreview(asset.icon||'','configAssetIconPreview','configAssetIconStatus',true,assetPreviewDims(asset.cols,asset.rows));
 renderConfigAssetGrid();
 document.getElementById('configAssetSelected').textContent=`Editando: ${asset.name}`;
 document.getElementById('configAssetStatus').textContent='';
}
async function deleteConfigAsset(objectKey){
 if(!confirm('¿Borrar este asset?'))return;
 const st=document.getElementById('configAssetStatus');
 try{
  const r=await fetch(`/api/config-floor?kind=object&object_key=${encodeURIComponent(objectKey)}`,{method:'DELETE'});
  const data=await r.json();if(!r.ok)throw new Error((Array.isArray(data)?data[0]?.error:data.error)||'No se pudo borrar el asset');
  delete configWorldObjectRows[objectKey];delete configWorldObjects[objectKey];
  if(window.editingAssetKey===objectKey)resetConfigAssetForm();
  renderConfigAssetsList();
  if(st)st.textContent='Asset borrado.';
 }catch(e){if(st)st.textContent=e.message}
}
function setupConfigAssetsMode(){
 const assetIconEditor=setupImageIconEditor({inputId:'configAssetImageInput',canvasId:'configAssetCropCanvas',previewId:'configAssetIconPreview',statusId:'configAssetIconStatus',zoomId:'configAssetCropZoom',eraserId:'configAssetMagicEraserBtn',toleranceId:'configAssetMagicTolerance',hexKey:'currentConfigAssetIconHex',statusPrefix:'Icono asset',onSave:renderConfigAssetGrid,aspect:()=>{const {cols,rows}=currentAssetGridDims();return{w:cols,h:rows}}});
 renderConfigAssetsList();
 renderConfigAssetGrid();
 const onGridSizeChange=()=>{assetIconEditor?.reclamp?.();renderConfigAssetGrid()};
 document.getElementById('configAssetCols').oninput=onGridSizeChange;
 document.getElementById('configAssetRows').oninput=onGridSizeChange;
 const gridCanvas=document.getElementById('configAssetGridCanvas');
 if(gridCanvas)gridCanvas.onclick=e=>{
  const {cols,rows}=currentAssetGridDims();
  const b=gridCanvas.getBoundingClientRect();
  const cx=Math.floor((e.clientX-b.left)*gridCanvas.width/b.width/(gridCanvas.width/cols));
  const cy=Math.floor((e.clientY-b.top)*gridCanvas.height/b.height/(gridCanvas.height/rows));
  const mask=ensureConfigAssetMask(cols,rows);
  if(mask[cy]?.[cx]!==undefined){mask[cy][cx]=!mask[cy][cx];renderConfigAssetGrid()}
 };
 document.getElementById('saveConfigAssetBtn').onclick=async()=>{
  const st=document.getElementById('configAssetStatus');
  const name=document.getElementById('configAssetName').value.trim();
  if(!name){st.textContent='Ponle un nombre al asset.';return}
  const {cols,rows}=currentAssetGridDims();
  const tilesNumber=`${cols};${rows}`;
  const tilesMask=serializeAssetMask(ensureConfigAssetMask(cols,rows));
  const ambiente=document.getElementById('configAssetAmbiente').value.trim();
  const objectKey=window.editingAssetKey;
  st.textContent='Guardando asset...';
  try{
   const body={name,tiles_number:tilesNumber,tiles_mask:tilesMask,ambiente,icon:window.currentConfigAssetIconHex||''};
   let r;
   if(objectKey){r=await fetch('/api/config-floor?kind=object',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,object_key:objectKey})})}
   else{r=await fetch('/api/config-floor?kind=object',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
   const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar el asset');
   const row=Array.isArray(data)?data[0]:data;
   configWorldObjectRows[row.object_key]=row;configWorldObjects[row.object_key]=row.icon||'';
   window.editingAssetKey=row.object_key;
   renderConfigAssetsList();
   document.getElementById('configAssetSelected').textContent=`Editando: ${row.name}`;
   st.textContent='Asset guardado.';
  }catch(e){st.textContent=e.message}
 };
 document.getElementById('newConfigAssetBtn').onclick=resetConfigAssetForm;
}

// ============================================================================
// UNLOCK GATES - min PJ level / min accumulated points required to pick a
// given race or class at character creation. Stored in config_unlock_gates,
// served through config-class.js?kind=gates (Vercel function-count limit).
// ============================================================================
let configGates={};
let configGatesLoaded=false;
function gateKeyOf(type,key){return `${type}:${key}`}
function gateFor(type,key){return configGates[gateKeyOf(type,key)]||{min_level:0,min_points:0}}
function gateUnlocked(type,key){
 const g=gateFor(type,key);
 const lvl=Number(window.currentUser?.max_pj_lv)||0,pts=Number(window.currentUser?.accumulated_points)||0;
 return lvl>=(g.min_level||0)&&pts>=(g.min_points||0);
}
// Cheapest-to-unlock first, so character creation reads as a progression:
// always-available options up top, harder gates further down.
function sortByGate(type,ids){
 return [...ids].sort((a,b)=>{
  const ga=gateFor(type,a),gb=gateFor(type,b);
  return (ga.min_level-gb.min_level)||(ga.min_points-gb.min_points);
 });
}
async function fetchConfigGates(){
 try{
  const r=await fetch('/api/config-class?kind=gates');const data=await r.json();
  if(!r.ok)throw new Error(data.error||'No se pudieron cargar los bloqueos');
  configGates={};
  for(const row of (Array.isArray(data)?data:[]))configGates[gateKeyOf(row.type,row.key)]={min_level:Number(row.min_level)||0,min_points:Number(row.min_points)||0};
  configGatesLoaded=true;
  renderConfigGatesLists();
  renderRaceChoices();renderClassChoices();
 }catch(e){const st=document.getElementById('configGatesStatus');if(st)st.textContent=`Error cargando bloqueos: ${e.message}`}
}
function renderGatesSection(rootId,type,entries){
 const root=document.getElementById(rootId);if(!root)return;
 root.innerHTML=entries.map(({key:k,label})=>{
  const g=gateFor(type,k);
  return `<div class="configItem"><span class="tierDot" style="background:${(g.min_level||g.min_points)?'#8c72e8':'#4d395a'}"></span><div><b>${label}</b><div class="configForm"><label>Nivel PJ mínimo <input type="number" min="0" step="1" data-gate-level="${gateKeyOf(type,k)}" value="${g.min_level||0}"></label><label>Puntuación mínima <input type="number" min="0" step="1" data-gate-points="${gateKeyOf(type,k)}" value="${g.min_points||0}"></label></div></div></div>`;
 }).join('');
}
function renderConfigGatesLists(){
 renderGatesSection('configGatesRaces','race',Object.entries(raceDefs).map(([id,r])=>({key:id,label:r.name})));
 const classEntries=Object.entries(classDefs).map(([id,c])=>({key:id,label:c.name}));
 // gateFor/gateUnlocked are keyed purely by classId, and renderClassChoices
 // already calls gateUnlocked('class',id) for Advanced-mode classes too - the
 // only gap was this admin list never listing them, so an Advanced class
 // (config_class row with advanced:true) had no lock to configure. Mirror
 // classIdsForSkillMode('advanced') exactly, deduped against the hardcoded
 // ids already listed above (a reskin sharing a hardcoded classId shares its
 // gate with that hardcoded entry, same as it already does at character
 // creation).
 const seen=new Set(Object.keys(classDefs));
 for(const id of classIdsForSkillMode('advanced')){
  if(seen.has(id))continue;
  seen.add(id);
  const row=configClassRowForId(id);
  classEntries.push({key:id,label:`${row?.class_json?.name||row?.nombre||id} (Advanced)`});
 }
 renderGatesSection('configGatesClasses','class',classEntries);
}
async function saveConfigGates(){
 const st=document.getElementById('configGatesStatus');if(st)st.textContent='Guardando...';
 try{
  const rows=[...document.querySelectorAll('[data-gate-level]')].map(inp=>{
   const [type,key]=inp.dataset.gateLevel.split(':');
   const pointsInp=document.querySelector(`[data-gate-points="${type}:${key}"]`);
   return {type,key,min_level:Number(inp.value)||0,min_points:Number(pointsInp?.value)||0};
  });
  for(const row of rows){
   const r=await fetch('/api/config-class?kind=gates',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(row)});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar el bloqueo');
  }
  await fetchConfigGates();
  if(st)st.textContent='Bloqueos guardados.';
 }catch(e){if(st)st.textContent=`Error: ${e.message}`}
}
function setupConfigGatesMode(){
 renderConfigGatesLists();
 document.getElementById('saveConfigGatesBtn').onclick=saveConfigGates;
}

// ============================================================================
// TESTING MODE - admin-only combat sandbox reachable from Configuración >
// Modo Testing. Spins up a throwaway character (race/class/level/stats/
// skills) and drops it straight into a chosen floor archetype so combat,
// skills and floor generation can be tried out. Nothing here is persisted:
// the resulting `game` never gets a pjId/dungeonStatusId, so every
// persistence call in the normal game loop (all gated on those ids, see
// persistTurnState/persistShards/finalizeCharacterDeath) silently no-ops.
// Race/class gates (gateUnlocked) are bypassed entirely rather than reused,
// since testing must work regardless of the admin account's own progress.
// ============================================================================
let tstRace=Object.keys(raceDefs)[0];
let tstClass=null;
let tstSkillMode='hardcode';
let tstCombatMode='classic';
let tstLevel=1;
let tstStatAlloc={strength:0,vitality:0,agility:0,luck:0,intelligence:0,wisdom:0};
let tstSkillIds=[];
let tstFloorArchetype='standard';
// Default well below 100%: a horda floor at full density is 100+ enemies,
// which reads as "I can't kill them, they keep coming" for a single tester
// rather than the intended stress-test - see launchTestCombat().
let tstEnemyDensity=50;
let preTestSelectedDungeonWorld; // stashed selectedDungeonWorld while a test run is active, restored on exit
const TEST_STAT_LABELS={strength:'Fuerza',vitality:'Vitalidad',agility:'Agilidad',luck:'Suerte',intelligence:'Inteligencia',wisdom:'Sabiduría'};

function testStatPointsTotal(level){return Math.max(0,Math.round(level)-1)}
function testMilestoneBonus(level){return Math.floor(Math.max(1,Math.round(level))/10)}
function testStatPointsSpent(){return Object.values(tstStatAlloc).reduce((a,b)=>a+b,0)}
// Mirrors classSkillIdsForLevelReward()'s maxTier rule (tier II unlocks at
// the first reward level, III once level-up rewards reach level 10+).
function testMaxSkillTierForLevel(level){return level>=10?3:level>=3?2:1}
function testMaxSkillPicks(level){return 1+[...LEVEL_UP_RANDOM_SKILL_LEVELS].filter(l=>l<=level).length}
function classSkillIdsForTierOf(classId,tier){const roman=['','I','II','III'][tier];return (classSkillTrees[classId]?.[roman]||[]).filter(id=>skillDefs[id])}
function testEligibleSkillIds(){
 const max=testMaxSkillTierForLevel(tstLevel),ids=[];
 for(let t=1;t<=max;t++)ids.push(...classSkillIdsForTierOf(tstClass,t));
 return ids;
}
function clampTestStatAlloc(){
 const total=testStatPointsTotal(tstLevel),keys=Object.keys(TEST_STAT_LABELS);
 let spent=testStatPointsSpent();
 while(spent>total){
  const k=keys.filter(k=>tstStatAlloc[k]>0).sort((a,b)=>tstStatAlloc[b]-tstStatAlloc[a])[0];
  if(!k)break;
  tstStatAlloc[k]--;spent--;
 }
}
function renderTestRaceChoices(){
 const root=document.getElementById('testRaceChoices');if(!root)return;
 const ids=Object.keys(raceDefs);
 if(!ids.includes(tstRace))tstRace=ids[0];
 root.innerHTML=ids.map(id=>{
  const r=raceDefs[id];
  return `<div class="choice ${id===tstRace?'selected':''}" data-test-race="${id}"><div class="choiceBody"><b>${r.name}</b><p class="small">${r.desc}</p><span class="raceTag">${r.origin}</span><p class="small"><strong>Rasgo:</strong> ${r.trait}</p></div></div>`;
 }).join('');
 root.querySelectorAll('[data-test-race]').forEach(el=>el.onclick=()=>{tstRace=el.dataset.testRace;renderTestRaceChoices()});
}
function testClassIds(){return classIdsForSkillMode(tstSkillMode)}
function renderTestClassChoices(){
 const root=document.getElementById('testClassChoices');if(!root)return;
 const ids=testClassIds();
 if(!ids.length){
  root.innerHTML='<p class="small">No hay clases Advanced configuradas todavía. Créalas en la pestaña Clases, o vuelve a Hardcode.</p>';
  tstClass=null;renderTestStatsPanel();renderTestSkillChoices();return;
 }
 if(!tstClass||!ids.includes(tstClass))tstClass=ids[0];
 root.innerHTML=ids.map(id=>{
  const c=resolveClassDef(id);
  return `<div class="classCard ${id===tstClass?'selected':''}" data-test-class="${id}"><canvas width="64" height="64" data-test-class-preview="${id}"></canvas><div class="classCopy"><b>${c.name}</b><span class="small">${c.desc}</span><div class="classStats">FUE ${c.stats.strength} · VIT ${c.stats.vitality} · AGI ${c.stats.agility} · SUE ${c.stats.luck} · INT ${c.stats.intelligence} · SAB ${c.stats.wisdom}</div></div></div>`;
 }).join('');
 root.querySelectorAll('[data-test-class-preview]').forEach(c=>drawClassPreview(c,c.dataset.testClassPreview));
 root.querySelectorAll('[data-test-class]').forEach(el=>el.onclick=()=>{tstClass=el.dataset.testClass;tstSkillIds=[];renderTestClassChoices()});
 renderTestStatsPanel();renderTestSkillChoices();
}
function renderTestStatsPanel(){
 const root=document.getElementById('testStatsPanel');if(!root)return;
 if(!tstClass){root.innerHTML='';return}
 const cls=resolveClassDef(tstClass);if(!cls){root.innerHTML='';return}
 clampTestStatAlloc();
 const total=testStatPointsTotal(tstLevel),spent=testStatPointsSpent(),remaining=total-spent,milestone=testMilestoneBonus(tstLevel);
 root.innerHTML=`<p><b>Puntos de nivel por asignar: ${remaining}/${total}</b><br><span class="small">Incluye +${milestone} automático a cada stat por hitos de nivel (cada 10 niveles), ya sumado abajo.</span></p>`+
  Object.entries(TEST_STAT_LABELS).map(([k,label])=>{
   const base=cls.stats[k]||0,final=base+milestone+(tstStatAlloc[k]||0);
   return `<div class="statBonusButton"><span><b>${label}: ${final}</b><span>${statDescriptions[k]||''}</span></span><div class="testStatBtns"><button type="button" data-test-stat-minus="${k}" ${tstStatAlloc[k]?'':'disabled'}>-</button><button type="button" data-test-stat-plus="${k}" ${remaining>0?'':'disabled'}>+</button></div></div>`;
  }).join('');
 root.querySelectorAll('[data-test-stat-plus]').forEach(b=>b.onclick=()=>{const k=b.dataset.testStatPlus;if(testStatPointsSpent()>=testStatPointsTotal(tstLevel))return;tstStatAlloc[k]=(tstStatAlloc[k]||0)+1;renderTestStatsPanel()});
 root.querySelectorAll('[data-test-stat-minus]').forEach(b=>b.onclick=()=>{const k=b.dataset.testStatMinus;if(!tstStatAlloc[k])return;tstStatAlloc[k]--;renderTestStatsPanel()});
}
function renderTestSkillChoices(){
 const root=document.getElementById('testSkillChoices'),info=document.getElementById('testSkillsInfo');
 if(!root)return;
 if(!tstClass){root.innerHTML='';if(info)info.textContent='';return}
 const eligible=testEligibleSkillIds();
 const cap=Math.min(testMaxSkillPicks(tstLevel),eligible.length);
 tstSkillIds=tstSkillIds.filter(id=>eligible.includes(id)).slice(0,cap);
 if(info)info.textContent=`Nivel ${tstLevel}: puedes seleccionar hasta ${cap} habilidad(es) de clase (hasta tier ${['','I','II','III'][testMaxSkillTierForLevel(tstLevel)]}). Las 4 primeras marcadas quedan equipadas (${Math.min(tstSkillIds.length,4)}/4 equipadas).`;
 root.innerHTML=eligible.map(id=>{
  const s=skillDefs[id];if(!s)return '';
  const idx=tstSkillIds.indexOf(id),checked=idx>=0,roman=['','I','II','III'][s.tier]||'?';
  return `<label class="configItem testSkillItem"><input type="checkbox" data-test-skill="${id}" ${checked?'checked':''}><div><b>${s.icon||''} ${s.name}</b> <span class="tierBadge">TIER ${roman}</span>${checked&&idx<4?' <span class="small">(equipada)</span>':''}<p class="small">${s.desc||''}</p></div></label>`;
 }).join('')||'<p class="small">Esta clase no tiene árbol de habilidades configurado.</p>';
 root.querySelectorAll('[data-test-skill]').forEach(cb=>cb.onchange=()=>{
  const id=cb.dataset.testSkill;
  if(cb.checked){
   if(tstSkillIds.length>=cap){cb.checked=false;alert(`Nivel ${tstLevel} solo permite conocer ${cap} habilidad(es) de clase.`);return}
   tstSkillIds.push(id);
  }else tstSkillIds=tstSkillIds.filter(x=>x!==id);
  renderTestSkillChoices();
 });
}
function renderTestFloorArchetypeDesc(){
 const p=document.getElementById('testFloorArchetypeDesc');if(!p)return;
 if(tstFloorArchetype==='megaboss'){p.textContent='Pasillo estrecho hacia una cámara fija con un megajefe reforzado (nivel = tu nivel +2 a +4).';return}
 const a=FLOOR_ARCHETYPES[tstFloorArchetype];p.textContent=a?a.desc:'';
}
function renderTestFloorArchetypes(){
 const sel=document.getElementById('testFloorArchetype');if(!sel)return;
 const ids=Object.keys(FLOOR_ARCHETYPES);
 sel.innerHTML=ids.map(id=>`<option value="${id}">${FLOOR_ARCHETYPES[id].label}</option>`).join('')+'<option value="megaboss">Cámara del megajefe (fija)</option>';
 sel.value=tstFloorArchetype;
 sel.onchange=()=>{tstFloorArchetype=sel.value;renderTestFloorArchetypeDesc()};
 renderTestFloorArchetypeDesc();
}
function setupTestingMode(){
 renderTestRaceChoices();
 renderTestClassChoices();
 renderTestFloorArchetypes();
 const lvl=document.getElementById('testLevelInput');
 if(lvl)lvl.onchange=()=>{tstLevel=Math.max(1,Math.min(LEVEL_CAP,Math.round(Number(lvl.value)||1)));lvl.value=tstLevel;renderTestStatsPanel();renderTestSkillChoices()};
 const skHard=document.getElementById('testSkillModeHardcode'),skAdv=document.getElementById('testSkillModeAdvanced');
 if(skHard)skHard.onchange=()=>{tstSkillMode='hardcode';tstClass=null;renderTestClassChoices()};
 if(skAdv)skAdv.onchange=()=>{tstSkillMode='advanced';tstClass=null;renderTestClassChoices()};
 const cmClassic=document.getElementById('testCombatModeClassic'),cmAp=document.getElementById('testCombatModeAp');
 if(cmClassic)cmClassic.onchange=()=>{tstCombatMode='classic'};
 if(cmAp)cmAp.onchange=()=>{tstCombatMode='ap'};
 const density=document.getElementById('testEnemyDensity'),densityVal=document.getElementById('testEnemyDensityValue');
 if(density){
  density.value=tstEnemyDensity;
  if(densityVal)densityVal.textContent=`${tstEnemyDensity}%`;
  density.oninput=()=>{tstEnemyDensity=Number(density.value)||50;if(densityVal)densityVal.textContent=`${tstEnemyDensity}%`};
 }
 document.getElementById('testLaunchBtn').onclick=launchTestCombat;
}
function launchTestCombat(){
 const status=document.getElementById('testStatus');
 if(!tstClass){if(status)status.textContent='Selecciona una clase válida antes de lanzar la prueba.';return}
 const cls=resolveClassDef(tstClass);
 if(!cls){if(status)status.textContent='La clase todavía se está cargando; espera un segundo e inténtalo de nuevo.';return}
 if(testStatPointsSpent()<testStatPointsTotal(tstLevel)){if(status)status.textContent=`Aún te quedan ${testStatPointsTotal(tstLevel)-testStatPointsSpent()} punto(s) de stat por asignar.`;return}
 if(!tstSkillIds.length&&testEligibleSkillIds().length){if(status)status.textContent='Elige al menos una habilidad antes de lanzar la prueba.';return}
 if(status)status.textContent='';

 const milestone=testMilestoneBonus(tstLevel),stats={...cls.stats};
 for(const k of Object.keys(TEST_STAT_LABELS))stats[k]=(stats[k]||0)+milestone+(tstStatAlloc[k]||0);

 let maxHp=30+stats.vitality*3+vitalityHpBonus(stats.vitality);
 let maxStamina=45+stats.strength*4+stats.agility*2;
 let maxMana=30+stats.wisdom*5+stats.intelligence*3;
 let baseDamage=2+stats.strength,baseArmor=4+Math.floor(stats.vitality/2);
 // Approximates the real per-level grantXp() loop using the final (already
 // allocated) stats throughout - order-independent and close enough for a
 // sandbox character built to already be at `tstLevel`.
 for(let l=2;l<=tstLevel;l++){
  const g=levelGrowth(l);
  maxHp+=g.hp+stats.vitality;
  maxStamina+=g.stamina+Math.floor(stats.strength/3);
  maxMana+=g.mana+Math.floor((stats.wisdom*2+stats.intelligence)/3);
  baseDamage+=g.damage;baseArmor+=g.armor;
 }

 const equipment=Object.fromEntries(slots.map(s=>[s,null]));
 equipment.weapon=makeStarterWeapon(tstClass);

 const arch=tstFloorArchetype==='megaboss'?null:(FLOOR_ARCHETYPES[tstFloorArchetype]||FLOOR_ARCHETYPES.standard);
 const minFloor=tstFloorArchetype==='megaboss'?3:(arch?.minFloor||1);
 const floorNum=Math.max(minFloor,Math.min(80,tstLevel));
 const totalFloors=Math.max(20,floorNum+10);

 preTestSelectedDungeonWorld=selectedDungeonWorld;
 selectedDungeonWorld=null; // otherwise generateFloor() could load a precomputed floor from a previously chosen real dungeon world

 game={
  floor:floorNum,themeIndex:0,turn:0,dungeonWorldId:null,dungeonWorldName:'Modo Testing',
  // Explicit 100% baselines - DEFAULT_WORLD_PARAMS otherwise defaults a
  // dungeon world to +25% enemy life/damage received, which has no business
  // being on by default for a combat sandbox. enemyCountPct is the one dial
  // testers actually want to touch (see tstEnemyDensity/testEnemyDensity).
  worldParams:normalizeWorldParams({floors:totalFloors,damageReceivedPct:100,damageDealtPct:100,lifePct:100,xpReceivedPct:100,enemyLootPct:100,enemyCountPct:tstEnemyDensity}),
  inventory:[],achievements:{},bossesKilled:0,chestsOpened:0,
  testingMode:true,forcedFloorArchetype:tstFloorArchetype,
  player:{
   name:(document.getElementById('testNameInput')?.value||'Tester').trim()||'Tester',
   race:tstRace,cls:tstClass,className:cls.name,classIcon:classIconForId(tstClass),
   skillMode:tstSkillMode,combatMode:tstCombatMode,
   level:tstLevel,xp:0,nextXp:tstLevel<LEVEL_CAP?xpNeededForLevel(tstLevel):0,
   hp:maxHp,maxHp,stamina:maxStamina,maxStamina,mana:maxMana,maxMana,
   baseDamage,baseArmor,gold:0,keys:0,vision:4+Math.floor((stats.agility||0)/4),shield:0,
   stats,equipment,knownSkills:[...tstSkillIds],
   skillProgress:Object.fromEntries(tstSkillIds.map(id=>[id,{level:1,xp:0,uses:0}])),
   skillChoicesAwarded:{1:'complete'},equippedSkills:[0,1,2,3].map(i=>tstSkillIds[i]||null),
   cooldowns:{},equipmentCooldowns:{},debuff:0,shards:{},unspentStatPoints:0,pendingLevelUpRewards:[]
  }
 };
 const rb=raceDefs[tstRace]?.bonuses||{};
 game.player.raceName=raceDefs[tstRace]?.name||tstRace;
 game.player.raceBonuses={...rb};
 if(rb.armor)game.player.baseArmor+=rb.armor;
 addStarterPotions(tstClass);
 // A naked level-30 character (nothing but the tier-1 starter weapon) hits
 // like a level-1 one - the level-appropriate loot has to actually be worn,
 // not just sit in the backpack, or every fight (megabosses especially)
 // feels unkillable regardless of the archetype/density chosen above.
 // Reuses the normal loot roller so gear composition matches real drops;
 // a handful of attempts land on already-filled/duplicate slots or potions,
 // which just fall back to the backpack instead of being wasted.
 const gearSlots=slots.filter(s=>s!=='weapon');
 for(let attempts=0;attempts<80&&gearSlots.some(s=>!game.player.equipment[s]);attempts++){
  const item=makeLoot(tstLevel,'testing');
  if(!item)continue;
  if(item.type==='potion'||item.slot==='weapon'||!gearSlots.includes(item.slot)||game.player.equipment[item.slot]){addInventoryItem(item);continue}
  game.player.equipment[item.slot]=item;
 }
 recomputeDerived();
 configScreen.classList.add('hidden');
 app.classList.remove('hidden');
 generateFloor();
 banner(`MODO TESTING · ${game.player.name} NV.${tstLevel} · ${(arch?arch.label:'Cámara del megajefe').toUpperCase()}`);
 log('Modo testing: personaje temporal, sin persistencia ni bloqueos de nivel/puntuación.','sys');
}
// Same custom-icon lookup as drawWorldObjectIcon but paints onto an arbitrary
// UI canvas (lock badges on locked race/class cards) and falls back to a
// plain glyph instead of the default game sprite when no icon is configured.
function drawWorldObjectIconToCanvas(canvas,objectKey,fallbackGlyph='🔒'){
 if(!canvas)return;
 const q=canvas.getContext('2d');q.imageSmoothingEnabled=true;q.clearRect(0,0,canvas.width,canvas.height);
 const hex=configWorldObjects[objectKey];
 if(hex){
  let img=tileImageCache.get('wobj:'+hex);if(!img){img=tileImageFromHex(hex);tileImageCache.set('wobj:'+hex,img)}
  if(img.complete&&img.naturalWidth){q.drawImage(img,0,0,canvas.width,canvas.height);return}
  img.onload=()=>drawWorldObjectIconToCanvas(canvas,objectKey,fallbackGlyph);
  return;
 }
 q.font=`${canvas.height-4}px sans-serif`;q.textAlign='center';q.textBaseline='middle';q.fillText(fallbackGlyph,canvas.width/2,canvas.height/2+1);
}
// Shared draw helper: if object_key has a custom icon, draws it and returns
// true; otherwise the caller falls back to its own procedural sprite.
function drawWorldObjectIcon(objectKey,x,y,size=TILE-14,offset=7){
 const hex=configWorldObjects[objectKey];if(!hex)return false;
 let img=tileImageCache.get('wobj:'+hex);if(!img){img=tileImageFromHex(hex);tileImageCache.set('wobj:'+hex,img)}
 if(img.complete){ctx.drawImage(img,x+offset,y+offset,size,size);return true}
 img.onload=()=>game&&draw();
 return false
}
// Decoration assets can span multiple tiles (tiles_number), so unlike
// drawWorldObjectIcon (always a square centered in one tile) this stretches
// the icon across the asset's full cols x rows footprint in screen space.
function drawAssetIcon(objectKey,x,y,w,h){
 const hex=configWorldObjects[objectKey];
 if(!hex){ctx.fillStyle='#5a4a6b';ctx.fillRect(x+2,y+2,w-4,h-4);return false}
 let img=tileImageCache.get('wobj:'+hex);if(!img){img=tileImageFromHex(hex);tileImageCache.set('wobj:'+hex,img)}
 if(img.complete){ctx.drawImage(img,x+2,y+2,w-4,h-4);return true}
 img.onload=()=>game&&draw();
 return false
}
// Same lookup as drawWorldObjectIcon but paints onto an arbitrary UI canvas
// (inventory rows, shards tab, ...) instead of the game's main ctx. Falls
// back to a tier-colored dot when the admin hasn't configured a custom icon.
function drawShardTierIconToCanvas(canvas,tier){
 if(!canvas)return;
 const q=canvas.getContext('2d');q.imageSmoothingEnabled=true;q.clearRect(0,0,canvas.width,canvas.height);
 const hex=configWorldObjects[`shard_${tier}`];
 if(hex){
  let img=tileImageCache.get('wobj:'+hex);if(!img){img=tileImageFromHex(hex);tileImageCache.set('wobj:'+hex,img)}
  if(img.complete&&img.naturalWidth){q.drawImage(img,0,0,canvas.width,canvas.height);return}
  img.onload=()=>drawShardTierIconToCanvas(canvas,tier);
 }
 q.fillStyle=tierColor(tier);q.beginPath();q.arc(canvas.width/2,canvas.height/2,canvas.width/2-2,0,Math.PI*2);q.fill();
}
function setupConfigTabs(){document.querySelectorAll('[data-config-tab]').forEach(btn=>btn.onclick=()=>{const tab=btn.dataset.configTab;document.querySelectorAll('[data-config-tab]').forEach(b=>b.classList.toggle('active',b===btn));configTabItems.classList.toggle('hidden',tab!=='items');configTabPotions?.classList.toggle('hidden',tab!=='potions');configTabClasses.classList.toggle('hidden',tab!=='classes');configTabTilesets.classList.toggle('hidden',tab!=='tilesets');configTabDungeons?.classList.toggle('hidden',tab!=='dungeons');configTabEnemies?.classList.toggle('hidden',tab!=='enemies');configTabChests?.classList.toggle('hidden',tab!=='chests');configTabWorldObjects?.classList.toggle('hidden',tab!=='worldobjects');configTabGates?.classList.toggle('hidden',tab!=='gates');configTabTesting?.classList.toggle('hidden',tab!=='testing');if(tab==='dungeons')fetchConfigDungeons();if(tab==='worldobjects'&&!configWorldObjectsLoaded)fetchConfigWorldObjects();if(tab==='gates'&&!configGatesLoaded)fetchConfigGates()})}

function setupImageIconEditor({inputId,canvasId,previewId,statusId,zoomId,eraserId,toleranceId,hexKey,statusPrefix,outline=true,onSave,aspect={w:1,h:1}}){
 const imgInput=document.getElementById(inputId),crop=document.getElementById(canvasId),preview=document.getElementById(previewId),status=document.getElementById(statusId),zoom=document.getElementById(zoomId),eraserBtn=document.getElementById(eraserId),tolerance=document.getElementById(toleranceId);
 if(!imgInput||!crop)return null;
 let source=null,rect=null,drag=null,activePointerId=null,eraser=false;
 // Preserve every pixel in the selected source area. The former fixed 50px
 // export permanently discarded detail before the image reached the game.
 function outSize(){if(rect)return{w:Math.max(1,Math.round(rect.w)),h:Math.max(1,Math.round(rect.h))};const a=typeof aspect==='function'?aspect():aspect,ratio=Math.max(a.w,1)/Math.max(a.h,1);return ratio>=1?{w:50,h:Math.max(1,Math.round(50/ratio))}:{w:Math.max(1,Math.round(50*ratio)),h:50}}
 function canvasZoom(){const scale=(Number(zoom?.value)||100)/100;crop.style.width=`${Math.max(1,Math.round(crop.width*scale))}px`;crop.style.height=`${Math.max(1,Math.round(crop.height*scale))}px`}
 function clampRect(r){
  const a=typeof aspect==='function'?aspect():aspect,ratio=Math.max(a.w,1)/Math.max(a.h,1);
  let w=Math.max(1,Math.round(r.w)),h=Math.max(1,Math.round(w/ratio));
  if(w>crop.width||h>crop.height){
   if(crop.width/ratio<=crop.height){w=crop.width;h=Math.max(1,Math.round(crop.width/ratio))}
   else{h=crop.height;w=Math.max(1,Math.round(crop.height*ratio))}
  }
  return{x:Math.max(0,Math.min(Math.round(r.x),Math.max(0,crop.width-w))),y:Math.max(0,Math.min(Math.round(r.y),Math.max(0,crop.height-h))),w,h};
 }
 function pointerPos(e){const b=crop.getBoundingClientRect();return{x:(e.clientX-b.left)*crop.width/b.width,y:(e.clientY-b.top)*crop.height/b.height}}
 function inRect(p,r){return r&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h}
 function checker(c){c.fillStyle='#241b2c';c.fillRect(0,0,crop.width,crop.height);c.fillStyle='#392d44';for(let y=0;y<crop.height;y+=16)for(let x=0;x<crop.width;x+=16)if((x/16+y/16)%2===0)c.fillRect(x,y,16,16)}
 function drawCrop(){const c=crop.getContext('2d');c.imageSmoothingEnabled=true;c.clearRect(0,0,crop.width,crop.height);checker(c);if(source)c.drawImage(source,0,0);if(rect){c.save();c.fillStyle='#0008';c.fillRect(0,0,crop.width,rect.y);c.fillRect(0,rect.y+rect.h,crop.width,crop.height-rect.y-rect.h);c.fillRect(0,rect.y,rect.x,rect.h);c.fillRect(rect.x+rect.w,rect.y,crop.width-rect.x-rect.w,rect.h);c.strokeStyle=eraser?'#7cffd4':'#ffd68b';c.lineWidth=2;c.strokeRect(rect.x+.5,rect.y+.5,rect.w,rect.h);c.fillStyle=c.strokeStyle;c.fillRect(rect.x+rect.w-5,rect.y+rect.h-5,5,5);c.restore()}}
 function saveIcon(){
  if(!source||!rect)return;
  const o=outSize();
  const out=document.createElement('canvas');out.width=o.w;out.height=o.h;
  const oc=out.getContext('2d');oc.imageSmoothingEnabled=true;oc.imageSmoothingQuality='high';oc.clearRect(0,0,o.w,o.h);oc.drawImage(source,rect.x,rect.y,rect.w,rect.h,0,0,o.w,o.h);
  if(outline)addIconSilhouetteBorder(out,2);
  preview.width=o.w;preview.height=o.h;
  const pc=preview.getContext('2d');pc.clearRect(0,0,o.w,o.h);pc.drawImage(out,0,0);
  fetch(out.toDataURL('image/png')).then(r=>r.arrayBuffer()).then(buf=>{window[hexKey]=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');if(status)status.textContent=`${statusPrefix} ${o.w}x${o.h} desde x:${rect.x}, y:${rect.y}`;if(onSave)onSave()})
 }
 function eraseAt(p){const c=source.getContext('2d'),dataObj=c.getImageData(0,0,source.width,source.height),data=dataObj.data,x=Math.max(0,Math.min(source.width-1,Math.round(p.x))),y=Math.max(0,Math.min(source.height-1,Math.round(p.y))),idx=(y*source.width+x)*4,base=[data[idx],data[idx+1],data[idx+2]],tol=Number(tolerance?.value||38);for(let i=0;i<data.length;i+=4){if(Math.hypot(data[i]-base[0],data[i+1]-base[1],data[i+2]-base[2])<=tol)data[i+3]=0}c.putImageData(dataObj,0,0);drawCrop();saveIcon();if(status)status.textContent=`Magic eraser aplicado con sutileza ${tol}.`}
 function updateDrag(e){
  if(!source||!drag)return;
  const p=pointerPos(e);
  if(drag.mode==='move')rect=clampRect({x:p.x-drag.dx,y:p.y-drag.dy,w:drag.start.w,h:drag.start.h});
  else{const o=outSize(),ratio=o.w/o.h,dx=Math.max(1,Math.abs(p.x-drag.origin.x)),dh=Math.max(1,Math.round(dx/ratio));rect=clampRect({x:p.x<drag.origin.x?drag.origin.x-dx:drag.origin.x,y:p.y<drag.origin.y?drag.origin.y-dh:drag.origin.y,w:dx,h:dh})}
  drawCrop();saveIcon()
 }
 function loadImage(img,save=false){crop.width=img.naturalWidth;crop.height=img.naturalHeight;source=document.createElement('canvas');source.width=crop.width;source.height=crop.height;const sc=source.getContext('2d');sc.imageSmoothingEnabled=true;sc.imageSmoothingQuality='high';sc.clearRect(0,0,source.width,source.height);sc.drawImage(img,0,0);const a=typeof aspect==='function'?aspect():aspect,ratio=Math.max(a.w,1)/Math.max(a.h,1);let w=crop.width,h=Math.round(w/ratio);if(h>crop.height){h=crop.height;w=Math.round(h*ratio)}rect=clampRect({x:(crop.width-w)/2,y:(crop.height-h)/2,w,h});canvasZoom();drawCrop();if(save)saveIcon()}
 function loadHex(hex){if(!hex)return;const img=new Image();img.onload=()=>{loadImage(img,false);if(status)status.textContent=`Imagen guardada ${crop.width}x${crop.height} recargada en el visor de recorte.`};img.src='data:image/png;base64,'+hexToBase64(hex.startsWith('#')?hex.slice(1):hex)}
 preview._iconEditor={loadHex};
 imgInput.onchange=()=>{const f=imgInput.files?.[0];if(!f)return;const img=new Image();img.onload=()=>{loadImage(img,true);if(status)status.textContent=`Imagen original ${crop.width}x${crop.height}. Ajusta zoom, recorte o Magic eraser.`;URL.revokeObjectURL(img.src)};img.src=URL.createObjectURL(f)};
 crop.onpointerdown=e=>{if(!source||activePointerId!==null)return;e.preventDefault();activePointerId=e.pointerId;crop.setPointerCapture?.(e.pointerId);const p=pointerPos(e);if(eraser){eraseAt(p);activePointerId=null;return}if(inRect(p,rect))drag={mode:'move',start:{...rect},dx:p.x-rect.x,dy:p.y-rect.y};else{drag={mode:'draw',origin:p};rect=clampRect({x:p.x,y:p.y,w:1,h:1})}drawCrop()};
 crop.onpointermove=e=>{if(e.pointerId!==activePointerId||eraser||!drag)return;e.preventDefault();updateDrag(e)};
 const finishPointer=e=>{if(e.pointerId!==activePointerId)return;e.preventDefault();if(!eraser&&drag){updateDrag(e);drag=null;saveIcon()}crop.releasePointerCapture?.(e.pointerId);activePointerId=null};
 crop.onpointerup=finishPointer;
 crop.onpointercancel=e=>{if(e.pointerId!==activePointerId)return;if(drag)saveIcon();drag=null;activePointerId=null;crop.releasePointerCapture?.(e.pointerId);drawCrop()};
 if(zoom)zoom.oninput=canvasZoom;
 if(eraserBtn)eraserBtn.onclick=()=>{eraser=!eraser;eraserBtn.textContent=`Magic eraser: ${eraser?'on':'off'}`;crop.classList.toggle('magicEraserActive',eraser);drawCrop()};
 canvasZoom();
 return{drawCrop,saveIcon,loadHex,reclamp:()=>{if(rect){rect=clampRect(rect);drawCrop();saveIcon()}}}
}
function setupClassConfigMode(){
 const editor=setupImageIconEditor({inputId:'configClassImageInput',canvasId:'configClassCropCanvas',previewId:'configClassIconPreview',statusId:'configClassIconStatus',zoomId:'configClassCropZoom',eraserId:'configClassMagicEraserBtn',toleranceId:'configClassMagicTolerance',hexKey:'currentConfigClassIconHex',statusPrefix:'Icono'});
 if(!editor)return;
 setupImageIconEditor({inputId:'configSkillImageInput',canvasId:'configSkillCropCanvas',previewId:'configSkillIconPreview',statusId:'configSkillIconStatus',zoomId:'configSkillCropZoom',eraserId:'configSkillMagicEraserBtn',toleranceId:'configSkillMagicTolerance',hexKey:'currentConfigSkillIconHex',statusPrefix:'Icono skill'});
 setupImageIconEditor({inputId:'configSummonImageInput',canvasId:'configSummonCropCanvas',previewId:'configSummonIconPreview',statusId:'configSummonIconStatus',zoomId:'configSummonCropZoom',eraserId:'configSummonMagicEraserBtn',toleranceId:'configSummonMagicTolerance',hexKey:'currentSummonIconHex',statusPrefix:'Icono invocación'});
 const summonExistingSel=document.getElementById('configSummonIconExisting');
 if(summonExistingSel)summonExistingSel.onchange=()=>{
  if(!summonExistingSel.value)return;
  window.currentSummonIconHex=summonExistingSel.value;
  renderConfigIconPreview(summonExistingSel.value,'configSummonIconPreview','configSummonIconStatus');
  document.getElementById('configSummonIconStatus').textContent='Imagen reutilizada de la lista.';
 };
 populateSummonIconExistingList();
 document.getElementById('configClassPotionSearch')?.addEventListener('input',renderConfigClassPotionResults);
 const effectSel=document.getElementById('configSkillEffect');
 if(effectSel&&!effectSel.options.length)effectSel.innerHTML=ALL_CLASS_EFFECTS.map(e=>`<option value="${e}">${e}</option>`).join('');
 configClassSelect.onchange=loadSelectedConfigClass;
 document.getElementById('configClassSkillSelect').onchange=e=>loadSkillIntoForm(e.target.value);
 document.getElementById('newConfigClassBtn').onclick=()=>{
  const name=prompt('Nombre de la nueva clase:');if(!name)return;
  window.pendingNewClassId=slugifyClassName(name);
  configClassName.value=name;document.getElementById('configClassDesc').value='Clase personalizada.';
  configClassStr.value=configClassVit.value=configClassAgi.value=configClassLuck.value=configClassInt.value=configClassWis.value=2;
  window.currentConfigClassIconHex='';renderConfigIconPreview('','configClassIconPreview','configClassIconStatus');
  window.currentClassSkillsDraft={};renderClassSkillSelect();
  renderConfigClassStarterGearOptions('',[]);
  configClassStatus.textContent=`Nueva clase "${name}" lista para configurar. Añade skills y pulsa Guardar clase.`;
 };
 document.getElementById('duplicateConfigClassBtn').onclick=()=>{
  const baseId=selectedGameClassId(),base=resolveClassDef(baseId);if(!base)return;
  const name=prompt('Nombre de la copia:',`${base.name} (copia)`);if(!name)return;
  const newId=slugifyClassName(name);
  window.pendingNewClassId=newId;
  configClassName.value=name;document.getElementById('configClassDesc').value=base.desc||'';
  configClassStr.value=base.stats.strength;configClassVit.value=base.stats.vitality;configClassAgi.value=base.stats.agility;configClassLuck.value=base.stats.luck;configClassInt.value=base.stats.intelligence;configClassWis.value=base.stats.wisdom;
  const sourceBag=classSkillBagFor(baseId),newBag={};
  for(const [sid,s] of Object.entries(sourceBag))newBag[`${newId}_${sid}`]={...s,classId:newId};
  window.currentClassSkillsDraft=newBag;
  renderClassSkillSelect();
  const baseRow=configClassRowForId(baseId);
  renderConfigClassStarterGearOptions(baseRow?.class_json?.starterWeaponType||'',baseRow?.class_json?.starterPotionIds||[]);
  configClassStatus.textContent=`Copia de "${base.name}" lista como "${name}". Pulsa Guardar clase para crearla.`;
 };
 document.getElementById('newConfigSkillBtn').onclick=()=>{
  const id=window.pendingNewClassId||selectedGameClassId(),n=Object.keys(window.currentClassSkillsDraft||{}).length+1;
  const skillId=`${id}_custom_${n}`;
  window.currentClassSkillsDraft=window.currentClassSkillsDraft||{};
  window.currentClassSkillsDraft[skillId]={name:'Nueva skill',icon:'✦',iconImage:'',desc:'Descripción pendiente.',cd:5,apCost:10,resource:'stamina',cost:10,type:'physical',rarity:'common',range:1,classEffect:'ranged',tier:1,classId:id,enemyUsable:true,unlock:'Clase'};
  renderClassSkillSelect();
  document.getElementById('configClassSkillSelect').value=skillId;loadSkillIntoForm(skillId);
 };
 document.getElementById('duplicateConfigSkillBtn').onclick=()=>{
  const src=window.editingConfigSkillId;if(!src||!window.currentClassSkillsDraft?.[src])return;
  const n=Object.keys(window.currentClassSkillsDraft).length+1,newId=`${src}_copy${n}`;
  window.currentClassSkillsDraft[newId]={...window.currentClassSkillsDraft[src],effects:JSON.parse(JSON.stringify(window.currentClassSkillsDraft[src].effects||[]))};
  renderClassSkillSelect();
  document.getElementById('configClassSkillSelect').value=newId;loadSkillIntoForm(newId);
 };
 const saveSkillAndClass=async()=>{
  const oldId=window.editingConfigSkillId,newId=document.getElementById('configSkillId').value.trim()||oldId;
  const skill=currentSkillFormJson();
  window.currentClassSkillsDraft=window.currentClassSkillsDraft||{};
  if(oldId&&oldId!==newId)delete window.currentClassSkillsDraft[oldId];
  window.currentClassSkillsDraft[newId]=skill;
  renderClassSkillSelect();
  document.getElementById('configClassSkillSelect').value=newId;
  const st=document.getElementById('configSkillStatus');
  st.textContent='Guardando skill y clase...';
  try{await saveConfigClass(currentConfigClassJson(),window.currentClassSkillsDraft);st.textContent='Skill y clase guardadas en BDD.'}catch(e){st.textContent=e.message}
 };
 document.getElementById('saveConfigSkillBtn').onclick=saveSkillAndClass;
 document.getElementById('saveConfigSkillBtnTop').onclick=saveSkillAndClass;
 document.getElementById('rollbackConfigSkillIconBtn').onclick=()=>{
  window.currentConfigSkillIconHex='';renderConfigIconPreview('','configSkillIconPreview','configSkillIconStatus');
  document.getElementById('configSkillIconStatus').textContent='Sin imagen: se usa el icono de texto/emoji.';
 };
 document.getElementById('addSkillEffectBtn').onclick=()=>{
  const kind=document.getElementById('configEffectKindPicker').value;
  window.currentSkillEffectsDraft=window.currentSkillEffectsDraft||[];
  window.currentSkillEffectsDraft.push(defaultComponentFor(kind));
  renderSkillEffectsList();
 };
 document.getElementById('exportConfigSkillsBtn').onclick=()=>{
  const blob=new Blob([JSON.stringify(window.currentClassSkillsDraft||{},null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`skills-${selectedGameClassId()}.json`;a.click();URL.revokeObjectURL(a.href);
 };
 document.getElementById('importConfigSkillsInput').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  const st=document.getElementById('configSkillStatus');
  try{
   const bag=JSON.parse(await file.text());
   if(!bag||typeof bag!=='object')throw new Error('El JSON debe ser un objeto {skillId:{...}}');
   window.currentClassSkillsDraft={...(window.currentClassSkillsDraft||{}),...bag};
   renderClassSkillSelect();
   st.textContent=`Importadas ${Object.keys(bag).length} skill(s) al borrador. Pulsa "Guardar skill" o "Guardar clase" para persistir.`;
  }catch(err){st.textContent=`Error importando JSON: ${err.message}`}
  finally{e.target.value=''}
 };
 saveConfigClassBtn.onclick=async()=>{
  configClassStatus.textContent='Guardando clase...';
  try{await saveConfigClass(currentConfigClassJson(),window.currentClassSkillsDraft||{});configClassStatus.textContent='Clase guardada en BDD.'}catch(e){configClassStatus.textContent=e.message}
 };
 rollbackConfigClassBtn.onclick=async()=>{
  configClassStatus.textContent='Restaurando pixels por defecto...';
  try{window.currentConfigClassIconHex='';renderConfigIconPreview('','configClassIconPreview','configClassIconStatus');await saveConfigClass(currentConfigClassJson(),window.currentClassSkillsDraft||{});configClassStatus.textContent='Rollback aplicado: la clase vuelve al sprite original.'}catch(e){configClassStatus.textContent=e.message}
 };
}
// ---- Potion composable-effects editor (admin) -------------------------
// Same list-of-cards editor as the class skill editor's "Efectos apilables"
// (effectComponentCardHtml/subEffectCardHtml/defaultComponentFor are shared,
// generic functions - see renderSkillEffectsList) - just wired to its own
// draft array/container so editing a potion never touches the skill editor's
// own draft.
function renderPotionEffectsList(){
 const wrap=document.getElementById('configPotionEffectsList');if(!wrap)return;
 populateSummonIconExistingList();
 const list=window.currentPotionEffectsDraft||[];
 wrap.innerHTML=list.map((comp,i)=>effectComponentCardHtml(comp,i)).join('')||'<p class="small">Sin efectos apilables añadidos todavía: elige un tipo arriba y pulsa "Añadir efecto".</p>';
 wrap.querySelectorAll('[data-effect-idx]').forEach(el=>{
  el.addEventListener('change',()=>{
   const idx=Number(el.dataset.effectIdx),field=el.dataset.effectField;
   const isNumber=el.type==='number',isCheckbox=el.type==='checkbox';
   window.currentPotionEffectsDraft[idx][field]=isNumber?Number(el.value):isCheckbox?el.checked:el.value;
   if(field==='effectType'||field==='mode'||field==='target'||field==='damageMode'||field==='permanent')renderPotionEffectsList();
  });
 });
 wrap.querySelectorAll('[data-remove-effect]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  window.currentPotionEffectsDraft.splice(Number(btn.dataset.removeEffect),1);renderPotionEffectsList();
 }));
 wrap.querySelectorAll('[data-sub-field]').forEach(el=>{
  el.addEventListener('change',()=>{
   const pIdx=Number(el.dataset.subParent),j=Number(el.dataset.subIdx),field=el.dataset.subField;
   const isNumber=el.type==='number',isCheckbox=el.type==='checkbox';
   const parent=window.currentPotionEffectsDraft[pIdx];if(!parent)return;
   parent.skillEffects=parent.skillEffects||[];
   parent.skillEffects[j][field]=isNumber?Number(el.value):isCheckbox?el.checked:el.value;
  });
 });
 wrap.querySelectorAll('[data-remove-sub-effect]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const pIdx=Number(btn.dataset.subParent),j=Number(btn.dataset.subIdx);
  window.currentPotionEffectsDraft[pIdx]?.skillEffects?.splice(j,1);
  renderPotionEffectsList();
 }));
 wrap.querySelectorAll('[data-add-sub-effect]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const pIdx=Number(btn.dataset.addSubEffect);
  const picker=wrap.querySelector(`[data-sub-add-kind][data-sub-parent="${pIdx}"]`);
  const kind=picker?.value||'dmg';
  const parent=window.currentPotionEffectsDraft[pIdx];if(!parent)return;
  parent.skillEffects=parent.skillEffects||[];
  parent.skillEffects.push(defaultComponentFor(kind));
  renderPotionEffectsList();
 }));
 wrap.querySelectorAll('[data-use-summon-icon]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const idx=Number(btn.dataset.useSummonIcon);
  if(!window.currentSummonIconHex){alert('Primero elige o recorta una imagen en "Imagen de invocación" (pestaña Clases).');return}
  window.currentPotionEffectsDraft[idx].iconImage=window.currentSummonIconHex;renderPotionEffectsList();
 }));
 wrap.querySelectorAll('[data-clear-summon-icon]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  window.currentPotionEffectsDraft[Number(btn.dataset.clearSummonIcon)].iconImage='';renderPotionEffectsList();
 }));
 wrap.querySelectorAll('[data-summon-icon-idx]').forEach(c=>{
  const comp=window.currentPotionEffectsDraft[Number(c.dataset.summonIconIdx)];
  if(comp?.iconImage)drawSkillIconImg(c,comp.iconImage);
 });
}
// Equipment's own effects[] draft/list - same card renderer as potions
// (effectComponentCardHtml/defaultComponentFor) bound to a separate
// window.currentEquipmentEffectsDraft array and #configEquipmentEffectsList
// container, since the Items tab is a fully separate editor from Potions.
function renderEquipmentEffectsList(){
 const wrap=document.getElementById('configEquipmentEffectsList');if(!wrap)return;
 populateSummonIconExistingList();
 const list=window.currentEquipmentEffectsDraft||[];
 wrap.innerHTML=list.map((comp,i)=>effectComponentCardHtml(comp,i)).join('')||'<p class="small">Sin efectos apilables añadidos todavía: elige un tipo arriba y pulsa "Añadir efecto".</p>';
 wrap.querySelectorAll('[data-effect-idx]').forEach(el=>{
  el.addEventListener('change',()=>{
   const idx=Number(el.dataset.effectIdx),field=el.dataset.effectField;
   const isNumber=el.type==='number',isCheckbox=el.type==='checkbox';
   window.currentEquipmentEffectsDraft[idx][field]=isNumber?Number(el.value):isCheckbox?el.checked:el.value;
   if(field==='effectType'||field==='mode'||field==='target'||field==='damageMode'||field==='permanent')renderEquipmentEffectsList();
  });
 });
 wrap.querySelectorAll('[data-remove-effect]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  window.currentEquipmentEffectsDraft.splice(Number(btn.dataset.removeEffect),1);renderEquipmentEffectsList();
 }));
 wrap.querySelectorAll('[data-sub-field]').forEach(el=>{
  el.addEventListener('change',()=>{
   const pIdx=Number(el.dataset.subParent),j=Number(el.dataset.subIdx),field=el.dataset.subField;
   const isNumber=el.type==='number',isCheckbox=el.type==='checkbox';
   const parent=window.currentEquipmentEffectsDraft[pIdx];if(!parent)return;
   parent.skillEffects=parent.skillEffects||[];
   parent.skillEffects[j][field]=isNumber?Number(el.value):isCheckbox?el.checked:el.value;
  });
 });
 wrap.querySelectorAll('[data-remove-sub-effect]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const pIdx=Number(btn.dataset.subParent),j=Number(btn.dataset.subIdx);
  window.currentEquipmentEffectsDraft[pIdx]?.skillEffects?.splice(j,1);
  renderEquipmentEffectsList();
 }));
 wrap.querySelectorAll('[data-add-sub-effect]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const pIdx=Number(btn.dataset.addSubEffect);
  const picker=wrap.querySelector(`[data-sub-add-kind][data-sub-parent="${pIdx}"]`);
  const kind=picker?.value||'dmg';
  const parent=window.currentEquipmentEffectsDraft[pIdx];if(!parent)return;
  parent.skillEffects=parent.skillEffects||[];
  parent.skillEffects.push(defaultComponentFor(kind));
  renderEquipmentEffectsList();
 }));
 wrap.querySelectorAll('[data-use-summon-icon]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const idx=Number(btn.dataset.useSummonIcon);
  if(!window.currentSummonIconHex){alert('Primero elige o recorta una imagen en "Imagen de invocación" (pestaña Clases).');return}
  window.currentEquipmentEffectsDraft[idx].iconImage=window.currentSummonIconHex;renderEquipmentEffectsList();
 }));
 wrap.querySelectorAll('[data-clear-summon-icon]').forEach(btn=>btn.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  window.currentEquipmentEffectsDraft[Number(btn.dataset.clearSummonIcon)].iconImage='';renderEquipmentEffectsList();
 }));
 wrap.querySelectorAll('[data-summon-icon-idx]').forEach(c=>{
  const comp=window.currentEquipmentEffectsDraft[Number(c.dataset.summonIconIdx)];
  if(comp?.iconImage)drawSkillIconImg(c,comp.iconImage);
 });
}
function setupConfigMode(){renderConfigStatsHelp();const slotSel=document.getElementById('configSlot');if(slotSel&&!slotSel.options.length)slotSel.innerHTML=slots.map(s=>`<option value="${s}">${slotNames[s]}</option>`).join('');if(configWeaponCategory&&!configWeaponCategory.options.length)configWeaponCategory.innerHTML=configWeaponTypes.map(c=>`<option value="${c}">${c}</option>`).join('');const toggleWeaponFields=()=>{const isWeapon=configSlot.value==='weapon',isActive=EQUIPMENT_ACTIVE_SLOTS.has(configSlot.value);configDamageDiceWrap.classList.toggle('hidden',!isWeapon);configWeaponCategoryWrap.classList.toggle('hidden',!isWeapon);configRangeMinWrap?.classList.toggle('hidden',!isWeapon);configRangeMaxWrap?.classList.toggle('hidden',!isWeapon);configProcChanceWrap?.classList.toggle('hidden',!isWeapon);configEquipmentCooldownWrap?.classList.toggle('hidden',!isActive);configEquipmentRangeWrap?.classList.toggle('hidden',!isActive)};const applyWeaponRangePreset=()=>{const preset=weaponTypeRanges[configWeaponCategory?.value]||{min:1,max:1};if(configRangeMin)configRangeMin.value=preset.min;if(configRangeMax)configRangeMax.value=preset.max};slotSel.onchange=toggleWeaponFields;if(configWeaponCategory)configWeaponCategory.onchange=applyWeaponRangePreset;toggleWeaponFields();window.currentEquipmentEffectsDraft=window.currentEquipmentEffectsDraft||[];renderEquipmentEffectsList();document.getElementById('addEquipmentEffectBtn')?.addEventListener('click',e=>{e.preventDefault();const kind=document.getElementById('configEquipmentEffectKindPicker')?.value||'dmg';window.currentEquipmentEffectsDraft.push(defaultComponentFor(kind));renderEquipmentEffectsList()});setupImageIconEditor({inputId:'configImageInput',canvasId:'configCropCanvas',previewId:'configIconPreview',statusId:'configIconStatus',zoomId:'configCropZoom',eraserId:'configMagicEraserBtn',toleranceId:'configMagicTolerance',hexKey:'currentConfigIconHex',statusPrefix:'Icono'});saveConfigItemBtn.onclick=async()=>{configStatus.textContent=window.editingConfigItemId?'Actualizando...':'Guardando...';try{const item=currentConfigItemJson();if(window.editingConfigItemId)await updateConfigItem(window.editingConfigItemId,item);else await saveConfigItems([{...item,nombre:configNombre.value,slot:item.slot,tier:configTier.value,ilvl:item.itemLevel,item_json:item}]);configStatus.textContent=window.editingConfigItemId?'Objeto actualizado.':'Objeto guardado.'}catch(e){configStatus.textContent=e.message}};newConfigItemBtn.onclick=resetConfigForm;exportConfigJsonBtn.onclick=()=>{const blob=new Blob([JSON.stringify(currentConfigItemJson(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='config-item.json';a.click();URL.revokeObjectURL(a.href)};importConfigJsonInput.onchange=async()=>{const files=[...importConfigJsonInput.files];configStatus.textContent='Leyendo JSON/ZIP...';try{const items=await parseImportedJsonFiles(files);configStatus.textContent=`Importando ${items.length} objeto(s) sin lote máximo...`;await saveConfigItems(items.map(x=>({...x,item_json:x})));configStatus.textContent=`Importados ${items.length} objeto(s).`}catch(e){configStatus.textContent=e.message}finally{importConfigJsonInput.value=''}}}
// Own tab, own draft/state, own icon editor instance - shares only the
// effects-card rendering (renderPotionEffectsList/defaultComponentFor) and
// the generic saveConfigItems/updateConfigItem/deleteConfigItem calls with
// the equipment tab, same table (config_items), never the same form fields.
function setupConfigPotionMode(){window.currentPotionEffectsDraft=window.currentPotionEffectsDraft||[];renderPotionEffectsList();document.getElementById('addPotionEffectBtn')?.addEventListener('click',e=>{e.preventDefault();const kind=document.getElementById('configPotionEffectKindPicker')?.value||'dmg';window.currentPotionEffectsDraft.push(defaultComponentFor(kind));renderPotionEffectsList()});setupImageIconEditor({inputId:'configPotionImageInput',canvasId:'configPotionCropCanvas',previewId:'configPotionIconPreview',statusId:'configPotionIconStatus',zoomId:'configPotionCropZoom',eraserId:'configPotionMagicEraserBtn',toleranceId:'configPotionMagicTolerance',hexKey:'currentConfigPotionIconHex',statusPrefix:'Icono'});saveConfigPotionBtn.onclick=async()=>{configPotionStatus.textContent=window.editingConfigPotionId?'Actualizando...':'Guardando...';try{const item=currentConfigPotionJson();if(window.editingConfigPotionId)await updateConfigItem(window.editingConfigPotionId,item);else await saveConfigItems([{...item,nombre:item.name,slot:item.slot,tier:item.rarity,ilvl:item.itemLevel,item_json:item}]);configPotionStatus.textContent=window.editingConfigPotionId?'Poción actualizada.':'Poción guardada.'}catch(e){configPotionStatus.textContent=e.message}};newConfigPotionBtn.onclick=resetConfigPotionForm;exportConfigPotionJsonBtn.onclick=()=>{const blob=new Blob([JSON.stringify(currentConfigPotionJson(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='config-potion.json';a.click();URL.revokeObjectURL(a.href)};importConfigPotionJsonInput.onchange=async()=>{const files=[...importConfigPotionJsonInput.files];configPotionStatus.textContent='Leyendo JSON/ZIP...';try{const items=await parseImportedJsonFiles(files);configPotionStatus.textContent=`Importando ${items.length} poción(es) sin lote máximo...`;await saveConfigItems(items.map(x=>{const raw=x.item_json||x,item={...raw,type:'potion',slot:'consumable',effects:Array.isArray(raw.effects)?raw.effects:[]};return {...item,nombre:item.name||x.nombre,slot:'consumable',tier:item.rarity||x.tier,item_json:item}}));configPotionStatus.textContent=`Importadas ${items.length} poción(es).`}catch(e){configPotionStatus.textContent=e.message}finally{importConfigPotionJsonInput.value=''}}}

// --- Editor administrativo de dungeons ---
let configDungeonWorlds=[],editingDungeonWorldId=null,editingDungeonBaseline=null,dungeonPreviewWorld=null,dungeonPreviewFloor=0;
const dungeonField=id=>document.getElementById(id);
function dungeonFloorDrafts(){return [...document.querySelectorAll('[data-dungeon-floor]')].map((row,i)=>({floor:i+1,archetype:row.querySelector('[data-dungeon-archetype]').value,story:row.querySelector('[data-dungeon-story]').value.trim(),floorId:row.querySelector('[data-dungeon-floor-type]').value}))}
function renderDungeonFloorEditor(plan=[]){const root=dungeonField('dungeonFloorEditor');if(!root)return;const floors=normalizedConfigFloors(),arch=Object.entries(FLOOR_ARCHETYPES).map(([id,a])=>`<option value="${id}">${a.label||id}</option>`).join('');root.innerHTML=Array.from({length:DUNGEON_FLOORS},(_,i)=>{const row=plan[i]||{};return `<div class="configItem dungeonFloorRow" data-dungeon-floor="${i+1}"><b>${i+1}</b><div class="dungeonFloorControls"><label>Tipo de piso<select data-dungeon-archetype><option value="">Aleatorio</option>${arch}<option value="megaboss">Megaboss</option></select></label><label>Tileset<select data-dungeon-floor-type><option value="">Aleatorio</option>${floors.map(f=>`<option value="${f.dbId||f.id||f.name}">${f.name}</option>`).join('')}</select></label><label>Historia del piso<input data-dungeon-story maxlength="240" placeholder="Narrativa al entrar..."></label></div></div>`}).join('');[...root.querySelectorAll('[data-dungeon-floor]')].forEach((el,i)=>{const row=plan[i]||{};el.querySelector('[data-dungeon-archetype]').value=row.archetype||'';el.querySelector('[data-dungeon-floor-type]').value=row.floorId||'';el.querySelector('[data-dungeon-story]').value=row.story||''})}
function dungeonConfigParams(){const fine={story:dungeonField('dungeonConfigStory').value.trim(),lootPerFloor:Number(dungeonField('dungeonLootPerFloor').value)||0,width:Number(dungeonField('dungeonWidth').value)||49,height:Number(dungeonField('dungeonHeight').value)||49,geometry:dungeonField('dungeonGeometry').value,roomDensityPct:Number(dungeonField('dungeonRoomDensity').value)||100};const floorPlan=dungeonFloorDrafts();return normalizeWorldParams({damageReceivedPct:dungeonField('dungeonDamageReceived').value,damageDealtPct:dungeonField('dungeonDamageDealt').value,lifePct:dungeonField('dungeonLife').value,xpReceivedPct:dungeonField('dungeonXp').value,enemyCountPct:dungeonField('dungeonEnemyCount').value,enemyLootPct:dungeonField('dungeonEnemyLoot').value,apMode:dungeonField('dungeonApMode').checked,floorPlan,fine})}
function dungeonChangedLeaves(previous,next){
 const changes=[],walk=(before,after,path)=>{
  if(Array.isArray(after)){if(JSON.stringify(before)!==JSON.stringify(after))changes.push({path,value:after});return}
  if(after&&typeof after==='object'){for(const key of Object.keys(after))walk(before?.[key],after[key],[...path,key]);return}
  if(before!==after)changes.push({path,value:after});
 };
 walk(previous,next,['params']);return changes
}
function resetDungeonConfig(){editingDungeonWorldId=null;editingDungeonBaseline=null;dungeonField('dungeonConfigName').value='';dungeonField('dungeonConfigStory').value='';for(const [id,v] of [['dungeonDamageReceived',125],['dungeonDamageDealt',100],['dungeonLife',125],['dungeonXp',100],['dungeonEnemyCount',100],['dungeonEnemyLoot',100],['dungeonLootPerFloor',4],['dungeonWidth',49],['dungeonHeight',49],['dungeonRoomDensity',100]])dungeonField(id).value=v;dungeonField('dungeonGeometry').value='rooms';dungeonField('dungeonApMode').checked=false;renderDungeonFloorEditor();dungeonPreviewWorld=null;drawDungeonGeometryPreview();dungeonField('dungeonConfigStatus').textContent='Nueva dungeon.'}
function fillDungeonConfig(world){editingDungeonWorldId=world.id||null;const p=normalizeWorldParams(world.world_json?.params||world.params),fine=p.fine||world.world_json?.fine||{};editingDungeonBaseline=JSON.parse(JSON.stringify(p));dungeonField('dungeonConfigName').value=world.world_name||world.worldName||'';dungeonField('dungeonConfigStory').value=fine.story||world.world_json?.story||'';for(const [id,key] of [['dungeonDamageReceived','damageReceivedPct'],['dungeonDamageDealt','damageDealtPct'],['dungeonLife','lifePct'],['dungeonXp','xpReceivedPct'],['dungeonEnemyCount','enemyCountPct'],['dungeonEnemyLoot','enemyLootPct']])dungeonField(id).value=p[key];dungeonField('dungeonLootPerFloor').value=fine.lootPerFloor??4;dungeonField('dungeonWidth').value=fine.width??49;dungeonField('dungeonHeight').value=fine.height??49;dungeonField('dungeonGeometry').value=fine.geometry||'rooms';dungeonField('dungeonRoomDensity').value=fine.roomDensityPct??100;dungeonField('dungeonApMode').checked=!!p.apMode;const plans=p.floorPlan||[];renderDungeonFloorEditor(plans.map((r,i)=>({...r,story:r.story||world.world_json?.floors?.[i]?.story||'',archetype:r.archetype||world.world_json?.floors?.[i]?.archetype||''})));dungeonPreviewWorld=world.world_json||world;dungeonPreviewFloor=0;drawDungeonGeometryPreview();dungeonField('dungeonConfigStatus').textContent=`Editando #${world.id||'importada'}.`}
async function fetchConfigDungeons(){const list=dungeonField('dungeonConfigList'),status=dungeonField('dungeonConfigStatus');if(!list)return;try{const r=await fetch('/api/dungeon-worlds?light=1'),data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudieron cargar');configDungeonWorlds=Array.isArray(data)?data:[];list.innerHTML=configDungeonWorlds.length?configDungeonWorlds.map(w=>`<div class="configItem"><span>⌂</span><div><b>${w.world_name||'Sin nombre'}</b><span class="small">#${w.id} · ${new Date(w.created_at).toLocaleString()}</span><div class="configItemActions"><button data-dungeon-edit="${w.id}">Editar</button><button data-dungeon-export="${w.id}">Exportar</button></div></div></div>`).join(''):'<p class="small">No hay dungeons guardadas.</p>';list.querySelectorAll('[data-dungeon-edit]').forEach(b=>b.onclick=()=>loadConfigDungeon(b.dataset.dungeonEdit));list.querySelectorAll('[data-dungeon-export]').forEach(b=>b.onclick=()=>exportStoredDungeon(b.dataset.dungeonExport))}catch(e){status.textContent=e.message}}
async function loadConfigDungeon(id){const r=await fetch(`/api/dungeon-worlds?id=${encodeURIComponent(id)}`),world=await r.json();if(!r.ok)throw new Error(world.error||'No se pudo cargar');fillDungeonConfig(world)}
function downloadDungeonJson(data,name='dungeon'){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${name.replace(/[^a-z0-9_-]+/gi,'-')}.json`;a.click();URL.revokeObjectURL(a.href)}
async function exportStoredDungeon(id){const r=await fetch(`/api/dungeon-worlds?id=${encodeURIComponent(id)}`),w=await r.json();if(r.ok)downloadDungeonJson(w,w.world_name||'dungeon')}
function drawDungeonGeometryPreview(){const c=dungeonField('dungeonGeometryPreview');if(!c)return;const q=c.getContext('2d'),floors=dungeonPreviewWorld?.floors||[],f=floors[dungeonPreviewFloor];q.fillStyle='#09070c';q.fillRect(0,0,c.width,c.height);dungeonField('dungeonPreviewLabel').textContent=`Piso ${dungeonPreviewFloor+1} / ${Math.max(1,floors.length)}${f?.archetypeLabel?' · '+f.archetypeLabel:''}`;if(!f?.map){q.fillStyle='#aa9ab2';q.font='16px monospace';q.fillText('Guarda o importa para generar la vista previa',35,260);return}const h=f.map.length,w=Math.max(...f.map.map(r=>r.length)),sz=Math.min(c.width/w,c.height/h),ox=(c.width-w*sz)/2,oy=(c.height-h*sz)/2;f.map.forEach((row,y)=>row.forEach((v,x)=>{q.fillStyle=v===1?'#241a2c':v===2?'#a26d3d':v===3?'#ffc35a':'#334735';q.fillRect(ox+x*sz,oy+y*sz,Math.ceil(sz),Math.ceil(sz))}));for(const r of f.rooms||[]){q.strokeStyle='#6ed4c5';q.strokeRect(ox+r.x*sz,oy+r.y*sz,r.w*sz,r.h*sz)}for(const e of f.enemies||[]){q.fillStyle=e.boss?'#ff4d4d':'#df7a65';q.fillRect(ox+e.x*sz,oy+e.y*sz,Math.max(2,sz),Math.max(2,sz))}for(const x of f.chests||[]){q.fillStyle='#ffd068';q.fillRect(ox+x.x*sz,oy+x.y*sz,Math.max(2,sz),Math.max(2,sz))}if(f.spawn){q.fillStyle='#72e5ff';q.fillRect(ox+f.spawn.x*sz,oy+f.spawn.y*sz,Math.max(3,sz),Math.max(3,sz))}if(f.stairs){q.fillStyle='#fff';q.fillRect(ox+f.stairs.x*sz,oy+f.stairs.y*sz,Math.max(3,sz),Math.max(3,sz))}}
async function saveDungeonConfig(){
 const status=dungeonField('dungeonConfigStatus'),name=dungeonField('dungeonConfigName').value.trim()||'Dungeon sin nombre';
 try{
  const params=dungeonConfigParams();
  if(editingDungeonWorldId){
   const changes=dungeonChangedLeaves(editingDungeonBaseline||{},params),originalName=configDungeonWorlds.find(w=>String(w.id)===String(editingDungeonWorldId))?.world_name;
   if(!changes.length&&name===originalName){status.textContent='No hay parámetros modificados.';return}
   status.textContent=`Guardando ${changes.length} parámetro(s) modificado(s), sin transferir mapas ni el JSON completo...`;
   const r=await fetch('/api/dungeon-worlds',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:editingDungeonWorldId,world_name:name!==originalName?name:null,changes})}),data=await r.json();
   if(!r.ok)throw new Error(data.error||data.message||'No se pudo actualizar');
   editingDungeonBaseline=JSON.parse(JSON.stringify(params));
   // Keep the already loaded preview locally; only its lightweight params
   // change. Pregenerated maps are intentionally untouched by an edit.
   if(dungeonPreviewWorld)dungeonPreviewWorld.params=params;
   await fetchConfigDungeons();status.textContent='Parámetros modificados consolidados; la geometría pregenerada no se reinsertó.';return
  }
  status.textContent='Generando los 6 pisos y su geometría para la nueva dungeon...';
  if(!configFloors.length)await fetchConfigFloors();if(!configEnemyFamilies.length)await fetchEnemyConfig();
  const world=createDungeonWorldJson(name,params);world.story=params.fine.story;world.fine=params.fine;world.floors.forEach((f,i)=>f.story=params.floorPlan[i]?.story||'');
  const r=await fetch('/api/dungeon-worlds',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({world_name:name,world_json:world})}),data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo guardar');
  editingDungeonWorldId=data.id;editingDungeonBaseline=JSON.parse(JSON.stringify(params));dungeonPreviewWorld=world;dungeonPreviewFloor=0;drawDungeonGeometryPreview();await fetchConfigDungeons();status.textContent='Dungeon nueva consolidada y vista previa actualizada.'
 }catch(e){status.textContent=`Error: ${e.message}`}
}
function setupDungeonConfigMode(){if(dungeonField('dungeonFloorEditor')?.dataset.ready)return;dungeonField('dungeonFloorEditor').dataset.ready='1';renderDungeonFloorEditor();dungeonField('saveDungeonConfigBtn').onclick=saveDungeonConfig;dungeonField('newDungeonConfigBtn').onclick=resetDungeonConfig;dungeonField('deleteDungeonConfigBtn').onclick=async()=>{if(!editingDungeonWorldId||!confirm('¿Borrar esta dungeon definitivamente?'))return;const r=await fetch(`/api/dungeon-worlds?id=${encodeURIComponent(editingDungeonWorldId)}`,{method:'DELETE'});if(r.ok){resetDungeonConfig();fetchConfigDungeons()}};dungeonField('exportDungeonConfigBtn').onclick=()=>downloadDungeonJson({world_name:dungeonField('dungeonConfigName').value,world_json:dungeonPreviewWorld||{params:dungeonConfigParams()}},dungeonField('dungeonConfigName').value||'dungeon');dungeonField('importDungeonConfigInput').onchange=async e=>{try{const raw=JSON.parse(await e.target.files[0].text());fillDungeonConfig(raw.world_json?raw:{world_json:raw,world_name:raw.worldName})}catch(err){dungeonField('dungeonConfigStatus').textContent=`JSON inválido: ${err.message}`}e.target.value=''};dungeonField('dungeonPreviewPrev').onclick=()=>{dungeonPreviewFloor=Math.max(0,dungeonPreviewFloor-1);drawDungeonGeometryPreview()};dungeonField('dungeonPreviewNext').onclick=()=>{dungeonPreviewFloor=Math.min((dungeonPreviewWorld?.floors?.length||1)-1,dungeonPreviewFloor+1);drawDungeonGeometryPreview()};fetchConfigDungeons();drawDungeonGeometryPreview()}

