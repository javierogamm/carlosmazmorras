/* MAZMORRA // BOTÍN v0.61.1
 * Renderizado del canvas, minimapa, sprites e inspección visual.
 * Carga clásica ordenada por index.html; el estado compartido pertenece al ámbito global del juego.
 */
function animate(){if(anim.t<1){anim.t=Math.min(1,anim.t+.2);draw();requestAnimationFrame(animate)}else draw()}

function drawTargetingOverlay(){
 if(!pendingTargetAction)return;const c=camera(),range=pendingTargetAction.range||1;
 ctx.save();ctx.globalAlpha=.28;
 for(let sy=0;sy<visibleTiles;sy++)for(let sx=0;sx<visibleTiles;sx++){const gx=c.x+sx,gy=c.y+sy;if(game.seen?.[gy]?.[gx]&&gridDistance(game.player,{x:gx,y:gy})>=(pendingTargetAction.minRange??1)&&gridDistance(game.player,{x:gx,y:gy})<=range&&hasLineOfSight(game.player,{x:gx,y:gy})){ctx.fillStyle=pendingTargetAction.mode==='area'?'#b26cff':'#ffca55';ctx.fillRect(sx*TILE+3,sy*TILE+3,TILE-6,TILE-6)}}
 ctx.restore()
}
// Semi-transparent AoE footprint shading, centered on the locked-in candidate
// (solid) or the live mouse hover (faint preview before locking in) for a
// pending area-target skill.
function drawAreaCandidateOverlay(){
 if(!pendingTargetAction||pendingTargetAction.mode!=='area')return;
 const center=pendingAreaCandidate||pendingAreaHover;if(!center)return;
 const c=camera(),radius=pendingAreaRadius();
 ctx.save();ctx.globalAlpha=pendingAreaCandidate?.45:.22;ctx.fillStyle='#ff5c9e';
 for(let gy=center.y-radius;gy<=center.y+radius;gy++)for(let gx=center.x-radius;gx<=center.x+radius;gx++){
  if(Math.max(Math.abs(gx-center.x),Math.abs(gy-center.y))>radius)continue;
  const sx=gx-c.x,sy=gy-c.y;if(sx<0||sy<0||sx>=visibleTiles||sy>=visibleTiles)continue;
  ctx.fillRect(sx*TILE+3,sy*TILE+3,TILE-6,TILE-6);
 }
 ctx.restore();
 if(pendingAreaCandidate){
  const sx=pendingAreaCandidate.x-c.x,sy=pendingAreaCandidate.y-c.y;
  if(sx>=0&&sy>=0&&sx<visibleTiles&&sy<visibleTiles){ctx.save();ctx.strokeStyle='#ff5c9e';ctx.lineWidth=2;ctx.strokeRect(sx*TILE+2,sy*TILE+2,TILE-4,TILE-4);ctx.restore()}
 }
}


function drawSafeRoomOverlay(sc){
 for(const room of game.safeRooms||[]){
  for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++){
   if(!game.seen?.[y]?.[x])continue;const p=sc(x,y);
   ctx.fillStyle='rgba(80,170,125,.12)';ctx.fillRect(p.x+3,p.y+3,TILE-6,TILE-6);
   ctx.strokeStyle='#62c893';ctx.strokeRect(p.x+5,p.y+5,TILE-10,TILE-10)
  }
  if(game.seen?.[room.cy]?.[room.cx]){
   const p=sc(room.cx,room.cy);
   px(p.x+22,p.y+39,20,7,'#513526');px(p.x+27,p.y+25,10,18,room.rested?'#777':'#e77939');
   if(!room.rested){px(p.x+30,p.y+18,5,12,'#ffd25a');px(p.x+24,p.y+27,16,7,'#ff9b45')}
  }
 }
}

