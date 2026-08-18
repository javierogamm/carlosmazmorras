(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.DungeonInteriors=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';

 const SPECIAL_TYPES={
  creator:'craft',soulmerchant:'merchant',shrine:'rest',prep:'rest',vault:'treasure',
  arena:'horde',bossarena:'boss',eliteden:'treasure',traproom:'maze'
 };
 const EXTRA_TYPES=['alchemist','cave','maze','horde','treasure'];
 const GEOMETRIES=['square','rectangular','alcoves','irregular','cross'];
 const cellKey=(x,y)=>`${x},${y}`;

 function parseDoor(value,cols,rows){
  const match=String(value||'').match(/^\s*(\d+)\s*[;,]\s*(\d+)\s*$/);
  if(!match)return null;
  const x=Number(match[1]),y=Number(match[2]);
  return x>=0&&y>=0&&x<cols&&y<rows?{x,y}:null;
 }

 function doorwayFor(room,map,reserved){
  const candidates=[];
  for(let x=room.x;x<room.x+room.w;x++)for(const y of [room.y,room.y+room.h-1])candidates.push({x,y});
  for(let y=room.y+1;y<room.y+room.h-1;y++)for(const x of [room.x,room.x+room.w-1])candidates.push({x,y});
  const outsideOpen=p=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{
   const nx=p.x+dx,ny=p.y+dy;
   const outside=nx<room.x||nx>=room.x+room.w||ny<room.y||ny>=room.y+room.h;
   return outside&&map[ny]?.[nx]===0;
  });
  return candidates.find(p=>map[p.y]?.[p.x]===0&&!reserved.has(cellKey(p.x,p.y))&&outsideOpen(p))||
   candidates.find(p=>map[p.y]?.[p.x]===0&&!reserved.has(cellKey(p.x,p.y)))||null;
 }

 // Additive post-processor: it never carves or blocks a tile and never moves an
 // existing entity. Old worlds and floors without configured asset doors remain
 // byte-for-byte compatible with the established generator.
 function enhanceFloor(plan,{assets=[],interiorFloors=[],random=Math.random}={}){
  if(!plan||!Array.isArray(plan.rooms)||!Array.isArray(plan.map))return plan;
  const doorAssets=assets.map(a=>({...a,door:parseDoor(a.door,a.cols,a.rows)})).filter(a=>a.door);
  if(!doorAssets.length||!interiorFloors.length)return plan;
  const reserved=new Set([
   plan.spawn,plan.stairs,...(plan.keys||[]),...(plan.chests||[]),...(plan.traps||[]),
   ...(plan.altars||[]),...(plan.enemies||[]),...(plan.boss?[plan.boss]:[])
  ].filter(Boolean).map(p=>cellKey(p.x,p.y)));
  const safeKeys=new Set((plan.safeRooms||[]).map(r=>`${r.x},${r.y}`));
  const eligible=plan.rooms.filter(r=>r.w>=4&&r.h>=4&&cellKey(r.cx,r.cy)!==cellKey(plan.spawn?.x,plan.spawn?.y));
  const target=eligible.length;
  const prioritized=[...eligible].sort((a,b)=>(SPECIAL_TYPES[b.type]?1:0)-(SPECIAL_TYPES[a.type]?1:0)||random()-.5);
  const interiors=[];
  for(const room of prioritized){
   if(interiors.length>=target)break;
   const entrance=doorwayFor(room,plan.map,reserved);if(!entrance)continue;
   const asset=doorAssets[Math.floor(random()*doorAssets.length)];
   const tileset=interiorFloors[Math.floor(random()*interiorFloors.length)];
   const isSafe=safeKeys.has(`${room.x},${room.y}`);
   const type=SPECIAL_TYPES[room.type]||(isSafe?'rest':(random()<.28?EXTRA_TYPES[Math.floor(random()*EXTRA_TYPES.length)]:'combat'));
   const interior={id:`interior-${plan.floor||0}-${interiors.length}`,roomIndex:plan.rooms.indexOf(room),type,geometry:GEOMETRIES[Math.floor(random()*GEOMETRIES.length)],x:room.x,y:room.y,w:room.w,h:room.h,entrance:{...entrance},doorAsset:{key:asset.key,name:asset.name,tile:{...asset.door}},floorTileset:{dbId:tileset.dbId||tileset.id||null,name:tileset.name}};
   room.interior=interior;
   interiors.push(interior);
   plan.doors=plan.doors||[];
   if(!plan.doors.some(d=>d.x===entrance.x&&d.y===entrance.y))plan.doors.push({...entrance,open:false,locked:false,protected:['treasure','alchemist','boss'].includes(type),interiorId:interior.id,assetKey:asset.key,assetTile:{...asset.door}});
   reserved.add(cellKey(entrance.x,entrance.y));
  }
  plan.interiors=interiors;
  return plan;
 }

 return {enhanceFloor,parseDoor,SPECIAL_TYPES,EXTRA_TYPES};
});
