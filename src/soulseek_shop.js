// ============================================================================
// SOULSEEK MODE - FASE 3: the Soul Unlocks shop.
// Loaded after game.js, soulseek.js and soulseeker-dungeons.js (classic
// script, same shared top-level scope - see soulseek.js's header comment).
// Nothing here edits those files' source: the "SHOP" button is rebound
// (same stale-onclick-value reasoning as Fase 2's buttons) and a handful of
// Fase 1/2 functions are wrapped/overridden again on top of what they
// already do, exactly like Fase 2 layered onto Fase 1.
//
// Design recap:
// - Two account-level unlock pools (races, classes) plus a per-class skill
//   pool (all three permanent, `user.soulseek_races/classes/skills`), spent
//   with the same Soul Spikes balance banked on death (user.souls).
// - The first race and the first class are free; every following one has a
//   fixed price by position (soulseekRaceUnlocked/soulseekClassUnlocked are
//   the single source of truth other files can use to check "is this
//   unlocked", including the character-creation race grid and the level-2
//   class picker, both overridden here).
// - Tier-1 skills come free with a class; tiers above that are individually
//   purchasable per class, gating classSkillIdsForTier/
//   classSkillIdsForLevelReward for soulseeker characters only.
// - A separate "Objetos" shop sells ephemeral items/potions: buying one
//   rolls a real item and appends it to user.soulseek_session_items, which
//   the next Soulseeker character's creation drains into its starting
//   inventory and clears (also cleared defensively on any soulseeker death,
//   in case a character was never actually created after a purchase).
// ============================================================================

let soulseekShopTab='pj';
let soulseekShopPjTab='razas';
let soulseekShopObjTab='objetos';
let soulseekShopSkillClassId=null;
let soulseekShopObjSlot='weapon';

const SOULSEEK_RACE_COSTS=[0,20,20,50,50,100,100];
const SOULSEEK_CLASS_COSTS=[0,15,15,25,25,50,50];
const SOULSEEK_SKILL_TIER_COSTS={2:5,3:10,4:15};
const SOULSEEK_POTION_TIER_COSTS=[3,5,7,10];
const SOULSEEK_ITEM_TIER_COSTS=[5,10,15,20];
const SOULSEEK_ROMAN_TO_TIER={I:1,II:2,III:3,IV:4,V:5,VI:6};

function soulseekCostForIndex(table,index,fallback){return index<table.length?table[index]:fallback}
function soulseekItemTierCost(rarity,table){const idx=Math.min(table.length-1,Math.max(0,LOOT_RARITY_ORDER.indexOf(rarity)));return table[idx]??table[table.length-1]}

// -- unlock pools: window.currentUser is kept in sync with the server on
// -- every login and every purchase (see soulseekSpendSouls), same pattern
// -- as soulseek.js's soulseekAccountSouls()/soulseekSetAccountSouls(). --
function soulseekUnlockedRaces(){return Array.isArray(window.currentUser?.soulseek_races)?window.currentUser.soulseek_races:[]}
function soulseekUnlockedClasses(){return Array.isArray(window.currentUser?.soulseek_classes)?window.currentUser.soulseek_classes:[]}
function soulseekUnlockedSkills(){return Array.isArray(window.currentUser?.soulseek_skills)?window.currentUser.soulseek_skills:[]}
function soulseekSessionItems(){return Array.isArray(window.currentUser?.soulseek_session_items)?window.currentUser.soulseek_session_items:[]}
// The first race/class in the natural listing order is always free/unlocked
// for everyone - not stored in the pool, just always true. Used both by the
// shop and by the character-creation/level-up gates below.
function soulseekRaceUnlocked(id){const ids=Object.keys(raceDefs),idx=ids.indexOf(id);return idx<=0||soulseekUnlockedRaces().includes(id)}
function soulseekClassUnlocked(id){const ids=allClassIds(),idx=ids.indexOf(id);return idx<=0||soulseekUnlockedClasses().includes(id)}

// Combines a souls spend (negative delta) with an unlock-pool/session-items
// write in one PATCH, so a purchase can never leave souls debited without
// the thing they bought (or vice versa) - see api/user.js's PUT handler.
async function soulseekSpendSouls(cost,extraFields={}){
 const r=await fetch('/api/user',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:window.currentUser.nombre,soulsDelta:-cost,...extraFields})});
 const data=await r.json().catch(()=>null);
 if(!r.ok)throw new Error(data?.error||data?.message||`HTTP ${r.status}`);
 Object.assign(window.currentUser,data);
 try{localStorage.setItem('mazmorraUser',JSON.stringify(window.currentUser))}catch(e){}
 return data;
}

