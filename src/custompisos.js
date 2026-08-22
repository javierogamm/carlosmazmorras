// ============================================================================
// EDITOR DE PISOS (config_custom_piso) - classic script, same shared
// top-level scope as game.js (loaded after it - see soulseek.js's header
// comment for why this works: browsers share one global declarative
// environment across <script> tags, so top-level `let`/`const`/`function`
// bindings in game.js are directly readable/callable here, and vice versa).
//
// Nothing in game.js/index.html's existing behaviour is edited. This file:
// - Adds its own listener on every [data-config-tab] button (in addition to
//   game.js's own setupConfigTabs onclick) to show/hide #configTabCustompisos
//   - both listeners coexist fine since one uses addEventListener and the
//   other assigns .onclick.
// - Reuses existing shared helpers/state instead of reimplementing them:
//   fetchConfigFloors/normalizedSupabaseFloors (tiles), fetchConfigWorldObjects/
//   listConfigAssets/fetchConfigWorldObjectDetail (assets), fetchEnemyConfig/
//   normalizedEnemyFamilies (enemies), fetchConfigChests/configChests (chests),
//   drawSkillIconImg/tileImageFromHex/hexToBase64 (icon rendering),
//   uiConfirm/uiAlert/uiTextPrompt (dialogs), rollDice (trap damage dice),
//   beginExternalEffectsCast/applySkillEffectsList/endExternalEffectsCast
//   (the same generic stackable-effects executor potions/equipment use).
// - Wraps two function DECLARATIONS from game.js (reassignable bindings,
//   unlike its many `const`s) to plug in without touching their source:
//   springTrap (dice damage + stackable effects on a sprung trap) and
//   loadPrecomputedFloor (splices a hand-authored floor into a normal
//   procedurally-generated run - see the long comment above that wrap, near
//   the bottom of this file, for exactly how).
// - No images are stored here (config_custom_piso has no icon columns by
//   design): every placeable thing references an already-configured catalog
//   row (tile/asset/enemy/chest) by id/key and reuses ITS icon.
//
// Data model: one "draft" (in-memory, matches config_custom_piso's columns
// once split) drives both the top-level piso and, recursively, the interior
// behind any placed door-asset (interiors are just nested drafts, capped at
// one level deep - same depth the real game itself never exceeds). See
// pisoNewDraft/pisoDraftToColumns/pisoColumnsToDraft.
// ============================================================================

// ---- small utilities --------------------------------------------------
function pisoKey(x,y){return x+','+y}
let pisoUidCounter=1;
function pisoUid(){return 'p'+(pisoUidCounter++)+'_'+Math.random().toString(36).slice(2,7)}
function pisoClamp(n,lo,hi){return Math.max(lo,Math.min(hi,n))}
async function pisoResponseJson(r){try{return await r.json()}catch(e){return null}}
function pisoIconCanvas(hex,size=30){
 const c=document.createElement('canvas');c.width=c.height=size;
 if(hex&&typeof drawSkillIconImg==='function')drawSkillIconImg(c,hex);
 return c;
}
function pisoDrawIconAt(ctx,hex,x,y,w,h){
 if(!hex)return false;
 let img=tileImageCache.get('piso:'+hex);
 if(!img){img=tileImageFromHex(hex);tileImageCache.set('piso:'+hex,img)}
 if(!img||img._loadFailed)return false;
 if(!img.complete){img.onload=()=>pisoDraw();return false}
 ctx.drawImage(img,x,y,w,h);
 return true;
}
// Free-text level match: "" = any level; comma list of numbers and/or
// "lo-hi" ranges, e.g. "3,5,8-10".
function pisoNivelMatches(nivelStr,floor){
 const s=String(nivelStr||'').trim();
 if(!s)return true;
 return s.split(',').map(p=>p.trim()).filter(Boolean).some(part=>{
  const range=part.match(/^(\d+)\s*-\s*(\d+)$/);
  if(range)return floor>=Number(range[1])&&floor<=Number(range[2]);
  const n=Number(part);
  return Number.isFinite(n)&&n===floor;
 });
}

// ---- draft model --------------------------------------------------------
function pisoNewDraft(cols,rows){
 return {
  id:null,name:'',nivel:'',cols,rows,
  grid:Array.from({length:rows},()=>Array(cols).fill(1)),
  tileRefs:{},doors:[],assets:[],enemies:[],chests:[],keys:[],traps:[],salas:[],
  spawn:null,stairs:null,interiors:{}
 };
}
function pisoResizeGrid(draft,cols,rows){
 cols=pisoClamp(Math.round(cols)||draft.cols,9,49);rows=pisoClamp(Math.round(rows)||draft.rows,9,49);
 const grid=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>draft.grid[y]?.[x]??1));
 const tileRefs={};
 for(const k in draft.tileRefs){const [x,y]=k.split(',').map(Number);if(x<cols&&y<rows)tileRefs[k]=draft.tileRefs[k]}
 const inBounds=e=>e.x<cols&&e.y<rows;
 draft.cols=cols;draft.rows=rows;draft.grid=grid;draft.tileRefs=tileRefs;
 draft.doors=draft.doors.filter(inBounds);draft.assets=draft.assets.filter(a=>a.x+a.cols<=cols&&a.y+a.rows<=rows);
 draft.enemies=draft.enemies.filter(inBounds);draft.chests=draft.chests.filter(inBounds);
 draft.keys=draft.keys.filter(inBounds);draft.traps=draft.traps.filter(inBounds);
 draft.salas=draft.salas.filter(s=>s.x+s.w<=cols&&s.y+s.h<=rows);
 if(draft.spawn&&!inBounds(draft.spawn))draft.spawn=null;
 if(draft.stairs&&!inBounds(draft.stairs))draft.stairs=null;
}
function pisoDraftToColumns(draft){
 return {
  name:draft.name||'Piso sin nombre',
  nivel:draft.nivel||null,
  tiles_doors:{cols:draft.cols,rows:draft.rows,grid:draft.grid,tileRefs:draft.tileRefs,doors:draft.doors,spawn:draft.spawn,stairs:draft.stairs,tilesetId:draft.tilesetId||null},
  assets:draft.assets,
  enemigos:draft.enemies,
  chests_keys_traps:{chests:draft.chests,keys:draft.keys,traps:draft.traps},
  interiors:Object.fromEntries(Object.entries(draft.interiors||{}).map(([iid,sub])=>[iid,pisoDraftToColumns(sub)])),
  salas:draft.salas
 };
}
function pisoColumnsToDraft(row){
 const td=row.tiles_doors||{},ckt=row.chests_keys_traps||{};
 const cols=td.cols||COLS,rows=td.rows||ROWS;
 const draft=pisoNewDraft(cols,rows);
 draft.id=row.id??null;draft.name=row.name||'';draft.nivel=row.nivel||'';
 if(Array.isArray(td.grid))draft.grid=td.grid.map(r=>r.map(v=>v?1:0));
 draft.tileRefs=td.tileRefs&&typeof td.tileRefs==='object'?td.tileRefs:{};
 draft.doors=Array.isArray(td.doors)?td.doors:[];
 draft.spawn=td.spawn||null;draft.stairs=td.stairs||null;draft.tilesetId=td.tilesetId||null;
 draft.assets=Array.isArray(row.assets)?row.assets:[];
 draft.enemies=Array.isArray(row.enemigos)?row.enemigos:[];
 draft.chests=Array.isArray(ckt.chests)?ckt.chests:[];
 draft.keys=Array.isArray(ckt.keys)?ckt.keys:[];
 draft.traps=Array.isArray(ckt.traps)?ckt.traps:[];
 draft.salas=Array.isArray(row.salas)?row.salas:[];
 draft.interiors={};
 for(const [iid,sub] of Object.entries(row.interiors||{}))
  try{draft.interiors[iid]=pisoColumnsToDraft(sub)}catch(e){/* ignore malformed nested interior */}
 return draft;
}

// ---- editor state ---------------------------------------------------------
let pisoRootDraft=pisoNewDraft(COLS,ROWS);
let pisoContextStack=[]; // [] editing root; [{assetIid,assetName}] editing that door's interior
let pisoList=[]; // light list from the API, for the "Pisos guardados" panel
let pisoTool='paint';
let pisoActiveEntry=null; // currently selected palette entry to paint/place with
let pisoActivePaletteTab='tiles';
let pisoActiveTileset=null; // full floor_json of the reference tileset (preview only)
let pisoZoom=1;
const PISO_CELL_BASE=22;
let pisoSelectedInstance=null; // {kind,iid} for the inspector
let pisoSelectionRect=null; // {x0,y0,x1,y1} grid coords, while/after marquee drag
let pisoEnemyIconRequests=new Set();

function pisoCurrentDraft(){
 let d=pisoRootDraft;
 for(const ctx of pisoContextStack){
  if(!d.interiors[ctx.assetIid])d.interiors[ctx.assetIid]=pisoNewDraft(21,21);
  d=d.interiors[ctx.assetIid];
 }
 return d;
}
function pisoInInterior(){return pisoContextStack.length>0}

