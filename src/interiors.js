(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.DungeonInteriors=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SPECIAL_TYPES={creator:'craft',soulmerchant:'merchant',shrine:'rest',prep:'rest',vault:'treasure',arena:'horde',bossarena:'boss',eliteden:'treasure',traproom:'maze'};
 const EXTRA_TYPES=['alchemist','cave','maze','horde','treasure'];
 const GEOMETRIES=['square','rectangular','alcoves','irregular','cross'];
 // [lo,hiAtFloor1] a mini-floor's width/height are independently rolled from -
 // hi grows toward 50 as the dungeon floor deepens (see interiorSpan).
 const SIZE_RANGE={rest:[9,15],craft:[9,14],merchant:[9,14],combat:[10,18],treasure:[12,24],horde:[15,30],boss:[16,34],alchemist:[10,18],cave:[13,28],maze:[13,32]};
 // The feature room (farthest from the entrance) gets this interior's real
 // content; every other sub-room gets a lighter pass so a big interior reads
 // as populated throughout instead of "one busy room, empty halls".
 const ROOM_FLAVOR={
  rest:{altar:.9,chest:.15,enemies:[0,0],traps:0},
  craft:{altar:.9,chest:.15,enemies:[0,0],traps:0},
  merchant:{altar:.9,chest:.1,enemies:[0,1],traps:0},
  treasure:{chest:1,chests:[1,3],enemies:[1,3],traps:.4,locked:true},
  horde:{chest:.25,enemies:[4,8],traps:.15},
  boss:{chest:.35,enemies:[1,1],traps:0,boss:true},
  alchemist:{chest:.3,enemies:[1,3],traps:.2},
  cave:{chest:.25,enemies:[2,5],traps:.3},
  maze:{chest:.2,enemies:[1,3],traps:.45},
  combat:{chest:.25,enemies:[2,4],traps:.15}
 };
 const PEACEFUL_TYPES=new Set(['rest','craft','merchant']);
 const PEACEFUL_SECONDARY={chest:.12,enemies:[0,0],traps:0};
 const LIVELY_SECONDARY={chest:.15,enemies:[0,2],traps:.12};
 const key=(x,y)=>`${x},${y}`;
 const rint=(random,n)=>Math.floor(random()*Math.max(1,n));
 const between=(random,a,b)=>a+rint(random,Math.max(1,b-a+1));
 function parseDoor(value,cols,rows){const m=String(value||'').match(/^\s*(\d+)\s*[;,]\s*(\d+)\s*$/);if(!m)return null;const x=+m[1],y=+m[2];return x>=0&&y>=0&&x<cols&&y<rows?{x,y}:null}
 function isDoorAsset(a){const d=parseDoor(a.door,a.cols,a.rows);return !!d&&(d.x===0||d.y===0||d.x===a.cols-1||d.y===a.rows-1)}
 function inside(r,p){return !!(r&&p&&p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h)}
 // 1-cell padded version of inside(): used only to keep a boss enemy's own
 // room out of the interior pool even if it got nudged just outside its
 // room's rect (nearestFreeCellForBoss can do that when the centre tile was
 // already claimed) - the exterior "kill the boss to unseal the exit"
 // objective must never end up hidden behind an interior door.
 function insideExpanded(r,p){return !!(r&&p&&p.x>=r.x-1&&p.x<r.x+r.w+1&&p.y>=r.y-1&&p.y<r.y+r.h+1)}
 function takeInRoom(list,room){const selected=[],remaining=[];for(const item of list||[])(inside(room,item)?selected:remaining).push(item);return{selected,remaining}}

 function interiorSpan(type,floor,totalFloors,random){
  const [lo,hi]=SIZE_RANGE[type]||[9,18];
  const depth=Math.max(0,Math.min(1,((floor||1)-1)/Math.max(1,(totalFloors||20)-1)));
  const grownHi=Math.min(50,Math.round(hi+(50-hi)*depth));
  return Math.max(9,Math.min(50,lo+rint(random,grownHi-lo+1)));
 }
 function interiorDims(type,floor,totalFloors,random){
  let width=interiorSpan(type,floor,totalFloors,random),height=interiorSpan(type,floor,totalFloors,random);
  if(width>height*2.2)width=Math.round(height*2.2);
  if(height>width*2.2)height=Math.round(width*2.2);
  return {width:Math.max(9,Math.min(50,width)),height:Math.max(9,Math.min(50,height))};
 }

 // Compact interiors stay one hand-shaped room (existing square/rectangular/
 // alcoves/irregular/cross variety, unchanged). Door/spawn sit on the room's
 // own bottom row, exactly as before this file grew a multi-room mode.
 function singleRoomLayout(width,height,random){
  const map=Array.from({length:height},()=>Array(width).fill(1)),room={x:1,y:1,w:width-2,h:height-2};
  room.cx=1+Math.floor(room.w/2);room.cy=1+Math.floor(room.h/2);
  const geometry=GEOMETRIES[rint(random,GEOMETRIES.length)];
  for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++){
   let open=true;
   if(geometry==='irregular'&&((x===room.x||x===room.x+room.w-1)&&(y===room.y||y===room.y+room.h-1)))open=false;
   if(geometry==='cross'){const inV=x>=room.x+Math.floor(room.w*.3)&&x<room.x+Math.ceil(room.w*.7),inH=y>=room.y+Math.floor(room.h*.3)&&y<room.y+Math.ceil(room.h*.7);open=inV||inH}
   if(open)map[y][x]=0;
  }
  const door={x:room.cx,y:room.y+room.h-1};map[door.y][door.x]=0;
  const spawn={x:door.x,y:Math.max(room.y,door.y-1)};
  return {map,rooms:[room],entranceRoom:room,featureRoom:room,door,spawn,geometry};
 }
 // Real sub-dungeon for bigger interiors ("subsalas"): rectangular rooms
 // placed without overlap, connected in sequence (guarantees every room is
 // reachable) plus a couple of extra loop connections on larger layouts. The
 // entrance is a stub corridor down to the outer edge from whichever room
 // sits closest to the south side; the feature room (this interior's real
 // content) is whichever room sits farthest from that entrance.
 function multiRoomLayout(width,height,random){
  const area=width*height,roomCount=Math.max(2,Math.min(12,Math.round(area/140)));
  const map=Array.from({length:height},()=>Array(width).fill(1)),rooms=[];
  const span=Math.max(5,Math.min(14,Math.round(Math.min(width,height)/Math.ceil(Math.sqrt(roomCount))+2)));
  const overlaps=(x,y,w,h)=>rooms.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y);
  for(let tries=0;tries<600&&rooms.length<roomCount;tries++){
   const w=between(random,4,Math.min(span,width-2)),h=between(random,4,Math.min(span,height-2));
   const x=1+rint(random,Math.max(1,width-w-1)),y=1+rint(random,Math.max(1,height-h-1));
   if(x+w>width-1||y+h>height-1||overlaps(x,y,w,h))continue;
   const room={x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)};
   rooms.push(room);
   for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)map[yy][xx]=0;
  }
  if(!rooms.length){
   const x=1,y=1,w=width-2,h=height-2;
   rooms.push({x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)});
   for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)map[yy][xx]=0;
  }
  const carveCorridor=(a,b)=>{let x=a.cx,y=a.cy;if(random()<.5){while(x!==b.cx){map[y][x]=0;x+=Math.sign(b.cx-x)}while(y!==b.cy){map[y][x]=0;y+=Math.sign(b.cy-y)}}else{while(y!==b.cy){map[y][x]=0;y+=Math.sign(b.cy-y)}while(x!==b.cx){map[y][x]=0;x+=Math.sign(b.cx-x)}}};
  for(let i=1;i<rooms.length;i++)carveCorridor(rooms[i-1],rooms[i]);
  const loops=Math.min(3,Math.max(0,rooms.length-3));
  for(let i=0;i<loops;i++){const a=rooms[rint(random,rooms.length)],b=rooms[rint(random,rooms.length)];if(a!==b)carveCorridor(a,b)}
  const entranceRoom=[...rooms].sort((a,b)=>(b.y+b.h)-(a.y+a.h))[0];
  const doorX=Math.min(width-2,Math.max(1,entranceRoom.cx));
  for(let y=entranceRoom.y+entranceRoom.h;y<height-1;y++)map[y][doorX]=0;
  const door={x:doorX,y:height-1};map[door.y][door.x]=0;
  const spawn={x:doorX,y:Math.max(entranceRoom.y,door.y-1)};
  const dist=r=>Math.abs(r.cx-entranceRoom.cx)+Math.abs(r.cy-entranceRoom.cy);
  const featureRoom=rooms.length>1?[...rooms].sort((a,b)=>dist(b)-dist(a))[0]:entranceRoom;
  return {map,rooms,entranceRoom,featureRoom,door,spawn,geometry:'rooms'};
 }
 function buildLayout(type,floor,totalFloors,random){
  const {width,height}=interiorDims(type,floor,totalFloors,random);
  return width*height<=150?singleRoomLayout(width,height,random):multiRoomLayout(width,height,random);
 }

 // Room rects can contain wall cells too (the 'irregular'/'cross' single-room
 // geometries carve only part of their own bounding rect), so this only ever
 // yields cells the map actually marks as floor (0).
 function shuffledCells(room,map,random){
  const cells=[];for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++)if(map[y][x]===0)cells.push({x,y});
  for(let i=cells.length-1;i>0;i--){const j=rint(random,i+1),t=cells[i];cells[i]=cells[j];cells[j]=t}
  return cells;
 }
 // Per-room content pass, additive on top of whatever the original exterior
 // room already contributed via takeInRoom - this is what actually fills the
 // extra square footage a bigger interior/its sub-rooms bring in.
 function populateInterior(shape,type,floor,random,makeEnemy,occupied){
  const queues=new Map(shape.rooms.map(r=>[r,shuffledCells(r,shape.map,random)]));
  const take=room=>{const q=queues.get(room);while(q.length){const p=q.shift();if(!occupied.has(key(p.x,p.y))){occupied.add(key(p.x,p.y));return p}}return null};
  const state={chests:[],traps:[],altars:[],enemies:[],boss:null};
  const peaceful=PEACEFUL_TYPES.has(type);
  for(const room of shape.rooms){
   const isFeature=room===shape.featureRoom;
   const flavor=isFeature?(ROOM_FLAVOR[type]||ROOM_FLAVOR.combat):(peaceful?PEACEFUL_SECONDARY:LIVELY_SECONDARY);
   if(flavor.traps&&random()<flavor.traps){
    const n=1+rint(random,2);
    for(let i=0;i<n;i++){const p=take(room);if(p)state.traps.push({...p,dmg:Math.max(3,Math.round(4+floor*1.6)),revealed:false,sprung:false})}
   }
   if(flavor.altar&&random()<.9){const p=take(room);if(p)state.altars.push({...p,kind:type==='merchant'?'soulmerchant':type==='craft'?'disenchant':['heal','shield','power'][rint(random,3)],used:false})}
   const chestN=flavor.chests?between(random,flavor.chests[0],flavor.chests[1]):(random()<(flavor.chest||0)?1:0);
   for(let i=0;i<chestN;i++){const p=take(room);if(p)state.chests.push({x:p.x,y:p.y,opened:false,locked:!!flavor.locked&&random()<.5})}
   if(makeEnemy){
    const [eLo,eHi]=flavor.enemies||[0,0],eN=eHi>0?between(random,eLo,eHi):0;
    for(let i=0;i<eN;i++){
     const p=take(room);if(!p)break;
     const wantBoss=!!(flavor.boss&&i===0);
     const enemy=makeEnemy(p,type,{wantBoss});
     if(!enemy)break;
     if(wantBoss){enemy.boss=true;state.boss=enemy}
     state.enemies.push(enemy);
    }
   }
  }
  return state;
 }

 function enhanceFloor(plan,{assets=[],interiorFloors=[],makeEnemy=null,random=Math.random,totalFloors}={}){
  if(!plan?.rooms||!plan?.map||!interiorFloors.length)return plan;
  const doorAssets=assets.map(a=>({...a,doorTile:parseDoor(a.door,a.cols,a.rows)})).filter(a=>a.doorTile&&isDoorAsset(a));
  if(!doorAssets.length)return plan;
  const floor=plan.floor||1,total=totalFloors||20;
  // A room holding a boss enemy (the single main boss, or one of bossRush's
  // chained arena bosses) must never become an interior: the "kill the boss"
  // objective/exit-seal logic only ever looks at the exterior's own
  // game.enemies, so a boss tucked behind a door would make that objective
  // unwinnable-by-design instead of just hidden.
  const bossEnemies=(plan.enemies||[]).filter(e=>e.boss);
  const eligible=room=>room!==plan.rooms[0]&&!inside(room,plan.stairs)&&room.w>=4&&room.h>=4&&!bossEnemies.some(b=>insideExpanded(room,b));
  // Every special-type room (rest/craft/merchant/treasure/horde/boss/maze -
  // see SPECIAL_TYPES) is mandatory: those typologies may only ever exist
  // behind an interior door now, so none of them are capped or skipped.
  const mandatory=plan.rooms.filter(r=>SPECIAL_TYPES[r.type]&&eligible(r)).sort(()=>random()-.5);
  // Ordinary rooms still get a proportional (not capped-at-5) scoop of bonus
  // flavoured interiors on top, same spirit as before - just uncapped.
  const bonusPool=plan.rooms.filter(r=>!SPECIAL_TYPES[r.type]&&eligible(r)).sort(()=>random()-.5);
  const bonusTarget=Math.max(2,Math.round(plan.rooms.length*.18));
  const candidates=[...mandatory,...bonusPool.slice(0,bonusTarget)];
  const interiors=[],entrances=[];
  for(const room of candidates){
   const fitting=doorAssets.filter(a=>a.cols<=room.w-2&&a.rows<=room.h-2);
   if(!fitting.length)continue; // no configured door asset small enough for this room - leave it as-is (opt-in system)
   const asset=fitting[rint(random,fitting.length)],ox=room.x+Math.floor((room.w-asset.cols)/2),oy=room.y+Math.floor((room.h-asset.rows)/2);
   const entrance={x:ox+asset.doorTile.x,y:oy+asset.doorTile.y};
   if(entrance.x===plan.spawn?.x&&entrance.y===plan.spawn?.y)continue;
   const safeIndex=(plan.safeRooms||[]).findIndex(r=>r.x===room.x&&r.y===room.y),isSafe=safeIndex>=0;
   const type=SPECIAL_TYPES[room.type]||(isSafe?'rest':(random()<.28?EXTRA_TYPES[rint(random,EXTRA_TYPES.length)]:'combat'));
   const shape=buildLayout(type,floor,total,random),tileset=interiorFloors[rint(random,interiorFloors.length)];
   const id=`interior-${floor}-${interiors.length}`;
   const secondaryType=PEACEFUL_TYPES.has(type)?'filler':'combat';
   for(const r of shape.rooms)r.type=r===shape.featureRoom?type:secondaryType;
   const state={map:shape.map,rooms:shape.rooms,safeRooms:isSafe?[{...shape.featureRoom,id:`safe-${id}`,rested:false}]:[],stairs:{x:-1,y:-1},doors:[{...shape.door,open:true,locked:false,interiorExit:true}],keys:[],chests:[],traps:[],altars:[],assets:[],enemies:[],boss:null,spawn:shape.spawn,floorTileset:tileset,seen:Array.from({length:shape.map.length},()=>Array(shape.map[0].length).fill(false))};
   for(const field of ['chests','traps','altars','enemies']){const moved=takeInRoom(plan[field],room);plan[field]=moved.remaining;state[field]=moved.selected}
   const occupied=new Set([key(shape.spawn.x,shape.spawn.y),key(shape.door.x,shape.door.y)]);
   const orderedRooms=[shape.featureRoom,...shape.rooms.filter(r=>r!==shape.featureRoom)],flatPool=[];
   for(const r of orderedRooms)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)if(shape.map[y][x]===0)flatPool.push({x,y});
   for(const field of ['chests','traps','altars','enemies'])for(const entity of state[field]){let p=flatPool.find(c=>!occupied.has(key(c.x,c.y)));if(!p)p=shape.spawn;entity.x=p.x;entity.y=p.y;occupied.add(key(p.x,p.y))}
   const extra=populateInterior(shape,type,floor,random,makeEnemy,occupied);
   state.chests.push(...extra.chests);state.traps.push(...extra.traps);state.altars.push(...extra.altars);state.enemies.push(...extra.enemies);
   if(extra.boss)state.boss=extra.boss;
   plan.assets=plan.assets.filter(a=>!inside(room,a));plan.doors=(plan.doors||[]).filter(d=>!inside(room,d));
   for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++)plan.map[y][x]=0;
   for(let dy=0;dy<asset.rows;dy++)for(let dx=0;dx<asset.cols;dx++){const x=ox+dx,y=oy+dy;plan.map[y][x]=(dx===asset.doorTile.x&&dy===asset.doorTile.y)?0:(asset.mask?.[dy]?.[dx]===false?0:1)}
   const placement={key:asset.key,name:asset.name,x:ox,y:oy,cols:asset.cols,rows:asset.rows,interiorId:id,doorTile:{...asset.doorTile}};plan.assets.push(placement);
   const interior={id,type,geometry:shape.geometry,doorAsset:{key:asset.key,name:asset.name,tile:{...asset.doorTile}},floorTileset:{dbId:tileset.dbId||tileset.id||null,name:tileset.name},state};
   const summary={id,type,geometry:shape.geometry,doorAsset:interior.doorAsset,floorTileset:interior.floorTileset};room.interior=summary;interiors.push(summary);entrances.push({...entrance,interiorId:id,assetKey:asset.key,interior});
   if(isSafe)plan.safeRooms.splice(safeIndex,1);
  }
  plan.interiors=interiors;plan.interiorEntrances=entrances;return plan;
 }
 return {enhanceFloor,parseDoor,isDoorAsset,SPECIAL_TYPES,EXTRA_TYPES};
});