// ============================================================================
// Styling. A full-viewport screen (not the centered .overlay/.modal pattern
// used elsewhere) so it can actually fill the width as asked, responsive
// down to phone widths. The detail popup reuses .statPointModal/.statPointBox
// (same convention as the class-pick/death-choice modals in soulseek.js/
// soulseeker-dungeons.js) since that's already a centered, themed dialog.
// ============================================================================
(function injectSoulseekShopStyles(){
 const style=document.createElement('style');
 style.textContent=`
  #soulseekShopOverlay{position:fixed;inset:0;z-index:9000;background:#0a0612;display:flex;flex-direction:column}
  .soulseekShopHeader{display:flex;align-items:center;gap:16px;padding:14px 20px;background:#1c1224;border-bottom:2px solid #6a4d7d;flex-wrap:wrap}
  .soulseekShopHeader h2{margin:0}
  .soulseekShopHeaderSouls{margin-left:auto;display:flex;align-items:center;gap:6px;color:#ffd68b;font-size:15px}
  .soulseekShopMainTabs{display:flex;gap:8px;padding:12px 20px 0}
  .soulseekShopMainTabs button{flex:1;padding:12px;font-size:15px;background:#251a2f;color:#fff;border:2px solid #684b7c;cursor:pointer}
  .soulseekShopMainTabs button.active{background:#65447a;border-color:#ffc35a}
  .soulseekShopSubTabs{display:flex;gap:8px;padding:10px 20px;flex-wrap:wrap}
  .soulseekShopSubTabs button{padding:8px 14px;background:#251a2f;color:#fff;border:2px solid #684b7c;cursor:pointer}
  .soulseekShopSubTabs button.active{background:#65447a;border-color:#ffc35a}
  .soulseekShopContent{flex:1;overflow:auto;padding:6px 20px 50px}
  .soulseekShopGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-top:6px}
  .soulseekShopCard{background:#1c1224;border:3px solid #4d395a;padding:14px;display:flex;flex-direction:column;gap:6px;position:relative;text-align:left;color:#f4ead5;font-family:inherit}
  button.soulseekShopCard{cursor:pointer}
  .soulseekShopCard.unlocked{border-color:#5fce7a}
  .soulseekShopCardIconWrap{display:flex;align-items:center;justify-content:center;height:64px;font-size:32px}
  .soulseekShopCardIconWrap canvas{width:56px;height:56px}
  .soulseekShopLock{position:absolute;top:10px;right:10px;font-size:20px;filter:grayscale(1) opacity(.6)}
  .soulseekShopCard.unlocked .soulseekShopLock{filter:none}
  .soulseekShopCard b{color:#ffd68b;font-size:14px}
  .soulseekShopCard p{margin:0;font-size:11px;color:#c9b8d0;flex:1}
  .soulseekShopCardPrice{font-size:12px;color:#d8b8ff}
  .soulseekShopCard button[data-shop-obj-buy]{margin-top:4px;background:#31223c;color:#fff;border:2px solid #6a4d7d;padding:7px;cursor:pointer}
  .soulseekShopSkillList{display:grid;gap:8px;margin:8px 0 14px}
  .soulseekShopSkillRow{background:#24182e;border:2px solid #59406b;padding:8px 10px}
  .soulseekShopSkillRow b{display:block;color:#ffd68b}
  .soulseekShopSkillRow p{margin:4px 0 0;font-size:11px}
  .soulseekShopUnlockedTag{color:#5fce7a;font-weight:bold;align-self:center}
  .soulseekShopDetailBox{width:min(560px,100%)}
  .soulseekShopDetailIcon{display:flex;justify-content:center;margin:8px 0}
  @media(max-width:700px){.soulseekShopGrid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}.soulseekShopHeader{padding:10px}.soulseekShopContent{padding:6px 10px 40px}}
 `;
 document.head.appendChild(style);
})();