// ---- catalogs (reuse game.js's own fetch/cache) ---------------------------
let pisoCatalogsPromise=null;
function pisoEnsureCatalogs(){
 if(pisoCatalogsPromise)return pisoCatalogsPromise;
 pisoCatalogsPromise=Promise.all([
  typeof fetchConfigFloors==='function'?fetchConfigFloors({light:true}).catch(()=>{}):null,
  typeof fetchConfigWorldObjects==='function'?fetchConfigWorldObjects().catch(()=>{}):null,
  typeof fetchEnemyConfig==='function'?fetchEnemyConfig().catch(()=>{}):null,
  typeof fetchConfigChests==='function'?fetchConfigChests().catch(()=>{}):null
 ]);
 return pisoCatalogsPromise;
}
async function pisoFetchFloorDetail(id){
 const r=await fetch('/api/config-floor?id='+encodeURIComponent(id));
 const data=await pisoResponseJson(r);
 if(!r.ok)throw new Error(data?.error||'No se pudo cargar el tileset');
 return data;
}
function pisoPopulateTilesetSelect(){
 const sel=document.getElementById('pisoTilesetSelect');if(!sel)return;
 const floors=(typeof configFloors!=='undefined'?configFloors:[]).filter(f=>!f.interior);
 const current=sel.value;
 sel.innerHTML='<option value="">— Elegir tileset de referencia —</option>'+floors.map(f=>`<option value="${f.id}">${(f.floor_name||'Floor '+f.id).replace(/</g,'&lt;')}</option>`).join('');
 if(current)sel.value=current;
}
async function pisoOnTilesetChange(id){
 if(!id){pisoActiveTileset=null;pisoRenderPalette();return}
 try{
  const detail=await pisoFetchFloorDetail(id);
  pisoActiveTileset=detail?.floor_json||null;
  pisoCurrentDraft().tilesetId=id;
 }catch(e){
  const st=document.getElementById('pisoStatus');if(st)st.textContent='Error cargando tileset: '+e.message;
 }
 pisoRenderPalette();pisoDraw();
}

// ---- enemy icon on-demand fetch (mirrors requestEnemyIcon but decoupled
// from live `game`/draw() - see that function's comment in game.js) --------
function pisoRequestEnemyIcon(templateId,onReady){
 const key=String(templateId);
 if(pisoEnemyIconRequests.has(key))return;
 pisoEnemyIconRequests.add(key);
 fetch('/api/enemy-detail?id='+encodeURIComponent(templateId)).then(pisoResponseJson).then(row=>{
  if(row?.icon){
   const detail=(typeof configEnemyDetails!=='undefined'?configEnemyDetails:[]).find(d=>String(d.id)===key);
   if(detail)detail.icon=row.icon;
   if(onReady)onReady(row.icon);
  }
 }).catch(()=>{}).finally(()=>pisoEnemyIconRequests.delete(key));
}

// ============================================================================
// PALETTE
// ============================================================================
let pisoPaletteEntries=[]; // rebuilt on every render, index-addressed by the DOM

function pisoBuildPaletteEntries(){
 const cat=pisoActivePaletteTab;
 if(cat==='tiles'){
  const floor=(pisoActiveTileset?.floorTiles||[]).map(t=>({cat:'tiles',kind:'floor',tile:t,label:t.name||'Suelo',icon:t.icon,color:t.color}));
  const wall=(pisoActiveTileset?.wallTiles||[]).map(t=>({cat:'tiles',kind:'wall',tile:t,label:t.name||'Muro',icon:t.icon,color:t.color}));
  return [...floor,...wall];
 }
 if(cat==='doors'){
  return (pisoActiveTileset?.doorTiles||[]).map(t=>({cat:'doors',kind:'door',tile:t,label:t.name||'Puerta',icon:t.icon,color:t.color}));
 }
 if(cat==='assets'){
  const list=typeof listConfigAssets==='function'?listConfigAssets():[];
  return list.map(a=>({cat:'assets',kind:'asset',asset:a,label:a.name,icon:a.icon}));
 }
 if(cat==='enemies'){
  const families=typeof normalizedEnemyFamilies==='function'?normalizedEnemyFamilies():[];
  const out=[];
  for(const fam of families)for(const en of fam.enemies||[])out.push({cat:'enemies',kind:'enemy',enemy:en,family:fam.name,label:`${en.name} (${fam.name})`,icon:en.icon});
  return out;
 }
 if(cat==='chests'){
  return (typeof configChests!=='undefined'?configChests:[]).map(r=>({cat:'chests',kind:'chest',chestRow:r,label:r.chest_json?.name||r.chest_name||'Cofre',icon:r.chest_json?.icon}));
 }
 if(cat==='keys')return [{cat:'keys',kind:'key',label:'Llave',glyph:'🔑'}];
 if(cat==='traps')return [{cat:'traps',kind:'trap',label:'Trampa',glyph:'☠️'}];
 return [];
}
function pisoRenderPalette(){
 const root=document.getElementById('pisoPaletteList');if(!root)return;
 pisoPaletteEntries=pisoBuildPaletteEntries();
 if(!pisoPaletteEntries.length){
  root.innerHTML=`<p class="small">${pisoActivePaletteTab==='tiles'||pisoActivePaletteTab==='doors'?'Elige un tileset de referencia arriba.':'Nada configurado todavía en ese catálogo.'}</p>`;
  return;
 }
 root.innerHTML='';
 pisoPaletteEntries.forEach((entry,idx)=>{
  const row=document.createElement('div');
  row.className='pisoPaletteItem';row.dataset.pisoEntryIdx=String(idx);
  if(pisoActiveEntry===entry)row.classList.add('active');
  const thumb=document.createElement('div');thumb.className='pisoPaletteThumb';
  if(entry.icon)thumb.appendChild(pisoIconCanvas(entry.icon,30));
  else if(entry.glyph)thumb.textContent=entry.glyph;
  else if(entry.color){thumb.style.background=entry.color}
  else thumb.textContent='?';
  const name=document.createElement('div');name.className='pisoPaletteName';
  name.innerHTML=`<b>${(entry.label||'').replace(/</g,'&lt;')}</b>`+(entry.kind==='wall'?'<span>Muro · '+(entry.tile?.direction||'auto')+'</span>':entry.kind==='asset'?`<span>${entry.asset.cols}×${entry.asset.rows}</span>`:'');
  row.appendChild(thumb);row.appendChild(name);
  pisoWirePaletteDrag(row,entry);
  root.appendChild(row);
  // lazily fetch icons the catalog doesn't ship in its light/list form
  if(entry.kind==='asset'&&!entry.icon&&typeof fetchConfigWorldObjectDetail==='function'){
   fetchConfigWorldObjectDetail(entry.asset.key).then(row2=>{if(row2?.icon){entry.icon=row2.icon;if(pisoActivePaletteTab==='assets')pisoRenderPalette()}}).catch(()=>{});
  }
  if(entry.kind==='enemy'&&!entry.icon&&entry.enemy?.id){
   pisoRequestEnemyIcon(entry.enemy.id,hex=>{entry.icon=hex;if(pisoActivePaletteTab==='enemies')pisoRenderPalette()});
  }
 });
}

// ============================================================================
// CANVAS RENDERING
// ============================================================================
function pisoCellPx(){return Math.max(6,Math.round(PISO_CELL_BASE*pisoZoom))}
function pisoCanvasEl(){return document.getElementById('pisoCanvas')}
function pisoCtx(){const c=pisoCanvasEl();return c?c.getContext('2d'):null}

