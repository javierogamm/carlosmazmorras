// ============================================================================
// TOUCH INPUT
// Mobile usability layer for the game board: swipe-to-move and long-press +
// drag-to-attack, plus the animated arrow drawn while dragging.
//
// Loaded right AFTER src/game.js (see index.html) as a plain classic script,
// so it shares the same global scope: `game`, `busy`, `move()`, `attack()`,
// `canvas`, `camera()`, `TILE`, `visibleTiles`, `weaponRangeBounds()`,
// `enemyAtCell()`, `validateTargetCell()`, `apCan()`, `actionDone()`,
// `pendingTargetAction`, `blockingModalOpen()` and friends all resolve to
// game.js's own globals at call time. Nothing here runs at parse time except
// wiring up the canvas' touch listeners, so game.js is always fully
// initialised first.
//
// ---- Gesture design ---------------------------------------------------------
// A single touch on the board can mean one of three things, disambiguated by
// how it moves:
//  - a TAP (little movement, released quickly): left alone entirely here -
//    no touchend handling fires for it, so the browser's own synthetic
//    'click' event still reaches the canvas 'click' listener in game.js
//    unchanged (that's what keeps skill/potion targeting-by-tap working).
//    Passing the turn / resting / entering-exiting an interior is a
//    dedicated button now (#passTurnSkillBtn, next to the skill thumbnails -
//    see game.js), not a gesture.
//  - a SWIPE (moves past a small threshold before the long-press delay
//    elapses): one grid step in the dominant direction via move(dx,dy), as
//    soon as the threshold is crossed - then, as long as the finger stays
//    down, one more step every TOUCH_SWIPE_REPEAT_MS in that same locked
//    direction (see startSwipeHold), so holding the finger after a swipe
//    keeps walking instead of requiring a fresh swipe per tile.
//  - a LONG-PRESS then DRAG (finger stays still past the delay, then moves):
//    enters "attack drag" mode, shows the animated arrow from the hero to
//    the finger, and on release attacks whatever enemy is under it, subject
//    to the same weapon range/line-of-sight rules as the keyboard/gamepad
//    basic attack.
// None of this calls preventDefault on the touch events themselves: page
// scroll during the gesture is stopped by `touch-action:none` on #game (see
// styles.css) instead, which is what keeps the browser's tap-vs-drag click
// synthesis intact for a real TAP. A resolved swipe/attack-drag already took
// its own action though, so the synthetic 'click' the browser still fires
// after such a touchend must NOT also reach game.js's canvas 'click' handler
// (which would otherwise pop the inspect tooltip for whatever cell the
// finger ended up over, as if the player had tapped it) - see
// suppressNextBoardClick().
// ============================================================================

const TOUCH_SWIPE_MOVE_PX=28,TOUCH_LONG_PRESS_MS=260,TOUCH_LONG_PRESS_JITTER_PX=14,TOUCH_SWIPE_REPEAT_MS=160;
let touchGesture=null,attackDragArrowEl=null,suppressBoardClick=false;

function boardTouchAllowed(){return !!game&&!busy&&!game.over&&!pendingTargetAction&&!blockingModalOpen()}

// A 'click' listener on the same element (#game) as game.js's own runs AFTER
// it if registered later, since same-target listeners fire in registration
// order regardless of the capture flag - too late to stop showInspect()
// having already run. Listening on `document` in the capture phase instead
// fires while the event is still travelling down toward the target, before
// any of #game's own listeners see it, so stopPropagation() here keeps it
// from ever reaching game.js's handler.
document.addEventListener('click',ev=>{
 if(!suppressBoardClick)return;
 suppressBoardClick=false;
 if(boardTouchEl&&boardTouchEl.contains(ev.target)){ev.stopPropagation();ev.preventDefault()}
},true);
// One-shot: marks the very next click on the board as the browser's own
// tap-vs-drag synthesis rather than a real tap, so it gets swallowed above.
// The timeout is just a safety net in case that synthetic click never
// arrives (some browsers skip it for a cancelled/multi-touch gesture) - it
// stops a stale flag from swallowing an unrelated later tap.
function suppressNextBoardClick(){suppressBoardClick=true;setTimeout(()=>{suppressBoardClick=false},400)}

function cellFromClientPoint(clientX,clientY){
 const rect=canvas.getBoundingClientRect(),scaleX=canvas.width/rect.width,scaleY=canvas.height/rect.height;
 const pxX=(clientX-rect.left)*scaleX,pxY=(clientY-rect.top)*scaleY,c=camera();
 return {x:c.x+Math.floor(pxX/TILE),y:c.y+Math.floor(pxY/TILE)};
}
function attackDragOriginPoint(){
 const r=canvas.getBoundingClientRect(),c=camera(),scale=r.width/visibleTiles;
 return {x:r.left+(game.player.x-c.x+.5)*scale,y:r.top+(game.player.y-c.y+.5)*scale};
}
// Repositions (creating on first use) the flowing arrow from the hero to the
// finger, colored by whether the cell currently under it is a legal attack
// target - live feedback for where the drag will land if released now.
function updateAttackDragArrow(clientX,clientY){
 if(!attackDragArrowEl){attackDragArrowEl=document.createElement('div');attackDragArrowEl.className='attackDragArrow';document.body.appendChild(attackDragArrowEl)}
 const origin=attackDragOriginPoint(),dx=clientX-origin.x,dy=clientY-origin.y,len=Math.hypot(dx,dy),angle=Math.atan2(dy,dx)*180/Math.PI;
 const {x,y}=cellFromClientPoint(clientX,clientY),bounds=weaponRangeBounds(),valid=!!enemyAtCell(x,y)&&validateTargetCell(x,y,bounds.max,bounds.min);
 attackDragArrowEl.style.left=`${origin.x}px`;attackDragArrowEl.style.top=`${origin.y}px`;attackDragArrowEl.style.width=`${len}px`;
 attackDragArrowEl.style.transform=`rotate(${angle}deg)`;
 attackDragArrowEl.classList.toggle('valid',valid);attackDragArrowEl.classList.toggle('invalid',!valid);
}
function removeAttackDragArrow(){attackDragArrowEl?.remove();attackDragArrowEl=null}
// Mirrors the single-target branch of beginBasicAttack()/resolveBasicAttack()
// in game.js (same dice/multiplier), but targets whatever cell the drag was
// released over instead of going through pendingTargetAction.
function resolveDragAttack(x,y){
 if(!game||busy||game.over)return false;
 const bounds=weaponRangeBounds(),enemy=enemyAtCell(x,y);
 if(!enemy)return false;
 if(!validateTargetCell(x,y,bounds.max,bounds.min)){log(`Enemigo fuera de alcance (${bounds.min}-${bounds.max}).`,'sys');return false}
 const apCost=weaponAttackApCost();if(!apCan('attack',apCost))return false;
 attack(enemy,0,{dice:baseAttackDice(),multiplier:rangeDamageMultiplier(bounds.max,false)});actionDone('attack',apCost);return true
}