// ============================================================================
// DOM scaffolding - built once, appended to <body>, reused across opens.
// ============================================================================
function soulseekEnsureShopDom(){
 if(document.getElementById('soulseekShopOverlay'))return;
 const wrap=document.createElement('div');
 wrap.innerHTML=`
<div class="hidden" id="soulseekShopOverlay">
 <header class="soulseekShopHeader">
  <h2>SHOP</h2>
  <div class="soulseekShopHeaderSouls" id="soulseekShopHeaderSouls"></div>
  <button class="backToLanding" id="soulseekShopBackBtn" style="position:static">VOLVER</button>
 </header>
 <div class="soulseekShopMainTabs">
  <button type="button" class="active" data-shop-main="pj">PJ</button>
  <button type="button" data-shop-main="objetos">OBJETOS</button>
 </div>
 <div class="soulseekShopSubTabs" id="soulseekShopSubTabs"></div>
 <div class="soulseekShopContent" id="soulseekShopContent"></div>
</div>
<div class="statPointModal" id="soulseekShopDetailModal"><div class="statPointBox soulseekShopDetailBox" id="soulseekShopDetailBox"></div></div>`;
 while(wrap.firstElementChild)document.body.appendChild(wrap.firstElementChild);
 document.querySelectorAll('[data-shop-main]').forEach(b=>b.onclick=()=>{soulseekShopTab=b.dataset.shopMain;soulseekShopPjTab='razas';soulseekShopObjTab='objetos';soulseekRenderShop()});
 document.getElementById('soulseekShopBackBtn').onclick=()=>{
  document.getElementById('soulseekShopOverlay').classList.add('hidden');
  document.getElementById('soulseekShopDetailModal')?.classList.remove('open');
  openSoulseekerMenu();
 };
 if(typeof MAIN_MENU_SCREEN_IDS!=='undefined'&&!MAIN_MENU_SCREEN_IDS.includes('soulseekShopOverlay'))MAIN_MENU_SCREEN_IDS.push('soulseekShopOverlay');
}
function soulseekCloseDetailModal(){document.getElementById('soulseekShopDetailModal')?.classList.remove('open')}

async function soulseekOpenShop(){
 soulseekEnsureShopDom();
 document.getElementById('soulseekOverlay')?.classList.add('hidden');
 document.getElementById('soulseekShopOverlay').classList.remove('hidden');
 soulseekRenderShopHeader();
 document.getElementById('soulseekShopContent').innerHTML='<p class="small">Cargando catálogo...</p>';
 await Promise.all([
  configRacesLoaded?Promise.resolve():fetchConfigRaces(),
  configClasses.length?Promise.resolve():fetchConfigClasses(),
  ensureConfigItemsHydrated()
 ]);
 soulseekShopTab='pj';soulseekShopPjTab='razas';
 soulseekRenderShop();
}

function soulseekRenderShopHeader(){
 const el=document.getElementById('soulseekShopHeaderSouls');if(!el)return;
 el.innerHTML=`${soulIconHtml()} <b>${soulseekAccountSouls()}</b>`;
 setTimeout(soulseekDrawMiniIcons,0);
}
function soulseekRenderShop(){
 soulseekRenderShopHeader();
 document.querySelectorAll('[data-shop-main]').forEach(b=>b.classList.toggle('active',b.dataset.shopMain===soulseekShopTab));
 const subRoot=document.getElementById('soulseekShopSubTabs');
 const subTabs=soulseekShopTab==='pj'?['razas','clases','skills']:['objetos','pociones'];
 const activeSub=soulseekShopTab==='pj'?soulseekShopPjTab:soulseekShopObjTab;
 subRoot.innerHTML=subTabs.map(t=>`<button type="button" class="${t===activeSub?'active':''}" data-shop-sub="${t}">${t.toUpperCase()}</button>`).join('');
 subRoot.querySelectorAll('[data-shop-sub]').forEach(b=>b.onclick=()=>{
  if(soulseekShopTab==='pj')soulseekShopPjTab=b.dataset.shopSub;else soulseekShopObjTab=b.dataset.shopSub;
  soulseekRenderShop();
 });
 if(soulseekShopTab==='pj'){
  if(soulseekShopPjTab==='razas')soulseekRenderShopRaces();
  else if(soulseekShopPjTab==='clases')soulseekRenderShopClasses();
  else soulseekRenderShopSkills();
 }else soulseekRenderShopObjects();
}