function pisoDraw(){
 const canvas=pisoCanvasEl(),ctx=pisoCtx();if(!canvas||!ctx)return;
 const draft=pisoCurrentDraft(),cell=pisoCellPx();
 canvas.width=draft.cols*cell;canvas.height=draft.rows*cell;
 ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#09070c';ctx.fillRect(0,0,canvas.width,canvas.height);
 for(let y=0;y<draft.rows;y++)for(let x=0;x<draft.cols;x++){
  const open=draft.grid[y][x]===0,ref=draft.tileRefs[pisoKey(x,y)];
  ctx.fillStyle=open?(ref?.color||'#241b2c'):(ref?.color||'#100b16');
  ctx.fillRect(x*cell,y*cell,cell,cell);
  if(ref?.icon)pisoDrawIconAt(ctx,ref.icon,x*cell,y*cell,cell,cell);
  ctx.strokeStyle='#00000050';ctx.lineWidth=1;ctx.strokeRect(x*cell+.5,y*cell+.5,cell-1,cell-1);
 }
 // salas outlines
 ctx.lineWidth=2;ctx.strokeStyle='#6ab7ff';ctx.font=`${Math.max(9,cell*.4)}px sans-serif`;ctx.fillStyle='#bcdcff';
 for(const s of draft.salas||[]){
  ctx.strokeRect(s.x*cell+2,s.y*cell+2,s.w*cell-4,s.h*cell-4);
  if(s.name)ctx.fillText(s.name,s.x*cell+5,s.y*cell+14);
 }
 // doors (map-level door tiles)
 for(const d of draft.doors||[]){
  ctx.fillStyle=d.locked===false?'#5affa0':'#ff9d4f';
  ctx.fillRect(d.x*cell+cell*.15,d.y*cell+cell*.15,cell*.7,cell*.7);
  ctx.strokeStyle='#000';ctx.strokeRect(d.x*cell+cell*.15,d.y*cell+cell*.15,cell*.7,cell*.7);
 }
 // assets (multi-cell)
 for(const a of draft.assets||[]){
  ctx.fillStyle='#3c2a4a';ctx.fillRect(a.x*cell,a.y*cell,a.cols*cell,a.rows*cell);
  ctx.strokeStyle=pisoSelectedInstance?.kind==='asset'&&pisoSelectedInstance.iid===a.iid?'#ffc35a':'#8b6b9d';
  ctx.lineWidth=2;ctx.strokeRect(a.x*cell+1,a.y*cell+1,a.cols*cell-2,a.rows*cell-2);
  if(a.icon)pisoDrawIconAt(ctx,a.icon,a.x*cell,a.y*cell,a.cols*cell,a.rows*cell);
  if(a.door&&window.DungeonInteriors){
   const dt=window.DungeonInteriors.parseDoor(a.door,a.cols,a.rows);
   if(dt){ctx.fillStyle='#ffd68b';ctx.fillRect((a.x+dt.x)*cell+cell*.3,(a.y+dt.y)*cell+cell*.3,cell*.4,cell*.4)}
  }
 }
 // enemies/chests/keys/traps
 for(const e of draft.enemies||[])pisoDrawGlyphOrIcon(ctx,e.icon,'👹',e.x*cell,e.y*cell,cell,e.boss?'#ff5c5c':'#e0b0ff');
 for(const c of draft.chests||[])pisoDrawGlyphOrIcon(ctx,c.icon,'🎁',c.x*cell,c.y*cell,cell,c.locked?'#ffcf70':'#8cffb0');
 for(const k of draft.keys||[])pisoDrawGlyphOrIcon(ctx,null,'🔑',k.x*cell,k.y*cell,cell,'#ffe28a');
 for(const t of draft.traps||[])pisoDrawGlyphOrIcon(ctx,null,'☠️',t.x*cell,t.y*cell,cell,t.effects?.length?'#ff6b6b':'#c98cff');
 // spawn/stairs markers
 if(draft.spawn)pisoDrawMarker(ctx,draft.spawn,'🚩',cell);
 if(draft.stairs)pisoDrawMarker(ctx,draft.stairs,'🏁',cell);
 // selection rectangle
 if(pisoSelectionRect){
  const r=pisoNormalizedRect(pisoSelectionRect);
  ctx.fillStyle='#ffc35a33';ctx.fillRect(r.x*cell,r.y*cell,(r.x1-r.x+1)*cell,(r.y1-r.y+1)*cell);
  ctx.strokeStyle='#ffc35a';ctx.lineWidth=2;ctx.strokeRect(r.x*cell+1,r.y*cell+1,(r.x1-r.x+1)*cell-2,(r.y1-r.y+1)*cell-2);
 }
 const zl=document.getElementById('pisoZoomLabel');if(zl)zl.textContent=Math.round(pisoZoom*100)+'%';
}
function pisoDrawGlyphOrIcon(ctx,hex,glyph,px,py,cell,accent){
 ctx.fillStyle=accent+'55';ctx.beginPath();ctx.arc(px+cell/2,py+cell/2,cell*.42,0,7);ctx.fill();
 if(hex&&pisoDrawIconAt(ctx,hex,px+cell*.08,py+cell*.08,cell*.84,cell*.84))return;
 ctx.font=`${Math.max(10,cell*.6)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText(glyph,px+cell/2,py+cell/2+1);
}
function pisoDrawMarker(ctx,pos,glyph,cell){
 ctx.font=`${Math.max(10,cell*.7)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillText(glyph,pos.x*cell+cell/2,pos.y*cell+cell/2);
}
function pisoNormalizedRect(r){return {x:Math.min(r.x0,r.x1),y:Math.min(r.y0,r.y1),x1:Math.max(r.x0,r.x1),y1:Math.max(r.y0,r.y1)}}

// ============================================================================
// CELL / ENTITY LOOKUP
// ============================================================================
function pisoInstanceAt(x,y){
 const draft=pisoCurrentDraft();
 const asset=(draft.assets||[]).find(a=>x>=a.x&&x<a.x+a.cols&&y>=a.y&&y<a.y+a.rows);
 if(asset)return {kind:'asset',iid:asset.iid,obj:asset};
 const enemy=(draft.enemies||[]).find(e=>e.x===x&&e.y===y);if(enemy)return {kind:'enemy',iid:enemy.iid,obj:enemy};
 const chest=(draft.chests||[]).find(c=>c.x===x&&c.y===y);if(chest)return {kind:'chest',iid:chest.iid,obj:chest};
 const key=(draft.keys||[]).find(k=>k.x===x&&k.y===y);if(key)return {kind:'key',iid:key.iid,obj:key};
 const trap=(draft.traps||[]).find(t=>t.x===x&&t.y===y);if(trap)return {kind:'trap',iid:trap.iid,obj:trap};
 const door=(draft.doors||[]).find(d=>d.x===x&&d.y===y);if(door)return {kind:'door',iid:door.iid,obj:door};
 return null;
}
function pisoInstanceListFor(draft,kind){
 return {asset:draft.assets,enemy:draft.enemies,chest:draft.chests,key:draft.keys,trap:draft.traps,door:draft.doors}[kind];
}
function pisoRemoveInstance(kind,iid){
 const draft=pisoCurrentDraft(),list=pisoInstanceListFor(draft,kind);if(!list)return;
 const idx=list.findIndex(o=>o.iid===iid);if(idx>=0)list.splice(idx,1);
 if(kind==='asset')delete draft.interiors[iid];
 if(pisoSelectedInstance?.iid===iid)pisoSelectedInstance=null;
}
function pisoCanPlaceAssetAt(draft,x,y,cols,rows,ignoreIid){
 if(x<0||y<0||x+cols>draft.cols||y+rows>draft.rows)return false;
 for(let yy=y;yy<y+rows;yy++)for(let xx=x;xx<x+cols;xx++)if(draft.grid[yy][xx]!==0)return false;
 for(const a of draft.assets||[]){
  if(a.iid===ignoreIid)continue;
  if(x<a.x+a.cols&&x+cols>a.x&&y<a.y+a.rows&&y+rows>a.y)return false;
 }
 return true;
}

// ============================================================================
// PLACEMENT
// ============================================================================
function pisoSetStatus(msg){const st=document.getElementById('pisoStatus');if(st)st.textContent=msg||''}

function pisoApplyTileEntry(entry,x,y){
 const draft=pisoCurrentDraft();
 if(entry.kind==='floor'){
  draft.grid[y][x]=0;draft.tileRefs[pisoKey(x,y)]={type:'floor',name:entry.tile.name,color:entry.tile.color,icon:entry.tile.icon};
  const doorIdx=(draft.doors||[]).findIndex(d=>d.x===x&&d.y===y);if(doorIdx>=0)draft.doors.splice(doorIdx,1);
 }else if(entry.kind==='wall'){
  if(pisoInstanceAt(x,y)){pisoSetStatus('Esa casilla tiene algo colocado encima; bórralo primero.');return}
  if((draft.spawn?.x===x&&draft.spawn?.y===y)||(draft.stairs?.x===x&&draft.stairs?.y===y)){pisoSetStatus('Ahí está marcada la entrada/salida; muévela primero.');return}
  draft.grid[y][x]=1;draft.tileRefs[pisoKey(x,y)]={type:'wall',name:entry.tile.name,color:entry.tile.color,icon:entry.tile.icon,direction:entry.tile.direction};
  const doorIdx=(draft.doors||[]).findIndex(d=>d.x===x&&d.y===y);if(doorIdx>=0)draft.doors.splice(doorIdx,1);
 }else if(entry.kind==='door'){
  draft.grid[y][x]=0;draft.tileRefs[pisoKey(x,y)]={type:'door',name:entry.tile.name,color:entry.tile.color,icon:entry.tile.icon};
  const existing=(draft.doors||[]).find(d=>d.x===x&&d.y===y);
  if(!existing)draft.doors.push({iid:pisoUid(),x,y,open:false,locked:true});
 }
 pisoDraw();
}
function pisoPlaceInstance(entry,x,y){
 const draft=pisoCurrentDraft();
 if(entry.kind==='asset'){
  const a=entry.asset;
  if(!pisoCanPlaceAssetAt(draft,x,y,a.cols,a.rows)){pisoSetStatus('No cabe ahí: hace falta suelo ya pintado y libre de otros assets en todo su hueco ('+a.cols+'×'+a.rows+').');return}
  draft.assets.push({iid:pisoUid(),key:a.key,name:a.name,icon:a.icon,x,y,cols:a.cols,rows:a.rows,door:a.door||''});
 }else if(entry.kind==='enemy'){
  if(draft.grid[y][x]!==0){pisoSetStatus('Coloca enemigos sobre suelo.');return}
  draft.enemies.push({iid:pisoUid(),x,y,enemyDetailId:entry.enemy.id,name:entry.enemy.name,icon:entry.enemy.icon,tier:entry.enemy.tier,boss:false,familyName:entry.family});
 }else if(entry.kind==='chest'){
  if(draft.grid[y][x]!==0){pisoSetStatus('Coloca cofres sobre suelo.');return}
  draft.chests.push({iid:pisoUid(),x,y,configChestId:entry.chestRow.id,name:entry.label,icon:entry.icon,locked:false});
 }else if(entry.kind==='key'){
  if(draft.grid[y][x]!==0){pisoSetStatus('Coloca llaves sobre suelo.');return}
  draft.keys.push({iid:pisoUid(),x,y});
 }else if(entry.kind==='trap'){
  if(draft.grid[y][x]!==0){pisoSetStatus('Coloca trampas sobre suelo.');return}
  draft.traps.push({iid:pisoUid(),x,y,dmgDice:'1d6+2',effects:[]});
 }
 pisoSetStatus('');pisoDraw();
}

// ============================================================================
// UNIFIED POINTER DRAG (mouse: starts on move; touch: press-and-hold ~320ms)
// ============================================================================
// `panEl`, when given, is manually scrolled (scrollLeft/scrollTop) while a
// touch pointer moves before its long-press fires. The canvas wrap uses
// touch-action:none (so a long-press-then-drag paint stroke is never
// hijacked mid-gesture by the browser's own native scroll), which means
// native panning never kicks in either - this recreates it in JS instead of
// relying on touch-action:pan-x/pan-y, which cannot reliably be un-committed
// once a real drag starts a few frames later.
function pisoBeginPointerDrag(e,{onStart,onMove,onEnd,panEl}){
 const isTouch=e.pointerType==='touch';
 let lastX=e.clientX,lastY=e.clientY;
 let started=!isTouch,longPressTimer=null,moved=false,panning=false;
 const pid=e.pointerId,threshold=8;
 function cleanup(){if(longPressTimer)clearTimeout(longPressTimer);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel)}
 function move(ev){
  if(ev.pointerId!==pid)return;
  if(!started){
   const dx=ev.clientX-lastX,dy=ev.clientY-lastY;
   if(panEl&&(panning||Math.hypot(dx,dy)>threshold)){
    panning=true;if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
    panEl.scrollLeft-=dx;panEl.scrollTop-=dy;lastX=ev.clientX;lastY=ev.clientY;
    return;
   }
   if(!panEl&&Math.hypot(dx,dy)>threshold)cleanup(); // no pan target: just abort and let the page do whatever it wants
   return;
  }
  moved=true;ev.preventDefault();onMove(ev);
 }
 function up(ev){if(ev.pointerId!==pid)return;cleanup();if(started)onEnd(ev,true,moved)}
 function cancel(ev){if(ev.pointerId!==pid)return;cleanup();if(started)onEnd(ev,false,moved)}
 document.addEventListener('pointermove',move);
 document.addEventListener('pointerup',up);
 document.addEventListener('pointercancel',cancel);
 if(isTouch)longPressTimer=setTimeout(()=>{if(!panning){started=true;onStart(e)}},320);
 else onStart(e);
}