function swipeDirectionFromDelta(dx,dy){return Math.abs(dx)>Math.abs(dy)?{dx:dx>0?1:-1,dy:0}:{dx:0,dy:dy>0?1:-1}}
function stopSwipeRepeat(gesture){if(gesture.repeatTimer){clearInterval(gesture.repeatTimer);gesture.repeatTimer=null}}
// Crossing the swipe threshold moves once immediately, then keeps stepping
// in that same locked direction every TOUCH_SWIPE_REPEAT_MS for as long as
// this exact gesture is still the live touchGesture and the board still
// accepts input - so lifting the finger (touchend/touchcancel clear
// touchGesture and stopSwipeRepeat) or a blocking modal popping up mid-hold
// both stop it cleanly. The direction itself is never re-read from later
// finger movement: "keep moving that way" means the way the swipe first
// pointed, not wherever the finger drifts to afterward.
function startSwipeHold(gesture,dir){
 gesture.dir=dir;move(dir.dx,dir.dy);suppressNextBoardClick();
 gesture.repeatTimer=setInterval(()=>{
  if(touchGesture!==gesture||!boardTouchAllowed()){stopSwipeRepeat(gesture);return}
  move(dir.dx,dir.dy);
 },TOUCH_SWIPE_REPEAT_MS);
}

const boardTouchEl=document.getElementById('game');
boardTouchEl?.addEventListener('touchstart',ev=>{
 if(ev.touches.length!==1||!boardTouchAllowed())return;
 const t=ev.touches[0],gesture={startX:t.clientX,startY:t.clientY,mode:'pending',timer:null,repeatTimer:null,dir:null};
 gesture.timer=setTimeout(()=>{if(touchGesture===gesture&&gesture.mode==='pending'){gesture.mode='attack';updateAttackDragArrow(gesture.startX,gesture.startY)}},TOUCH_LONG_PRESS_MS);
 touchGesture=gesture;
},{passive:true});
boardTouchEl?.addEventListener('touchmove',ev=>{
 if(!touchGesture||ev.touches.length!==1)return;
 const t=ev.touches[0],dx=t.clientX-touchGesture.startX,dy=t.clientY-touchGesture.startY;
 if(touchGesture.mode==='pending'){
  if(Math.hypot(dx,dy)>TOUCH_LONG_PRESS_JITTER_PX){clearTimeout(touchGesture.timer);touchGesture.mode='swipe'}
  return;
 }
 if(touchGesture.mode==='swipe'){
  if(!touchGesture.repeatTimer&&Math.hypot(dx,dy)>=TOUCH_SWIPE_MOVE_PX)startSwipeHold(touchGesture,swipeDirectionFromDelta(dx,dy));
  return;
 }
 if(touchGesture.mode==='attack')updateAttackDragArrow(t.clientX,t.clientY);
},{passive:true});
boardTouchEl?.addEventListener('touchend',ev=>{
 if(!touchGesture)return;
 clearTimeout(touchGesture.timer);
 const gesture=touchGesture;touchGesture=null;
 const hadRepeat=!!gesture.repeatTimer;
 stopSwipeRepeat(gesture);
 const t=ev.changedTouches[0];
 if(gesture.mode==='swipe'){
  // Normal case already handled live in touchmove (startSwipeHold fired the
  // first move and, on a hold, the repeats). This only covers a swipe fast
  // enough that touchend arrives before any touchmove crossed the
  // threshold - still a real swipe, so it gets its one step here instead of
  // being silently dropped.
  let moved=hadRepeat;
  if(!hadRepeat&&t){
   const dx=t.clientX-gesture.startX,dy=t.clientY-gesture.startY;
   if(Math.hypot(dx,dy)>=TOUCH_SWIPE_MOVE_PX){const dir=swipeDirectionFromDelta(dx,dy);move(dir.dx,dir.dy);moved=true}
  }
  if(moved)suppressNextBoardClick();
 }else if(gesture.mode==='attack'){
  if(t){const {x,y}=cellFromClientPoint(t.clientX,t.clientY);resolveDragAttack(x,y)}
  removeAttackDragArrow();
  suppressNextBoardClick();
 }
},{passive:true});
boardTouchEl?.addEventListener('touchcancel',()=>{if(touchGesture){clearTimeout(touchGesture.timer);stopSwipeRepeat(touchGesture);touchGesture=null}removeAttackDragArrow()},{passive:true});