// ============================================================================
// PJ > Razas
// ============================================================================
function soulseekRenderShopRaces(){
 const root=document.getElementById('soulseekShopContent');
 const ids=Object.keys(raceDefs);
 if(!ids.length){root.innerHTML=`<p class="small">${configRacesLoaded?'No hay razas configuradas.':'Cargando razas...'}</p>`;return}
 root.innerHTML=`<div class="soulseekShopGrid">${ids.map((id,i)=>{
  const r=raceDefs[id],unlocked=soulseekRaceUnlocked(id),cost=soulseekCostForIndex(SOULSEEK_RACE_COSTS,i,100);
  return `<button type="button" class="soulseekShopCard ${unlocked?'unlocked':''}" data-shop-race="${id}">
   <span class="soulseekShopLock">${unlocked?'🔓':'🔒'}</span>
   <div class="soulseekShopCardIconWrap">${r.icon?`<canvas data-shop-race-icon="${id}" width="56" height="56"></canvas>`:'🧬'}</div>
   <b>${r.name}</b><p>${r.trait||''}</p>
   <span class="soulseekShopCardPrice">${unlocked?'Desbloqueada':(i===0?'GRATIS':cost+' souls')}</span>
  </button>`;
 }).join('')}</div>`;
 root.querySelectorAll('[data-shop-race-icon]').forEach(c=>drawSkillIconImg(c,raceIconForId(c.dataset.shopRaceIcon)));
 root.querySelectorAll('[data-shop-race]').forEach(btn=>btn.onclick=()=>soulseekOpenRaceDetail(btn.dataset.shopRace));
}
function soulseekOpenRaceDetail(id){
 const r=raceDefs[id];if(!r)return;
 const ids=Object.keys(raceDefs),idx=ids.indexOf(id),unlocked=soulseekRaceUnlocked(id),cost=soulseekCostForIndex(SOULSEEK_RACE_COSTS,idx,100),skill=r.skill;
 const box=document.getElementById('soulseekShopDetailBox');
 box.innerHTML=`<h2>${r.name}</h2>
  <div class="soulseekShopDetailIcon">${r.icon?`<canvas id="soulseekShopDetailIconCanvas" width="72" height="72"></canvas>`:''}</div>
  <p class="small">${r.desc||''}</p>
  <p class="small"><strong>Bonificaciones:</strong> ${r.trait||'Ninguna'}</p>
  ${skill?`<p class="small"><strong>Skill activa:</strong> ${skill.icon||''} ${skill.name} — ${skill.desc||''}</p>`:''}
  <div class="startActions">${unlocked?'<span class="soulseekShopUnlockedTag">DESBLOQUEADA</span>':`<button id="soulseekShopUnlockBtn" class="start">DESBLOQUEAR (${idx===0?'GRATIS':cost+' souls'})</button>`}<button id="soulseekShopDetailCloseBtn">CERRAR</button></div>`;
 if(r.icon)setTimeout(()=>drawSkillIconImg(document.getElementById('soulseekShopDetailIconCanvas'),r.icon),0);
 document.getElementById('soulseekShopDetailModal').classList.add('open');
 document.getElementById('soulseekShopDetailCloseBtn').onclick=soulseekCloseDetailModal;
 document.getElementById('soulseekShopUnlockBtn')?.addEventListener('click',()=>soulseekBuyRace(id,idx===0?0:cost));
}
async function soulseekBuyRace(id,price){
 if(soulseekAccountSouls()<price){alert('No tienes suficientes Soul Spikes.');return}
 if(!confirm(`¿Desbloquear la raza ${raceDefs[id]?.name} por ${price===0?'GRATIS':price+' souls'}?`))return;
 try{
  const next=[...new Set([...soulseekUnlockedRaces(),id])];
  await soulseekSpendSouls(price,{soulseek_races:next});
  soulseekCloseDetailModal();
  soulseekRenderShop();
 }catch(e){alert('Error al desbloquear: '+e.message)}
}