function pisoWirePaletteDrag(row,entry){
 row.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button>0)return;
  const ghost=document.getElementById('pisoDragGhost');
  pisoBeginPointerDrag(e,{
   panEl:document.getElementById('pisoPaletteList'),
   onStart:()=>{
    if(ghost){
     ghost.innerHTML='';
     if(entry.icon)ghost.appendChild(pisoIconCanvas(entry.icon,32));
     else ghost.textContent=entry.glyph||'●';
     ghost.classList.remove('hidden');
     ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';
    }
   },
   onMove:ev=>{if(ghost){ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px'}},
   onEnd:(ev,completed,moved)=>{
    if(ghost)ghost.classList.add('hidden');
    if(!completed)return;
    const cell=moved?pisoCellFromPoint(ev.clientX,ev.clientY):null;
    if(cell){
     pisoActiveEntry=entry;pisoActivePaletteTab=entry.cat;
     if(entry.cat==='tiles'||entry.cat==='doors')pisoApplyTileEntry(entry,cell.x,cell.y);
     else pisoPlaceInstance(entry,cell.x,cell.y);
    }else{
     // plain click (or an aborted drag): select this entry as the active
     // "brush" so clicking/painting the canvas directly keeps using it.
     pisoActiveEntry=entry;pisoTool='paint';pisoSyncToolButtons();pisoRenderPalette();
    }
   }
  });
 });
}
function pisoCellFromPoint(clientX,clientY){
 const canvas=pisoCanvasEl();if(!canvas)return null;
 const rect=canvas.getBoundingClientRect();
 if(clientX<rect.left||clientX>rect.right||clientY<rect.top||clientY>rect.bottom)return null;
 const cell=pisoCellPx(),scaleX=canvas.width/rect.width,scaleY=canvas.height/rect.height;
 const x=Math.floor((clientX-rect.left)*scaleX/cell),y=Math.floor((clientY-rect.top)*scaleY/cell);
 const draft=pisoCurrentDraft();
 if(x<0||y<0||x>=draft.cols||y>=draft.rows)return null;
 return {x,y};
}

function pisoWireCanvas(){
 const canvas=pisoCanvasEl();if(!canvas)return;
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button>0)return;
  const startCell=pisoCellFromPoint(e.clientX,e.clientY);if(!startCell)return;
  const panEl=document.getElementById('pisoCanvasWrap');
  if(pisoTool==='select'||pisoTool==='room'){
   pisoBeginPointerDrag(e,{
    panEl,
    onStart:()=>{pisoSelectionRect={x0:startCell.x,y0:startCell.y,x1:startCell.x,y1:startCell.y};pisoHideSelectionMenu();pisoDraw()},
    onMove:ev=>{const c=pisoCellFromPoint(ev.clientX,ev.clientY);if(c){pisoSelectionRect.x1=c.x;pisoSelectionRect.y1=c.y;pisoDraw()}},
    onEnd:()=>{if(pisoTool==='select')pisoShowSelectionMenu();else pisoPromptRoomName()}
   });
   return;
  }
  if(pisoTool==='erase'){
   pisoBeginPointerDrag(e,{
    panEl,
    onStart:()=>pisoEraseAt(startCell.x,startCell.y),
    onMove:ev=>{const c=pisoCellFromPoint(ev.clientX,ev.clientY);if(c)pisoEraseAt(c.x,c.y)},
    onEnd:()=>{}
   });
   return;
  }
  if(pisoTool==='spawn'||pisoTool==='stairs'){
   pisoBeginPointerDrag(e,{panEl,onStart:()=>pisoPlaceMarker(pisoTool,startCell.x,startCell.y),onMove:()=>{},onEnd:()=>{}});
   return;
  }
  // paint tool: reposition an existing instance, or paint/place with the active entry
  const hit=pisoInstanceAt(startCell.x,startCell.y);
  if(hit&&hit.kind==='door'){
   // Door tiles stay pinned to the grid cell they were painted on (not a
   // freely draggable instance) - a click just opens its inspector.
   pisoBeginPointerDrag(e,{panEl,onStart:()=>{},onMove:()=>{},onEnd:(ev,completed,moved)=>{if(!moved)pisoSelectInstance('door',hit.iid)}});
   return;
  }
  if(hit){
   pisoBeginPointerDrag(e,{
    panEl,
    onStart:()=>{},
    onMove:ev=>{const c=pisoCellFromPoint(ev.clientX,ev.clientY);if(!c)return;
     if(hit.kind==='asset'){if(!pisoCanPlaceAssetAt(pisoCurrentDraft(),c.x,c.y,hit.obj.cols,hit.obj.rows,hit.iid))return}
     else if(pisoCurrentDraft().grid[c.y][c.x]!==0)return;
     hit.obj.x=c.x;hit.obj.y=c.y;pisoDraw();
    },
    onEnd:(ev,completed,moved)=>{if(!moved)pisoSelectInstance(hit.kind,hit.iid)}
   });
   return;
  }
  if(!pisoActiveEntry){pisoSetStatus('Elige algo de la paleta primero.');return}
  pisoBeginPointerDrag(e,{
   panEl,
   onStart:()=>{if(pisoActiveEntry.cat==='tiles'||pisoActiveEntry.cat==='doors')pisoApplyTileEntry(pisoActiveEntry,startCell.x,startCell.y);else pisoPlaceInstance(pisoActiveEntry,startCell.x,startCell.y)},
   onMove:ev=>{
    if(pisoActiveEntry.cat!=='tiles'&&pisoActiveEntry.cat!=='doors')return; // instances only place once per stroke
    const c=pisoCellFromPoint(ev.clientX,ev.clientY);if(c)pisoApplyTileEntry(pisoActiveEntry,c.x,c.y);
   },
   onEnd:()=>{}
  });
 });
}
function pisoEraseAt(x,y){
 const draft=pisoCurrentDraft();
 const hit=pisoInstanceAt(x,y);
 if(hit){pisoRemoveInstance(hit.kind,hit.iid);pisoDraw();return}
 draft.grid[y][x]=1;delete draft.tileRefs[pisoKey(x,y)];
 if(draft.spawn?.x===x&&draft.spawn?.y===y)draft.spawn=null;
 if(draft.stairs?.x===x&&draft.stairs?.y===y)draft.stairs=null;
 pisoDraw();
}
function pisoPlaceMarker(kind,x,y){
 const draft=pisoCurrentDraft();
 if(draft.grid[y][x]!==0){pisoSetStatus('El '+(kind==='spawn'?'punto de entrada':'punto de salida')+' debe ir sobre una casilla de suelo.');return}
 draft[kind]={x,y};pisoSetStatus('');pisoDraw();
}

