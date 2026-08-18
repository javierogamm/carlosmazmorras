const assert=require('node:assert/strict');
const {enhanceFloor,parseDoor,isDoorAsset}=require('../src/interiors.js');

assert.deepEqual(parseDoor('1;0',2,2),{x:1,y:0});
assert.equal(parseDoor('3;0',2,2),null);

const houseAsset={key:'house',name:'Casa',cols:3,rows:3,door:'1;2',mask:Array.from({length:3},()=>Array(3).fill(true))};
assert.equal(isDoorAsset(houseAsset),true);
assert.equal(isDoorAsset({...houseAsset,door:'1;1'}),false); // not on the footprint's edge

// Small deterministic PRNG (LCG) so multi-room placement can actually vary
// between draws - a constant random() would make every room-placement
// attempt collide with the first room and never place a second one.
function makeRng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}

// --- fixture: 9 rooms - spawn, a special room sitting on the stairs (must
// stay exterior), a special room holding the floor's boss (must stay
// exterior), and 6 more special-type rooms that should ALL convert (proving
// there is no cap-of-5 any more).
const SIZE=49;
const map=Array.from({length:SIZE},()=>Array(SIZE).fill(1));
const rooms=[
 {x:1,y:1,w:5,h:5,cx:3,cy:3,type:'filler'},        // spawn
 {x:8,y:2,w:6,h:6,cx:11,cy:5,type:'vault'},         // holds the stairs -> stays exterior
 {x:16,y:2,w:6,h:6,cx:19,cy:5,type:'eliteden'},     // holds the boss -> stays exterior
 {x:24,y:2,w:6,h:6,cx:27,cy:5,type:'arena'},        // -> horde
 {x:32,y:2,w:6,h:6,cx:35,cy:5,type:'bossarena'},    // -> boss
 {x:8,y:10,w:6,h:6,cx:11,cy:13,type:'shrine'},      // -> rest
 {x:16,y:10,w:6,h:6,cx:19,cy:13,type:'prep'},       // -> rest
 {x:24,y:10,w:6,h:6,cx:27,cy:13,type:'traproom'},   // -> maze
 {x:32,y:10,w:6,h:6,cx:35,cy:13,type:'creator'}     // -> craft
];
for(const room of rooms)for(let y=room.y;y<room.y+room.h;y++)for(let x=room.x;x<room.x+room.w;x++)map[y][x]=0;

const plan={
 floor:5,map,rooms,spawn:{x:3,y:3},stairs:{x:11,y:5},doors:[],keys:[],chests:[],traps:[],altars:[],assets:[],
 enemies:[{x:19,y:5,boss:true,hp:80,maxHp:80,name:'Jefe de prueba'}],
 safeRooms:[],family:{name:'Prueba'}
};

let bossEnemiesBuilt=0,chestDefsBuilt=0;
enhanceFloor(plan,{
 assets:[houseAsset],
 interiorFloors:[{id:7,name:'Madera'}],
 totalFloors:20,
 makeEnemy:(pos,type,opts)=>{if(opts?.wantBoss)bossEnemiesBuilt++;return {name:opts?.wantBoss?'Jefe interior':'Guardián',hp:10,maxHp:10,boss:!!opts?.wantBoss,...pos}},
 makeChest:()=>{chestDefsBuilt++;return {type:'weapon',name:'Cofre de prueba',configChestId:1}},
 random:makeRng(20260818)
});

// stairs room and boss room must never become interiors
assert.equal(rooms.find(r=>r.type==='vault').interior,undefined);
assert.equal(rooms.find(r=>r.type==='eliteden').interior,undefined);

// every other special room converts - no cap of 5
assert.equal(plan.interiors.length,6);
assert.equal(plan.interiorEntrances.length,6);

for(const entry of plan.interiorEntrances){
 assert.equal(plan.map[entry.y][entry.x],0,'door tile must be walkable on the exterior map');
 const state=entry.interior.state;
 assert.ok(state.map.length>=9&&state.map.length<=50,'interior height within 9..50');
 assert.ok(state.map[0].length>=9&&state.map[0].length<=50,'interior width within 9..50');
 assert.ok(state.rooms.length>=1);
}

// at least one interior grew big enough to generate real sub-rooms
assert.ok(plan.interiorEntrances.some(e=>e.interior.state.rooms.length>1),'expected at least one multi-room interior');

// the "boss" flavoured interior (from the bossarena room) got its own guarded enemy
const bossInterior=plan.interiorEntrances.find(e=>e.interior.type==='boss');
assert.ok(bossInterior,'expected a boss-flavoured interior');
assert.ok(bossInterior.interior.state.boss,'boss-flavoured interior should have a state.boss');
assert.ok(bossEnemiesBuilt>=1);

// every interior chest carries a real config_chest-backed def, same as the
// exterior generator's own chests - never a def-less "legacy" chest.
let interiorChestsSeen=0;
for(const entry of plan.interiorEntrances){
 for(const c of entry.interior.state.chests||[]){interiorChestsSeen++;assert.ok(c.chestDef,'interior chest missing chestDef')}
}
assert.ok(interiorChestsSeen>=1);
assert.ok(chestDefsBuilt>=interiorChestsSeen);

// --- forced-maximum-depth check: floor===totalFloors with an RNG pinned to
// its top edge must be able to reach the full 50x50 ceiling.
const bigMap=Array.from({length:21},()=>Array(21).fill(1));
const bigRoom={x:1,y:1,w:10,h:10,cx:5,cy:5,type:'bossarena'};
for(let y=bigRoom.y;y<bigRoom.y+bigRoom.h;y++)for(let x=bigRoom.x;x<bigRoom.x+bigRoom.w;x++)bigMap[y][x]=0;
const bigPlan={floor:20,map:bigMap,rooms:[{x:0,y:0,w:1,h:1,cx:0,cy:0,type:'filler'},bigRoom],spawn:{x:0,y:0},stairs:{x:0,y:0},doors:[],keys:[],chests:[],traps:[],altars:[],assets:[],enemies:[],safeRooms:[],family:{name:'Prueba'}};
enhanceFloor(bigPlan,{assets:[houseAsset],interiorFloors:[{id:7,name:'Madera'}],totalFloors:20,makeEnemy:pos=>({name:'Guardián',hp:10,maxHp:10,...pos}),random:()=>0.9999});
assert.equal(bigPlan.interiorEntrances.length,1);
assert.equal(bigPlan.interiorEntrances[0].interior.state.map.length,50);
assert.equal(bigPlan.interiorEntrances[0].interior.state.map[0].length,50);

console.log('interiors.test.js: OK');