// ============================================================================
// PJ > Clases
// ============================================================================
function soulseekRenderShopClasses(){
 const root=document.getElementById('soulseekShopContent');
 const ids=allClassIds().filter(id=>resolveClassDef(id));
 if(!ids.length){root.innerHTML='<p class="small">No hay clases configuradas.</p>';return}
 root.innerHTML=`<div class="soulseekShopGrid">${ids.map((id,i)=>{
  const cls=resolveClassDef(id),unlocked=soulseekClassUnlocked(id),cost=soulseekCostForIndex(SOULSEEK_CLASS_COSTS,i,100),icon=classIconForId(id);
  return `<button type="button" class="soulseekShopCard ${unlocked?'unlocked':''}" data-shop-class="${id}">
   <span class="soulseekShopLock">${unlocked?'🔓':'🔒'}</span>
   <div class="soulseekShopCardIconWrap">${icon?`<canvas data-shop-class-icon="${id}" width="56" height="56"></canvas>`:'⚔'}</div>
   <b>${cls.name}</b><p>${cls.desc||''}</p>
   <span class="soulseekShopCardPrice">${unlocked?'Desbloqueada':(i===0?'GRATIS':cost+' souls')}</span>
  </button>`;
 }).join('')}</div>`;
 root.querySelectorAll('[data-shop-class-icon]').forEach(c=>drawSkillIconImg(c,classIconForId(c.dataset.shopClassIcon)));
 root.querySelectorAll('[data-shop-class]').forEach(btn=>btn.onclick=()=>soulseekOpenClassDetail(btn.dataset.shopClass));
}
function soulseekOpenClassDetail(id){
 const cls=resolveClassDef(id);if(!cls)return;
 const ids=allClassIds(),idx=ids.indexOf(id),unlocked=soulseekClassUnlocked(id),cost=soulseekCostForIndex(SOULSEEK_CLASS_COSTS,idx,100);
 const tier1=(classSkillTrees[id]?.I||[]).filter(sid=>skillDefs[sid]);
 const box=document.getElementById('soulseekShopDetailBox');
 box.innerHTML=`<h2>${cls.name}</h2><p class="small">${cls.desc||''}</p>
  <h3>Skills de Tier 1</h3>
  <div class="soulseekShopSkillList">${tier1.length?tier1.map(sid=>{const s=skillDefs[sid];return `<div class="soulseekShopSkillRow"><b>${s.icon||''} ${s.name}</b><p>${s.desc||''}</p></div>`}).join(''):'<p class="small">Sin skills de tier 1 configuradas.</p>'}</div>
  <div class="startActions">${unlocked?'<span class="soulseekShopUnlockedTag">DESBLOQUEADA</span>':`<button id="soulseekShopUnlockBtn" class="start">DESBLOQUEAR (${idx===0?'GRATIS':cost+' souls'})</button>`}<button id="soulseekShopDetailCloseBtn">CERRAR</button></div>`;
 document.getElementById('soulseekShopDetailModal').classList.add('open');
 document.getElementById('soulseekShopDetailCloseBtn').onclick=soulseekCloseDetailModal;
 document.getElementById('soulseekShopUnlockBtn')?.addEventListener('click',()=>soulseekBuyClass(id,idx===0?0:cost));
}
async function soulseekBuyClass(id,price){
 if(soulseekAccountSouls()<price){alert('No tienes suficientes Soul Spikes.');return}
 if(!confirm(`¿Desbloquear la clase ${resolveClassDef(id)?.name} por ${price===0?'GRATIS':price+' souls'}?`))return;
 try{
  const next=[...new Set([...soulseekUnlockedClasses(),id])];
  await soulseekSpendSouls(price,{soulseek_classes:next});
  soulseekCloseDetailModal();
  soulseekRenderShop();
 }catch(e){alert('Error al desbloquear: '+e.message)}
}

