const assert=require('node:assert/strict');
const {enhanceFloor,parseDoor}=require('../src/interiors.js');

assert.deepEqual(parseDoor('1;0',2,2),{x:1,y:0});
assert.equal(parseDoor('3;0',2,2),null);

const map=Array.from({length:9},()=>Array(9).fill(1));
for(let y=2;y<7;y++)for(let x=2;x<7;x++)map[y][x]=0;
map[4][1]=0;
const plan={floor:1,map,rooms:[{x:2,y:2,w:5,h:5,cx:4,cy:4,type:'vault'}],spawn:{x:1,y:4},stairs:{x:4,y:4},doors:[],keys:[],chests:[],traps:[],altars:[],enemies:[],safeRooms:[]};
const originalMap=JSON.stringify(map);
enhanceFloor(plan,{assets:[{key:'house',name:'Casa',cols:2,rows:2,door:'0;1'}],interiorFloors:[{id:7,name:'Madera'}],random:()=>0});
assert.equal(plan.interiors.length,1);
assert.equal(plan.interiors[0].type,'treasure');
assert.equal(plan.doors[0].assetKey,'house');
assert.equal(JSON.stringify(map),originalMap,'el post-procesador no altera la geometría existente');
console.log('interiors.test.js: OK');