// ---- marquee "place on selection" menu ------------------------------------
function pisoHideSelectionMenu(){document.getElementById('pisoSelectionMenu')?.classList.add('hidden')}
function pisoShowSelectionMenu(){
 const menu=document.getElementById('pisoSelectionMenu');const canvas=pisoCanvasEl();if(!menu||!pisoSelectionRect||!canvas)return;
 const r=pisoNormalizedRect(pisoSelectionRect),cell=pisoCellPx();
 // Positioned :fixed (viewport-relative), so it lines up regardless of
 // scroll/zoom inside .pisoCanvasWrap - map the selection's canvas-internal
 // pixel coords through the canvas's own on-page rect/scale to get there.
 const rect=canvas.getBoundingClientRect(),scaleX=rect.width/canvas.width,scaleY=rect.height/canvas.height;
 menu.style.left=Math.round(rect.left+(r.x1+1)*cell*scaleX+8)+'px';
 menu.style.top=Math.round(rect.top+r.y*cell*scaleY)+'px';
 const w=r.x1-r.x+1,h=r.y1-r.y+1;
 menu.innerHTML=`<div class="small">Selección ${w}×${h}</div>`;
 const addBtn=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{fn();pisoHideSelectionMenu();pisoSelectionRect=null;pisoDraw()};menu.appendChild(b)};
 if(pisoActiveEntry&&(pisoActiveEntry.cat==='tiles'||pisoActiveEntry.cat==='doors'))
  addBtn('Rellenar con «'+(pisoActiveEntry.label||'')+'»',()=>{for(let y=r.y;y<=r.y1;y++)for(let x=r.x;x<=r.x1;x++)pisoApplyTileEntry(pisoActiveEntry,x,y)});
 addBtn('Vaciar (muro)',()=>{const draft=pisoCurrentDraft();for(let y=r.y;y<=r.y1;y++)for(let x=r.x;x<=r.x1;x++){const hit=pisoInstanceAt(x,y);if(hit)pisoRemoveInstance(hit.kind,hit.iid);draft.grid[y][x]=1;delete draft.tileRefs[pisoKey(x,y)]}});
 addBtn('Definir como sala…',()=>pisoPromptRoomName());
 addBtn('Cancelar',()=>{});
 menu.classList.remove('hidden');
}
async function pisoPromptRoomName(){
 if(!pisoSelectionRect)return;
 const r=pisoNormalizedRect(pisoSelectionRect);
 const name=await uiTextPrompt('Nombre de la sala (solo organizativo):','Sala');
 pisoSelectionRect=null;pisoHideSelectionMenu();
 if(name===null||name===undefined){pisoDraw();return}
 pisoCurrentDraft().salas.push({x:r.x,y:r.y,w:r.x1-r.x+1,h:r.y1-r.y+1,name:name||'Sala'});
 pisoDraw();
}

// ============================================================================
// INSPECTOR
// ============================================================================
function pisoSelectInstance(kind,iid){pisoSelectedInstance={kind,iid};pisoRenderInspector();pisoDraw()}
function pisoRenderInspector(){
 const root=document.getElementById('pisoInspector');if(!root)return;
 if(!pisoSelectedInstance){root.classList.add('hidden');root.innerHTML='';return}
 const draft=pisoCurrentDraft(),list=pisoInstanceListFor(draft,pisoSelectedInstance.kind);
 const obj=list?.find(o=>o.iid===pisoSelectedInstance.iid);
 if(!obj){pisoSelectedInstance=null;root.classList.add('hidden');return}
 root.classList.remove('hidden');
 const kind=pisoSelectedInstance.kind;
 let html=`<h3>${pisoInspectorTitle(kind,obj)}</h3>`;
 if(kind==='trap'){
  html+=`<div class="pisoInspectorRow"><label>Dados de daño <input id="pisoTrapDice" value="${(obj.dmgDice||'').replace(/"/g,'&quot;')}" placeholder="1d6+2"></label>
   <label>&nbsp;<button type="button" id="pisoTrapRoll">🎲 Probar tirada</button></label></div>
   <p class="small" id="pisoTrapRollResult"></p>
   <h4>Efectos apilables</h4>
   <div class="pisoInspectorRow"><select id="pisoTrapEffectKind">${PISO_EFFECT_KINDS.map(k=>`<option value="${k.id}">${k.label}</option>`).join('')}</select>
   <button type="button" id="pisoTrapAddEffect">AÑADIR EFECTO →</button></div>
   <div id="pisoTrapEffectsList" class="effectsList"></div>`;
 }else if(kind==='asset'){
  const isDoor=!!(obj.door&&window.DungeonInteriors?.parseDoor(obj.door,obj.cols,obj.rows));
  html+=`<p class="small">${obj.name} · ${obj.cols}×${obj.rows}</p>`;
  if(isDoor&&!pisoInInterior())html+='<button type="button" id="pisoOpenInterior">Editar interior de esta puerta →</button>';
  else if(isDoor)html+='<p class="small">Los interiores no pueden anidarse más de un nivel.</p>';
 }else if(kind==='enemy'){
  html+=`<label class="tileRotateLabel"><input type="checkbox" id="pisoEnemyBoss" ${obj.boss?'checked':''}> Es un boss (nivel/estadísticas de jefe)</label>`;
 }else if(kind==='chest'){
  html+=`<label class="tileRotateLabel"><input type="checkbox" id="pisoChestLocked" ${obj.locked?'checked':''}> Cofre cerrado (requiere llave)</label>`;
 }else if(kind==='door'){
  html+=`<label class="tileRotateLabel"><input type="checkbox" id="pisoDoorLocked" ${obj.locked!==false?'checked':''}> Puerta cerrada (requiere llave)</label>`;
 }
 html+='<div class="configItemActions"><button type="button" id="pisoDeleteInstance">ELIMINAR</button><button type="button" id="pisoCloseInspector">CERRAR</button></div>';
 root.innerHTML=html;
 document.getElementById('pisoDeleteInstance').onclick=()=>{pisoRemoveInstance(kind,obj.iid);pisoRenderInspector();pisoDraw()};
 document.getElementById('pisoCloseInspector').onclick=()=>{pisoSelectedInstance=null;pisoRenderInspector();pisoDraw()};
 if(kind==='trap'){
  document.getElementById('pisoTrapDice').oninput=e=>{obj.dmgDice=e.target.value};
  document.getElementById('pisoTrapRoll').onclick=()=>{
   const out=document.getElementById('pisoTrapRollResult');
   try{out.textContent='Tirada: '+rollDice(obj.dmgDice||'1d6')}catch(e){out.textContent='Expresión de dados no válida (ej: 1d6+2).'}
  };
  document.getElementById('pisoTrapAddEffect').onclick=()=>{
   const kindSel=document.getElementById('pisoTrapEffectKind').value;
   obj.effects=obj.effects||[];
   obj.effects.push({kind:kindSel,target:'self',params:{}});
   pisoRenderTrapEffects(obj);
  };
  pisoRenderTrapEffects(obj);
 }
 if(kind==='asset'){
  document.getElementById('pisoOpenInterior')?.addEventListener('click',()=>pisoOpenInterior(obj));
 }
 if(kind==='enemy')document.getElementById('pisoEnemyBoss').onchange=e=>{obj.boss=e.target.checked};
 if(kind==='chest')document.getElementById('pisoChestLocked').onchange=e=>{obj.locked=e.target.checked};
 if(kind==='door')document.getElementById('pisoDoorLocked').onchange=e=>{obj.locked=e.target.checked};
}
function pisoInspectorTitle(kind,obj){
 return {trap:'Trampa',asset:'Asset: '+(obj.name||''),enemy:'Enemigo: '+(obj.name||''),chest:'Cofre: '+(obj.name||''),door:'Puerta',key:'Llave'}[kind]||kind;
}
const PISO_EFFECT_KINDS=[
 {id:'dmg',label:'Daño'},{id:'dot',label:'Daño periódico (DOT)'},{id:'debuff',label:'Debuff'},
 {id:'cc',label:'Control (aturdir/congelar/silenciar/enraizar)'},{id:'fear',label:'Miedo'},
 {id:'mark',label:'Marca (aumenta daño recibido)'},{id:'drain',label:'Drenaje'},{id:'aoe',label:'AOE'},
 {id:'summon',label:'Invocación'},{id:'buff',label:'Buff (si el objetivo eres tú)'},{id:'utility',label:'Utilidad'}
];
function pisoRenderTrapEffects(trap){
 const root=document.getElementById('pisoTrapEffectsList');if(!root)return;
 root.innerHTML=(trap.effects||[]).map((fx,i)=>`
  <details class="effectCard" open data-idx="${i}">
   <summary class="effectCardHead"><b>${PISO_EFFECT_KINDS.find(k=>k.id===fx.kind)?.label||fx.kind}</b><button type="button" data-remove-effect="${i}">Quitar</button></summary>
   <div class="pisoInspectorRow">
    <label>Objetivo <select data-fx-field="target" data-idx="${i}"><option value="self" ${fx.target==='self'?'selected':''}>A ti mismo</option><option value="enemy" ${fx.target==='enemy'?'selected':''}>Enemigo más cercano</option></select></label>
   </div>
   <label>Parámetros (JSON libre: dice, amount, duration, chance, stat...) <textarea data-fx-field="params" data-idx="${i}" rows="2">${JSON.stringify(fx.params||{})}</textarea></label>
  </details>`).join('');
 root.querySelectorAll('[data-remove-effect]').forEach(b=>b.onclick=()=>{trap.effects.splice(Number(b.dataset.removeEffect),1);pisoRenderTrapEffects(trap)});
 root.querySelectorAll('[data-fx-field="target"]').forEach(s=>s.onchange=()=>{trap.effects[Number(s.dataset.idx)].target=s.value});
 root.querySelectorAll('[data-fx-field="params"]').forEach(t=>t.onchange=()=>{try{trap.effects[Number(t.dataset.idx)].params=JSON.parse(t.value||'{}')}catch(e){pisoSetStatus('JSON de parámetros no válido en un efecto de trampa.')}});
}

