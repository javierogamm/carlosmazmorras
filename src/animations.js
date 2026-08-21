// ---- Animations ------------------------------------------------------------
// Every DOM/canvas visual-feedback helper used by game.js lives here: floating
// combat numbers, the GSAP hit/cast particles, ranged tracers, the canvas
// shake/flash, the death skull, area-effect pulses and the proc/buff-debuff
// call-outs. Nothing here owns game state - every function reads globals
// declared in game.js (game, canvas, camera(), visibleTiles, skillDefs,
// effectSourceDef) and is in turn called BY game.js, so this file must load
// before game.js in index.html. Classic (non-module) scripts on the same page
// share one global scope, so a plain function/const declared here is visible
// to game.js exactly as if it were still defined inline - moving code here
// changes nothing about how any of it is called.

function floating(text,x,y,color='#fff'){const r=canvas.getBoundingClientRect(),c=camera(),d=document.createElement('div');d.className='floatText';d.textContent=text;d.style.color=color;d.style.left=`${r.left+(x-c.x+.45)*r.width/visibleTiles}px`;d.style.top=`${r.top+(y-c.y+.25)*r.height/visibleTiles}px`;document.body.appendChild(d);setTimeout(()=>d.remove(),850)}
// GSAP effects are independent DOM particles: they keep canvas art crisp and
// avoid spritesheets while still covering movement, attacks and every skill component.
const CLASS_FX_THEMES={
 yunque:{color:'#b9c3c9',accent:'#ff9f43',icon:'▰',theme:'forge'},berserker:{color:'#ff3f81',accent:'#ff8b3d',icon:'╳',theme:'rage'},necromancer:{color:'#78d66b',accent:'#9b6cff',icon:'☠',theme:'necrotic'},paladin:{color:'#ffe07a',accent:'#8de8ff',icon:'✚',theme:'holy'},
 jester:{color:'#e06cff',accent:'#58f2d2',icon:'◇',theme:'chaos'},sniper:{color:'#80eaff',accent:'#ffcf5a',icon:'⌖',theme:'rune'},shaman:{color:'#66dfff',accent:'#c88cff',icon:'ϟ',theme:'storm'},thief:{color:'#8d75ff',accent:'#46f1dc',icon:'◈',theme:'quantum'},
 cleric:{color:'#fff0a0',accent:'#70dc9b',icon:'✧',theme:'silicon'},entropyMage:{color:'#b05cff',accent:'#ff557f',icon:'◌',theme:'entropy'},bountyHunter:{color:'#ff9b4a',accent:'#54d7ff',icon:'⌁',theme:'bounty'},druid:{color:'#77c76a',accent:'#d0ad62',icon:'❧',theme:'nature'},
 monk:{color:'#f4d06f',accent:'#75e6dd',icon:'◎',theme:'loop'},engineer:{color:'#ffb14e',accent:'#84ffb1',icon:'⚗',theme:'alchemy'},seer:{color:'#8fa7ff',accent:'#e783ff',icon:'◉',theme:'abyss'},beastGuardian:{color:'#58e8ff',accent:'#9cff71',icon:'➵',theme:'plasma'}
};
function skillFxProfile(id,kind='attack'){
 const d=effectSourceDef(id)||skillDefs[id]||{},base=CLASS_FX_THEMES[d.classId||game?.player?.cls]||{color:'#b98cff',accent:'#ffd45f',icon:'✦',theme:'arcane'};
 const utility=['buff','heal','shield','hot'].includes(kind),dot=kind==='dot';
 return {...base,color:dot?'#e06b72':utility?base.accent:base.color,icon:dot?'·':utility?'○':base.icon}
}
function combatFx(kind,x,y,{to=null,color='#ffd45f',accent=color,icon='·',theme='neutral',subtle=false}={}){
 const layer=document.getElementById('combatFxLayer');if(!layer||!game)return;
 const c=camera(),el=document.createElement('i'),pct=100/visibleTiles;
 el.className=`combatFx ${kind} fx-${theme}${subtle?' subtle':''}`;el.textContent=icon;el.style.color=color;el.style.setProperty('--fx-accent',accent);el.style.left=`${(x-c.x+.5)*pct}%`;el.style.top=`${(y-c.y+.5)*pct}%`;layer.appendChild(el);
 const end=to?{left:`${(to.x-c.x+.5)*pct}%`,top:`${(to.y-c.y+.5)*pct}%`}:{};
 if(window.gsap)gsap.fromTo(el,{scale:.35,opacity:0,rotation:kind==='melee'?-35:-12},{...end,scale:subtle?.85:kind==='attack'?1.35:1.15,opacity:subtle?.62:.92,rotation:kind==='buff'?120:kind==='melee'?35:12,duration:kind==='move'?.22:subtle?.2:.34,ease:'power2.out',onComplete:()=>gsap.to(el,{scale:.35,opacity:0,duration:subtle?.16:.26,onComplete:()=>el.remove()})});
 else{el.animate([{opacity:0,transform:'scale(.25)'},{opacity:1,transform:'scale(1.2)'},{opacity:0,transform:'scale(.2)'}],{duration:650}).onfinish=()=>el.remove()}
}
// Brief tracer line for any hit landed from more than 1 tile away (ranged
// weapons, ranged skills, enemy ranged attacks) - a plain DOM overlay like
// floating(), not a canvas draw, so it doesn't need to hook into the
// animate()/draw() loop to fade out on its own.
function rangedTracer(x1,y1,x2,y2,color='#9be8ff'){
 const r=canvas.getBoundingClientRect(),c=camera(),scale=r.width/visibleTiles;
 const sx1=r.left+(x1-c.x+.5)*scale,sy1=r.top+(y1-c.y+.5)*scale;
 const sx2=r.left+(x2-c.x+.5)*scale,sy2=r.top+(y2-c.y+.5)*scale;
 const dx=sx2-sx1,dy=sy2-sy1,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;
 const d=document.createElement('div');
 d.className='rangedTracer';
 d.style.left=`${sx1}px`;d.style.top=`${sy1}px`;d.style.width=`${len}px`;
 d.style.setProperty('--tracer-color',color);
 d.style.transform=`rotate(${angle}deg)`;
 document.body.appendChild(d);
 setTimeout(()=>d.remove(),260);
}
function effect(cls){canvas.classList.remove(cls);void canvas.offsetWidth;canvas.classList.add(cls)}