function draw(){
 if(!game)return;const c=camera();ctx.clearRect(0,0,CANVAS_SIZE,CANVAS_SIZE);
 for(let sy=0;sy<visibleTiles;sy++)for(let sx=0;sx<visibleTiles;sx++){const x=c.x+sx,y=c.y+sy;if(!game.seen[y][x]){px(sx*TILE,sy*TILE,TILE,TILE,'#040306');continue}drawDungeonTile(sx*TILE,sy*TILE,!!game.map[y][x],x,y);if(!game.map[y][x]&&roomTypeAt(x,y)==='creator')px(sx*TILE,sy*TILE,TILE,TILE,'#2a5bff26')}
 const sc=(x,y)=>({x:(x-c.x)*TILE,y:(y-c.y)*TILE});drawSafeRoomOverlay(sc);drawSkillObjectGroundOverlay(sc);
 for(const r of game.rooms||[]){const cx=r.cx??(r.x+Math.floor(r.w/2)),cy=r.cy??(r.y+Math.floor(r.h/2));if(game.seen[cy]?.[cx])drawWorldObjectIcon('room_'+r.type,sc(cx,cy).x,sc(cx,cy).y,32,16)}
 for(const a of game.assets||[]){
  let visible=false;
  for(let dy=0;dy<a.rows&&!visible;dy++)for(let dx=0;dx<a.cols&&!visible;dx++)if(game.seen[a.y+dy]?.[a.x+dx])visible=true;
  if(!visible)continue;
  const p=sc(a.x,a.y);drawAssetIcon(a.key,p.x,p.y,a.cols*TILE,a.rows*TILE);
 }
 if(game.seen[game.stairs.y][game.stairs.x]){let p=sc(game.stairs.x,game.stairs.y);stairsSprite(p.x,p.y)}
 for(const d of game.doors)if(game.seen[d.y][d.x]){let p=sc(d.x,d.y);drawDoorTile(p.x,p.y,d)}
 for(const t of game.traps||[])if(t.revealed&&!t.sprung&&game.seen[t.y]?.[t.x]){let p=sc(t.x,t.y);trapSprite(p.x,p.y)}
 for(const a of game.altars||[])if(game.seen[a.y]?.[a.x]){let p=sc(a.x,a.y);altarSprite(p.x,p.y,a)}
 for(const k of game.keys)if(game.seen[k.y][k.x]){let p=sc(k.x,k.y);keySprite(p.x,p.y)}
 for(const chest of game.chests)if(!chest.opened&&game.seen[chest.y][chest.x]){let p=sc(chest.x,chest.y);drawChestSprite(p.x,p.y,chest)}
 for(const obj of game.skillObjects||[])if(game.seen[obj.y]?.[obj.x]){let p=sc(obj.x,obj.y);skillObjectSprite(p.x,p.y,obj)}
 for(const e of game.enemies)if(e.hp>0&&game.seen[e.y]?.[e.x]){const t=e.animT??1,ix=(e.prevX??e.x)+(e.x-(e.prevX??e.x))*t,iy=(e.prevY??e.y)+(e.y-(e.prevY??e.y))*t;let p=sc(ix,iy);enemySprite(p.x,p.y,e)}
 for(const ally of game.companions||[])if(((ally.hp>0&&ally.turns>0)||(ally.permanent&&ally.hp<=0))&&game.seen[ally.y]?.[ally.x]){let p=sc(ally.x,ally.y);companionSprite(p.x,p.y,ally)}
 for(const rp of game.otherPlayers||[])if(rp.hp>0&&game.seen[rp.y]?.[rp.x]){const t=rp.animT??1,ix=(rp.prevX??rp.x)+(rp.x-(rp.prevX??rp.x))*t,iy=(rp.prevY??rp.y)+(rp.y-(rp.prevY??rp.y))*t;let p=sc(ix,iy);remotePlayerSprite(p.x,p.y,rp)}
 const hx=(anim.heroX+(anim.targetX-anim.heroX)*anim.t-c.x)*TILE,hy=(anim.heroY+(anim.targetY-anim.heroY)*anim.t-c.y)*TILE;
 if(isPlayerInvisible()){ctx.save();ctx.globalAlpha=.45;heroSprite(hx,hy,pick([0,0]));ctx.restore()}else heroSprite(hx,hy,pick([0,0]));
 drawPlayerStatusFrames(hx,hy);
 const center=CANVAS_SIZE/2;const g=ctx.createRadialGradient(center,center,CANVAS_SIZE*.27,center,center,CANVAS_SIZE*.73);g.addColorStop(0,'#0000');g.addColorStop(1,'#000a');ctx.fillStyle=g;ctx.fillRect(0,0,CANVAS_SIZE,CANVAS_SIZE)
 drawTargetingOverlay();
 drawAreaCandidateOverlay();
}
// Persistent area effects (totems/zones with radius > 1, e.g. stormTotem's
// lightning field or consecrate's healing ground) used to only render a
// bold marker on their own single anchor tile - the actual affected area
// (tickSkillObjects() hits every enemy within gridDistance<=radius) was
// otherwise invisible. Paints a subtle, low-alpha tint across every seen
// tile the effect actually covers, drawn early (with the floor) so the
// bold anchor icon from skillObjectSprite still reads as the focal point.
function drawSkillObjectGroundOverlay(sc){
 for(const o of game.skillObjects||[]){
  if(!['totem','zone'].includes(o.kind)||(o.radius||0)<=1)continue;
  const color=o.kind==='totem'?'#9f7bff':'#64e0a0';
  ctx.save();ctx.lineWidth=2;
  for(let dy=-o.radius;dy<=o.radius;dy++)for(let dx=-o.radius;dx<=o.radius;dx++){
   if(Math.max(Math.abs(dx),Math.abs(dy))>o.radius)continue;
   const x=o.x+dx,y=o.y+dy;
   if(!game.seen?.[y]?.[x])continue;
   const p=sc(x,y);
   ctx.fillStyle=color+'40';ctx.fillRect(p.x,p.y,TILE,TILE);
   ctx.strokeStyle=color+'90';ctx.strokeRect(p.x+1,p.y+1,TILE-2,TILE-2);
  }
  ctx.restore();
 }
}
function px(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
function skillObjectSprite(x,y,o){
 const color=o.kind==='trap'?'#ffcc55':o.kind==='totem'?'#9f7bff':o.kind==='decoy'?'#d989ff':'#64e0a0';
 ctx.save();ctx.globalAlpha=.88;ctx.fillStyle=color+'33';ctx.fillRect(x+8,y+8,TILE-16,TILE-16);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(x+12,y+12,TILE-24,TILE-24);ctx.fillStyle=color;ctx.font='26px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(o.icon||'◆',x+TILE/2,y+TILE/2);ctx.font='10px monospace';ctx.fillText(`${o.turns}T`,x+TILE/2,y+TILE-11);ctx.restore()}

const classVisuals={
 yunque:{body:'#66717d',accent:'#d3a94f',trim:'#313944',weapon:'hammer',head:'helm',bulk:2},
 berserker:{body:'#6d2838',accent:'#ff2f8b',trim:'#25131b',weapon:'axe',head:'mohawk',bulk:2},
 necromancer:{body:'#37285c',accent:'#43e6ca',trim:'#171322',weapon:'staff',head:'hood',bulk:0},
 paladin:{body:'#d1c5a1',accent:'#65d9ff',trim:'#50576b',weapon:'sword',head:'halo',bulk:2},
 jester:{body:'#7c2f77',accent:'#f4d84a',trim:'#2b1734',weapon:'wand',head:'jester',bulk:0},
 sniper:{body:'#43566a',accent:'#d5a64d',trim:'#1c2630',weapon:'rifle',head:'visor',bulk:0},
 shaman:{body:'#476c5d',accent:'#b06ee7',trim:'#25362e',weapon:'totem',head:'antlers',bulk:1},
 thief:{body:'#303b54',accent:'#5ff4e4',trim:'#121722',weapon:'dagger',head:'mask',bulk:0},
 cleric:{body:'#d9d1c0',accent:'#72b9ff',trim:'#535164',weapon:'mace',head:'cowl',bulk:1},
 entropyMage:{body:'#461d55',accent:'#ff5d79',trim:'#1a0d20',weapon:'orb',head:'hood',bulk:0},
 bountyHunter:{body:'#6a4938',accent:'#e68b42',trim:'#25201d',weapon:'pistol',head:'implant',bulk:1},
 druid:{body:'#53633d',accent:'#9fd15b',trim:'#2c3020',weapon:'staff',head:'branches',bulk:1},
 monk:{body:'#a04f33',accent:'#e7c978',trim:'#382019',weapon:'fists',head:'bald',bulk:0},
 engineer:{body:'#6b5848',accent:'#ffb445',trim:'#29231e',weapon:'cannon',head:'goggles',bulk:1},
 seer:{body:'#273b62',accent:'#c572ff',trim:'#12182a',weapon:'eye',head:'veil',bulk:0},
 beastGuardian:{body:'#4b5e49',accent:'#d0754d',trim:'#252e25',weapon:'claws',head:'beast',bulk:2}
};
const rarityColors={common:'#b7b7b7',uncommon:'#65d889',rare:'#62aef5',epic:'#c879ef',legendary:'#ffbd45'};
function shade(hex,amt){
 const n=parseInt(hex.slice(1),16),r=Math.max(0,Math.min(255,(n>>16)+amt)),g=Math.max(0,Math.min(255,((n>>8)&255)+amt)),b=Math.max(0,Math.min(255,(n&255)+amt));
 return `rgb(${r},${g},${b})`
}


function showTab(name){
 const target=[...document.querySelectorAll('[data-tab]')].find(b=>b.dataset.tab===name);
 if(target)target.click();
}

function updateGameHud(){
 if(!game?.player)return;
 const p=game.player,need=p.level>=LEVEL_CAP?1:(p.nextXp||xpNeededForLevel(p.level));
 const set=(fill,text,val,max,bar)=>{const f=document.getElementById(fill),t=document.getElementById(text),b=bar&&document.getElementById(bar),pct=Math.max(0,Math.min(100,val/max*100));if(f)f.style.width=`${pct}%`;if(t)t.textContent=`${Math.ceil(val)}/${Math.ceil(max)}`;if(b)b.setAttribute('aria-valuenow',Math.round(pct))};
 set('hudHpFill','hudHpText',p.hp,p.maxHp,'hudHpBar');
 set('hudXpFill','hudXpText',p.level>=LEVEL_CAP?1:p.xp,need,'hudXpBar');if(p.level>=LEVEL_CAP){const t=document.getElementById('hudXpText');if(t)t.textContent='MÁX'}
 set('hudStaminaFill','hudStaminaText',p.stamina,p.maxStamina,'hudStaminaBar');
 set('hudManaFill','hudManaText',p.mana,p.maxMana,'hudManaBar');
 drawMinimap();
}
function drawMinimap(){
 const c=document.getElementById('minimap');if(!c||!game?.map)return;
 const q=c.getContext('2d'),w=game.map[0].length,h=game.map.length,s=Math.min(c.width/w,c.height/h);
 q.clearRect(0,0,c.width,c.height);q.fillStyle='#07050a';q.fillRect(0,0,c.width,c.height);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!game.seen?.[y]?.[x])continue;
  q.fillStyle=game.map[y][x]?'#1a1320':'#5a4665';q.fillRect(Math.floor(x*s),Math.floor(y*s),Math.ceil(s),Math.ceil(s));
 }
 for(const r of game.safeRooms||[]){if(game.seen?.[r.cy]?.[r.cx]){q.fillStyle=r.rested?'#557064':'#62c893';q.fillRect(Math.floor(r.cx*s)-1,Math.floor(r.cy*s)-1,Math.max(3,Math.ceil(s+2)),Math.max(3,Math.ceil(s+2)))}}
 for(const e of game.enemies||[]){if(e.hp>0&&game.seen?.[e.y]?.[e.x]){q.fillStyle=e.boss?'#ffd15d':'#d85a68';q.fillRect(Math.floor(e.x*s),Math.floor(e.y*s),Math.max(2,Math.ceil(s)),Math.max(2,Math.ceil(s)))}}
 q.fillStyle='#6cf0a2';q.fillRect(Math.floor(game.player.x*s),Math.floor(game.player.y*s),Math.max(3,Math.ceil(s+1)),Math.max(3,Math.ceil(s+1)));
}
function inspectedEntityAt(gx,gy){
 const enemy=enemyAtCell(gx,gy);if(enemy)return{type:'enemy',data:enemy};
 const item=game.floorItems?.find?.(i=>i.x===gx&&i.y===gy);if(item)return{type:'item',data:item};
 const chest=game.chests?.find?.(i=>i.x===gx&&i.y===gy);if(chest)return{type:'chest',data:chest};
 const door=game.doors?.find?.(i=>i.x===gx&&i.y===gy);if(door)return{type:'door',data:door};
 const altar=(game.altars||[]).find(a=>a.x===gx&&a.y===gy);if(altar)return{type:'altar',data:altar};
 const trapAt=(game.traps||[]).find(t=>t.revealed&&!t.sprung&&t.x===gx&&t.y===gy);if(trapAt)return{type:'trap',data:trapAt};
 const safe=safeRoomAt(gx,gy);if(safe)return{type:'safeRoom',data:safe};if(game.stairs?.x===gx&&game.stairs?.y===gy)return{type:'stairs',data:game.stairs};
 return game.map?.[gy]?.[gx]===0?{type:'floor',data:{x:gx,y:gy}}:{type:'wall',data:{x:gx,y:gy}};
}
function showInspect(entity,clientX,clientY){
 const pop=document.getElementById('inspectPopup'),content=document.getElementById('inspectContent');if(!pop||!content)return;
 let h='';
 if(entity.type==='enemy'){const e=entity.data;const clsLabel=e.enemyClassLabel||ENEMY_CLASS_GEAR[enemyClassOf(e)]?.label;h=`<h4>${e.name||'Enemigo'}</h4><p>${e.boss?'Jefe':'Enemigo'}${e.elite?' élite':''}${clsLabel?` · ${clsLabel}`:''}</p><p>Vida: ${Math.max(0,e.hp)}/${e.maxHp}</p><p>Daño estimado: ${e.damage||'?'}</p>${e.weapon?`<p><b>Arma:</b> ${e.weapon.name} (${e.weapon.label||e.weapon.rarity}${e.weapon.kind!=='melee'?` · alcance ${e.weapon.rangeMax}`:''})</p>`:''}<p>${enemyDefs[e.type]?.desc||'Una criatura hostil de la mazmorra.'}</p>${e.skills?.length?`<p><b>Habilidades:</b> ${e.skills.map(id=>skillDefs[id]?.name).filter(Boolean).join(' · ')}</p>`:''}`}
 else if(entity.type==='item'){const i=entity.data;h=`<h4>${i.name||'Objeto'}</h4><p>${i.desc||'Objeto encontrado en la mazmorra.'}</p><p>${i.flavor||''}</p>${describeItem(i)}`}
 else if(entity.type==='chest')h=`<h4>Cofre</h4><p>${entity.data.open?'Está vacío.':'Contiene botín aleatorio y puede ocultar habilidades.'}</p>`;
 else if(entity.type==='door')h=`<h4>Puerta ${entity.data.locked?'cerrada':'abierta'}</h4><p>${entity.data.locked?'Necesitas una llave o un efecto especial.':'Puedes atravesarla.'}</p>`;
 else if(entity.type==='safeRoom')h=`<h4>Sala segura</h4><p>Los enemigos no pueden entrar.</p><p>${entity.data.rested?'Ya has descansado aquí.':'Sitúate sobre el fuego central y pulsa DESCANSAR para recuperar toda la vida, stamina y maná.'}</p>`;
 else if(entity.type==='altar')h=`<h4>${entity.data.kind==='disenchant'?'Altar del Creador':'Altar'}</h4><p>${entity.data.kind==='disenchant'?'Crea y mejora equipo con shards. Reutilizable. (Deshacer objetos ya no requiere esta sala: hazlo desde la Mochila.)':entity.data.used?'Ya lo has usado.':entity.data.kind==='heal'?'Restaura una parte importante de tu vida.':entity.data.kind==='shield'?'Te concede un escudo.':'Potencia tu daño y armadura durante varios turnos.'}</p>`;
 else if(entity.type==='trap')h=`<h4>Trampa</h4><p>Un mecanismo oculto. Evita pisarlo.</p>`;
 else if(entity.type==='stairs')h=`<h4>Escaleras</h4><p>Conducen al siguiente nivel de la mazmorra.</p>`;
 else if(entity.type==='wall')h=`<h4>Muro</h4><p>Piedra antigua. No parece impresionada por tus credenciales.</p>`;
 else h=`<h4>Suelo explorado</h4><p>Una zona ya revelada de la mazmorra.</p>`;
 content.innerHTML=h;pop.classList.add('open');
 const host=gameCanvasWrap?.getBoundingClientRect?.()||document.getElementById('game').parentElement.getBoundingClientRect();
 pop.style.left=`${Math.min(host.width-310,Math.max(8,clientX-host.left+10))}px`;
 pop.style.top=`${Math.min(host.height-190,Math.max(8,clientY-host.top+10))}px`;
}
function closeInspect(){document.getElementById('inspectPopup')?.classList.remove('open')}




