(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.DungeonInteriors=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SPECIAL_TYPES={creator:'craft',soulmerchant:'merchant',shrine:'rest',prep:'rest',vault:'treasure',arena:'horde',bossarena:'boss',eliteden:'treasure',traproom:'maze'};
 const EXTRA_TYPES=['alchemist','cave','maze','horde','treasure'];
 const GEOMETRIES=['square','rectangular','alcoves','irregular','cross'];
 const key=(x,y)=>`${x},${y}`;
 function parseDoor(value,cols,rows){const m=String(value||'').match(/^\s*(\d+)\s*[;,]\s*(\d+)\s*$/);if(!m)return null;const x=+m[1],y=+m[2];return x>=0&&y>=0&&x<cols&&y<rows?{x,y}:null}
 function inside(r,p){return p&&p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h}
 function carveInterior(rows,cols,source,type,random){
  const map=Array.from({length:rows},()=>Array(cols).fill(1));
  const w=Math.max(5,Math.min(cols-4,source.w+(type==='cave'?4:0))),h=Math.max(5,Math.min(rows-4,source.h+(type==='cave'?4:0)));
  const x=Math.floor((cols-w)/2),y=Math.floor((rows-h)/2),geometry=GEOMETRIES[Math.floor(random()*GEOMETRIES.length)];
  for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){
   let open=true;
   if(geometry==='irregular'&&((px===x||px===x+w-1)&&(py===y||py===y+h-1)))open=false;
   if(geometry==='cross'){const inV=px>=x+Math.floor(w*.3)&&px<x+Math.ceil(w*.7),inH=py>=y+Math.floor(h*.3)&&py<y+Math.ceil(h*.7);open=inV||inH}
   if(open)map[py][px]=0;
  }
  const door={x:x+Math.floor(w/2),y:y+h-1};map[door.y][door.x]=0;
  return {map,room:{x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2),type:source.type},door,spawn:{x:door.x,y:Math.max(y,door.y-1)},geometry};
 }
 function takeInRoom(list,room){const selected=[],remaining=[];for(const item of list||[])(inside(room,item)?selected:remaining).push(item);return{selected,remaining}}
 function enhanceFloor(plan,{assets=[],interiorFloors=[],random=Math.random}={}){
  if(!plan?.rooms||!plan?.map||!interiorFloors.length)return plan;
  const doorAssets=assets.map(a=>({...a,doorTile:parseDoor(a.door,a.cols,a.rows)})).filter(a=>a.doorTile&&(a.doorTile.x===0||a.doorTile.y===0||a.doorTile.x===a.cols-1||a.doorTile.y===a.rows-1));
  if(!doorAssets.length)return plan;
  const rows=plan.map.length,cols=plan.map[0]?.length||0,entrances=[],interiors=[];
  for(const room of plan.rooms){
   if(room===plan.rooms[0]||inside(room,plan.stairs)||room.w<4||room.h<4)continue;
   const fitting=doorAssets.filter(a=>a.cols<=room.w-2&&a.rows<=room.h-2);if(!fitting.length)continue;
   const asset=fitting[Math.floor(random()*fitting.length)],ox=room.x+Math.floor((room.w-asset.cols)/2),oy=room.y+Math.floor((room.h-asset.rows)/2);
   const entrance={x:ox+asset.doorTile.x,y:oy+asset.doorTile.y};
   if(entrance.x===plan.spawn?.x&&entrance.y===plan.spawn?.y)continue;
   const safeIndex=(plan.safeRooms||[]).findIndex(r=>r.x===room.x&&r.y===room.y),isSafe=safeIndex>=0;
   const type=SPECIAL_TYPES[room.type]||(isSafe?'rest':(random()<.28?EXTRA_TYPES[Math.floor(random()*EXTRA_TYPES.length)]:'combat'));
   const shape=carveInterior(rows,cols,room,type,random),tileset=interiorFloors[Math.floor(random()*interiorFloors.length)];
   const id=`interior-${plan.floor||0}-${interiors.length}`,state={map:shape.map,rooms:[shape.room],safeRooms:isSafe?[{...shape.room,id:`safe-${id}`,rested:false}]:[],stairs:{x:-1,y:-1},doors:[{...shape.door,open:true,locked:false,interiorExit:true}],keys:[],chests:[],traps:[],altars:[],assets:[],enemies:[],boss:null,spawn:shape.spawn,floorTileset:tileset,seen:Array.from({length:rows},()=>Array(cols).fill(false))};
   for(const field of ['chests','traps','altars','enemies']){const moved=takeInRoom(plan[field],room);plan[field]=moved.remaining;state[field]=moved.selected}
   const occupied=new Set([key(shape.spawn.x,shape.spawn.y),key(shape.door.x,shape.door.y)]),free=[];
   for(let y=shape.room.y+1;y<shape.room.y+shape.room.h-1;y++)for(let x=shape.room.x+1;x<shape.room.x+shape.room.w-1;x++)if(shape.map[y][x]===0)free.push({x,y});
   for(const field of ['chests','traps','altars','enemies'])for(const entity of state[field]){let p=free.find(c=>!occupied.has(key(c.x,c.y)));if(!p)p=shape.spawn;entity.x=p.x;entity.y=p.y;occupied.add(key(p.x,p.y))}
   if(plan.boss&&state.enemies.includes(plan.boss)){state.boss=plan.boss;plan.boss=null}
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
 return {enhanceFloor,parseDoor,SPECIAL_TYPES,EXTRA_TYPES};
});