// ============================================================================
// PJ > Skills - class selector (unlocked classes only) then its tier 2+
// skills grouped by tier (tier 1 is free with the class, not sold here).
// ============================================================================
function soulseekRenderShopSkills(){
 const root=document.getElementById('soulseekShopContent');
 const allIds=allClassIds().filter(id=>resolveClassDef(id));
 const unlockedIds=allIds.filter(id=>soulseekClassUnlocked(id));
 if(!unlockedIds.length){root.innerHTML='<p class="small">Desbloquea una clase en la pestaña CLASES primero.</p>';return}
 if(!soulseekShopSkillClassId||!unlockedIds.includes(soulseekShopSkillClassId))soulseekShopSkillClassId=unlockedIds[0];
 const picker=`<div class="soulseekShopSubTabs" style="padding:0 0 12px">${unlockedIds.map(id=>`<button type="button" class="${id===soulseekShopSkillClassId?'active':''}" data-shop-skill-class="${id}">${resolveClassDef(id)?.name||id}</button>`).join('')}</div>`;
 const tree=classSkillTrees[soulseekShopSkillClassId]||{};
 const tierGroups=Object.entries(tree).filter(([roman,ids])=>roman!=='I'&&ids?.length);
 root.innerHTML=picker+(tierGroups.length?tierGroups.map(([roman,ids])=>{
  const tierNum=SOULSEEK_ROMAN_TO_TIER[roman]||0,cost=SOULSEEK_SKILL_TIER_COSTS[tierNum]||15,unlockedSkills=soulseekUnlockedSkills();
  return `<h3>Tier ${tierNum}</h3><div class="soulseekShopGrid">${ids.filter(id=>skillDefs[id]).map(id=>{
   const s=skillDefs[id],unlocked=unlockedSkills.includes(id);
   return `<button type="button" class="soulseekShopCard ${unlocked?'unlocked':''}" data-shop-skill="${id}" data-shop-skill-cost="${cost}">
    <span class="soulseekShopLock">${unlocked?'🔓':'🔒'}</span>
    <b>${s.icon||''} ${s.name}</b><p>${s.desc||''}</p>
    <span class="soulseekShopCardPrice">${unlocked?'Desbloqueada':cost+' souls'}</span>
   </button>`;
  }).join('')}</div>`;
 }).join(''):'<p class="small">Esta clase no tiene skills de tier superior configuradas.</p>');
 root.querySelectorAll('[data-shop-skill-class]').forEach(btn=>btn.onclick=()=>{soulseekShopSkillClassId=btn.dataset.shopSkillClass;soulseekRenderShopSkills()});
 root.querySelectorAll('[data-shop-skill]').forEach(btn=>btn.onclick=()=>soulseekOpenSkillDetail(btn.dataset.shopSkill,Number(btn.dataset.shopSkillCost)));
}
function soulseekOpenSkillDetail(id,cost){
 const s=skillDefs[id];if(!s)return;
 const unlocked=soulseekUnlockedSkills().includes(id);
 const box=document.getElementById('soulseekShopDetailBox');
 box.innerHTML=`<h2>${s.icon||''} ${s.name}</h2><p class="small">${s.desc||''}</p>
  <p class="small">${s.cost} ${s.resource==='mana'?'maná':'stamina'} · CD ${s.cd} · Alcance ${s.range||0}</p>
  <div class="startActions">${unlocked?'<span class="soulseekShopUnlockedTag">DESBLOQUEADA</span>':`<button id="soulseekShopUnlockBtn" class="start">DESBLOQUEAR (${cost} souls)</button>`}<button id="soulseekShopDetailCloseBtn">CERRAR</button></div>`;
 document.getElementById('soulseekShopDetailModal').classList.add('open');
 document.getElementById('soulseekShopDetailCloseBtn').onclick=soulseekCloseDetailModal;
 document.getElementById('soulseekShopUnlockBtn')?.addEventListener('click',()=>soulseekBuySkill(id,cost));
}
async function soulseekBuySkill(id,cost){
 if(soulseekAccountSouls()<cost){alert('No tienes suficientes Soul Spikes.');return}
 if(!confirm(`¿Desbloquear la skill ${skillDefs[id]?.name} por ${cost} souls?`))return;
 try{
  const next=[...new Set([...soulseekUnlockedSkills(),id])];
  await soulseekSpendSouls(cost,{soulseek_skills:next});
  soulseekCloseDetailModal();
  soulseekRenderShop();
 }catch(e){alert('Error al desbloquear: '+e.message)}
}