const defaultTilesetFloors=[
 {id:'verdant-cave',name:'Caverna verdeante',story:'Cavernas húmedas cubiertas de musgo, raíces y piedra viva.',floorTiles:[{name:'Musgo húmedo',color:'#263927',alt:'#314832',accent:'#8fbf63',icon:''},{name:'Raíz y limo',color:'#213420',alt:'#39523a',accent:'#6f9457',icon:''}],wallTiles:[{name:'Piedra musgosa',color:'#1c2b1d',top:'#304832',accent:'#8fbf63',rotatable:true,icon:''}],doorTiles:[{name:'Puerta de raíces',color:'#6b4a2f',accent:'#8fbf63',icon:''}]},
 {id:'crypt',name:'Cripta violeta',story:'Tumbas antiguas y corredores bajo una luna que no existe.',floorTiles:[{name:'Losa arcana',color:'#30283a',alt:'#3b3146',accent:'#b08bd3',icon:''}],wallTiles:[{name:'Muro funerario',color:'#24202e',top:'#3b3349',accent:'#b08bd3',rotatable:true,icon:''}],doorTiles:[{name:'Puerta funeraria',color:'#4b394f',accent:'#b08bd3',icon:''}]},
 {id:'foundry',name:'Fundición carmesí',story:'Hornos, cadenas y metal fundido.',floorTiles:[{name:'Baldosa caliente',color:'#4b241d',alt:'#5c2c22',accent:'#ff8a45',icon:''}],wallTiles:[{name:'Ladrillo abrasado',color:'#3a1d19',top:'#612c20',accent:'#ff8a45',rotatable:true,icon:''}],doorTiles:[{name:'Compuerta oxidada',color:'#5b3328',accent:'#ff8a45',icon:''}]},
 {id:'archive',name:'Archivo del Vacío',story:'Bibliotecas imposibles y pasillos que olvidan dónde estaban.',floorTiles:[{name:'Suelo imposible',color:'#211d3c',alt:'#2c2750',accent:'#66e0df',icon:''}],wallTiles:[{name:'Muro imposible',color:'#18162b',top:'#29234b',accent:'#66e0df',rotatable:true,icon:''}],doorTiles:[{name:'Umbral de datos',color:'#25203d',accent:'#66e0df',icon:''}]}
];
function normalizedSupabaseFloors(){return configFloors.map(r=>({...(r.floor_json||{}),dbId:r.id,name:r.floor_json?.name||r.floor_name,source:'config_floor'})).filter(f=>f&&f.name)}
function normalizedConfigFloors(){const saved=normalizedSupabaseFloors();return saved.length?saved:defaultTilesetFloors}
function pickFloorTilesetForLevel(level){const floors=normalizedSupabaseFloors();if(!floors.length)throw new Error('No hay floors consolidados en config_floor. Crea o importa floors antes de generar la dungeon.');return pick(floors)}
function compactTileForWorld(tile){const {icon,...rest}=tile||{};return rest}
function compactFloorTilesetForWorld(floorTileset){if(!floorTileset)return null;return{...floorTileset,floorTiles:(floorTileset.floorTiles||[]).map(compactTileForWorld),wallTiles:(floorTileset.wallTiles||[]).map(compactTileForWorld),doorTiles:(floorTileset.doorTiles||[]).map(compactTileForWorld)}}
function hydrateFloorTilesetForWorld(saved){if(!saved)return pickFloorTilesetForLevel(game?.floor||1);const source=normalizedConfigFloors().find(f=>(saved.dbId&&String(f.dbId)===String(saved.dbId))||f.name===saved.name);if(!source)return saved;return{...source,...saved,floorTiles:(saved.floorTiles||source.floorTiles||[]).map((t,i)=>({...source.floorTiles?.[i],...t,icon:t.icon||source.floorTiles?.[i]?.icon||''})),wallTiles:(saved.wallTiles||source.wallTiles||[]).map((t,i)=>({...source.wallTiles?.[i],...t,icon:t.icon||source.wallTiles?.[i]?.icon||''})),doorTiles:(saved.doorTiles||source.doorTiles||[]).map((t,i)=>({...source.doorTiles?.[i],...t,icon:t.icon||source.doorTiles?.[i]?.icon||''}))}}
function activeFloorTileset(){return game?.floorTileset||pickFloorTilesetForLevel(game?.floor||1)}
function wallDirectionForCell(gx,gy){const open=(x,y)=>game?.map?.[y]?.[x]===0,up=open(gx,gy-1),down=open(gx,gy+1),left=open(gx-1,gy),right=open(gx+1,gy);if(up&&down&&!left&&!right)return'vertical';if(left&&right&&!up&&!down)return'horizontal';if(down&&!up)return'top';if(up&&!down)return'bottom';if(right&&!left)return'left';if(left&&!right)return'right';return'center'}
function wallRotationForDirection(direction){return {top:0,right:90,bottom:180,left:270,horizontal:90,vertical:0,center:0}[direction]||0}
function directionalWallTile(tiles,direction,seed){const exact=tiles.filter(t=>!t.direction||t.direction===direction||(direction==='horizontal'&&t.direction==='right')||(direction==='vertical'&&t.direction==='top'));return (exact.length?exact:tiles)[seed%(exact.length?exact.length:tiles.length)]}
function tileImageFromHex(hex){if(!hex)return null;const img=new Image();img.src='data:image/png;base64,'+btoa(String(hex).match(/.{1,2}/g).map(h=>String.fromCharCode(parseInt(h,16))).join(''));return img}
const tileImageCache=new Map();
// Skill icon override (skillDefs[id].iconImage, a hex PNG from the class
// editor's image icon tool): renders in place of the plain text/emoji glyph
// wherever a skill is shown. Existing skills keep their emoji by default -
// this only draws when an override has actually been set.
function drawSkillIconImg(canvas,hex){
 let img=tileImageCache.get('skill:'+hex);if(!img){img=tileImageFromHex(hex);tileImageCache.set('skill:'+hex,img)}
 const paint=()=>{const c=canvas.getContext('2d');c.imageSmoothingEnabled=true;c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(img,0,0,canvas.width,canvas.height)};
 if(img.complete)paint();else img.onload=paint;
}
function drawConfiguredTile(tile,x,y,rotate=0){if(!tile?.icon)return false;let img=tileImageCache.get(tile.icon);if(!img){img=tileImageFromHex(tile.icon);tileImageCache.set(tile.icon,img)}if(!img)return false;const paint=()=>{ctx.save();ctx.translate(x+TILE/2,y+TILE/2);if(rotate)ctx.rotate(rotate*Math.PI/180);ctx.drawImage(img,-TILE/2,-TILE/2,TILE,TILE);ctx.restore()};if(img.complete){paint();return true}img.onload=()=>game&&draw();return false}

