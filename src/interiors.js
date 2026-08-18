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
 function carveInterior(source,type,random){
  const width=Math.max(9,Math.min(23,source.w+(type==='cave'?6:4))),height=Math.max(9,Math.min(23,source.h+(type==='cave'?6:4)));
  const map=Array.from({length:height},()=>Array(width).fill(1)),room={x:1,y:1,w:width-2,h:height-2,type:source.type};
  room.cx=1+Math.floor(room.w/2);room.cy=1+Math.floor(room.h/2);
  const geometry=GEOMETRIES[Math.floor(random()*GEOMETRIES.length)];
  for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++){
   let open=true;
   if(geometry==='irregular'&&((x===room.x||x===room.x+room.w-1)&&(y===room.y||y===room.y+room.h-1)))open=false;
   if(geometry==='cross'){const inV=x>=room.x+Math.floor(room.w*.3)&&x<room.x+Math.ceil(room.w*.7),inH=y>=room.y+Math.floor(room.h*.3)&&y<room.y+Math.ceil(room.h*.7);open=inV||inH}
   if(open)map[y][x]=0;
  }
  const door={x:room.cx,y:room.y+room.h-1};map[door.y][door.x]=0;
  return {map,room,door,spawn:{x:door.x,y:Math.max(room.y,door.y-1)},geometry};
 }
 function takeInRoom(list,room){const selected=[],remaining=[];for(const item of list||[])(inside(room,item)?selected:remaining).push(item);return{selected,remaining}}
 function enhanceFloor(plan,{assets=[],interiorFloors=[],makeEnemy=null,random=Math.random}={}){
  if(!plan?.rooms||!plan?.map||!interiorFloors.length)return plan;
  const doorAssets=assets.map(a=>({...a,doorTile:parseDoor(a.door,a.cols,a.rows)})).filter(a=>a.doorTile&&(a.doorTile.x===0||a.doorTile.y===0||a.doorTile.x===a.cols-1||a.doorTile.y===a.rows-1));
  if(!doorAssets.length)return plan;
  const entrances=[],interiors=[];
  const candidates=plan.rooms.filter(room=>room!==plan.rooms[0]&&!inside(room,plan.stairs)&&room.w>=4&&room.h>=4).sort((a,b)=>(SPECIAL_TYPES[b.type]?1:0)-(SPECIAL_TYPES[a.type]?1:0)||random()-.5);
  const target=Math.min(5,Math.max(2,Math.round(plan.rooms.length*.18)));
  for(const room of candidates){
   if(interiors.length>=target)break;
   const fitting=doorAssets.filter(a=>a.cols<=room.w-2&&a.rows<=room.h-2);if(!fitting.length)continue;
   const asset=fitting[Math.floor(random()*fitting.length)],ox=room.x+Math.floor((room.w-asset.cols)/2),oy=room.y+Math.floor((room.h-asset.rows)/2);
   const entrance={x:ox+asset.doorTile.x,y:oy+asset.doorTile.y};
   if(entrance.x===plan.spawn?.x&&entrance.y===plan.spawn?.y)continue;
   const safeIndex=(plan.safeRooms||[]).findIndex(r=>r.x===room.x&&r.y===room.y),isSafe=safeIndex>=0;
   const type=SPECIAL_TYPES[room.type]||(isSafe?'rest':(random()<.28?EXTRA_TYPES[Math.floor(random()*EXTRA_TYPES.length)]:'combat'));
   const shape=carveInterior(room,type,random),tileset=interiorFloors[Math.floor(random()*interiorFloors.length)];
   const id=`interior-${plan.floor||0}-${interiors.length}`,state={map:shape.map,rooms:[shape.room],safeRooms:isSafe?[{...shape.room,id:`safe-${id}`,rested:false}]:[],stairs:{x:-1,y:-1},doors:[{...shape.door,open:true,locked:false,interiorExit:true}],keys:[],chests:[],traps:[],altars:[],assets:[],enemies:[],boss:null,spawn:shape.spawn,floorTileset:tileset,seen:Array.from({length:shape.map.length},()=>Array(shape.map[0].length).fill(false))};
   for(const field of ['chests','traps','altars','enemies']){const moved=takeInRoom(plan[field],room);plan[field]=moved.remaining;state[field]=moved.selected}
   const occupied=new Set([key(shape.spawn.x,shape.spawn.y),key(shape.door.x,shape.door.y)]),free=[];
   for(let y=shape.room.y+1;y<shape.room.y+shape.room.h-1;y++)for(let x=shape.room.x+1;x<shape.room.x+shape.room.w-1;x++)if(shape.map[y][x]===0)free.push({x,y});
   for(const field of ['chests','traps','altars','enemies'])for(const entity of state[field]){let p=free.find(c=>!occupied.has(key(c.x,c.y)));if(!p)p=shape.spawn;entity.x=p.x;entity.y=p.y;occupied.add(key(p.x,p.y))}
   const desired={rest:0,craft:0,merchant:0,treasure:3,horde:7,boss:4,alchemist:4,cave:5,maze:3,combat:3}[type]??2;
   while(makeEnemy&&state.enemies.length<desired){const p=free.find(c=>!occupied.has(key(c.x,c.y)));if(!p)break;const enemy=makeEnemy(p,type);if(!enemy)break;state.enemies.push(enemy);occupied.add(key(p.x,p.y))}
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