// ============================================================================
// INTERIOR SUB-EDITOR (breadcrumb-based context switch, capped at 1 level)
// ============================================================================
function pisoOpenInterior(assetObj){
 if(pisoInInterior())return;
 if(!pisoRootDraft.interiors[assetObj.iid])pisoRootDraft.interiors[assetObj.iid]=pisoNewDraft(21,21);
 pisoContextStack=[{assetIid:assetObj.iid,assetName:assetObj.name}];
 pisoSelectedInstance=null;pisoActiveEntry=null;pisoTool='paint';pisoSyncToolButtons();
 pisoRenderBreadcrumb();pisoRenderInspector();pisoDraw();
}
function pisoCloseInterior(){
 pisoContextStack=[];pisoSelectedInstance=null;pisoActiveEntry=null;
 pisoRenderBreadcrumb();pisoRenderInspector();pisoDraw();
}
function pisoRenderBreadcrumb(){
 const el=document.getElementById('pisoBreadcrumb');if(!el)return;
 if(!pisoInInterior()){el.classList.add('hidden');el.innerHTML='';pisoSyncMarkerButtons();return}
 const ctx=pisoContextStack[0];
 el.classList.remove('hidden');
 el.innerHTML=`<button type="button" id="pisoBackToPisoBtn">◀ Volver al piso</button> Editando interior de <b>${(ctx.assetName||'').replace(/</g,'&lt;')}</b>
  <label>Tamaño <input type="number" id="pisoIntCols" min="9" max="49" value="${pisoCurrentDraft().cols}" style="width:56px"> × <input type="number" id="pisoIntRows" min="9" max="49" value="${pisoCurrentDraft().rows}" style="width:56px"></label>`;
 document.getElementById('pisoBackToPisoBtn').onclick=pisoCloseInterior;
 const applySize=()=>{const c=Number(document.getElementById('pisoIntCols').value),r=Number(document.getElementById('pisoIntRows').value);pisoResizeGrid(pisoCurrentDraft(),c,r);pisoDraw()};
 document.getElementById('pisoIntCols').onchange=applySize;document.getElementById('pisoIntRows').onchange=applySize;
 pisoSyncMarkerButtons();
}
function pisoSyncMarkerButtons(){
 const stairsBtn=document.querySelector('[data-piso-tool="stairs"]');
 if(stairsBtn)stairsBtn.classList.toggle('hidden',pisoInInterior());
 const spawnBtn=document.querySelector('[data-piso-tool="spawn"]');
 if(spawnBtn)spawnBtn.textContent=pisoInInterior()?'📍 Puerta de salida':'📍 Entrada';
}

// ============================================================================
// TOOLBAR / ZOOM / FULLSCREEN
// ============================================================================
function pisoSyncToolButtons(){
 document.querySelectorAll('[data-piso-tool]').forEach(b=>b.classList.toggle('active',b.dataset.pisoTool===pisoTool));
}
function pisoWireToolbar(){
 const toolGroup=document.getElementById('pisoToolButtons');
 if(toolGroup&&!toolGroup.querySelector('[data-piso-tool="spawn"]')){
  const spawnBtn=document.createElement('button');spawnBtn.type='button';spawnBtn.dataset.pisoTool='spawn';spawnBtn.textContent='📍 Entrada';
  const stairsBtn=document.createElement('button');stairsBtn.type='button';stairsBtn.dataset.pisoTool='stairs';stairsBtn.textContent='🏁 Salida';
  toolGroup.appendChild(spawnBtn);toolGroup.appendChild(stairsBtn);
 }
 document.querySelectorAll('[data-piso-tool]').forEach(b=>b.addEventListener('click',()=>{pisoTool=b.dataset.pisoTool;pisoSyncToolButtons();pisoHideSelectionMenu();pisoSelectionRect=null;pisoDraw()}));
 pisoSyncToolButtons();
 document.getElementById('pisoZoomInBtn')?.addEventListener('click',()=>{pisoZoom=pisoClamp(pisoZoom*1.25,.3,3);pisoDraw()});
 document.getElementById('pisoZoomOutBtn')?.addEventListener('click',()=>{pisoZoom=pisoClamp(pisoZoom/1.25,.3,3);pisoDraw()});
 document.getElementById('pisoCanvasWrap')?.addEventListener('wheel',e=>{
  if(!e.ctrlKey&&!e.metaKey)return; // plain wheel/trackpad still scrolls the wrap normally
  e.preventDefault();pisoZoom=pisoClamp(pisoZoom*(e.deltaY<0?1.1:.9),.3,3);pisoDraw();
 },{passive:false});
 document.getElementById('pisoFullscreenBtn')?.addEventListener('click',()=>{
  const wrap=document.getElementById('pisoCanvasWrap');if(!wrap)return;
  if(document.fullscreenElement)document.exitFullscreen?.();
  else wrap.requestFullscreen?.().catch(()=>pisoSetStatus('Pantalla completa no disponible en este navegador.'));
 });
 document.querySelectorAll('[data-piso-palette]').forEach(b=>b.addEventListener('click',()=>{
  pisoActivePaletteTab=b.dataset.pisoPalette;
  document.querySelectorAll('[data-piso-palette]').forEach(x=>x.classList.toggle('active',x===b));
  pisoRenderPalette();
 }));
 document.getElementById('pisoTilesetSelect')?.addEventListener('change',e=>pisoOnTilesetChange(e.target.value));
}