// ============================================================================
// Objetos > Objetos (by slot) / Pociones - ephemeral one-shot purchases,
// stacked in user.soulseek_session_items instead of an unlock pool.
// ============================================================================
function soulseekRenderShopObjects(){
 const root=document.getElementById('soulseekShopContent');
 if(soulseekShopObjTab==='pociones'){
  const rows=configuredPotionRows();
  root.innerHTML=rows.length?`<div class="soulseekShopGrid">${rows.map(row=>soulseekObjectCardHtml(row,SOULSEEK_POTION_TIER_COSTS)).join('')}</div>`:'<p class="small">No hay pociones configuradas.</p>';
 }else{
  if(!slots.includes(soulseekShopObjSlot))soulseekShopObjSlot=slots[0];
  const slotTabs=`<div class="soulseekShopSubTabs" style="padding:0 0 12px">${slots.map(s=>`<button type="button" class="${s===soulseekShopObjSlot?'active':''}" data-shop-obj-slot="${s}">${s.toUpperCase()}</button>`).join('')}</div>`;
  const rows=configItems.filter(r=>!isConfiguredPotionRow(r)&&((r.item_json||r).slot||r.slot)===soulseekShopObjSlot);
  root.innerHTML=slotTabs+(rows.length?`<div class="soulseekShopGrid">${rows.map(row=>soulseekObjectCardHtml(row,SOULSEEK_ITEM_TIER_COSTS)).join('')}</div>`:'<p class="small">No hay objetos configurados para este slot.</p>');
  root.querySelectorAll('[data-shop-obj-slot]').forEach(b=>b.onclick=()=>{soulseekShopObjSlot=b.dataset.shopObjSlot;soulseekRenderShopObjects()});
 }
 root.querySelectorAll('[data-shop-obj-icon]').forEach(c=>{const row=configItems.find(r=>String(r.id)===c.dataset.shopObjIcon);drawSkillIconImg(c,(row?.item_json||row||{}).icon||'')});
 root.querySelectorAll('[data-shop-obj-buy]').forEach(btn=>btn.onclick=()=>soulseekBuyObject(btn.dataset.shopObjBuy,Number(btn.dataset.shopObjCost)));
}
function soulseekObjectCardHtml(row,costTable){
 const it=row.item_json||row,rarity=it.rarity||row.tier||'common',cost=soulseekItemTierCost(rarity,costTable),name=it.name||row.nombre||'Objeto';
 return `<div class="soulseekShopCard">
  <div class="soulseekShopCardIconWrap">${it.icon?`<canvas data-shop-obj-icon="${row.id}" width="56" height="56"></canvas>`:'✦'}</div>
  <b style="color:${tierDefs[rarity]?.color||'#fff'}">${name}</b>
  <p>${tierDefs[rarity]?.label||rarity}</p>
  <span class="soulseekShopCardPrice">${cost} souls</span>
  <button type="button" data-shop-obj-buy="${row.id}" data-shop-obj-cost="${cost}">COMPRAR</button>
 </div>`;
}
async function soulseekBuyObject(rowId,cost){
 const row=configItems.find(r=>String(r.id)===String(rowId));if(!row)return;
 if(soulseekAccountSouls()<cost){alert('No tienes suficientes Soul Spikes.');return}
 const it=row.item_json||row,name=it.name||row.nombre||'Objeto';
 if(!confirm(`¿Comprar ${name} por ${cost} souls? Aparecerá en el inventario de tu próximo personaje Soulseeker.`))return;
 try{
  const lootRow={itemLevel:{min:1,max:3}};
  const item=isConfiguredPotionRow(row)?configuredPotionFromRow(row,lootRow,1):configuredItemFromRow(row,lootRow,1);
  if(!item)throw new Error('No se pudo generar el objeto.');
  const next=[...soulseekSessionItems(),item];
  await soulseekSpendSouls(cost,{soulseek_session_items:next});
  banner(`COMPRADO: ${item.name}`);
  soulseekRenderShop();
 }catch(e){alert('Error al comprar: '+e.message)}
}