// ---- Area-effect pulse ------------------------------------------------
// Any area-targeted cast (skill, potion, weapon/armor proc - all three route
// through applyEffectComponent's resolveComponentEnemyTargets/
// resolveComponentAllyTargets/'aoe' branch in game.js) shows this pulse on
// the affected tiles first; the actual damage/status application that
// follows in the same synchronous call is what reads as "pulse, then
// effect" once the pulse's own quick opacity ramp is on screen. One-shot
// only - for an area that lingers for several turns (totem/zone/trap skill
// objects), the persisting radius pulse is drawn straight on the canvas
// every frame instead (see drawSkillObjectGroundOverlay/
// drawCompanionAreaOverlays in game.js), which already covered that case.
const AREA_PULSE_COLORS={dmg:'#ff6b6b',dot:'#d98a75',debuff:'#e0895f',cc:'#8ecbff',fear:'#b98cff',mesmer:'#e06cff',mark:'#ffcf5a',execute:'#ff4d4d',pullroot:'#8ecbff',aoe:'#ff6b6b',heal:'#70dc9b',hot:'#70dc9b'};
function areaPulse(x,y,radius=2,{color='#b98cff'}={}){
 const layer=document.getElementById('combatFxLayer');if(!layer||!game||x==null||y==null)return;
 const c=camera(),pct=100/visibleTiles,size=(Math.max(0,radius)*2+1)*pct;
 const el=document.createElement('div');
 el.className='areaPulse';
 el.style.left=`${(x-c.x+.5)*pct}%`;el.style.top=`${(y-c.y+.5)*pct}%`;
 el.style.width=`${size}%`;el.style.height=`${size}%`;
 el.style.setProperty('--pulse-color',color);
 layer.appendChild(el);
 setTimeout(()=>el.remove(),650);
}