// ============================================================================
// LIST / CRUD
// ============================================================================
async function pisoFetchList(){
 try{
  const r=await fetch('/api/config-floor?kind=custompiso');
  const data=await pisoResponseJson(r);
  if(!r.ok)throw new Error(data?.error||'No se pudo cargar la lista de pisos');
  pisoList=Array.isArray(data)?data:[];
  pisoRenderList();
 }catch(e){pisoSetStatus('Error cargando pisos: '+e.message)}
}
function pisoRenderList(){
 const root=document.getElementById('pisoList');if(!root)return;
 if(!pisoList.length){root.innerHTML='<p class="small">Todavía no hay pisos guardados.</p>';return}
 root.innerHTML=pisoList.map(r=>`<div class="configItem"><span class="tierDot" style="background:${r.id===pisoRootDraft.id?'#ffc35a':'#4d395a'}"></span>
  <div><b>${(r.name||'Sin nombre').replace(/</g,'&lt;')}</b><span class="small">Nivel: ${r.nivel?r.nivel:'cualquiera'}</span>
   <div class="configItemActions">
    <button type="button" data-piso-edit="${r.id}">Editar</button>
    <button type="button" data-piso-delete="${r.id}">Borrar</button>
   </div>
  </div></div>`).join('');
 root.querySelectorAll('[data-piso-edit]').forEach(b=>b.onclick=()=>pisoLoadForEdit(b.dataset.pisoEdit));
 root.querySelectorAll('[data-piso-delete]').forEach(b=>b.onclick=()=>pisoDeletePiso(b.dataset.pisoDelete));
}
async function pisoLoadForEdit(id){
 try{
  pisoSetStatus('Cargando piso...');
  const r=await fetch('/api/config-floor?kind=custompiso&id='+encodeURIComponent(id)+'&light=0');
  const data=await pisoResponseJson(r);
  if(!r.ok||!data)throw new Error(data?.error||'No se pudo cargar el piso');
  pisoRootDraft=pisoColumnsToDraft(data);
  pisoContextStack=[];pisoSelectedInstance=null;pisoActiveEntry=null;
  pisoSyncFormFromDraft();pisoRenderBreadcrumb();pisoRenderInspector();pisoDraw();
  pisoSetStatus('Piso "'+(pisoRootDraft.name||'')+'" cargado.');
 }catch(e){pisoSetStatus('Error: '+e.message)}
}
async function pisoDeletePiso(id){
 const ok=await uiConfirm('¿Eliminar este piso permanentemente?');
 if(!ok)return;
 try{
  const r=await fetch('/api/config-floor?kind=custompiso&id='+encodeURIComponent(id),{method:'DELETE'});
  if(!r.ok){const d=await pisoResponseJson(r);throw new Error(d?.error||'No se pudo borrar')}
  if(pisoRootDraft.id===Number(id)){pisoRootDraft=pisoNewDraft(COLS,ROWS);pisoContextStack=[];pisoSyncFormFromDraft();pisoDraw()}
  await pisoFetchList();
 }catch(e){pisoSetStatus('Error borrando: '+e.message)}
}
function pisoSyncFormFromDraft(){
 const nameInput=document.getElementById('pisoName'),nivelInput=document.getElementById('pisoNivel');
 if(nameInput)nameInput.value=pisoRootDraft.name||'';
 if(nivelInput)nivelInput.value=pisoRootDraft.nivel||'';
}
async function pisoSave(){
 pisoRootDraft.name=document.getElementById('pisoName')?.value||'';
 pisoRootDraft.nivel=document.getElementById('pisoNivel')?.value||'';
 if(!pisoRootDraft.name.trim()){pisoSetStatus('Ponle un nombre al piso antes de guardar.');return}
 if(!pisoRootDraft.spawn||!pisoRootDraft.stairs)pisoSetStatus('Aviso: falta marcar entrada y/o salida - se guardará igualmente, pero el generador no podrá usar este piso hasta que las marques.');
 else pisoSetStatus('Guardando...');
 try{
  const cols=pisoDraftToColumns(pisoRootDraft);
  const id=pisoRootDraft.id;
  const r=await fetch(id?`/api/config-floor?kind=custompiso&id=${id}`:'/api/config-floor?kind=custompiso',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cols)});
  const data=await pisoResponseJson(r);
  if(!r.ok)throw new Error(data?.error||'No se pudo guardar el piso');
  pisoRootDraft.id=(Array.isArray(data)?data[0]?.id:data?.id)??id;
  pisoSetStatus('Piso guardado.');
  await pisoFetchList();
  pisoPrefetchRuntimeCatalog(); // refresh the gameplay cache too
 }catch(e){pisoSetStatus('Error guardando: '+e.message)}
}
function pisoNewPiso(){
 pisoRootDraft=pisoNewDraft(COLS,ROWS);pisoContextStack=[];pisoSelectedInstance=null;pisoActiveEntry=null;
 pisoSyncFormFromDraft();pisoRenderBreadcrumb();pisoRenderInspector();pisoDraw();
 pisoSetStatus('Nuevo piso: dibuja el suelo, marca entrada/salida y coloca lo que necesites.');
}
async function pisoDeleteCurrent(){
 if(!pisoRootDraft.id){pisoNewPiso();return}
 await pisoDeletePiso(pisoRootDraft.id);
}

// ============================================================================
// IMPORT / EXPORT JSON (generated/parsed on the fly, never persisted apart)
// ============================================================================
function pisoExportJson(){
 pisoRootDraft.name=document.getElementById('pisoName')?.value||pisoRootDraft.name;
 pisoRootDraft.nivel=document.getElementById('pisoNivel')?.value||pisoRootDraft.nivel;
 const combined=pisoDraftToColumns(pisoRootDraft);
 const blob=new Blob([JSON.stringify(combined,null,1)],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);
 a.download=(pisoRootDraft.name||'piso').replace(/[^a-z0-9_-]+/gi,'_')+'.json';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}
function pisoImportJson(file){
 const reader=new FileReader();
 reader.onload=()=>{
  try{
   const parsed=JSON.parse(reader.result);
   const keepId=pisoRootDraft.id;
   pisoRootDraft=pisoColumnsToDraft(parsed);
   pisoRootDraft.id=parsed.id??keepId??null; // importing edits the currently open piso unless the JSON itself carries an id
   pisoContextStack=[];pisoSelectedInstance=null;pisoActiveEntry=null;
   pisoSyncFormFromDraft();pisoRenderBreadcrumb();pisoRenderInspector();pisoDraw();
   pisoSetStatus('JSON importado en memoria. Pulsa GUARDAR PISO para persistirlo.');
  }catch(e){pisoSetStatus('JSON no válido: '+e.message)}
 };
 reader.readAsText(file);
}

// ============================================================================
// TAB WIRING (own listener, additive to game.js's own setupConfigTabs)
// ============================================================================
let pisoModeReady=false;
function pisoSetupMode(){
 if(pisoModeReady)return;pisoModeReady=true;
 pisoWireToolbar();pisoWireCanvas();
 document.getElementById('savePisoBtn')?.addEventListener('click',pisoSave);
 document.getElementById('newPisoBtn')?.addEventListener('click',pisoNewPiso);
 document.getElementById('deletePisoBtn')?.addEventListener('click',pisoDeleteCurrent);
 document.getElementById('exportPisoJsonBtn')?.addEventListener('click',pisoExportJson);
 document.getElementById('importPisoJsonInput')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)pisoImportJson(f);e.target.value=''});
 document.addEventListener('click',e=>{
  const menu=document.getElementById('pisoSelectionMenu');
  if(menu&&!menu.classList.contains('hidden')&&!menu.contains(e.target)&&e.target.closest('#pisoCanvasWrap')===null)pisoHideSelectionMenu();
 });
 pisoSyncFormFromDraft();pisoRenderBreadcrumb();pisoDraw();
}
async function pisoOnTabOpen(){
 pisoSetupMode();
 await pisoEnsureCatalogs();
 pisoPopulateTilesetSelect();
 pisoRenderPalette();
 if(!pisoList.length)await pisoFetchList();
 pisoDraw();
}
document.querySelectorAll('[data-config-tab]').forEach(btn=>{
 btn.addEventListener('click',()=>{
  const tab=btn.dataset.configTab;
  document.getElementById('configTabCustompisos')?.classList.toggle('hidden',tab!=='custompisos');
  if(tab==='custompisos')pisoOnTabOpen();
 });
});

// ============================================================================
// GAMEPLAY HOOKS
// ============================================================================

// ---- traps: dice damage + stackable effects --------------------------------
// springTrap is a `function` DECLARATION in game.js (var-like binding, unlike
// its many `const`s), so it can be reassigned from here without touching its
// source. The wrap only adds behaviour on top of what it already does: if the
// trap carries an authored dice expression, roll it into t.dmg right before
// calling the original (which reads t.dmg||6); afterwards, if it carries a
// stackable-effects list, run it through the exact same generic executor
// usePotion/useEquipmentActive already use for self-cast effects.
if(typeof springTrap==='function'){
 const pisoOrigSpringTrap=springTrap;
 springTrap=function(t){
  if(t.dmgDice){try{t.dmg=rollDice(t.dmgDice)}catch(e){/* keep the flat fallback dmg */}}
  pisoOrigSpringTrap(t);
  if(Array.isArray(t.effects)&&t.effects.length&&typeof beginExternalEffectsCast==='function'){
   try{
    const castId=beginExternalEffectsCast('customtrap:'+t.x+','+t.y,{name:'Trampa',effects:t.effects});
    const visible=typeof visibleEnemiesInRange==='function'?visibleEnemiesInRange(8):[];
    const nearest=visible.sort((a,b)=>(Math.abs(a.x-game.player.x)+Math.abs(a.y-game.player.y))-(Math.abs(b.x-game.player.x)+Math.abs(b.y-game.player.y)))[0];
    applySkillEffectsList(castId,{x:game.player.x,y:game.player.y,clickedEnemy:nearest,nearest});
    endExternalEffectsCast();
   }catch(e){console.error('Error aplicando efectos de trampa personalizada',e)}
  }
 };
}

// ---- custom floors: gameplay catalog + generator hook ---------------------
// Fetched once per page load (light=0: full rows, needed synchronously at
// generation time - see the long comment below). Cheap in practice: this is
// curated admin content, not user-scale data.
let pisoRuntimeCatalog=[];
function pisoPrefetchRuntimeCatalog(){
 fetch('/api/config-floor?kind=custompiso&light=0').then(pisoResponseJson).then(rows=>{
  if(!Array.isArray(rows))return;
  pisoRuntimeCatalog=rows.map(row=>{try{return {id:row.id,name:row.name,nivel:row.nivel,draft:pisoColumnsToDraft(row)}}catch(e){return null}}).filter(Boolean);
 }).catch(()=>{});
}
pisoPrefetchRuntimeCatalog();

function pisoEligibleForFloor(floor){return pisoRuntimeCatalog.filter(p=>pisoNivelMatches(p.nivel,floor)&&p.draft.cols===COLS&&p.draft.rows===ROWS&&p.draft.spawn&&p.draft.stairs)}

