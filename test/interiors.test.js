const assert=require('node:assert/strict');
const {enhanceFloor,parseDoor}=require('../src/interiors.js');

assert.deepEqual(parseDoor('1;0',2,2),{x:1,y:0});
assert.equal(parseDoor('3;0',2,2),null);

const map=Array.from({length:21},()=>Array(21).fill(1));
const rooms=[{x:1,y:1,w:5,h:5,cx:3,cy:3,type:'filler'},{x:8,y:2,w:7,h:7,cx:11,cy:5,type:'vault'},{x:2,y:11,w:7,h:7,cx:5,cy:14,type:'arena'}];
for(const room of rooms)for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++)map[y][x]=0;
const plan={floor:1,map,rooms,spawn:{x:3,y:3},stairs:{x:5,y:14},doors:[],keys:[],chests:[],traps:[],altars:[],assets:[],enemies:[],safeRooms:[],family:{name:'Prueba'}};
enhanceFloor(plan,{assets:[{key:'house',name:'Casa',cols:3,rows:3,door:'1;2',mask:Array.from({length:3},()=>Array(3).fill(true))}],interiorFloors:[{id:7,name:'Madera'}],makeEnemy:pos=>({name:'Guardián',hp:10,...pos}),random:()=>0});
assert.equal(plan.interiors.length,1);
assert.equal(plan.interiorEntrances.length,1);
assert.ok(plan.interiorEntrances[0].interior.state.map.length<=23);
assert.ok(plan.interiorEntrances[0].interior.state.enemies.length>=3);
assert.equal(plan.map[plan.interiorEntrances[0].y][plan.interiorEntrances[0].x],0);
console.log('interiors.test.js: OK');
