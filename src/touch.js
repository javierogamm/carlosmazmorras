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
// A single touch on the board can mean one of four things, disambiguated by
// how it moves:
//  - a TAP (little movement, released quickly): left alone entirely here -
//    no touchend handling fires for it beyond double-tap bookkeeping, so the
//    browser's own synthetic 'click' event still reaches the canvas 'click'
//    listener in game.js unchanged (that's what keeps skill/potion
//    targeting-by-tap working).
//  - a DOUBLE TAP (two taps in quick succession, near the same spot): the
//    same action as clicking #waitBtn - enter/leave an interior, rest at a
//    campfire, or just pass the turn, whichever applies at the hero's
//    current tile (see updateRestButton() in game.js, which decides that
//    per-tile). The second tap's synthetic click is suppressed so it can't
//    also open the inspect popup underneath.
//  - a SWIPE (moves past a small threshold before the long-press delay
//    elapses): one grid step in the dominant direction via move(dx,dy),
//    resolved on release - exactly like one arrow-key press.
//  - a LONG-PRESS then DRAG (finger stays still past the delay, then moves):
//    enters "attack drag" mode, shows the animated arrow from the hero to
//    the finger, and on release attacks whatever enemy is under it, subject
//    to the same weapon range/line-of-sight rules as the keyboard/gamepad
//    basic attack.
// Nothing here calls preventDefault except the double-tap's second touchend
// (to swallow its synthetic click): page scroll during the gesture is
// stopped by `touch-action:none` on #game (see styles.css) instead, which is
// what keeps the browser's tap-vs-drag click synthesis intact for every
// other case.
// ============================================================================

const TOUCH_SWIPE_MOVE_PX=28,TOUCH_LONG_PRESS_MS=260,TOUCH_LONG_PRESS_JITTER_PX=14,TOUCH_DOUBLE_TAP_MS=350,TOUCH_DOUBLE_TAP_PX=32;
let touchGesture=null,attackDragArrowEl=null,lastBoardTapAt=0,lastBoardTapX=0,lastBoardTapY=0;

function boardTouchAllowed(){return !!game&&!busy&&!game.over&&!pendingTargetAction&&!blockingModalOpen()}

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

const boardTouchEl=document.getElementById('game');
boardTouchEl?.addEventListener('touchstart',ev=>{
 if(ev.touches.length!==1||!boardTouchAllowed())return;
 const t=ev.touches[0],gesture={startX:t.clientX,startY:t.clientY,mode:'pending',timer:null};
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
 if(touchGesture.mode==='attack')updateAttackDragArrow(t.clientX,t.clientY);
},{passive:true});
boardTouchEl?.addEventListener('touchend',ev=>{
 if(!touchGesture)return;
 clearTimeout(touchGesture.timer);
 const gesture=touchGesture;touchGesture=null;
 const t=ev.changedTouches[0];
 if(gesture.mode==='swipe'&&t){
  const dx=t.clientX-gesture.startX,dy=t.clientY-gesture.startY;
  if(Math.hypot(dx,dy)>=TOUCH_SWIPE_MOVE_PX){if(Math.abs(dx)>Math.abs(dy))move(dx>0?1:-1,0);else move(0,dy>0?1:-1)}
 }else if(gesture.mode==='attack'){
  if(t){const {x,y}=cellFromClientPoint(t.clientX,t.clientY);resolveDragAttack(x,y)}
  removeAttackDragArrow();
 }else if(gesture.mode==='pending'&&t){
  // A genuine tap (never grew past the long-press jitter threshold): check
  // whether it lands close enough in time/space to the previous one to count
  // as a double-tap. If not, just remember it as the new "last tap" and let
  // the browser's synthetic click fire normally for it.
  const now=Date.now();
  if(now-lastBoardTapAt<=TOUCH_DOUBLE_TAP_MS&&Math.hypot(t.clientX-lastBoardTapX,t.clientY-lastBoardTapY)<=TOUCH_DOUBLE_TAP_PX){
   lastBoardTapAt=0;
   ev.preventDefault();
   document.getElementById('waitBtn')?.click();
  }else{
   lastBoardTapAt=now;lastBoardTapX=t.clientX;lastBoardTapY=t.clientY;
  }
 }
},{passive:false});
boardTouchEl?.addEventListener('touchcancel',()=>{if(touchGesture){clearTimeout(touchGesture.timer);touchGesture=null}removeAttackDragArrow()},{passive:true});