const floorVisualThemes={
 1:{name:'Fortaleza Verde',wall:'#1c2b1d',wallTop:'#304832',floor:'#263927',floorAlt:'#314832',accent:'#8fbf63',fog:'#071009',story:'Fortaleza tomada por trasgos, mercenarios y bestias de los bosques.'},
 2:{name:'Criptas del Duque',wall:'#24202e',wallTop:'#3b3349',floor:'#30283a',floorAlt:'#3b3146',accent:'#b08bd3',fog:'#0b0810',story:'Tumbas antiguas, capillas rotas y corredores bajo una luna que no existe.'},
 3:{name:'Fundición Carmesí',wall:'#3a1d19',wallTop:'#612c20',floor:'#4b241d',floorAlt:'#5c2c22',accent:'#ff8a45',fog:'#120705',story:'Hornos, cadenas, metal fundido y obreros monstruosos al servicio del Tirano.'},
 4:{name:'Archivo del Vacío',wall:'#18162b',wallTop:'#29234b',floor:'#211d3c',floorAlt:'#2c2750',accent:'#66e0df',fog:'#05040c',story:'Bibliotecas imposibles, magia rota y pasillos que olvidan dónde estaban.'}
};
function currentFloorTheme(){const f=activeFloorTileset();return {name:f.name,story:f.story||f.desc||'Set de tiles configurado.',floor:f.floorTiles?.[0]?.color||'#263927',floorAlt:f.floorTiles?.[0]?.alt||'#314832',wall:f.wallTiles?.[0]?.color||'#1c2b1d',wallTop:f.wallTiles?.[0]?.top||'#304832',accent:f.floorTiles?.[0]?.accent||f.wallTiles?.[0]?.accent||'#8fbf63',fog:'#071009'}}

function drawDungeonTile(x,y,wall,gx,gy){
 const floorSet=activeFloorTileset(),seed=(gx*73856093^gy*19349663)>>>0;
 const t=currentFloorTheme();
 if(wall){
  const wallTiles=floorSet.wallTiles?.length?floorSet.wallTiles:[{}],dir=wallDirectionForCell(gx,gy),wt=directionalWallTile(wallTiles,dir,seed),rot=wt.rotatable?wallRotationForDirection(dir):0;
  if(drawConfiguredTile(wt,x,y,rot)){ctx.strokeStyle=shade(t.wall,-10);ctx.strokeRect(x+.5,y+.5,TILE-1,TILE-1);return}
  px(x,y,TILE,TILE,t.wall);px(x,y,TILE,7,t.wallTop);px(x+5,y+9,TILE-10,TILE-14,shade(t.wall,6));
  for(let i=0;i<4;i++){const yy=y+12+i*13,off=((i&1)*8);for(let xx=x-8+off;xx<x+TILE;xx+=24){px(xx,yy,20,2,shade(t.wall,-10));px(xx+19,yy-10,2,12,shade(t.wall,-7))}}
  if(game.floor===3&&seed%7===0){px(x+49,y+8,5,27,'#8b351e');px(x+48,y+7,7,5,'#ff9b45')}
  if(game.floor===4&&seed%8===0){px(x+11,y+12,2,30,t.accent);px(x+8,y+25,8,2,t.accent)}
 }else{
  const floorTiles=floorSet.floorTiles?.length?floorSet.floorTiles:[{}],ft=floorTiles[seed%floorTiles.length];
  if(drawConfiguredTile(ft,x,y,0)){ctx.strokeStyle=shade(t.floor,-10);ctx.strokeRect(x+.5,y+.5,TILE-1,TILE-1);return}
  px(x,y,TILE,TILE,t.floor);px(x+2,y+2,TILE-4,TILE-4,t.floorAlt);
  px(x+3,y+3,TILE-6,2,shade(t.floorAlt,12));px(x+3,y+TILE-5,TILE-6,2,shade(t.floor,-12));
  if(seed%5===0)px(x+12+(seed%31),y+10+((seed>>4)%35),3,3,shade(t.floorAlt,16));
  if(game.floor===1&&seed%11===0){px(x+8,y+48,14,3,'#4d6a3f');px(x+16,y+41,3,10,'#6f9457')}
  if(game.floor===2&&seed%13===0){px(x+13,y+17,3,20,'#55435e');px(x+9,y+32,10,3,'#55435e')}
  if(game.floor===3&&seed%9===0){px(x+50,y+8,4,20,'#d45a32');px(x+48,y+8,8,4,'#ff9c42')}
  if(game.floor===4&&seed%9===0){px(x+11,y+12,2,30,'#7c5cff');px(x+8,y+25,8,2,'#43d9df')}
 }
 ctx.strokeStyle=shade(t.floor,-10);ctx.strokeRect(x+.5,y+.5,TILE-1,TILE-1)
}

const weaponPixelAnchors={
 hammer:{x:18,y:-8,rotation:0},axe:{x:18,y:-9,rotation:0},sword:{x:18,y:-12,rotation:0},
 staff:{x:19,y:-10,rotation:0},totem:{x:19,y:-9,rotation:0},rifle:{x:17,y:-9,rotation:0},
 cannon:{x:16,y:-8,rotation:0},pistol:{x:18,y:-8,rotation:0},dagger:{x:18,y:-10,rotation:0},
 mace:{x:18,y:-9,rotation:0},wand:{x:18,y:-10,rotation:0},orb:{x:19,y:-11,rotation:0},
 eye:{x:19,y:-11,rotation:0},claws:{x:17,y:-7,rotation:0},fists:{x:16,y:-5,rotation:0}
};
const classPixelAdjust={
 yunque:{weapon:{x:2,y:1},offhand:{x:-1,y:0}},berserker:{weapon:{x:1,y:-1}},paladin:{weapon:{x:0,y:-2},offhand:{x:-1,y:-2}},
 sniper:{weapon:{x:-2,y:-1}},thief:{weapon:{x:0,y:1}},cleric:{weapon:{x:0,y:-1}},bountyHunter:{weapon:{x:1,y:0}},
 engineer:{weapon:{x:-2,y:1}},monk:{weapon:{x:0,y:2}},beastGuardian:{weapon:{x:-1,y:1}}
};
function equipmentAnchor(cls,type,side='weapon',facing=1){
 const b=weaponPixelAnchors[type]||{x:18,y:-8,rotation:0},c=classPixelAdjust[cls]?.[side]||{x:0,y:0};
 const x=(b.x+c.x)*(facing>0?1:-1);
 return{x,y:b.y+c.y,rotation:(b.rotation||0)*(facing>0?1:-1)}
}

