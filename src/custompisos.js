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
  tileRefs:{},doors:[],assets:[],enemies:[],chests:[],keys:[],traps:[],altars:[],salas:[],
  spawn:null,stairs:null,interiors:{}
 };
}
// Piso size is only hard-capped for sanity (huge grids get slow to paint/
// render); it is NOT tied to the engine's own COLS/ROWS constants - camera(),
// blocked() and reveal() all size themselves off game.map's own dimensions
// (see mapDimensions() in game.js), so a differently-sized custom piso works
// live too. See the loadPrecomputedFloor wrap near the bottom of this file
// for the one thing that still needs a manual fix-up: game.seen's size.
function pisoResizeGrid(draft,cols,rows){
 cols=pisoClamp(Math.round(cols)||draft.cols,9,99);rows=pisoClamp(Math.round(rows)||draft.rows,9,99);
 const grid=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>draft.grid[y]?.[x]??1));
 const tileRefs={};
 for(const k in draft.tileRefs){const [x,y]=k.split(',').map(Number);if(x<cols&&y<rows)tileRefs[k]=draft.tileRefs[k]}
 const inBounds=e=>e.x<cols&&e.y<rows;
 draft.cols=cols;draft.rows=rows;draft.grid=grid;draft.tileRefs=tileRefs;
 draft.doors=draft.doors.filter(inBounds);draft.assets=draft.assets.filter(a=>a.x+a.cols<=cols&&a.y+a.rows<=rows);
 draft.enemies=draft.enemies.filter(e=>e.megaboss?e.x+2<=cols&&e.y+2<=rows:inBounds(e));draft.chests=draft.chests.filter(inBounds);
 draft.keys=draft.keys.filter(inBounds);draft.traps=draft.traps.filter(inBounds);draft.altars=draft.altars.filter(inBounds);
 draft.salas=draft.salas.filter(s=>s.x+s.w<=cols&&s.y+s.h<=rows);
 if(draft.spawn&&!inBounds(draft.spawn))draft.spawn=null;
 if(draft.stairs&&!inBounds(draft.stairs))draft.stairs=null;
}
// Belt-and-suspenders: strips any leftover `icon` (hex PNG) from an object -
// nothing in this file writes one anymore (see pisoApplyTileEntry's/
// pisoPlaceInstance's comments), but a piso saved before that fix, or a
// hand-edited import, could still be carrying one in memory. Re-saving it
// must never re-persist that bloat.
function pisoWithoutIcon(o){if(!o||typeof o!=='object')return o;const {icon,...rest}=o;return rest}
function pisoDraftToColumns(draft){
 const tileRefs={};for(const k in draft.tileRefs)tileRefs[k]=pisoWithoutIcon(draft.tileRefs[k]);
 return {
  name:draft.name||'Piso sin nombre',
  nivel:draft.nivel||null,
  tiles_doors:{cols:draft.cols,rows:draft.rows,grid:draft.grid,tileRefs,doors:draft.doors,spawn:draft.spawn,stairs:draft.stairs,tilesetId:draft.tilesetId||null},
  assets:(draft.assets||[]).map(pisoWithoutIcon),
  enemigos:(draft.enemies||[]).map(pisoWithoutIcon),
  chests_keys_traps:{chests:(draft.chests||[]).map(pisoWithoutIcon),keys:draft.keys,traps:draft.traps,altars:draft.altars},
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
 draft.altars=Array.isArray(ckt.altars)?ckt.altars:[];
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
let pisoBrushSize=1; // 1/2/3, centered NxN brush for tile/wall/door painting
let pisoDragPreview=null; // {x,y,cols,rows,valid} live asset-footprint highlight while dragging
let pisoMultiSelection=new Set(); // Set of "kind:iid" strings, used by the multiselect tool
let pisoClipboard=null; // {anchorX,anchorY,items:[{kind,obj}]} from copy/cut

function pisoCurrentDraft(){
 let d=pisoRootDraft;
 for(const ctx of pisoContextStack){
  if(!d.interiors[ctx.assetIid])d.interiors[ctx.assetIid]=pisoNewDraft(21,21);
  d=d.interiors[ctx.assetIid];
 }
 return d;
}

// ============================================================================
// UNDO / REDO
// ============================================================================
// Whole-tree snapshots (JSON strings of pisoDraftToColumns(pisoRootDraft)) are
// simple and correct for a document this size, and cover interior edits too
// since interiors nest inside the same root draft. Call pisoPushHistory()
// once at the START of a mutating gesture/action (not per intermediate step -
// a whole paint stroke or drag is one undo step), never after the fact.
let pisoUndoStack=[],pisoRedoStack=[];
const PISO_HISTORY_LIMIT=60;
function pisoPushHistory(){
 try{
  pisoUndoStack.push(JSON.stringify(pisoDraftToColumns(pisoRootDraft)));
  if(pisoUndoStack.length>PISO_HISTORY_LIMIT)pisoUndoStack.shift();
  pisoRedoStack.length=0;
  pisoSyncHistoryButtons();
 }catch(e){/* history is a convenience, never block the actual edit over it */}
}
function pisoRestoreSnapshot(json){
 const parsed=JSON.parse(json);
 pisoRootDraft=pisoColumnsToDraft(parsed);
 pisoSelectedInstance=null;pisoMultiSelection.clear();pisoSelectionRect=null;pisoDragPreview=null;
 pisoSyncFormFromDraft();pisoRenderBreadcrumb();pisoRenderInspector();pisoRenderMultiSelectBar();pisoDraw();pisoSyncHistoryButtons();
}
function pisoUndo(){
 if(!pisoUndoStack.length)return;
 pisoRedoStack.push(JSON.stringify(pisoDraftToColumns(pisoRootDraft)));
 pisoRestoreSnapshot(pisoUndoStack.pop());
}
function pisoRedo(){
 if(!pisoRedoStack.length)return;
 pisoUndoStack.push(JSON.stringify(pisoDraftToColumns(pisoRootDraft)));
 pisoRestoreSnapshot(pisoRedoStack.pop());
}
function pisoSyncHistoryButtons(){
 const u=document.getElementById('pisoUndoBtn'),r=document.getElementById('pisoRedoBtn');
 if(u)u.disabled=!pisoUndoStack.length;
 if(r)r.disabled=!pisoRedoStack.length;
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
 if(!id){pisoActiveTileset=null;pisoRenderPalette();pisoDraw();return}
 try{
  const detail=await pisoFetchFloorDetail(id);
  pisoActiveTileset=detail?.floor_json||null;
  pisoCurrentDraft().tilesetId=id;
 }catch(e){
  const st=document.getElementById('pisoStatus');if(st)st.textContent='Error cargando tileset: '+e.message;
 }
 pisoRenderPalette();pisoDraw();
}
// Re-selects and (re)loads whichever tileset the CURRENT draft (root or
// interior) was last painted with, so already-painted tiles show their real
// icons again instead of just their flat color - tileRefs only keep a
// name/type reference, not the icon itself (see pisoTileIconFor()), so
// without this the active tileset has to be picked by hand after every
// load/interior switch for icons to reappear.
function pisoSyncActiveTilesetFromDraft(){
 const id=pisoCurrentDraft().tilesetId;
 const sel=document.getElementById('pisoTilesetSelect');
 if(sel)sel.value=id||'';
 if(id)pisoOnTilesetChange(id);
 else{pisoActiveTileset=null;pisoRenderPalette();pisoDraw()}
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
  return list.map(a=>({cat:'assets',kind:'asset',asset:a,label:a.name,icon:a.icon,group:a.ambiente||'Sin ambiente'}));
 }
 if(cat==='enemies'){
  const families=typeof normalizedEnemyFamilies==='function'?normalizedEnemyFamilies():[];
  const out=[];
  for(const fam of families)for(const en of fam.enemies||[])out.push({cat:'enemies',kind:'enemy',enemy:en,family:fam.name,label:en.name,icon:en.icon,group:fam.name});
  return out;
 }
 if(cat==='chests'){
  return (typeof configChests!=='undefined'?configChests:[]).map(r=>({cat:'chests',kind:'chest',chestRow:r,label:r.chest_json?.name||r.chest_name||'Cofre',icon:r.chest_json?.icon}));
 }
 if(cat==='keys')return [{cat:'keys',kind:'key',label:'Llave',glyph:'🔑'}];
 if(cat==='traps')return [{cat:'traps',kind:'trap',label:'Trampa',glyph:'☠️'}];
 if(cat==='salas')return ROOM_ARCHETYPES.map(rt=>({cat:'salas',kind:'sala',roomType:rt,label:rt.label,color:rt.color,glyph:'▦'}));
 return [];
}
function pisoBuildPaletteRow(entry,idx){
 const row=document.createElement('div');
 row.className='pisoPaletteItem';row.dataset.pisoEntryIdx=String(idx);
 if(pisoActiveEntry===entry)row.classList.add('active');
 const thumb=document.createElement('div');thumb.className='pisoPaletteThumb';
 if(entry.icon)thumb.appendChild(pisoIconCanvas(entry.icon,30));
 else if(entry.glyph)thumb.textContent=entry.glyph;
 else if(entry.color){thumb.style.background=entry.color}
 else thumb.textContent='?';
 const name=document.createElement('div');name.className='pisoPaletteName';
 name.innerHTML=`<b>${(entry.label||'').replace(/</g,'&lt;')}</b>`+(entry.kind==='wall'?'<span>Muro · '+(entry.tile?.direction||'auto')+'</span>':entry.kind==='asset'?`<span>${entry.asset.cols}×${entry.asset.rows}</span>`:entry.kind==='enemy'?`<span>Tier ${(entry.enemy.tier||'?').toString().toUpperCase()}${entry.enemy.megaboss?' · MEGAJEFE':entry.enemy.boss?' · JEFE':''}</span>`:'');
 row.appendChild(thumb);row.appendChild(name);
 pisoWirePaletteDrag(row,entry);
 // lazily fetch icons the catalog doesn't ship in its light/list form
 if(entry.kind==='asset'&&!entry.icon&&typeof fetchConfigWorldObjectDetail==='function'){
  fetchConfigWorldObjectDetail(entry.asset.key).then(row2=>{if(row2?.icon){entry.icon=row2.icon;if(pisoActivePaletteTab==='assets')pisoRenderPalette()}}).catch(()=>{});
 }
 if(entry.kind==='enemy'&&!entry.icon&&entry.enemy?.id){
  pisoRequestEnemyIcon(entry.enemy.id,hex=>{entry.icon=hex;if(pisoActivePaletteTab==='enemies')pisoRenderPalette()});
 }
 return row;
}
function pisoRenderPalette(){
 const root=document.getElementById('pisoPaletteList');if(!root)return;
 pisoPaletteEntries=pisoBuildPaletteEntries();
 if(!pisoPaletteEntries.length){
  root.innerHTML=`<p class="small">${pisoActivePaletteTab==='tiles'||pisoActivePaletteTab==='doors'?'Elige un tileset de referencia arriba.':'Nada configurado todavía en ese catálogo.'}</p>`;
  return;
 }
 root.innerHTML='';
 const grouped=pisoActivePaletteTab==='enemies'||pisoActivePaletteTab==='assets';
 if(!grouped){
  pisoPaletteEntries.forEach((entry,idx)=>root.appendChild(pisoBuildPaletteRow(entry,idx)));
  return;
 }
 // Enemies grouped by family, assets grouped by "ambiente" - both as
 // collapsible <details> (same pattern as .configSlotGroup elsewhere).
 const groups=new Map();
 pisoPaletteEntries.forEach((entry,idx)=>{
  const g=entry.group||'—';
  if(!groups.has(g))groups.set(g,[]);
  groups.get(g).push({entry,idx});
 });
 for(const [label,items] of groups){
  const details=document.createElement('details');details.className='configSlotGroup';details.open=groups.size<=3;
  const summary=document.createElement('summary');summary.innerHTML=`<span>${label.replace(/</g,'&lt;')}</span><b>${items.length}</b>`;
  const body=document.createElement('div');body.className='configSlotItems';
  for(const {entry,idx} of items)body.appendChild(pisoBuildPaletteRow(entry,idx));
  details.appendChild(summary);details.appendChild(body);
  root.appendChild(details);
 }
}

// ============================================================================
// CANVAS RENDERING
// ============================================================================
function pisoCellPx(){return Math.max(6,Math.round(PISO_CELL_BASE*pisoZoom))}
function pisoCanvasEl(){return document.getElementById('pisoCanvas')}
function pisoCtx(){const c=pisoCanvasEl();return c?c.getContext('2d'):null}

// Tile icons are NOT stored per painted cell (that would duplicate the same
// icon hex hundreds/thousands of times and blow past Vercel's request body
// limit on any reasonably-painted floor - see the comment on
// pisoApplyTileEntry). Instead each cell only remembers {type,name,...}, and
// the actual icon is looked up here, live, from the currently loaded
// reference tileset. A cell painted with a tile that isn't in the active
// tileset (e.g. reopening a piso before its own tileset has loaded) just
// falls back to its flat color until pisoSyncActiveTilesetFromDraft() runs.
function pisoTileIconFor(ref){
 if(!ref||!pisoActiveTileset)return null;
 const list=ref.type==='wall'?pisoActiveTileset.wallTiles:ref.type==='door'?pisoActiveTileset.doorTiles:pisoActiveTileset.floorTiles;
 return (list||[]).find(t=>t.name===ref.name)?.icon||null;
}
// Same reasoning as pisoTileIconFor: asset/enemy/chest instances only keep
// their stable catalog reference (key/enemyDetailId/configChestId), never
// the icon itself, so resolve it live from whichever catalog cache already
// has it (populated by pisoEnsureCatalogs()/pisoRequestEnemyIcon()/
// fetchConfigWorldObjectDetail() - all shared with the rest of the config
// screen, so nothing here re-fetches on its own).
const pisoAssetIconRequests=new Set();
function pisoAssetIconFor(key){
 if(!key||typeof configWorldObjectRows==='undefined')return null;
 const icon=configWorldObjectRows[key]?.icon;
 if(icon===undefined&&typeof fetchConfigWorldObjectDetail==='function'&&!pisoAssetIconRequests.has(key)){
  pisoAssetIconRequests.add(key);
  fetchConfigWorldObjectDetail(key).then(()=>pisoDraw()).catch(()=>{}).finally(()=>pisoAssetIconRequests.delete(key));
 }
 return icon||null;
}
function pisoEnemyIconFor(enemyDetailId){
 if(!enemyDetailId||typeof configEnemyDetails==='undefined')return null;
 const detail=configEnemyDetails.find(d=>String(d.id)===String(enemyDetailId));
 if(detail&&!detail.icon)pisoRequestEnemyIcon(enemyDetailId,()=>pisoDraw());
 return detail?.icon||null;
}
function pisoChestIconFor(configChestId){return (typeof configChests!=='undefined'?configChests.find(r=>String(r.id)===String(configChestId))?.chest_json?.icon:null)||null}
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
  const icon=pisoTileIconFor(ref);if(icon)pisoDrawIconAt(ctx,icon,x*cell,y*cell,cell,cell);
  ctx.strokeStyle='#00000050';ctx.lineWidth=1;ctx.strokeRect(x*cell+.5,y*cell+.5,cell-1,cell-1);
 }
 // salas outlines, colored by archetype when the sala has one
 ctx.lineWidth=2;ctx.font=`${Math.max(9,cell*.4)}px sans-serif`;
 for(const s of draft.salas||[]){
  const arch=ROOM_ARCHETYPES.find(a=>a.id===s.type);
  ctx.strokeStyle=arch?.color||'#6ab7ff';ctx.fillStyle=arch?.color||'#bcdcff';
  ctx.strokeRect(s.x*cell+2,s.y*cell+2,s.w*cell-4,s.h*cell-4);
  if(s.name)ctx.fillText(s.name,s.x*cell+5,s.y*cell+14);
 }
 // doors (map-level door tiles): green=open, orange=closed unlocked, red=closed+locked
 for(const d of draft.doors||[]){
  ctx.fillStyle=d.open?'#5affa0':(d.locked===false?'#ffcf70':'#ff6b6b');
  ctx.fillRect(d.x*cell+cell*.15,d.y*cell+cell*.15,cell*.7,cell*.7);
  ctx.strokeStyle=pisoSelectedInstance?.kind==='door'&&pisoSelectedInstance.iid===d.iid?'#ffc35a':'#000';
  ctx.lineWidth=pisoSelectedInstance?.kind==='door'&&pisoSelectedInstance.iid===d.iid?3:1;
  ctx.strokeRect(d.x*cell+cell*.15,d.y*cell+cell*.15,cell*.7,cell*.7);
 }
 // altars (auto-placed by salas, or removed by hand)
 for(const al of draft.altars||[])pisoDrawGlyphOrIcon(ctx,null,'⛩️',al.x*cell,al.y*cell,cell,'#ffe28a');
 // assets (multi-cell)
 for(const a of draft.assets||[]){
  ctx.fillStyle='#3c2a4a';ctx.fillRect(a.x*cell,a.y*cell,a.cols*cell,a.rows*cell);
  ctx.strokeStyle=pisoSelectedInstance?.kind==='asset'&&pisoSelectedInstance.iid===a.iid?'#ffc35a':'#8b6b9d';
  ctx.lineWidth=2;ctx.strokeRect(a.x*cell+1,a.y*cell+1,a.cols*cell-2,a.rows*cell-2);
  const assetIcon=pisoAssetIconFor(a.key);if(assetIcon)pisoDrawIconAt(ctx,assetIcon,a.x*cell,a.y*cell,a.cols*cell,a.rows*cell);
  if(a.door&&window.DungeonInteriors){
   const dt=window.DungeonInteriors.parseDoor(a.door,a.cols,a.rows);
   if(dt){ctx.fillStyle='#ffd68b';ctx.fillRect((a.x+dt.x)*cell+cell*.3,(a.y+dt.y)*cell+cell*.3,cell*.4,cell*.4)}
  }
 }
 // enemies/chests/keys/traps
 for(const e of draft.enemies||[])pisoDrawGlyphOrIcon(ctx,pisoEnemyIconFor(e.enemyDetailId),'👹',e.x*cell,e.y*cell,cell,e.megaboss?'#ff2f2f':e.boss?'#ff5c5c':'#e0b0ff',pisoEnemyBadgeText(e),e.megaboss?2:1);
 for(const c of draft.chests||[])pisoDrawGlyphOrIcon(ctx,pisoChestIconFor(c.configChestId),'🎁',c.x*cell,c.y*cell,cell,c.locked?'#ffcf70':'#8cffb0');
 for(const k of draft.keys||[])pisoDrawGlyphOrIcon(ctx,null,'🔑',k.x*cell,k.y*cell,cell,'#ffe28a');
 for(const t of draft.traps||[])pisoDrawGlyphOrIcon(ctx,null,'☠️',t.x*cell,t.y*cell,cell,t.effects?.length?'#ff6b6b':'#c98cff');
 // spawn/stairs markers
 if(draft.spawn)pisoDrawMarker(ctx,draft.spawn,'🚩',cell);
 if(draft.stairs)pisoDrawMarker(ctx,draft.stairs,'🏁',cell);
 // multi-selection outlines
 if(pisoMultiSelection.size){
  ctx.strokeStyle='#7cffd4';ctx.lineWidth=3;
  for(const k of pisoMultiSelection){
   const [kind,iid]=k.split(':'),list=pisoInstanceListFor(draft,kind),o=list?.find(x=>x.iid===iid);if(!o)continue;
   const w=kind==='asset'?o.cols:kind==='enemy'&&o.megaboss?2:1,h=kind==='asset'?o.rows:kind==='enemy'&&o.megaboss?2:1;
   ctx.strokeRect(o.x*cell+1,o.y*cell+1,w*cell-2,h*cell-2);
  }
 }
 // selection rectangle
 if(pisoSelectionRect){
  const r=pisoNormalizedRect(pisoSelectionRect);
  ctx.fillStyle='#ffc35a33';ctx.fillRect(r.x*cell,r.y*cell,(r.x1-r.x+1)*cell,(r.y1-r.y+1)*cell);
  ctx.strokeStyle='#ffc35a';ctx.lineWidth=2;ctx.strokeRect(r.x*cell+1,r.y*cell+1,(r.x1-r.x+1)*cell-2,(r.y1-r.y+1)*cell-2);
 }
 // live asset drag/reposition footprint preview
 if(pisoDragPreview){
  const p=pisoDragPreview;
  ctx.fillStyle=p.valid?'#5affa055':'#ff5c5c55';
  ctx.fillRect(p.x*cell,p.y*cell,p.cols*cell,p.rows*cell);
  ctx.strokeStyle=p.valid?'#5affa0':'#ff5c5c';ctx.lineWidth=2;
  ctx.strokeRect(p.x*cell+1,p.y*cell+1,p.cols*cell-2,p.rows*cell-2);
 }
 const zl=document.getElementById('pisoZoomLabel');if(zl)zl.textContent=Math.round(pisoZoom*100)+'%';
}
// `sizeCells` lets a multi-tile instance (a megaboss, footprint 2x2 in-game -
// see upgradeToMegaboss() in game.js) draw its icon/glyph across its whole
// footprint instead of just its origin cell.
function pisoDrawGlyphOrIcon(ctx,hex,glyph,px,py,cell,accent,badge,sizeCells=1){
 const w=cell*sizeCells,h=cell*sizeCells;
 ctx.fillStyle=accent+'55';ctx.beginPath();ctx.arc(px+w/2,py+h/2,Math.min(w,h)*.42,0,7);ctx.fill();
 if(!(hex&&pisoDrawIconAt(ctx,hex,px+w*.08,py+h*.08,w*.84,h*.84))){
  ctx.font=`${Math.max(10,Math.min(w,h)*.6)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(glyph,px+w/2,py+h/2+1);
 }
 if(badge)pisoDrawTierBadge(ctx,badge,px,py,w,h);
}
// Small tier/rank badge (e.g. "III·J", "II·MJ") in the bottom-right corner
// of an instance's footprint - used by enemies in both the palette (see
// pisoBuildPaletteRow) and here on the canvas itself.
function pisoDrawTierBadge(ctx,text,px,py,w,h){
 const label=String(text).toUpperCase();
 ctx.font=`bold ${Math.max(8,Math.min(w,h)*.28)}px sans-serif`;
 const bw=ctx.measureText(label).width+6,bh=Math.max(9,Math.min(w,h)*.32);
 const bx=px+w-bw-1,by=py+h-bh-1;
 ctx.fillStyle='#000000c0';ctx.fillRect(bx,by,bw,bh);
 ctx.fillStyle='#ffe28a';ctx.textAlign='left';ctx.textBaseline='middle';
 ctx.fillText(label,bx+3,by+bh/2+1);
}
function pisoEnemyBadgeText(e){
 const tier=(e.tier||'').toString().toUpperCase();
 const suffix=e.megaboss?'MJ':e.boss?'J':'';
 return [tier,suffix].filter(Boolean).join('·')||null;
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
 const enemy=(draft.enemies||[]).find(e=>{const s=e.megaboss?2:1;return x>=e.x&&x<e.x+s&&y>=e.y&&y<e.y+s});if(enemy)return {kind:'enemy',iid:enemy.iid,obj:enemy};
 const chest=(draft.chests||[]).find(c=>c.x===x&&c.y===y);if(chest)return {kind:'chest',iid:chest.iid,obj:chest};
 const key=(draft.keys||[]).find(k=>k.x===x&&k.y===y);if(key)return {kind:'key',iid:key.iid,obj:key};
 const trap=(draft.traps||[]).find(t=>t.x===x&&t.y===y);if(trap)return {kind:'trap',iid:trap.iid,obj:trap};
 const altar=(draft.altars||[]).find(a=>a.x===x&&a.y===y);if(altar)return {kind:'altar',iid:altar.iid,obj:altar};
 const door=(draft.doors||[]).find(d=>d.x===x&&d.y===y);if(door)return {kind:'door',iid:door.iid,obj:door};
 return null;
}
function pisoInstanceListFor(draft,kind){
 return {asset:draft.assets,enemy:draft.enemies,chest:draft.chests,key:draft.keys,trap:draft.traps,altar:draft.altars,door:draft.doors}[kind];
}
function pisoRemoveInstance(kind,iid){
 const draft=pisoCurrentDraft(),list=pisoInstanceListFor(draft,kind);if(!list)return;
 const idx=list.findIndex(o=>o.iid===iid);if(idx>=0)list.splice(idx,1);
 if(kind==='asset')delete draft.interiors[iid];
 if(pisoSelectedInstance?.iid===iid)pisoSelectedInstance=null;
 pisoMultiSelection.delete(kind+':'+iid);
}
// Deep-cloned copy of an instance with a fresh iid, offset by (dx,dy).
function pisoCloneInstance(kind,obj,dx,dy){
 const c=JSON.parse(JSON.stringify(obj));c.iid=pisoUid();c.x+=dx;c.y+=dy;
 return c;
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

// Deliberately NOT storing entry.tile.icon here: it's a hex-encoded PNG,
// and this runs once per painted cell - on any decently-sized floor that
// would multiply the same icon hundreds/thousands of times into the saved
// JSON and blow well past Vercel's request body limit (this is exactly what
// broke saving a 40x40 floor). color/name/type/direction are all tiny and
// enough to resolve the real icon back from the tileset at render time -
// see pisoTileIconFor().
function pisoApplyTileEntry(entry,x,y){
 const draft=pisoCurrentDraft();
 if(entry.kind==='floor'){
  draft.grid[y][x]=0;draft.tileRefs[pisoKey(x,y)]={type:'floor',name:entry.tile.name,color:entry.tile.color};
  const doorIdx=(draft.doors||[]).findIndex(d=>d.x===x&&d.y===y);if(doorIdx>=0)draft.doors.splice(doorIdx,1);
 }else if(entry.kind==='wall'){
  if(pisoInstanceAt(x,y)){pisoSetStatus('Esa casilla tiene algo colocado encima; bórralo primero.');return}
  if((draft.spawn?.x===x&&draft.spawn?.y===y)||(draft.stairs?.x===x&&draft.stairs?.y===y)){pisoSetStatus('Ahí está marcada la entrada/salida; muévela primero.');return}
  draft.grid[y][x]=1;draft.tileRefs[pisoKey(x,y)]={type:'wall',name:entry.tile.name,color:entry.tile.color,direction:entry.tile.direction};
  const doorIdx=(draft.doors||[]).findIndex(d=>d.x===x&&d.y===y);if(doorIdx>=0)draft.doors.splice(doorIdx,1);
 }else if(entry.kind==='door'){
  draft.grid[y][x]=0;draft.tileRefs[pisoKey(x,y)]={type:'door',name:entry.tile.name,color:entry.tile.color};
  const existing=(draft.doors||[]).find(d=>d.x===x&&d.y===y);
  if(!existing)draft.doors.push({iid:pisoUid(),x,y,open:false,locked:true});
 }
}
// Applies a tile/wall/door entry to the centered pisoBrushSize×pisoBrushSize
// block around (cx,cy) - size 1 is just the single cell, unchanged behaviour.
// Redraws once at the end regardless of brush size, instead of letting each
// underlying pisoApplyTileEntry() call redraw the whole grid on its own.
function pisoApplyTileBrush(entry,cx,cy){
 const draft=pisoCurrentDraft(),size=pisoClamp(pisoBrushSize,1,3),off=Math.floor(size/2);
 for(let dy=-off;dy<size-off;dy++)for(let dx=-off;dx<size-off;dx++){
  const x=cx+dx,y=cy+dy;
  if(x<0||y<0||x>=draft.cols||y>=draft.rows)continue;
  pisoApplyTileEntry(entry,x,y);
 }
 pisoDraw();
}
// Signature used to decide which neighbouring cells the bucket considers
// "the same" as the clicked cell: open/wall state plus the painted tile's
// own name (or 'vacio' when nothing has been painted there yet).
function pisoCellSignature(draft,x,y){return draft.grid[y][x]+':'+(draft.tileRefs[pisoKey(x,y)]?.name||'')}
const PISO_BUCKET_LIMIT=4000;
function pisoBucketFill(entry,sx,sy){
 const draft=pisoCurrentDraft();
 if(sx<0||sy<0||sx>=draft.cols||sy>=draft.rows)return;
 const target=pisoCellSignature(draft,sx,sy);
 const seenCells=new Set([pisoKey(sx,sy)]),stack=[[sx,sy]];
 let guard=0;
 while(stack.length&&guard<PISO_BUCKET_LIMIT){
  const [x,y]=stack.pop();guard++;
  pisoApplyTileEntry(entry,x,y);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=x+dx,ny=y+dy,k=pisoKey(nx,ny);
   if(nx<0||ny<0||nx>=draft.cols||ny>=draft.rows||seenCells.has(k))continue;
   seenCells.add(k);
   if(pisoCellSignature(draft,nx,ny)===target)stack.push([nx,ny]);
  }
 }
 if(guard>=PISO_BUCKET_LIMIT)pisoSetStatus('Relleno detenido: el hueco era demasiado grande (límite '+PISO_BUCKET_LIMIT+' casillas).');
}
function pisoPlaceInstance(entry,x,y){
 const draft=pisoCurrentDraft();
 if(entry.kind==='asset'){
  const a=entry.asset;
  if(!pisoCanPlaceAssetAt(draft,x,y,a.cols,a.rows)){pisoSetStatus('No cabe ahí: hace falta suelo ya pintado y libre de otros assets en todo su hueco ('+a.cols+'×'+a.rows+').');return}
  // icon deliberately not stored - see pisoAssetIconFor()/the comment above pisoApplyTileEntry
  draft.assets.push({iid:pisoUid(),key:a.key,name:a.name,x,y,cols:a.cols,rows:a.rows,door:a.door||''});
 }else if(entry.kind==='enemy'){
  const isMega=!!entry.enemy.megaboss;
  // Megajefes ocupan un footprint 2x2 en juego (upgradeToMegaboss() en
  // game.js) - reserva el mismo hueco 2x2 libre que un asset, en vez de solo
  // la celda clicada.
  if(isMega){
   if(!pisoCanPlaceAssetAt(draft,x,y,2,2)){pisoSetStatus('Los megajefes ocupan un hueco de 2×2 de suelo libre.');return}
  }else if(draft.grid[y][x]!==0){pisoSetStatus('Coloca enemigos sobre suelo.');return}
  draft.enemies.push({iid:pisoUid(),x,y,enemyDetailId:entry.enemy.id,name:entry.enemy.name,tier:entry.enemy.tier,boss:!!entry.enemy.boss,megaboss:isMega,familyName:entry.family});
 }else if(entry.kind==='chest'){
  if(draft.grid[y][x]!==0){pisoSetStatus('Coloca cofres sobre suelo.');return}
  draft.chests.push({iid:pisoUid(),x,y,configChestId:entry.chestRow.id,name:entry.label,locked:false});
 }else if(entry.kind==='key'){
  if(draft.grid[y][x]!==0){pisoSetStatus('Coloca llaves sobre suelo.');return}
  draft.keys.push({iid:pisoUid(),x,y});
 }else if(entry.kind==='trap'){
  if(draft.grid[y][x]!==0){pisoSetStatus('Coloca trampas sobre suelo.');return}
  draft.traps.push({iid:pisoUid(),x,y,dmgDice:'1d6+2',effects:[]});
 }else if(entry.kind==='sala'){
  pisoPlaceDefaultRoom(entry.roomType,x,y);
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
   onMove:ev=>{
    if(ghost){ghost.style.left=ev.clientX+'px';ghost.style.top=ev.clientY+'px'}
    if(entry.cat==='assets'){
     const c=pisoCellFromPoint(ev.clientX,ev.clientY);
     pisoDragPreview=c?{x:c.x,y:c.y,cols:entry.asset.cols,rows:entry.asset.rows,valid:pisoCanPlaceAssetAt(pisoCurrentDraft(),c.x,c.y,entry.asset.cols,entry.asset.rows)}:null;
     pisoDraw();
    }
   },
   onEnd:(ev,completed,moved)=>{
    if(ghost)ghost.classList.add('hidden');
    pisoDragPreview=null;
    if(!completed){pisoDraw();return}
    const cell=moved?pisoCellFromPoint(ev.clientX,ev.clientY):null;
    if(cell){
     pisoActiveEntry=entry;pisoActivePaletteTab=entry.cat;
     pisoPushHistory();
     if(entry.cat==='tiles'||entry.cat==='doors')pisoApplyTileBrush(entry,cell.x,cell.y);
     else pisoPlaceInstance(entry,cell.x,cell.y);
    }else{
     // plain click (or an aborted drag): select this entry as the active
     // "brush" so clicking/painting the canvas directly keeps using it.
     pisoActiveEntry=entry;pisoTool=entry.cat==='salas'?'room':'paint';pisoSyncToolButtons();pisoRenderPalette();pisoDraw();
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

// Every instance kind whose footprint the given rect touches (assets use
// their full cols×rows box; everything else is a single cell). Doors are
// deliberately excluded from multi-select: they stay pinned to the grid
// cell they were painted on (see pisoWireCanvas's paint-tool door branch),
// so they can't be dragged/moved as part of a group either.
function pisoInstancesInRect(draft,r){
 const out=[];
 const test=(kind,list)=>{
  for(const o of list||[]){
   const w=kind==='asset'?o.cols:kind==='enemy'&&o.megaboss?2:1,h=kind==='asset'?o.rows:kind==='enemy'&&o.megaboss?2:1;
   if(o.x<r.x1+1&&o.x+w>r.x&&o.y<r.y1+1&&o.y+h>r.y)out.push({kind,iid:o.iid,obj:o});
  }
 };
 test('asset',draft.assets);test('enemy',draft.enemies);test('chest',draft.chests);
 test('key',draft.keys);test('trap',draft.traps);test('altar',draft.altars);
 return out;
}
function pisoWireCanvas(){
 const canvas=pisoCanvasEl();if(!canvas)return;
 canvas.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button>0)return;
  const startCell=pisoCellFromPoint(e.clientX,e.clientY);if(!startCell)return;
  const panEl=document.getElementById('pisoCanvasWrap');
  if(pisoTool==='multiselect'){
   const rawHit=pisoInstanceAt(startCell.x,startCell.y);
   const hit=rawHit?.kind==='door'?null:rawHit; // doors don't join multi-select, see pisoInstancesInRect's comment
   if(rawHit?.kind==='door'){
    pisoBeginPointerDrag(e,{panEl,onStart:()=>{},onMove:()=>{},onEnd:(ev,completed,moved)=>{if(!moved)pisoSelectInstance('door',rawHit.iid)}});
    return;
   }
   const hitKey=hit?hit.kind+':'+hit.iid:null;
   if(hit&&pisoMultiSelection.has(hitKey)){
    // already-selected instance: drag moves the whole group together
    const draft=pisoCurrentDraft();
    const group=[...pisoMultiSelection].map(k=>{const [kind,iid]=k.split(':');const list=pisoInstanceListFor(draft,kind);const obj=list?.find(o=>o.iid===iid);return obj?{kind,obj,startX:obj.x,startY:obj.y}:null}).filter(Boolean);
    let historyPushed=false;
    pisoBeginPointerDrag(e,{
     panEl,onStart:()=>{},
     onMove:ev=>{
      const c=pisoCellFromPoint(ev.clientX,ev.clientY);if(!c)return;
      const dx=c.x-startCell.x,dy=c.y-startCell.y;
      if(!historyPushed){pisoPushHistory();historyPushed=true}
      for(const g of group){g.obj.x=g.startX+dx;g.obj.y=g.startY+dy}
      pisoDraw();
     },
     onEnd:()=>pisoDraw()
    });
    return;
   }
   pisoBeginPointerDrag(e,{
    panEl,
    onStart:()=>{pisoSelectionRect={x0:startCell.x,y0:startCell.y,x1:startCell.x,y1:startCell.y};pisoDraw()},
    onMove:ev=>{const c=pisoCellFromPoint(ev.clientX,ev.clientY);if(c){pisoSelectionRect.x1=c.x;pisoSelectionRect.y1=c.y;pisoDraw()}},
    onEnd:(ev,completed,moved)=>{
     const r=pisoNormalizedRect(pisoSelectionRect||{x0:startCell.x,y0:startCell.y,x1:startCell.x,y1:startCell.y});
     pisoSelectionRect=null;
     if(!moved&&hit){pisoMultiSelection.add(hitKey)} // single click on a not-yet-selected instance: add it
     else{const found=pisoInstancesInRect(pisoCurrentDraft(),r);if(found.length)for(const f of found)pisoMultiSelection.add(f.kind+':'+f.iid);else pisoMultiSelection.clear()}
     pisoRenderMultiSelectBar();pisoDraw();
    }
   });
   return;
  }
  if(pisoTool==='select'){
   const hit=pisoInstanceAt(startCell.x,startCell.y);
   if(hit){
    pisoBeginPointerDrag(e,{panEl,onStart:()=>{},onMove:()=>{},onEnd:(ev,completed,moved)=>{if(!moved)pisoSelectInstance(hit.kind,hit.iid)}});
    return;
   }
   pisoBeginPointerDrag(e,{
    panEl,
    onStart:()=>{pisoSelectionRect={x0:startCell.x,y0:startCell.y,x1:startCell.x,y1:startCell.y};pisoHideSelectionMenu();pisoDraw()},
    onMove:ev=>{const c=pisoCellFromPoint(ev.clientX,ev.clientY);if(c){pisoSelectionRect.x1=c.x;pisoSelectionRect.y1=c.y;pisoDraw()}},
    onEnd:()=>pisoShowSelectionMenu()
   });
   return;
  }
  if(pisoTool==='room'){
   pisoBeginPointerDrag(e,{
    panEl,
    onStart:()=>{pisoSelectionRect={x0:startCell.x,y0:startCell.y,x1:startCell.x,y1:startCell.y};pisoHideSelectionMenu();pisoDraw()},
    onMove:ev=>{const c=pisoCellFromPoint(ev.clientX,ev.clientY);if(c){pisoSelectionRect.x1=c.x;pisoSelectionRect.y1=c.y;pisoDraw()}},
    onEnd:()=>{
     if(pisoActiveEntry?.cat==='salas'){const r=pisoNormalizedRect(pisoSelectionRect);pisoSelectionRect=null;pisoFinishRoomFromCatalog(pisoActiveEntry.roomType,r)}
     else pisoPromptRoomName();
    }
   });
   return;
  }
  if(pisoTool==='erase'){
   pisoBeginPointerDrag(e,{
    panEl,
    onStart:()=>{pisoPushHistory();pisoEraseAt(startCell.x,startCell.y)},
    onMove:ev=>{const c=pisoCellFromPoint(ev.clientX,ev.clientY);if(c)pisoEraseAt(c.x,c.y)},
    onEnd:()=>{}
   });
   return;
  }
  if(pisoTool==='bucket'){
   if(!pisoActiveEntry||(pisoActiveEntry.cat!=='tiles'&&pisoActiveEntry.cat!=='doors')){pisoSetStatus('Elige un tile o puerta de la paleta primero.');return}
   pisoBeginPointerDrag(e,{panEl,onStart:()=>{pisoPushHistory();pisoBucketFill(pisoActiveEntry,startCell.x,startCell.y)},onMove:()=>{},onEnd:()=>{}});
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
   let historyPushed=false;
   pisoBeginPointerDrag(e,{
    panEl,
    onStart:()=>{},
    onMove:ev=>{
     const c=pisoCellFromPoint(ev.clientX,ev.clientY);if(!c)return;
     if(hit.kind==='asset'){
      const valid=pisoCanPlaceAssetAt(pisoCurrentDraft(),c.x,c.y,hit.obj.cols,hit.obj.rows,hit.iid);
      pisoDragPreview={x:c.x,y:c.y,cols:hit.obj.cols,rows:hit.obj.rows,valid};
      if(!valid){pisoDraw();return}
     }else if(pisoCurrentDraft().grid[c.y][c.x]!==0)return;
     if(!historyPushed){pisoPushHistory();historyPushed=true}
     hit.obj.x=c.x;hit.obj.y=c.y;pisoDraw();
    },
    onEnd:(ev,completed,moved)=>{pisoDragPreview=null;if(!moved)pisoSelectInstance(hit.kind,hit.iid);else pisoDraw()}
   });
   return;
  }
  if(!pisoActiveEntry){pisoSetStatus('Elige algo de la paleta primero.');return}
  pisoBeginPointerDrag(e,{
   panEl,
   onStart:()=>{
    pisoPushHistory();
    if(pisoActiveEntry.cat==='tiles'||pisoActiveEntry.cat==='doors')pisoApplyTileBrush(pisoActiveEntry,startCell.x,startCell.y);
    else pisoPlaceInstance(pisoActiveEntry,startCell.x,startCell.y);
   },
   onMove:ev=>{
    if(pisoActiveEntry.cat!=='tiles'&&pisoActiveEntry.cat!=='doors')return; // instances only place once per stroke
    const c=pisoCellFromPoint(ev.clientX,ev.clientY);if(c)pisoApplyTileBrush(pisoActiveEntry,c.x,c.y);
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
 pisoPushHistory();
 draft[kind]={x,y};pisoSetStatus('');pisoDraw();
}

// ============================================================================
// SALAS (room archetypes) - picking one from the palette and drawing a room
// with it tags draft.salas with a type AND, for the three archetypes that
// have a real in-game altar counterpart, auto-places the matching activable
// (draft.altars, rendered/consumed exactly like a normal altar - see
// useAltar() in game.js: kind 'disenchant' opens the craft modal, kind
// 'soulmerchant' the soul shop, anything else is a heal/shield/power buff).
// ============================================================================
const ROOM_ARCHETYPES=[
 {id:'rest',label:'Descanso',color:'#5fd97a',altar:'heal'},
 {id:'craft',label:'Creador (forja)',color:'#7ad9d9',altar:'disenchant'},
 {id:'merchant',label:'Comerciante',color:'#d7a72e',altar:'soulmerchant'},
 {id:'treasure',label:'Tesoro',color:'#ffd24f',altar:null},
 {id:'horde',label:'Horda',color:'#ff6b6b',altar:null},
 {id:'boss',label:'Jefe',color:'#b26bff',altar:null},
 {id:'alchemist',label:'Alquimista',color:'#7ad98f',altar:null},
 {id:'cave',label:'Cueva',color:'#8f7355',altar:null},
 {id:'maze',label:'Laberinto',color:'#9b9b9b',altar:null},
 {id:'combat',label:'Combate',color:'#e08b6b',altar:null}
];
// Finds an open (floor) cell to drop the auto-altar on, preferring the
// room's own center; falls back to a scan of the room, then gives up.
function pisoFindOpenCellInRoom(draft,r){
 if(draft.grid[r.y+Math.floor(r.h/2)]?.[r.x+Math.floor(r.w/2)]===0)return {x:r.x+Math.floor(r.w/2),y:r.y+Math.floor(r.h/2)};
 for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)if(draft.grid[y]?.[x]===0&&!pisoInstanceAt(x,y))return {x,y};
 return null;
}
function pisoApplyRoomArchetype(roomType,rect){
 const draft=pisoCurrentDraft();
 const room={x:rect.x,y:rect.y,w:rect.x1-rect.x+1,h:rect.y1-rect.y+1,name:roomType.label,type:roomType.id};
 draft.salas.push(room);
 if(roomType.altar){
  const cell=pisoFindOpenCellInRoom(draft,room);
  if(cell)draft.altars.push({iid:pisoUid(),x:cell.x,y:cell.y,kind:roomType.altar,used:false});
  else pisoSetStatus('Sala "'+roomType.label+'" definida, pero no había suelo libre para el activable: colócalo a mano.');
 }
}
function pisoFinishRoomFromCatalog(roomType,rect){
 pisoPushHistory();
 pisoApplyRoomArchetype(roomType,rect);
 pisoDraw();
}
// Single-cell drop from the palette (no rectangle drawn): a small default
// footprint centered on the drop point.
function pisoPlaceDefaultRoom(roomType,x,y){
 const draft=pisoCurrentDraft(),w=5,h=5;
 const rx=pisoClamp(x-Math.floor(w/2),0,Math.max(0,draft.cols-w)),ry=pisoClamp(y-Math.floor(h/2),0,Math.max(0,draft.rows-h));
 pisoApplyRoomArchetype(roomType,{x:rx,y:ry,x1:Math.min(draft.cols,rx+w)-1,y1:Math.min(draft.rows,ry+h)-1});
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
 const addBtn=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{pisoPushHistory();fn();pisoHideSelectionMenu();pisoSelectionRect=null;pisoDraw()};menu.appendChild(b)};
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
 pisoPushHistory();
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
  if(isDoor&&!pisoInInterior())html+=`<button type="button" id="pisoOpenInterior">${draft.interiors?.[obj.iid]?'Editar sala interior →':'Definir sala interior →'}</button>`;
  else if(isDoor)html+='<p class="small">Los interiores no pueden anidarse más de un nivel.</p>';
 }else if(kind==='enemy'){
  html+=`<p class="small">Tier ${(obj.tier||'?').toString().toUpperCase()}</p>
   <label class="tileRotateLabel"><input type="checkbox" id="pisoEnemyBoss" ${obj.boss?'checked':''}> Es un jefe (nivel/estadísticas de jefe)</label>
   <label class="tileRotateLabel"><input type="checkbox" id="pisoEnemyMegaboss" ${obj.megaboss?'checked':''}> Es un megajefe (ocupa 2×2, estadísticas dobladas)</label>`;
 }else if(kind==='chest'){
  html+=`<label class="tileRotateLabel"><input type="checkbox" id="pisoChestLocked" ${obj.locked?'checked':''}> Cofre cerrado (requiere llave)</label>`;
 }else if(kind==='door'){
  html+=`<label class="tileRotateLabel"><input type="checkbox" id="pisoDoorOpen" ${obj.open?'checked':''}> Abierta (se puede cruzar sin abrirla)</label>
   <label class="tileRotateLabel"><input type="checkbox" id="pisoDoorLocked" ${obj.locked!==false?'checked':''}> Cerrada con llave (hace falta una llave para abrirla)</label>`;
 }else if(kind==='altar'){
  html+=`<p class="small">Activable de sala (${ROOM_ARCHETYPES.find(r=>r.altar===obj.kind)?.label||obj.kind}). Se generó solo al definir la sala; bórralo si no lo quieres.</p>`;
 }
 html+='<div class="configItemActions"><button type="button" id="pisoDeleteInstance">ELIMINAR</button><button type="button" id="pisoCloseInspector">CERRAR</button></div>';
 root.innerHTML=html;
 document.getElementById('pisoDeleteInstance').onclick=()=>{pisoPushHistory();pisoRemoveInstance(kind,obj.iid);pisoRenderInspector();pisoDraw()};
 document.getElementById('pisoCloseInspector').onclick=()=>{pisoSelectedInstance=null;pisoRenderInspector();pisoDraw()};
 if(kind==='trap'){
  document.getElementById('pisoTrapDice').onfocus=()=>pisoPushHistory(); // one undo step per editing session, not per keystroke
  document.getElementById('pisoTrapDice').oninput=e=>{obj.dmgDice=e.target.value};
  document.getElementById('pisoTrapRoll').onclick=()=>{
   const out=document.getElementById('pisoTrapRollResult');
   try{out.textContent='Tirada: '+rollDice(obj.dmgDice||'1d6')}catch(e){out.textContent='Expresión de dados no válida (ej: 1d6+2).'}
  };
  document.getElementById('pisoTrapAddEffect').onclick=()=>{
   pisoPushHistory();
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
 if(kind==='enemy'){
  document.getElementById('pisoEnemyBoss').onchange=e=>{pisoPushHistory();obj.boss=e.target.checked;if(!obj.boss)obj.megaboss=false;pisoRenderInspector();pisoDraw()};
  document.getElementById('pisoEnemyMegaboss').onchange=e=>{pisoPushHistory();obj.megaboss=e.target.checked;if(obj.megaboss)obj.boss=true;pisoRenderInspector();pisoDraw()};
 }
 if(kind==='chest')document.getElementById('pisoChestLocked').onchange=e=>{pisoPushHistory();obj.locked=e.target.checked};
 if(kind==='door'){
  document.getElementById('pisoDoorOpen').onchange=e=>{pisoPushHistory();obj.open=e.target.checked;pisoDraw()};
  document.getElementById('pisoDoorLocked').onchange=e=>{pisoPushHistory();obj.locked=e.target.checked};
 }
}
function pisoInspectorTitle(kind,obj){
 return {trap:'Trampa',asset:'Asset: '+(obj.name||''),enemy:'Enemigo: '+(obj.name||''),chest:'Cofre: '+(obj.name||''),door:'Puerta',key:'Llave',altar:'Altar'}[kind]||kind;
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
 root.querySelectorAll('[data-remove-effect]').forEach(b=>b.onclick=()=>{pisoPushHistory();trap.effects.splice(Number(b.dataset.removeEffect),1);pisoRenderTrapEffects(trap)});
 root.querySelectorAll('[data-fx-field="target"]').forEach(s=>s.onchange=()=>{trap.effects[Number(s.dataset.idx)].target=s.value});
 root.querySelectorAll('[data-fx-field="params"]').forEach(t=>t.onchange=()=>{try{trap.effects[Number(t.dataset.idx)].params=JSON.parse(t.value||'{}')}catch(e){pisoSetStatus('JSON de parámetros no válido en un efecto de trampa.')}});
}

// ============================================================================
// MULTI-SELECT ACTION BAR + CLIPBOARD (copy/cut/paste)
// ============================================================================
function pisoRenderMultiSelectBar(){
 const root=document.getElementById('pisoMultiSelectBar');if(!root)return;
 if(pisoTool!=='multiselect'||!pisoMultiSelection.size){root.classList.add('hidden');root.innerHTML='';return}
 root.classList.remove('hidden');
 root.innerHTML=`<h3>${pisoMultiSelection.size} elemento(s) seleccionados</h3>
  <div class="configItemActions">
   <button type="button" id="pisoMultiCopyBtn">⧉ Copiar</button>
   <button type="button" id="pisoMultiCutBtn">✂ Cortar</button>
   <button type="button" id="pisoMultiDeleteBtn">ELIMINAR</button>
   <button type="button" id="pisoMultiClearBtn">Cancelar selección</button>
  </div>`;
 document.getElementById('pisoMultiCopyBtn').onclick=()=>pisoCopySelection(false);
 document.getElementById('pisoMultiCutBtn').onclick=()=>pisoCopySelection(true);
 document.getElementById('pisoMultiDeleteBtn').onclick=()=>{
  pisoPushHistory();
  for(const k of pisoMultiSelection){const [kind,iid]=k.split(':');pisoRemoveInstance(kind,iid)}
  pisoMultiSelection.clear();pisoRenderMultiSelectBar();pisoDraw();
 };
 document.getElementById('pisoMultiClearBtn').onclick=()=>{pisoMultiSelection.clear();pisoRenderMultiSelectBar();pisoDraw()};
}
// Builds the clipboard from either the multi-selection (multiselect tool) or
// the single instance currently open in the inspector (paint/select tools) -
// whichever has something. Coordinates are stored relative to the
// selection's own top-left so paste can drop them anywhere.
function pisoCopySelection(cut){
 const draft=pisoCurrentDraft();
 let refs=[];
 if(pisoMultiSelection.size){
  refs=[...pisoMultiSelection].map(k=>{const [kind,iid]=k.split(':');const list=pisoInstanceListFor(draft,kind);const obj=list?.find(o=>o.iid===iid);return obj?{kind,obj}:null}).filter(Boolean);
 }else if(pisoSelectedInstance){
  const list=pisoInstanceListFor(draft,pisoSelectedInstance.kind),obj=list?.find(o=>o.iid===pisoSelectedInstance.iid);
  if(obj)refs=[{kind:pisoSelectedInstance.kind,obj}];
 }
 if(!refs.length){pisoSetStatus('No hay nada seleccionado para copiar.');return}
 const anchorX=Math.min(...refs.map(r=>r.obj.x)),anchorY=Math.min(...refs.map(r=>r.obj.y));
 pisoClipboard={anchorX,anchorY,items:refs.map(r=>({kind:r.kind,obj:JSON.parse(JSON.stringify(r.obj))}))};
 pisoSetStatus((cut?'Cortado':'Copiado')+' '+refs.length+' elemento(s).');
 if(cut){
  pisoPushHistory();
  for(const r of refs)pisoRemoveInstance(r.kind,r.obj.iid);
  pisoMultiSelection.clear();pisoRenderMultiSelectBar();pisoDraw();
 }
}
// Pastes at a fixed +2/+2 offset from the copied anchor (clamped to the
// grid) - simple and predictable, no extra "click to place" step needed.
// Asset drops that no longer fit (or land off a repainted floor) are
// skipped defensively rather than corrupting the draft.
function pisoPasteClipboard(){
 if(!pisoClipboard){pisoSetStatus('No hay nada copiado.');return}
 const draft=pisoCurrentDraft(),dx=2,dy=2;
 pisoPushHistory();
 let placed=0;
 pisoMultiSelection.clear();
 for(const item of pisoClipboard.items){
  const relX=item.obj.x-pisoClipboard.anchorX,relY=item.obj.y-pisoClipboard.anchorY;
  const x=pisoClamp(pisoClipboard.anchorX+dx+relX,0,draft.cols-1),y=pisoClamp(pisoClipboard.anchorY+dy+relY,0,draft.rows-1);
  if(item.kind==='asset'){
   if(!pisoCanPlaceAssetAt(draft,x,y,item.obj.cols,item.obj.rows))continue;
   const clone=pisoCloneInstance('asset',item.obj,x-item.obj.x,y-item.obj.y);
   draft.assets.push(clone);pisoMultiSelection.add('asset:'+clone.iid);placed++;
  }else if(item.kind==='door'){
   if(draft.grid[y]?.[x]!==0)continue;
   const clone=pisoCloneInstance('door',item.obj,x-item.obj.x,y-item.obj.y);
   draft.doors.push(clone);pisoMultiSelection.add('door:'+clone.iid);placed++;
  }else{
   const list=pisoInstanceListFor(draft,item.kind);if(!list||draft.grid[y]?.[x]!==0)continue;
   const clone=pisoCloneInstance(item.kind,item.obj,x-item.obj.x,y-item.obj.y);
   list.push(clone);pisoMultiSelection.add(item.kind+':'+clone.iid);placed++;
  }
 }
 pisoSetStatus('Pegado(s) '+placed+' de '+pisoClipboard.items.length+' elemento(s).');
 pisoRenderMultiSelectBar();pisoDraw();
}

// ============================================================================
// INTERIOR SUB-EDITOR (breadcrumb-based context switch, capped at 1 level)
// ============================================================================
function pisoOpenInterior(assetObj){
 if(pisoInInterior())return;
 if(!pisoRootDraft.interiors[assetObj.iid])pisoRootDraft.interiors[assetObj.iid]=pisoNewDraft(21,21);
 pisoContextStack=[{assetIid:assetObj.iid,assetName:assetObj.name}];
 pisoSelectedInstance=null;pisoActiveEntry=null;pisoTool='paint';pisoSyncToolButtons();
 pisoRenderBreadcrumb();pisoRenderInspector();pisoSyncActiveTilesetFromDraft();
}
function pisoCloseInterior(){
 pisoContextStack=[];pisoSelectedInstance=null;pisoActiveEntry=null;
 pisoRenderBreadcrumb();pisoRenderInspector();pisoSyncActiveTilesetFromDraft();
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
  const mk=(tool,label)=>{const b=document.createElement('button');b.type='button';b.dataset.pisoTool=tool;b.textContent=label;return b};
  toolGroup.appendChild(mk('bucket','🪣 Rellenar'));
  toolGroup.appendChild(mk('multiselect','⬚ Selector múltiple'));
  toolGroup.appendChild(mk('spawn','📍 Entrada'));
  toolGroup.appendChild(mk('stairs','🏁 Salida'));
 }
 document.querySelectorAll('[data-piso-tool]').forEach(b=>b.addEventListener('click',()=>{
  pisoTool=b.dataset.pisoTool;pisoSyncToolButtons();pisoHideSelectionMenu();pisoSelectionRect=null;
  if(pisoTool!=='multiselect'){pisoMultiSelection.clear()}
  pisoRenderMultiSelectBar();pisoDraw();
 }));
 pisoSyncToolButtons();
 // Brush size (only meaningful for paint/bucket with a tiles/doors entry active)
 if(toolGroup&&!document.getElementById('pisoBrushSizeSelect')){
  const wrap=document.createElement('label');wrap.className='small';wrap.style.display='flex';wrap.style.alignItems='center';wrap.style.gap='4px';
  wrap.innerHTML='Pincel <select id="pisoBrushSizeSelect"><option value="1">1×1</option><option value="2">2×2</option><option value="3">3×3</option></select>';
  toolGroup.appendChild(wrap);
  document.getElementById('pisoBrushSizeSelect').onchange=e=>{pisoBrushSize=Number(e.target.value)||1};
 }
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
 // History / clipboard group, injected once next to the zoom controls.
 const zoomGroup=document.getElementById('pisoZoomInBtn')?.parentElement;
 if(zoomGroup&&!document.getElementById('pisoUndoBtn')){
  const histGroup=document.createElement('div');histGroup.className='pisoToolGroup';
  histGroup.innerHTML=`<button type="button" id="pisoUndoBtn" title="Deshacer (Ctrl+Z)">↶ Deshacer</button>
   <button type="button" id="pisoRedoBtn" title="Rehacer (Ctrl+Y)">↷ Rehacer</button>
   <button type="button" id="pisoCopyBtn" title="Copiar (Ctrl+C)">⧉ Copiar</button>
   <button type="button" id="pisoCutBtn" title="Cortar (Ctrl+X)">✂ Cortar</button>
   <button type="button" id="pisoPasteBtn" title="Pegar (Ctrl+V)">📋 Pegar</button>`;
  zoomGroup.insertAdjacentElement('afterend',histGroup);
  document.getElementById('pisoUndoBtn').onclick=pisoUndo;
  document.getElementById('pisoRedoBtn').onclick=pisoRedo;
  document.getElementById('pisoCopyBtn').onclick=()=>pisoCopySelection(false);
  document.getElementById('pisoCutBtn').onclick=()=>pisoCopySelection(true);
  document.getElementById('pisoPasteBtn').onclick=pisoPasteClipboard;
  pisoSyncHistoryButtons();
 }
 document.querySelectorAll('[data-piso-palette]').forEach(b=>b.addEventListener('click',()=>{
  pisoActivePaletteTab=b.dataset.pisoPalette;
  document.querySelectorAll('[data-piso-palette]').forEach(x=>x.classList.toggle('active',x===b));
  pisoRenderPalette();
 }));
 document.getElementById('pisoTilesetSelect')?.addEventListener('change',e=>pisoOnTilesetChange(e.target.value));
 document.addEventListener('keydown',pisoOnKeyDown);
}
// Ignored while typing in any text field (including the piso's own name/
// nivel/trap-dice inputs) so shortcuts never hijack normal text editing.
function pisoOnKeyDown(e){
 const el=document.activeElement,tag=el?.tagName;
 if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||el?.isContentEditable)return;
 if(document.getElementById('configTabCustompisos')?.classList.contains('hidden'))return;
 const mod=e.ctrlKey||e.metaKey;
 if(!mod)return;
 const k=e.key.toLowerCase();
 if(k==='z'&&!e.shiftKey){e.preventDefault();pisoUndo()}
 else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();pisoRedo()}
 else if(k==='c'){e.preventDefault();pisoCopySelection(false)}
 else if(k==='x'){e.preventDefault();pisoCopySelection(true)}
 else if(k==='v'){e.preventDefault();pisoPasteClipboard()}
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
  pisoContextStack=[];pisoSelectedInstance=null;pisoActiveEntry=null;pisoMultiSelection.clear();pisoDragPreview=null;
  pisoUndoStack=[];pisoRedoStack=[];pisoSyncHistoryButtons();
  pisoSyncFormFromDraft();pisoRenderBreadcrumb();pisoRenderInspector();pisoRenderMultiSelectBar();pisoSyncActiveTilesetFromDraft();
  pisoSetStatus('Piso "'+(pisoRootDraft.name||'')+'" cargado.');
 }catch(e){pisoSetStatus('Error: '+e.message)}
}
async function pisoDeletePiso(id){
 const ok=await uiConfirm('¿Eliminar este piso permanentemente?');
 if(!ok)return;
 try{
  const r=await fetch('/api/config-floor?kind=custompiso&id='+encodeURIComponent(id),{method:'DELETE'});
  if(!r.ok){const d=await pisoResponseJson(r);throw new Error(d?.error||'No se pudo borrar')}
  if(pisoRootDraft.id===Number(id)){pisoRootDraft=pisoNewDraft(COLS,ROWS);pisoContextStack=[];pisoSelectedInstance=null;pisoMultiSelection.clear();pisoDragPreview=null;pisoUndoStack=[];pisoRedoStack=[];pisoSyncHistoryButtons();pisoSyncFormFromDraft();pisoRenderInspector();pisoRenderMultiSelectBar();pisoDraw()}
  await pisoFetchList();
 }catch(e){pisoSetStatus('Error borrando: '+e.message)}
}
function pisoSyncFormFromDraft(){
 const nameInput=document.getElementById('pisoName'),nivelInput=document.getElementById('pisoNivel');
 const colsInput=document.getElementById('pisoCols'),rowsInput=document.getElementById('pisoRows');
 if(nameInput)nameInput.value=pisoRootDraft.name||'';
 if(nivelInput)nivelInput.value=pisoRootDraft.nivel||'';
 if(colsInput)colsInput.value=pisoRootDraft.cols;
 if(rowsInput)rowsInput.value=pisoRootDraft.rows;
}
// Resizing while mid-way through editing an interior would silently resize
// the WRONG draft (pisoResizeGrid always targets pisoCurrentDraft()), so the
// root size controls are only wired to actually resize while at the root.
function pisoWirePisoSizeInputs(){
 const apply=()=>{
  if(pisoInInterior())return;
  const c=Number(document.getElementById('pisoCols')?.value),r=Number(document.getElementById('pisoRows')?.value);
  if(!c||!r)return;
  pisoPushHistory();pisoResizeGrid(pisoRootDraft,c,r);pisoSyncFormFromDraft();pisoDraw();
 };
 document.getElementById('pisoCols')?.addEventListener('change',apply);
 document.getElementById('pisoRows')?.addEventListener('change',apply);
}
async function pisoSave(){
 pisoRootDraft.name=document.getElementById('pisoName')?.value||'';
 pisoRootDraft.nivel=document.getElementById('pisoNivel')?.value||'';
 if(!pisoRootDraft.name.trim()){pisoSetStatus('Ponle un nombre al piso antes de guardar.');return}
 if(!pisoRootDraft.spawn||!pisoRootDraft.stairs)pisoSetStatus('Aviso: falta marcar entrada y/o salida - se guardará igualmente, pero el generador no podrá usar este piso hasta que las marques.');
 else pisoSetStatus('Guardando...');
 try{
  const cols=pisoDraftToColumns(pisoRootDraft);
  const body=JSON.stringify(cols);
  const id=pisoRootDraft.id;
  const r=await fetch(id?`/api/config-floor?kind=custompiso&id=${id}`:'/api/config-floor?kind=custompiso',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body});
  const data=await pisoResponseJson(r);
  if(!r.ok){
   // A body this size (413) or an infra-level failure (5xx from the edge)
   // never reaches our own JSON-emitting handler, so data/data.error is
   // null here - surface the raw HTTP status instead of a silent "no se
   // pudo guardar" so a payload-size regression is diagnosable from the
   // status line alone next time.
   const sizeKb=Math.round(body.length/1024);
   throw new Error(data?.error||`HTTP ${r.status} (payload ~${sizeKb} KB)`);
  }
  pisoRootDraft.id=(Array.isArray(data)?data[0]?.id:data?.id)??id;
  pisoSetStatus('Piso guardado.');
  await pisoFetchList();
  pisoPrefetchRuntimeCatalog(); // refresh the gameplay cache too
 }catch(e){pisoSetStatus('Error guardando: '+e.message)}
}
function pisoNewPiso(){
 pisoRootDraft=pisoNewDraft(COLS,ROWS);pisoContextStack=[];pisoSelectedInstance=null;pisoActiveEntry=null;pisoMultiSelection.clear();pisoDragPreview=null;
 pisoUndoStack=[];pisoRedoStack=[];pisoSyncHistoryButtons();
 pisoSyncFormFromDraft();pisoRenderBreadcrumb();pisoRenderInspector();pisoRenderMultiSelectBar();pisoDraw();
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
   pisoContextStack=[];pisoSelectedInstance=null;pisoActiveEntry=null;pisoMultiSelection.clear();pisoDragPreview=null;
   pisoUndoStack=[];pisoRedoStack=[];pisoSyncHistoryButtons();
   pisoSyncFormFromDraft();pisoRenderBreadcrumb();pisoRenderInspector();pisoRenderMultiSelectBar();pisoSyncActiveTilesetFromDraft();
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
 pisoWireToolbar();pisoWireCanvas();pisoWirePisoSizeInputs();
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
 if(!pisoActiveTileset&&pisoCurrentDraft().tilesetId)pisoSyncActiveTilesetFromDraft();
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

// Any grid size works live: camera()/blocked()/reveal() all size themselves
// off game.map's own dimensions (mapDimensions() in game.js), not the fixed
// COLS/ROWS constants - see pisoResizeGrid's comment. The one thing that
// doesn't self-size is game.seen, patched manually right after the
// loadPrecomputedFloor() wrap below successfully applies the floor.
function pisoEligibleForFloor(floor){return pisoRuntimeCatalog.filter(p=>pisoNivelMatches(p.nivel,floor)&&p.draft.spawn&&p.draft.stairs)}

// buildConfiguredEnemy() (game.js) already ORs `wantBoss` with the catalog
// template's own `.boss` flag, so a catalog-configured boss/megaboss lands
// with correct boss-tier stats even if the piso instance's own `boss` toggle
// is off. It never applies upgradeToMegaboss() on its own though (that's
// normally called explicitly by buildMegabossFloorPlan) - do that extra step
// here whenever either the placed instance or its catalog template is
// flagged as a megaboss, so a custom piso megaboss gets the same 2x2
// footprint/doubled stats a procedural megaboss floor gives it.
function pisoBuildRuntimeEnemy(tpl,en,floor){
 let e=buildConfiguredEnemy(tpl,{x:en.x,y:en.y},floor,!!en.boss);
 if((en.megaboss||tpl.megaboss)&&typeof upgradeToMegaboss==='function')e=upgradeToMegaboss(e);
 return e;
}
function pisoBuildInteriorState(sub,floor){
 if(!sub?.spawn)return null;
 const map=sub.grid.map(row=>row.map(v=>v?1:0));
 const families=typeof normalizedEnemyFamilies==='function'?normalizedEnemyFamilies():[],allTemplates=families.flatMap(f=>f.enemies||[]);
 const enemies=(sub.enemies||[]).map(en=>{
  const tpl=allTemplates.find(t=>String(t.id)===String(en.enemyDetailId));if(!tpl)return null;
  try{return pisoBuildRuntimeEnemy(tpl,en,floor)}catch(e){return null}
 }).filter(Boolean);
 const chestRows=typeof configChests!=='undefined'?configChests:[];
 const chests=(sub.chests||[]).map(c=>{const row=chestRows.find(r=>String(r.id)===String(c.configChestId));if(!row)return null;return {x:c.x,y:c.y,opened:false,locked:!!c.locked,chestDef:{...row.chest_json,configChestId:row.id}}}).filter(Boolean);
 const traps=(sub.traps||[]).map(t=>({x:t.x,y:t.y,dmg:6,revealed:false,sprung:false,dmgDice:t.dmgDice||null,effects:Array.isArray(t.effects)?t.effects:[]}));
 const keys=(sub.keys||[]).map(k=>({x:k.x,y:k.y}));
 const altars=(sub.altars||[]).map(a=>({x:a.x,y:a.y,kind:a.kind,used:false}));
 const room={x:0,y:0,w:sub.cols,h:sub.rows,cx:sub.spawn.x,cy:sub.spawn.y};
 return {map,rooms:[room],safeRooms:[],stairs:{x:-1,y:-1},doors:[{x:sub.spawn.x,y:sub.spawn.y,open:true,locked:false,interiorExit:true}],keys,chests,traps,altars,assets:[],enemies,boss:enemies.find(e=>e.boss)||null,spawn:{...sub.spawn},floorTileset:null};
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
  try{return pisoBuildRuntimeEnemy(tpl,en,floor)}catch(e){return null}
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
 const altars=(draft.altars||[]).map(a=>({x:a.x,y:a.y,kind:a.kind,used:false}));
 const rooms=[{x:0,y:0,w:draft.cols,h:draft.rows,cx:draft.spawn.x,cy:draft.spawn.y,type:'filler'},
  ...(draft.salas||[]).map(s=>({x:s.x,y:s.y,w:s.w,h:s.h,cx:s.x+Math.floor(s.w/2),cy:s.y+Math.floor(s.h/2),type:s.name||'sala'}))];
 return {
  map,rooms,safeRooms:[],spawn:{...draft.spawn},stairs:{...draft.stairs},doors,keys,chests,traps,altars,assets,event:null,
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
   // soulseeker-dungeons.js's own header comment) and CAN use custom pisos -
   // just never on a floor%3===0 floor, since Soulseek guarantees those as a
   // megaboss/bossrush floor (see buildFloorPlan's wrap in
   // soulseeker-dungeons.js) and a custom piso carries no guaranteed boss.
   const isSoulseeker=!!game?.player?.soulseeker;
   if(!selectedDungeonWorld&&!game?.forcedFloorArchetype&&!(isSoulseeker&&game.floor%3===0)&&pisoRuntimeCatalog.length){
    if(game.floor===1){game._pisoUsedThisRun=false;game._pisoLastForcedFloor=0} // fresh run: reset the best-effort "at least one" guarantee
    const eligible=pisoEligibleForFloor(game.floor);
    if(eligible.length){
     const total=(typeof worldParams==='function'?worldParams().floors:null)||DUNGEON_FLOORS;
     // Best-effort guarantee: force it on the run's second-to-last floor if
     // none has been used yet (floor===total is left alone - it's the
     // climax/megaboss floor, see buildFloorPlan). Otherwise a flat chance
     // per eligible floor. Not a mathematical guarantee for every possible
     // `nivel` configuration (e.g. one only matching the very last floor),
     // just a reasonable best effort.
     // Soulseeker runs never end at `total`, so re-arm this guarantee every
     // `total` floors instead of once per run (game._pisoLastForcedFloor
     // tracks the last floor it fired on).
     const mustForce=isSoulseeker
      ?(!game._pisoUsedThisRun||game.floor-(game._pisoLastForcedFloor||0)>=total)
      :(!game._pisoUsedThisRun&&game.floor===total-1);
     if(mustForce||Math.random()<.4){
      const entry=eligible[Math.floor(Math.random()*eligible.length)];
      const data=pisoBuildFloorData(entry,game.floor);
      const savedWorld=selectedDungeonWorld;
      selectedDungeonWorld={world_name:'Piso especial',id:'custom-'+entry.id,world_json:{floors:Array(game.floor-1).fill(null).concat([data])}};
      let ok=false;
      try{ok=pisoOrigLoadPrecomputedFloor()}finally{selectedDungeonWorld=savedWorld}
      if(ok){
       game._pisoUsedThisRun=true;if(mustForce)game._pisoLastForcedFloor=game.floor;
       // loadPrecomputedFloor() always sizes game.seen off the fixed ROWS/
       // COLS constants (matching every OTHER precomputed floor, which are
       // always exactly that size); a custom piso can be any size, so redo
       // it here to match data.map's real dimensions, then re-reveal the
       // spawn cell that fog-of-war reset just wiped.
       if(data.map.length!==ROWS||data.map[0].length!==COLS){
        game.seen=Array.from({length:data.map.length},()=>Array(data.map[0].length).fill(false));
        if(typeof reveal==='function')reveal(data.spawn.x,data.spawn.y);
       }
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