function pisoBuildInteriorState(sub,floor){
 if(!sub?.spawn)return null;
 const map=sub.grid.map(row=>row.map(v=>v?1:0));
 const families=typeof normalizedEnemyFamilies==='function'?normalizedEnemyFamilies():[],allTemplates=families.flatMap(f=>f.enemies||[]);
 const enemies=(sub.enemies||[]).map(en=>{
  const tpl=allTemplates.find(t=>String(t.id)===String(en.enemyDetailId));if(!tpl)return null;
  try{return buildConfiguredEnemy(tpl,{x:en.x,y:en.y},floor,!!en.boss)}catch(e){return null}
 }).filter(Boolean);
 const chestRows=typeof configChests!=='undefined'?configChests:[];
 const chests=(sub.chests||[]).map(c=>{const row=chestRows.find(r=>String(r.id)===String(c.configChestId));if(!row)return null;return {x:c.x,y:c.y,opened:false,locked:!!c.locked,chestDef:{...row.chest_json,configChestId:row.id}}}).filter(Boolean);
 const traps=(sub.traps||[]).map(t=>({x:t.x,y:t.y,dmg:6,revealed:false,sprung:false,dmgDice:t.dmgDice||null,effects:Array.isArray(t.effects)?t.effects:[]}));
 const keys=(sub.keys||[]).map(k=>({x:k.x,y:k.y}));
 const room={x:0,y:0,w:sub.cols,h:sub.rows,cx:sub.spawn.x,cy:sub.spawn.y};
 return {map,rooms:[room],safeRooms:[],stairs:{x:-1,y:-1},doors:[{x:sub.spawn.x,y:sub.spawn.y,open:true,locked:false,interiorExit:true}],keys,chests,traps,altars:[],assets:[],enemies,boss:enemies.find(e=>e.boss)||null,spawn:{...sub.spawn},floorTileset:null};
}
function pisoBuildFloorData(entry,floor){
 const draft=entry.draft;
 const map=draft.grid.map(row=>row.map(v=>v?1:0));
 const doors=(draft.doors||[]).map(d=>({x:d.x,y:d.y,open:!!d.open,locked:d.locked!==false}));
 const keys=(draft.keys||[]).map(k=>({x:k.x,y:k.y}));
 const traps=(draft.traps||[]).map(t=>({x:t.x,y:t.y,dmg:6,revealed:false,sprung:false,dmgDice:t.dmgDice||null,effects:Array.isArray(t.effects)?t.effects:[]}));
 const chestRows=typeof configChests!=='undefined'?configChests:[];
 const chests=(draft.chests||[]).map(c=>{const row=chestRows.find(r=>String(r.id)===String(c.configChestId));if(!row)return null;return {x:c.x,y:c.y,opened:false,locked:!!c.locked,chestDef:{...row.chest_json,configChestId:row.id}}}).filter(Boolean);
 const families=typeof normalizedEnemyFamilies==='function'?normalizedEnemyFamilies():[],allTemplates=families.flatMap(f=>f.enemies||[]);
 const enemies=(draft.enemies||[]).map(en=>{
  const tpl=allTemplates.find(t=>String(t.id)===String(en.enemyDetailId));if(!tpl)return null;
  try{return buildConfiguredEnemy(tpl,{x:en.x,y:en.y},floor,!!en.boss)}catch(e){return null}
 }).filter(Boolean);
 const boss=enemies.find(e=>e.boss)||null;
 const interiorIds={};
 const interiorEntrances=[];
 if(window.DungeonInteriors)for(const a of draft.assets||[]){
  const sub=draft.interiors?.[a.iid];if(!sub)continue;
  const doorTile=window.DungeonInteriors.parseDoor(a.door,a.cols,a.rows);if(!doorTile)continue;
  const state=pisoBuildInteriorState(sub,floor);if(!state)continue;
  const id=`custom-${entry.id}-${a.iid}`;interiorIds[a.iid]=id;
  interiorEntrances.push({x:a.x+doorTile.x,y:a.y+doorTile.y,interiorId:id,assetKey:a.key,interior:{id,type:'custom',geometry:'rooms',doorAsset:{key:a.key,name:a.name,tile:{...doorTile}},floorTileset:null,state}});
 }
 const assets=(draft.assets||[]).map(a=>({key:a.key,name:a.name,x:a.x,y:a.y,cols:a.cols,rows:a.rows,interiorId:interiorIds[a.iid]||undefined}));
 const rooms=[{x:0,y:0,w:draft.cols,h:draft.rows,cx:draft.spawn.x,cy:draft.spawn.y,type:'filler'},
  ...(draft.salas||[]).map(s=>({x:s.x,y:s.y,w:s.w,h:s.h,cx:s.x+Math.floor(s.w/2),cy:s.y+Math.floor(s.h/2),type:s.name||'sala'}))];
 return {
  map,rooms,safeRooms:[],spawn:{...draft.spawn},stairs:{...draft.stairs},doors,keys,chests,traps,altars:[],assets,event:null,
  archetype:'customPiso',archetypeLabel:'Piso especial',archetypeDesc:entry.name||'Piso diseñado a mano.',
  objective:{type:'stairs',label:'Encuentra la salida'},tierExpected:null,rewardRarityBonus:0,
  enemies,enemyFamily:'Personalizado',enemyFamilyId:null,themeName:entry.name||'Piso especial',floorTileset:null,boss,interiorEntrances
 };
}

// loadPrecomputedFloor() (game.js) is what "Dungeons" already uses to splice
// a fully hand-baked floor into play, reading from
// selectedDungeonWorld.world_json.floors[game.floor-1] and applying it
// wholesale (map/doors/keys/chests/traps/enemies/interiorEntrances/...) via
// one Object.assign(game,{...}) - see its body in game.js for the exact
// contract this file's pisoBuildFloorData()/pisoBuildInteriorState() mirror.
// generateFloor() calls it SYNCHRONOUSLY (`if(loadPrecomputedFloor())return`)
// before ever falling back to procedural generation, so this wrap must also
// stay synchronous - it can only use catalogs already resident in memory
// (configEnemyDetails/configChests/configFloors/...), which normal play
// already guarantees are loaded by the time a floor can generate at all
// (vanilla procedural generation needs those same globals). If the custom
// pisos catalog itself (pisoRuntimeCatalog, prefetched above) hasn't finished
// loading yet on an unusually fast/slow-network run, this just falls through
// to normal generation for that run - not a correctness issue, and the next
// run will have it cached.
//
// selectedDungeonWorld is a top-level `let` in game.js (not `const`), so it's
// safe to swap synchronously for the one nested call and restore it right
// after - loadPrecomputedFloor() only reads it synchronously inside its own
// body, so there is no async gap where anything else could observe the
// temporary swap.
if(typeof loadPrecomputedFloor==='function'){
 const pisoOrigLoadPrecomputedFloor=loadPrecomputedFloor;
 loadPrecomputedFloor=function(){
  try{
   // Soulseeker runs always have selectedDungeonWorld unset too (see
   // soulseeker-dungeons.js's own header comment) but use their own floor
   // numbering/pacing - only apply to normal procedurally-generated runs.
   if(!selectedDungeonWorld&&!game?.forcedFloorArchetype&&!game?.player?.soulseeker&&pisoRuntimeCatalog.length){
    if(game.floor===1)game._pisoUsedThisRun=false; // fresh run: reset the best-effort "at least one" guarantee
    const eligible=pisoEligibleForFloor(game.floor);
    if(eligible.length){
     const total=(typeof worldParams==='function'?worldParams().floors:null)||DUNGEON_FLOORS;
     // Best-effort guarantee: force it on the run's second-to-last floor if
     // none has been used yet (floor===total is left alone - it's the
     // climax/megaboss floor, see buildFloorPlan). Otherwise a flat chance
     // per eligible floor. Not a mathematical guarantee for every possible
     // `nivel` configuration (e.g. one only matching the very last floor),
     // just a reasonable best effort.
     const mustForce=!game._pisoUsedThisRun&&game.floor===total-1;
     if(mustForce||Math.random()<.4){
      const entry=eligible[Math.floor(Math.random()*eligible.length)];
      const data=pisoBuildFloorData(entry,game.floor);
      const savedWorld=selectedDungeonWorld;
      selectedDungeonWorld={world_name:'Piso especial',id:'custom-'+entry.id,world_json:{floors:Array(game.floor-1).fill(null).concat([data])}};
      let ok=false;
      try{ok=pisoOrigLoadPrecomputedFloor()}finally{selectedDungeonWorld=savedWorld}
      if(ok){
       game._pisoUsedThisRun=true;
       if(typeof banner==='function')banner('¡PISO ESPECIAL!');
       if(typeof log==='function')log('Este piso ha sido diseñado a mano: '+(entry.name||''),'story');
       return true;
      }
     }
    }
   }
  }catch(e){console.error('Error aplicando piso personalizado, se usará generación normal',e)}
  return pisoOrigLoadPrecomputedFloor();
 };
}