function drawPixelWeapon(q,x,y,type,color,flip=1){
 q.fillStyle='#221a24';
 const r=(a,b,c,d,col=color)=>{q.fillStyle=col;q.fillRect(x+a*flip-(flip<0?c:0),y+b,c,d)};
 if(type==='hammer'){r(0,15,4,24,'#6d4b32');r(-7,8,18,10,color);r(-5,6,14,3,shade(color,20))}
 else if(type==='axe'){r(0,13,4,27,'#72503a');r(-8,5,14,13,color);r(5,8,7,8,shade(color,-20))}
 else if(type==='sword'){r(0,-1,4,29,color);r(1,-4,2,5,shade(color,22));r(-4,27,12,4,'#c89b55');r(0,31,4,8,'#64442f')}
 else if(type==='staff'||type==='totem'){r(0,5,4,37,'#72503b');r(-5,0,14,12,color);r(-2,2,8,6,shade(color,25))}
 else if(type==='rifle'||type==='cannon'){r(-12,16,27,7,color);r(6,21,5,13,'#6b4934');r(-10,23,9,3,shade(color,-15))}
 else if(type==='pistol'){r(-7,14,16,7,color);r(1,20,5,11,'#634532')}
 else if(type==='dagger'){r(0,12,4,18,color);r(-3,28,10,3,'#d3a64e')}
 else if(type==='mace'){r(0,14,4,25,'#6e4b34');r(-5,6,14,12,color)}
 else if(type==='wand'){r(0,13,4,25,'#77503a');r(-4,5,12,11,color)}
 else if(type==='orb'||type==='eye'){r(-5,6,14,14,color);r(-2,3,8,4,shade(color,25))}
 else if(type==='claws'){for(let i=0;i<3;i++)r(i*4-6,13-i*2,3,18,color)}
}
function drawHeadGear(q,v,x,y,type,color){
 q.fillStyle=color;
 if(type==='helm'){q.fillRect(x-12,y-9,24,10);q.fillRect(x-15,y-4,5,13);q.fillRect(x+10,y-4,5,13);q.fillStyle=shade(color,20);q.fillRect(x-8,y-7,16,3)}
 else if(type==='mohawk'){q.fillRect(x-3,y-17,6,14);q.fillRect(x-8,y-14,6,5);q.fillRect(x+3,y-14,6,5)}
 else if(type==='hood'||type==='cowl'){q.fillRect(x-14,y-11,28,15);q.fillRect(x-16,y-2,6,15);q.fillRect(x+10,y-2,6,15)}
 else if(type==='halo'){q.fillRect(x-12,y-17,24,3);q.fillRect(x-15,y-14,4,4);q.fillRect(x+11,y-14,4,4)}
 else if(type==='jester'){q.fillRect(x-14,y-11,28,7);q.fillRect(x-14,y-16,6,8);q.fillRect(x+8,y-16,6,8);q.fillStyle='#ffd95e';q.fillRect(x-15,y-18,4,4);q.fillRect(x+11,y-18,4,4)}
 else if(type==='visor'){q.fillRect(x-13,y-5,26,6);q.fillStyle='#ef3e66';q.fillRect(x-10,y-3,20,2)}
 else if(type==='antlers'||type==='branches'){q.fillRect(x-11,y-15,3,12);q.fillRect(x+8,y-15,3,12);q.fillRect(x-15,y-15,7,3);q.fillRect(x+8,y-15,7,3)}
 else if(type==='mask'){q.fillRect(x-13,y-5,26,8);q.fillStyle='#50f0df';q.fillRect(x-8,y-2,5,2);q.fillRect(x+3,y-2,5,2)}
 else if(type==='implant'){q.fillRect(x+8,y-6,6,8);q.fillStyle='#ff9a42';q.fillRect(x+10,y-4,3,3)}
 else if(type==='goggles'){q.fillRect(x-13,y-6,26,6);q.fillStyle='#ffc34b';q.fillRect(x-10,y-4,7,3);q.fillRect(x+3,y-4,7,3)}
 else if(type==='veil'){q.globalAlpha=.7;q.fillRect(x-15,y-10,30,23);q.globalAlpha=1}
 else if(type==='beast'){q.fillRect(x-14,y-10,7,9);q.fillRect(x+7,y-10,7,9);q.fillRect(x-10,y-15,5,7);q.fillRect(x+5,y-15,5,7)}
}

function drawEquippedWeaponIcon(q,item,x,y,facing=1){
 const img=item?weaponIconImage(item):null;
 if(!(img?.complete&&img.naturalWidth))return false;
 const rect=weaponUsesSwordSpritesheet(item.weaponIconRow)?swordSpriteRect(item.weaponIconRow,item.weaponIconCol):null;
 const displaySize=(rect||img.naturalWidth>=WEAPON_TYPE_ICON_SIZE)?24:16;
 q.save();q.translate(x,y);q.scale(facing,1);q.rotate(facing>0?.55:-.55);
 if(rect)q.drawImage(img,rect.x,rect.y,rect.size,rect.size,-displaySize/2,-displaySize-2,displaySize,displaySize);else q.drawImage(img,-displaySize/2,-displaySize-2,displaySize,displaySize);
 q.restore();
 return true;
}