// ---- Proc animation -----------------------------------------------------
// A distinct burst (separate from the normal skill-cast combatFx icon) so a
// weapon/armor proc firing reads as its own kind of event rather than just
// another regular hit - see maybeProcWeaponEffects/
// maybeProcDefensiveEquipmentEffects in game.js.
function procFx(x,y,{color='#ffd45f',icon='⚡'}={}){
 const layer=document.getElementById('combatFxLayer');if(!layer||!game||x==null||y==null)return;
 const c=camera(),pct=100/visibleTiles;
 const el=document.createElement('i');
 el.className='procFx';el.textContent=icon;el.style.setProperty('--proc-color',color);
 el.style.left=`${(x-c.x+.5)*pct}%`;el.style.top=`${(y-c.y+.5)*pct}%`;
 layer.appendChild(el);
 setTimeout(()=>el.remove(),650);
}

// ---- Buff/debuff floating call-out ---------------------------------------
// Separate from floating() (used for damage/heal numbers): a small
// up/down-triangle-prefixed label that reads as "a status was just applied"
// rather than a number, fired from applyBuff/addEnemyStatus/
// applyEnemyStatDebuff/applyMindControlStatus in game.js.
function buffFloat(text,x,y,positive=true){
 if(x==null||y==null)return;
 const r=canvas.getBoundingClientRect(),c=camera(),d=document.createElement('div');
 d.className=`floatText buffFloat ${positive?'positive':'negative'}`;
 d.textContent=`${positive?'▲':'▼'} ${text}`;
 d.style.left=`${r.left+(x-c.x+.45)*r.width/visibleTiles}px`;
 d.style.top=`${r.top+(y-c.y+.05)*r.height/visibleTiles}px`;
 document.body.appendChild(d);
 setTimeout(()=>d.remove(),1000);
}

// Two seconds of a skull rising and spinning over the corpse before any
// death screen opens. Deliberately driven from the death HANDLERS rather
// than from permanentDeath(): that function is also reached from "volver al
// menú" in Soulseek and from banking souls, and a skull flying up because
// you clicked a menu button would make no sense.
// game.over is already true by the time either handler runs (see the two
// call sites), so the player cannot act during the animation.
const DEATH_SKULL_MS=2000;
function playDeathSkullAnimation(done){
 // Parented to #gameStage, not to #combatFxLayer: that layer is
 // overflow:hidden and would clip the skull as it climbs out of the tile.
 // Both boxes are the same size (the layer is inset:0 on the stage), so the
 // percentage positioning below is identical either way.
 const stage=document.getElementById('gameStage');
 if(!stage||!game?.player){done();return}
 const c=camera(),pct=100/visibleTiles;
 const el=document.createElement('i');
 el.className='deathSkull';
 el.textContent='☠';
 el.style.left=`${(game.player.x-c.x+.5)*pct}%`;
 el.style.top=`${(game.player.y-c.y+.5)*pct}%`;
 stage.appendChild(el);
 const finish=()=>{el.remove();done()};
 if(window.gsap){
  gsap.fromTo(el,{scale:.2,opacity:0,rotation:0,yPercent:0},
   {scale:1.9,opacity:1,rotation:720,yPercent:-260,duration:DEATH_SKULL_MS/1000,ease:'power1.out',
    onComplete:()=>gsap.to(el,{opacity:0,duration:.25,onComplete:finish})});
 }else{
  el.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.2) rotate(0deg)'},
              {opacity:1,transform:'translate(-50%,-160%) scale(1.9) rotate(540deg)',offset:.75},
              {opacity:0,transform:'translate(-50%,-260%) scale(1.9) rotate(720deg)'}],
             {duration:DEATH_SKULL_MS,easing:'ease-out'}).onfinish=finish;
  setTimeout(finish,DEATH_SKULL_MS+400);
 }
}