// ============================================================================
// Wiring
// ============================================================================
(function wireSoulseekShop(){
 soulseekEnsureShopDom();

 // Same stale-onclick-value issue as Fase 2's buttons: soulseek.js bound
 // #soulseekUnlocksBtn directly to its own (placeholder) handler value.
 document.getElementById('soulseekUnlocksBtn').onclick=soulseekOpenShop;

 // -- gate character creation's race grid and the level-2 class picker to
 // -- only unlocked entries. Both are short Fase 1 functions, fully
 // -- replaced here (not wrapped) with the unlock filter added in; the
 // -- rendering/selection logic itself is unchanged from soulseek.js. --
 renderSoulseekRaceChoices=function(){
  const root=document.getElementById('soulseekRaceChoices');if(!root)return;
  const raceIds=Object.keys(raceDefs).filter(id=>soulseekRaceUnlocked(id));
  if(!raceIds.length){soulseekSelectedRace=null;root.innerHTML=`<p class="small">${configRacesLoaded?'No tienes ninguna raza desbloqueada todavía. Ve a SHOP → PJ → RAZAS.':'Cargando razas configuradas desde la base de datos...'}</p>`;return}
  if(!raceIds.includes(soulseekSelectedRace))soulseekSelectedRace=raceIds[0];
  root.innerHTML=raceIds.map(id=>{
   const r=raceDefs[id],icon=raceIconForId(id);
   return `<div class="choice ${id===soulseekSelectedRace?'selected':''}" data-soulseek-race="${id}">${icon?`<canvas class="raceChoiceIcon" width="42" height="42" data-soulseek-race-icon="${id}"></canvas>`:''}<div class="choiceBody"><b>${r.name}</b><p class="small">${r.desc}</p><span class="raceTag">${r.origin}</span></div></div>`;
  }).join('');
  root.querySelectorAll('[data-soulseek-race-icon]').forEach(c=>drawSkillIconImg(c,raceIconForId(c.dataset.soulseekRaceIcon)));
  root.querySelectorAll('[data-soulseek-race]').forEach(el=>el.onclick=()=>{soulseekSelectedRace=el.dataset.soulseekRace;renderSoulseekRaceChoices();renderSoulseekGenderChoices()});
 };
 // soulseek.js's own soulseekAdvancedClassIds() is the gameplay-eligible
 // pool for the level-2 class picker (every class flagged `advanced` in
 // the editor, or every hardcoded class as a fallback if none are). That
 // set can be ordered/populated differently from allClassIds() - the
 // shop's own canonical pricing order (soulseekClassUnlocked treats
 // allClassIds()[0] as always-free) - e.g. an admin's "advanced" classes
 // might not include whichever class happens to be first in allClassIds().
 // Filter the eligible pool by unlock state; if nothing is unlocked yet,
 // offer the shop's free class only if it's actually eligible, otherwise
 // fall back to the first eligible class so level 2 is never a dead end.
 const soulseekOriginalAdvancedClassIds=soulseekAdvancedClassIds;
 soulseekAdvancedClassIds=function(){
  const eligible=soulseekOriginalAdvancedClassIds();
  const unlocked=eligible.filter(id=>soulseekClassUnlocked(id));
  if(unlocked.length)return unlocked;
  const freeId=allClassIds()[0];
  return freeId&&eligible.includes(freeId)?[freeId]:eligible.slice(0,1);
 };

 // -- tier 2+ skill choices (level-up pool) only ever offer unlocked
 // -- skills for soulseeker characters; tier 1 always comes free with the
 // -- class, and normal-mode characters are entirely unaffected. --
 const soulseekOriginalClassSkillIdsForTier=classSkillIdsForTier;
 classSkillIdsForTier=function(tier){
  const ids=soulseekOriginalClassSkillIdsForTier(tier);
  if(tier<=1||!game?.player?.soulseeker)return ids;
  const unlocked=soulseekUnlockedSkills();
  return ids.filter(id=>unlocked.includes(id));
 };
 const soulseekOriginalClassSkillIdsForLevelReward=classSkillIdsForLevelReward;
 classSkillIdsForLevelReward=function(level){
  const ids=soulseekOriginalClassSkillIdsForLevelReward(level);
  if(!game?.player?.soulseeker)return ids;
  const unlocked=soulseekUnlockedSkills();
  return ids.filter(id=>{const s=skillDefs[id];return (s?.tier||1)<=1||unlocked.includes(id)});
 };

 // -- ephemeral shop items: drained into the new character's starting
 // -- inventory right before Fase 2's create-and-save-and-enter-dungeon
 // -- flow runs, then cleared from the account once that succeeds. --
 const soulseekFinishCharacterCreationBeforeShop=soulseekFinishCharacterCreation;
 soulseekFinishCharacterCreation=async function(){
  const items=soulseekSessionItems();
  if(items.length)game.inventory=[...(game.inventory||[]),...items];
  await soulseekFinishCharacterCreationBeforeShop();
  if(items.length&&game?.pjId){
   try{await soulseekSpendSouls(0,{soulseek_session_items:[]})}catch(e){console.error('No se pudo limpiar el stash de objetos efímeros',e)}
  }
 };

 // -- defensive backstop: clear any still-pending ephemeral stash whenever
 // -- a soulseeker character dies, in case a purchase was made but no new
 // -- character ever picked it up (the block above is the normal path). --
 const soulseekPermanentDeathBeforeShop=permanentDeath;
 permanentDeath=function(){
  if(game?.player?.soulseeker&&soulseekSessionItems().length){
   soulseekSpendSouls(0,{soulseek_session_items:[]}).catch(()=>{});
  }
  soulseekPermanentDeathBeforeShop();
 };
})();