function drawCharacter(q,x,y,scale,cls,equipment={},frame=0,facing=1){
 const v=classVisuals[cls]||classVisuals.yunque, bob=frame%2?1:0;
 q.save();q.translate(x,y+bob);q.scale(scale,scale);
 const r=(a,b,c,d,col)=>{q.fillStyle=col;q.fillRect(a,b,c,d)};
 const skin='#c99062', dark='#1b141d',body=v.body,accent=v.accent,trim=v.trim,bulk=v.bulk||0;
 // shadow
 r(-17,25,34,6,'#09070b88');
 // cape/back silhouette by class
 if(['necromancer','entropyMage','seer','cleric','druid'].includes(cls)){r(-13,-2,26,31,shade(body,-18));r(-17,10,7,19,shade(body,-25));r(10,10,7,19,shade(body,-25))}
 // legs and boots
 r(-10,13,8,15,trim);r(2,13,8,15,trim);
 const boots=equipment.boots,bootCol=boots?rarityColors[boots.rarity]:shade(trim,10);
 r(-12,24,11,6,bootCol);r(1,24,11,6,bootCol);
 // torso, chest visible
 r(-12-bulk,-5,24+bulk*2,20,body);r(-10-bulk,-3,20+bulk*2,4,shade(body,20));
 const chest=equipment.chest;
 if(chest){const cc=rarityColors[chest.rarity];r(-13-bulk,-6,26+bulk*2,8,cc);r(-11-bulk,3,22+bulk*2,3,shade(cc,-25));r(-3,-4,6,16,shade(cc,12))}
 // arms and gloves
 r(-18-bulk,-2,7,18,skin);r(11+bulk,-2,7,18,skin);
 const gloves=equipment.hands,gc=gloves?rarityColors[gloves.rarity]:shade(body,-12);
 r(-19-bulk,10,8,7,gc);r(11+bulk,10,8,7,gc);
 // neck
 if(equipment.neck){const nc=rarityColors[equipment.neck.rarity];r(-5,-4,10,2,nc);r(-1,-2,3,4,shade(nc,20))}
 // head/face
 r(-10,-18,20,15,skin);r(-8,-16,16,3,shade(skin,12));r(-6,-11,3,3,dark);r(3,-11,3,3,dark);
 // hair
 if(!['hood','cowl','helm'].includes(v.head)){r(-10,-19,20,4,shade(trim,-5));r(-11,-16,4,7,shade(trim,-5))}
 drawHeadGear(q,v,0,-9,v.head,accent);
 if(equipment.head)drawHeadGear(q,v,0,-9,'helm',rarityColors[equipment.head.rarity]);
 // weapon and offhand
 const weapon=equipment.weapon, wc=weapon?rarityColors[weapon.rarity]:accent;
 const wa=equipmentAnchor(cls,v.weapon,'weapon',facing);
 if(!drawEquippedWeaponIcon(q,weapon,wa.x,wa.y,facing)){q.save();q.translate(wa.x,wa.y);if(wa.rotation)q.rotate(wa.rotation);drawPixelWeapon(q,0,0,v.weapon,wc,facing);q.restore();}
 if(equipment.offhand){const oc=rarityColors[equipment.offhand.rarity],oa=equipmentAnchor(cls,v.weapon,'offhand',-facing);q.save();q.translate(oa.x+(facing>0?-2:2),oa.y+8);q.fillStyle=oc;q.fillRect(-6,-5,12,17);q.fillStyle=shade(oc,-20);q.fillRect(-4,-3,8,13);q.fillStyle=shade(oc,18);q.fillRect(-3,-2,6,3);q.restore()}
 // rings/trinkets glow
 const glow=[equipment.ring1,equipment.ring2,equipment.trinket1,equipment.trinket2].filter(Boolean);
 if(glow.length){q.globalAlpha=.55;for(let i=0;i<glow.length;i++){q.strokeStyle=rarityColors[glow[i].rarity];q.strokeRect(-19-i, -20-i,38+i*2,50+i*2)}q.globalAlpha=1}
 q.restore()
}
function drawTrimmedImage(q,img,x,y,w,h,padding=0){
 const src=document.createElement('canvas');src.width=img.naturalWidth||img.width;src.height=img.naturalHeight||img.height;const s=src.getContext('2d');s.imageSmoothingEnabled=true;s.clearRect(0,0,src.width,src.height);s.drawImage(img,0,0);
 const data=s.getImageData(0,0,src.width,src.height).data;let minX=src.width,minY=src.height,maxX=-1,maxY=-1;
 for(let yy=0;yy<src.height;yy++)for(let xx=0;xx<src.width;xx++){if(data[(yy*src.width+xx)*4+3]>8){if(xx<minX)minX=xx;if(yy<minY)minY=yy;if(xx>maxX)maxX=xx;if(yy>maxY)maxY=yy}}
 q.imageSmoothingEnabled=true;
 if(maxX<0){q.drawImage(img,x,y,w,h);return}
 const sw=maxX-minX+1,sh=maxY-minY+1,scale=Math.min((w-padding*2)/sw,(h-padding*2)/sh),dw=Math.max(1,Math.round(sw*scale)),dh=Math.max(1,Math.round(sh*scale)),dx=x+Math.round((w-dw)/2),dy=y+Math.round((h-dh)/2);
 q.drawImage(img,minX,minY,sw,sh,dx,dy,dw,dh)
}
function drawCharacterIcon(q,iconHex,x,y,w,h,padding=0){
 if(!iconHex)return false;
 try{const data='data:image/png;base64,'+hexToBase64(iconHex.startsWith('#')?iconHex.slice(1):iconHex),img=configIconImage(data);
  const draw=()=>drawTrimmedImage(q,img,x,y,w,h,padding);
  if(img.complete&&img.naturalWidth){draw();return true}
  img.onload=()=>{draw();if(game)draw()};
 }catch(e){}
 return false;
}
// Same invisibility check enemyTurn() uses to skip the enemy response:
// active from the 'invisible' stackable effect - a skill's or a potion's,
// both set the same p.invisibleTurns (see effectSourceDef).
function isPlayerInvisible(){return game.player.invisibleTurns>0}
// Concentric 5px square frames drawn around the hero tile, one per active
// status: shield (blue) innermost, stat buffs (green), invisibility (gray)
// outermost - stacking them instead of overlapping keeps every active status
// visible at once instead of just the last one drawn.
function drawPlayerStatusFrames(x,y){
 const p=game.player,frames=[];
 if(p.holyShield>0)frames.push('#4da6ff');
 if((p.activeBuffs||[]).some(b=>!String(b.id||'').startsWith('equip:')))frames.push('#4ddc7a');
 if(isPlayerInvisible())frames.push('#9a9a9a');
 let inset=0;
 for(const color of frames){
  ctx.strokeStyle=color;ctx.lineWidth=5;
  ctx.strokeRect(x+2.5+inset,y+2.5+inset,TILE-5-inset*2,TILE-5-inset*2);
  inset+=7;
 }
 if((p.activeBuffs||[]).some(b=>String(b.id||'').startsWith('equip:'))){
  ctx.strokeStyle='#ffd45f';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,TILE-2,TILE-2);
 }
}
// The 'transform' or 'ascend' stackable effect's own author-picked icon, if
// one is currently active - takes over the hero's rendered appearance until
// it expires. Transform wins if somehow both are active at once.
function activePlayerIconOverride(){
 const buffs=game.player?.activeBuffs||[];
 return buffs.find(b=>b.effects?.transformIcon)?.effects?.transformIcon
  ||buffs.find(b=>b.effects?.ascendIcon)?.effects?.ascendIcon
  ||null;
}
function heroSprite(x,y){
 const overrideIcon=activePlayerIconOverride();
 if(overrideIcon&&drawCharacterIcon(ctx,overrideIcon,x+3,y+3,58,58,2))return;
 const icon=game.player.classIcon||classIconForId(game.player.cls);
 if(icon&&drawCharacterIcon(ctx,icon,x+3,y+3,58,58,2))return;
 const facing=game.player.facing||1,frame=game.turn%4<2?0:1;
 drawCharacter(ctx,x+32,y+34,1.18,game.player.cls,game.player.equipment,frame,facing)
}
function remotePlayerSprite(x,y,rp){
 const icon=rp.classIcon||classIconForId(rp.cls);
 if(!(icon&&drawCharacterIcon(ctx,icon,x+3,y+3,58,58,2))){
  const facing=rp.facing||1,frame=game.turn%4<2?0:1;
  drawCharacter(ctx,x+32,y+34,1.18,rp.cls||'yunque',rp.equipment||{},frame,facing);
 }
 ctx.strokeStyle='#73aaff';ctx.lineWidth=2;ctx.strokeRect(x+5,y+5,54,54);
 px(x+8,y+3,48,5,'#132433');
 px(x+8,y+3,48*Math.max(0,(rp.hp||0)/(rp.maxHp||1)),5,'#73aaff');
 ctx.fillStyle='#dce8ff';ctx.font='7px monospace';ctx.textAlign='center';
 ctx.fillText((rp.name||'JUGADOR').toUpperCase().slice(0,14),x+32,y+63);
}
function drawClassPreview(canvas,cls){
 const q=canvas.getContext('2d');q.imageSmoothingEnabled=true;q.clearRect(0,0,64,64);
 q.fillStyle='#120c18';q.fillRect(0,0,64,64);
 q.fillStyle='#25182e';for(let i=0;i<4;i++)q.fillRect(i*18,50+(i%2)*3,15,8);
 if(drawCharacterIcon(q,classIconForId(cls),3,3,58,58,2))return;
 drawCharacter(q,32,38,.85,cls,{},0,1)
}
function drawPaperDoll(canvas,p){
 const q=canvas.getContext('2d');q.imageSmoothingEnabled=true;q.clearRect(0,0,128,192);
 const grad=q.createLinearGradient(0,0,0,192);grad.addColorStop(0,'#21162b');grad.addColorStop(1,'#0d0912');q.fillStyle=grad;q.fillRect(0,0,128,192);
 q.strokeStyle='#493454';q.strokeRect(5,5,118,182);
 for(let y=12;y<188;y+=16){q.fillStyle=y%32?'#16101d':'#1a1222';q.fillRect(8,y,112,1)}
 if(p.classIcon||classIconForId(p.cls)){drawCharacterIcon(q,p.classIcon||classIconForId(p.cls),24,26,80,112,4)}else{q.save();q.translate(64,103);q.scale(2.25,2.25);drawCharacter(q,0,0,1,p.cls,p.equipment,game.turn%2,p.facing||1);q.restore();}
 q.fillStyle='#e8d8a7';q.font='6px monospace';q.textAlign='center';q.fillText((p.className||'CLASE').toUpperCase().slice(0,20),64,181)
}
function chestSprite(x,y){px(x+8,y+27,48,27,'#553018');px(x+10,y+19,44,15,'#a65d2c');px(x+14,y+21,36,4,'#d38a43');px(x+28,y+24,8,22,'#f2c456');px(x+13,y+47,38,4,'#321b12')}
// Renders the chest's own config_chest icon when it has one (same hex-icon
// pipeline used for tiles/doors); falls back to the procedural sprite only
// while that image is still loading.
function drawChestSprite(x,y,c){
 const icon=c.chestDef?.icon;
 if(icon){
  let img=tileImageCache.get(icon);
  if(!img){img=tileImageFromHex(icon);tileImageCache.set(icon,img)}
  if(img.complete){ctx.drawImage(img,x+7,y+7,TILE-14,TILE-14);return}
  img.onload=()=>game&&draw();
 }
 chestSprite(x,y);
}
function trapSprite(x,y){
 if(drawWorldObjectIcon('trap',x,y))return;
 ctx.strokeStyle='#ff9d4f';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(x+16,y+16);ctx.lineTo(x+48,y+48);ctx.moveTo(x+48,y+16);ctx.lineTo(x+16,y+48);ctx.stroke();
 ctx.strokeStyle='rgba(255,157,79,.45)';ctx.strokeRect(x+10,y+10,44,44);
}
function altarSprite(x,y,a){
 if(drawWorldObjectIcon('altar_'+a.kind,x,y))return;
 const disenchant=a.kind==='disenchant';
 const col=disenchant?'#4d7dff':a.used?'#5b6472':a.kind==='heal'?'#8dffa8':a.kind==='shield'?'#9be8ff':'#ffd45f';
 const grayed=!disenchant&&a.used;
 px(x+18,y+40,28,14,grayed?'#2a2f3a':disenchant?'#1c2d5c':'#3a4356');
 px(x+22,y+22,20,20,col);
 ctx.fillStyle=grayed?'#7d8595':'#0c0f16';ctx.font='12px monospace';ctx.textAlign='center';
 ctx.fillText(disenchant?'⚒':a.kind==='heal'?'✚':a.kind==='shield'?'▣':'✦',x+32,y+37);
}
function stairsSprite(x,y){if(drawWorldObjectIcon('stairsDown',x,y))return;for(let i=0;i<5;i++){px(x+8+i*5,y+10+i*9,48-i*10,7,shade('#9d8ba8',i*4));px(x+8+i*5,y+17+i*9,48-i*10,2,'#3b3142')}}
function doorSprite(x,y,d){px(x+8,y+5,48,57,'#2b1a16');px(x+11,y+8,42,54,d.open?'#342a23':'#8b4e2c');if(!d.open){for(let i=0;i<3;i++)px(x+15,y+13+i*15,34,3,'#5b301f');px(x+17,y+10,3,48,'#b16d3c');px(x+44,y+10,3,48,'#5e321f');px(x+39,y+34,7,7,d.locked?'#ffd24f':'#271713')}}
// Each floor's tileset can define its own door look (config_floor.doorTiles,
// same icon editor as walls/floors); replaces the generic doorSprite whenever
// one is configured, falling back to it otherwise. Locked doors get a gold
// glow hugging whatever silhouette actually gets drawn (icon or procedural).
function drawDoorTile(x,y,d){
 const doorTiles=activeFloorTileset().doorTiles;
 let painted=false;
 if(doorTiles?.length){
  const seed=(d.x*73856093^d.y*19349663)>>>0;
  painted=drawConfiguredTile(doorTiles[seed%doorTiles.length],x,y,0);
 }
 if(!painted)doorSprite(x,y,d);
 // locked doors get an unmistakable 5px gold stripe down the middle of the
 // tile, on top of whatever art was drawn (icon or procedural)
 if(d.locked)px(x+Math.floor((TILE-5)/2),y+6,5,TILE-12,'#ffd24f');
} 
function keySprite(x,y){if(drawWorldObjectIcon('key',x,y))return;px(x+14,y+28,27,7,'#d6a832');px(x+37,y+18,16,25,'#f1cb55');px(x+42,y+23,6,6,'#392614');px(x+11,y+23,7,18,'#f1cb55');px(x+7,y+27,7,5,'#f1cb55')}

function companionSprite(x,y,c){
 // Downed permanent companion: sits on its tile, greyed out, until the
 // player walks onto it to pay the revive cost (reviveCompanion via move()).
 if(c.permanent&&c.hp<=0){
  ctx.save();ctx.globalAlpha=.5;px(x+10,y+10,44,44,'#3a2224');ctx.globalAlpha=1;
  ctx.fillStyle='#ff8f8f';ctx.font='26px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('☠',x+32,y+28);
  ctx.font='9px monospace';ctx.fillText('Caído',x+32,y+50);
  ctx.restore();
  return;
 }
 const shape=c.shape||'allyCompanion';
 const R=(ox,oy,w,h,col)=>px(x+ox,y+oy,w,h,col);
 ctx.save();
 ctx.shadowColor='#70dc9b';
 ctx.shadowBlur=9;
 R(8,54,48,5,'#07140d99');

 if(c.iconImage){
  // author-picked image for a stackable 'summon'/'summonturret' effect,
  // takes over from the procedural allyX shapes below
  let img=tileImageCache.get('companion:'+c.iconImage);
  if(!img){img=tileImageFromHex(c.iconImage);tileImageCache.set('companion:'+c.iconImage,img)}
  if(img.complete)ctx.drawImage(img,x+7,y+7,50,50);else img.onload=()=>game&&draw();
 }else if(shape==='allySkeleton'){
  R(20,6,24,18,'#ded8bc');R(24,11,5,5,'#18211c');R(36,11,5,5,'#18211c');
  R(27,24,10,16,'#c7c0a5');R(15,25,9,23,'#d8d1b7');R(41,25,9,23,'#d8d1b7');
  R(23,39,6,17,'#d8d1b7');R(36,39,6,17,'#d8d1b7');
  R(48,15,3,37,'#7f6947');R(44,15,11,4,'#a58b5e');
 }else if(shape==='allyTurret'){
  R(13,29,38,20,'#657078');R(20,18,24,14,'#8e9aa3');R(42,22,17,5,'#b7c4cc');R(28,11,8,8,'#70dc9b');
 }else if(shape==='allyWolf'){
  R(9,28,39,17,'#66766d');R(39,17,18,17,'#77897f');R(42,10,7,10,'#77897f');R(52,10,7,10,'#77897f');
  R(43,22,4,4,'#d6ff8e');R(51,22,4,4,'#d6ff8e');R(13,43,6,13,'#5b6961');R(39,43,6,13,'#5b6961');
 }else if(shape==='allyHealer'){
  R(21,7,22,17,'#d9e8e2');R(17,24,30,27,'#6d8f87');R(29,31,7,7,'#9fffd2');
  R(50,10,3,40,'#c5b16d');R(46,10,11,5,'#9fffd2');
 }else if(shape==='allyTank'){
  R(15,12,34,40,'#536b62');R(8,23,13,27,'#708a80');R(44,23,13,27,'#708a80');R(25,18,6,6,'#b7f3d2');R(37,18,6,6,'#b7f3d2');
 }else if(shape==='allyClone'){
  ctx.globalAlpha=.72;R(18,9,28,19,'#8a72d8');R(14,28,36,25,'#4d3f87');R(23,14,5,5,'#d9ccff');R(36,14,5,5,'#d9ccff');ctx.globalAlpha=1;
 }else{
  R(18,10,28,19,'#9fc8b4');R(14,29,36,24,'#527565');R(24,15,5,5,'#13231c');R(36,15,5,5,'#13231c');
 }

 ctx.restore();

 // marco aliado y barra de vida
 ctx.strokeStyle='#70dc9b';ctx.lineWidth=2;ctx.strokeRect(x+5,y+5,54,54);
 R(8,3,48,5,'#163323');
 R(8,3,48*Math.max(0,c.hp/c.maxHp),5,'#70dc9b');
 ctx.fillStyle='#d7ffe5';ctx.font='7px monospace';ctx.textAlign='center';
 ctx.fillText((c.name||'ALIADO').toUpperCase().slice(0,14),x+32,y+63);
}

function enemySprite(x,y,e){
 // some configured enemies (elites especially, since they're built by boosting
 // an already-built enemy rather than a separate template) can end up with no
 // icon of their own - fall back to their base template's icon instead of
 // rendering fully transparent
 if(e.customEnemy&&!e.icon){const t=configuredEnemyTemplateFor(e);if(t?.icon)e.icon=t.icon}
 if(e.customEnemy&&drawEnemyIconHex(e.icon,x,y,e.boss,e.megaboss)){enemyStatusOverlay(x,y,e);return}
 const d=enemyDefs[e.type]||{},shape=d.shape||d.sprite||e.type,c=d.color||({
  cultist:'#8c3b31',slagBeast:'#754032',fireImp:'#d84a2e',chainKnight:'#59606a',magmaPriest:'#8d392a',ashGolem:'#6c625c',
  FurnaceTyrant:'#9b3f24',voidClerk:'#4b416f',phaseHound:'#51466f',dataWraith:'#4b65a2',nullMage:'#34265f',quantumGuard:'#4d587c',errorSpawn:'#8a3f85',NullArchivist:'#3a2864'
 }[shape]||'#866080'),a=d.accent||({
  cultist:'#ff8a42',slagBeast:'#f2693d',fireImp:'#ffd158',chainKnight:'#d7a65b',magmaPriest:'#ffca55',ashGolem:'#d17749',
  FurnaceTyrant:'#ffb33f',voidClerk:'#c07cff',phaseHound:'#59e6ef',dataWraith:'#66f1da',nullMage:'#e36aff',quantumGuard:'#7ce2ef',errorSpawn:'#ff5ccf',NullArchivist:'#60e6e0'
 }[shape]||'#ffd36a');
 const R=(ox,oy,w,h,col)=>px(x+ox,y+oy,w,h,col);
 R(10,53,44,6,'#08060999');
 if(['goblin','cultist','voidClerk'].includes(shape)){R(17,20,30,29,c);R(11,17,10,13,c);R(43,17,10,13,c);R(20,12,24,10,shade(c,14));R(22,28,6,5,a);R(36,28,6,5,a);R(22,43,20,4,shade(c,-20));if(shape==='cultist'){R(14,10,36,8,'#39161c');R(7,26,8,27,'#7a3327')}if(shape==='voidClerk'){R(12,43,40,10,'#25203d');R(26,13,12,5,a)}}
 else if(['orc','bossOrc','chainKnight','quantumGuard'].includes(shape)){R(10,18,44,37,c);R(4,28,13,24,c);R(47,28,13,24,c);R(17,12,30,11,shade(c,15));R(19,29,7,6,a);R(38,29,7,6,a);R(23,43,18,5,shade(c,-25));if(['chainKnight','quantumGuard'].includes(shape)){R(8,16,48,9,shade(c,20));R(13,25,38,19,shade(c,-8));for(let i=0;i<4;i++)R(15+i*9,28,5,5,a)}if(d.boss||e.boss){R(7,7,50,9,a);R(13,3,7,8,a);R(44,3,7,8,a)}}
 else if(['wolf','phaseHound','slagBeast'].includes(shape)){R(9,30,45,22,c);R(36,18,23,24,c);R(44,12,6,10,c);R(54,17,6,12,c);R(48,26,5,5,a);R(12,49,8,11,shade(c,-15));R(42,49,8,11,shade(c,-15));R(4,34,10,6,shade(c,-10));if(shape==='phaseHound'){R(13,27,8,3,a);R(25,34,8,3,a);R(38,41,8,3,a)}if(shape==='slagBeast'){R(15,24,8,7,'#e75b37');R(28,22,9,6,'#e75b37')}}
 else if(shape==='rider'){R(6,36,52,20,a);R(12,28,40,13,shade(a,-10));R(21,14,28,27,c);R(18,9,8,10,c);R(43,9,8,10,c);R(27,23,6,5,'#f4cf58')}
 else if(['bomber','fireImp','errorSpawn'].includes(shape)){R(15,19,34,34,c);R(7,25,11,19,a);R(46,25,11,19,a);R(23,10,18,13,shade(a,10));R(22,29,6,6,'#1c1017');R(36,29,6,6,'#1c1017');if(shape==='errorSpawn'){for(let i=0;i<5;i++)R(5+rng(50),8+rng(45),5+rng(9),3,a)}}
 else if(['shaman','magmaPriest','nullMage'].includes(shape)){R(17,20,30,35,c);R(22,13,20,12,shade(c,12));R(25,28,6,5,a);R(36,28,6,5,a);R(7,18,5,40,'#765037');R(2,10,15,15,a);R(19,48,26,10,shade(c,-18));if(shape==='magmaPriest'){R(21,7,22,7,'#ff6937')}if(shape==='nullMage'){R(13,15,38,4,a);R(28,5,8,12,a)}}
 else if(['ghoul','ashGolem'].includes(shape)){R(14,15,36,40,c);R(6,35,18,9,c);R(40,35,18,9,c);R(20,24,6,6,a);R(38,24,6,6,a);R(22,42,20,5,shade(c,-20));if(shape==='ashGolem'){R(8,12,48,12,shade(c,-10));R(10,46,44,10,shade(c,-15));R(19,18,7,7,'#e55a32');R(38,18,7,7,'#e55a32')}}
 else if(['vampire','dataWraith'].includes(shape)){R(18,13,28,40,c);R(7,21,18,35,shade(c,-25));R(39,21,18,35,shade(c,-25));R(23,21,5,5,a);R(36,21,5,5,a);R(27,35,10,4,'#e5d5cc');if(shape==='dataWraith'){ctx.globalAlpha=.55;R(10,9,44,48,a);ctx.globalAlpha=1}}
 else if(shape==='mummy'){R(17,10,30,46,c);for(let i=0;i<6;i++)R(13,13+i*8,38,4,a);R(22,19,5,5,'#151015');R(38,19,5,5,'#151015')}
 else if(['lich','madlich','bossLich','NullArchivist'].includes(shape)){R(18,12,28,40,c);R(12,34,40,24,shade(c,-28));R(23,20,6,6,a);R(36,20,6,6,a);R(5,8,7,48,a);R(2,5,13,12,shade(a,15));if(d.boss||e.boss){R(9,5,46,8,a);R(14,1,7,7,a);R(43,1,7,7,a)}if(shape==='NullArchivist'){R(18,39,28,4,'#60e6e0');R(26,10,12,4,'#ff5bd6')}}
 else if(['abomination','FurnaceTyrant'].includes(shape)){R(7,11,50,45,c);R(1,22,15,31,a);R(48,18,15,37,a);for(let i=0;i<3;i++)R(17+i*13,24,7,7,'#ffe57a');if(shape==='FurnaceTyrant'){R(12,7,40,9,'#5a2116');R(18,43,28,8,'#ff6537')}}
 enemyStatusOverlay(x,y,e);
}
// colored border by enemy tier (boss overrides tier coloring with red);
// elites additionally get an inner orange border, inside the tier border.
// Shared by both the hand-drawn sprite path and the icon-hex (customEnemy)
// path, which used to skip it entirely.
function enemyStatusOverlay(x,y,e){
 const R=(ox,oy,w,h,col)=>px(x+ox,y+oy,w,h,col);
 if(e.megaboss){
  // Red frame + health bar sized to the full 2x2 block instead of one tile.
  const box=TILE*2;ctx.strokeStyle='#ff4d4d';ctx.lineWidth=4;ctx.strokeRect(x+4,y+4,box-8,box-8);
  if(e.hp<e.maxHp){R(8,box-6,box-16,7,'#330d14');R(8,box-6,(box-16)*Math.max(0,e.hp/e.maxHp),7,'#e45c68')}
  return;
 }
 if(e.boss){ctx.strokeStyle='#ff4d4d';ctx.lineWidth=3;ctx.strokeRect(x+3,y+3,58,58)}
 else{ctx.strokeStyle=ENEMY_TIER_BORDER_COLORS[e.tier]||ENEMY_TIER_BORDER_COLORS.i;ctx.lineWidth=2;ctx.strokeRect(x+5,y+5,54,54)}
 if(e.elite){ctx.strokeStyle='#ff8c1a';ctx.lineWidth=2;ctx.strokeRect(x+9,y+9,46,46)}
 if(e.hp<e.maxHp){R(8,58,48,5,'#330d14');R(8,58,48*Math.max(0,e.hp/e.maxHp),5,'#e45c68')}
}



function normalizeClassName(name){return String(name||'').trim().toLowerCase()}
function configClassRowForId(id){const def=classDefs[id];const wanted=normalizeClassName(def?.name||id);return configClasses.find(c=>String(c.class_json?.classId||'')===id)||configClasses.find(c=>normalizeClassName(c.nombre)===wanted)}
function classIconForId(id){const row=configClassRowForId(id);return row?.class_json?.icon||row?.icon||''}
// A class def, whether hardcoded (classDefs) or a fully custom one that only
// exists as a config_class row (no matching classDefs entry at all).
function resolveClassDef(id){
 const base=classDefs[id],row=configClassRowForId(id),j=row?.class_json;
 if(!base&&!j)return null;
 // a DB override (stats edited in the class editor) always wins over the
 // hardcoded baseline, for both built-in and fully custom classes
 return {
  name:j?.name||base?.name||id,
  desc:j?.desc||base?.desc||'Clase personalizada.',
  // merge over full defaults (not just fall back when the whole stats
  // object is missing) - a custom Advanced-mode class saved with a partial
  // stats blob (e.g. missing agility) must not leave that stat undefined,
  // which cascades into NaN vision/maxHp/maxStamina/etc at character creation
  stats:{strength:2,vitality:2,agility:2,luck:2,intelligence:2,wisdom:2,...(j?.stats||base?.stats||{})},
  skills:j?.starterSkills||base?.skills||[],
  resourceBias:j?.resourceBias||base?.resourceBias||'stamina',
  custom:!base
 };
}
function allClassIds(){
 const ids=new Set(Object.keys(classDefs));
 for(const row of configClasses){const cid=row.class_json?.classId;if(cid&&!classDefs[cid])ids.add(cid)}
 return [...ids];
}

