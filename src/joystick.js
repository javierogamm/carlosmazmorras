// ============================================================================
// JOYSTICK / GAMEPAD INPUT
// Everything the Standard Gamepad API drives: the remappable button menu,
// the stick-vs-D-pad split, focus navigation through menus, and the on-board
// aiming cursor used while a skill/attack is being targeted.
//
// Loaded right AFTER src/game.js (see index.html) as a plain classic script,
// so it shares the same global scope: `game`, `busy`, `move()`, `useSkill()`,
// `draw()`, `pendingTargetAction`, `gamepadTargetCursor`, `COLS`/`ROWS` and
// friends all resolve to game.js's own globals at call time. Nothing here
// runs at parse time except wiring up DOM listeners and starting the poll
// loop, so game.js is always fully initialised first.
//
// ---- Control scheme --------------------------------------------------------
// LEFT STICK  -> the world, always: it moves the character, or the aiming
//                cursor while a skill/attack is being targeted. It never
//                drives menus while there is something in the world to
//                drive (it does fall back to menu navigation on screens
//                where no run is playable at all - the login/landing
//                screens, config, the scores table - because there is no
//                character to move there and a dead stick would just be a
//                worse version of the D-pad).
// D-PAD       -> the UI, always: it walks the focusable elements of whatever
//                is on top (side-panel tabs and their contents during a run,
//                the buttons of any open modal or overlay otherwise). It
//                never moves the character or the aiming cursor.
// SHOULDERS   -> jump between "zones" (the side panel's tabs during a run,
//                the declared [data-gamepad-zone] blocks elsewhere).
// ============================================================================

// Bindings are deliberately button-index-based so Xbox, PlayStation and
// generic pads can all be remapped without assumptions about their layout.
const DEFAULT_GAMEPAD_BINDINGS={confirm:0,cancel:1,skill1:2,skill2:3,skill3:4,skill4:5,prevTab:6,nextTab:7,wait:8,attack:9,menu:10,fullscreen:11};
const GAMEPAD_ACTIONS={confirm:'Confirmar / interactuar',cancel:'Atrás / volver al juego',attack:'Atacar',skill1:'Habilidad 1',skill2:'Habilidad 2',skill3:'Habilidad 3',skill4:'Habilidad 4',prevTab:'Hombro: zona anterior',nextTab:'Hombro: zona siguiente',wait:'Esperar',menu:'Menú de mando',fullscreen:'Solo juego / pantalla completa'};
// D-pad button indices in the Standard Gamepad mapping, with the grid step
// each one means.
const GAMEPAD_DPAD=[[12,0,-1],[13,0,1],[14,-1,0],[15,1,0]];
const GAMEPAD_STICK_DEADZONE=.55;
const GAMEPAD_REPEAT_MS=190;
let gamepadBindings={...DEFAULT_GAMEPAD_BINDINGS},gamepadListening=null,gamepadPrevious=[],gamepadRepeat={},gamepadUiMode='gameplay',gamepadZoneIndex=0,gamepadConnected=false,gamepadAutoFocusedScreen=null;
// The element the pad itself put the focus ring on. Tracked so the ring can
// be recovered if that exact element is later destroyed - see
// autoFocusGamepadScreen().
let gamepadFocusedElement=null;
try{gamepadBindings={...gamepadBindings,...JSON.parse(localStorage.getItem('gamepadBindings')||'{}')}}catch(e){}

// ---- Bindings menu ---------------------------------------------------------
function gamepadButtonName(index){return ['A / ✕','B / ○','X / □','Y / △','LB / L1','RB / R1','LT / L2','RT / R2','SELECT','START','L3','R3','CRUCETA ↑','CRUCETA ↓','CRUCETA ←','CRUCETA →'][index]||`Botón ${index}`}
function renderGamepadBindings(){const root=document.getElementById('gamepadBindings');if(!root)return;root.innerHTML=Object.entries(GAMEPAD_ACTIONS).map(([id,label])=>`<div class="gamepadBinding"><span><b>${label}</b><small>${gamepadButtonName(gamepadBindings[id])}</small></span><button type="button" data-gamepad-bind="${id}" class="${gamepadListening===id?'listening':''}">${gamepadListening===id?'PULSA UN BOTÓN…':'CAMBIAR'}</button></div>`).join('');root.querySelectorAll('[data-gamepad-bind]').forEach(b=>b.onclick=()=>{gamepadListening=b.dataset.gamepadBind;renderGamepadBindings()})}
function openGamepadMenu(){gamepadListening=null;renderGamepadBindings();document.getElementById('gamepadOverlay')?.classList.remove('hidden')}
function closeGamepadMenu(){gamepadListening=null;document.getElementById('gamepadOverlay')?.classList.add('hidden')}
document.getElementById('menuGamepadBtn')?.addEventListener('click',openGamepadMenu);
document.getElementById('closeGamepadBtn')?.addEventListener('click',closeGamepadMenu);
document.getElementById('resetGamepadBtn')?.addEventListener('click',()=>{gamepadBindings={...DEFAULT_GAMEPAD_BINDINGS};localStorage.setItem('gamepadBindings',JSON.stringify(gamepadBindings));renderGamepadBindings()});

// ---- Screens, zones and focus ---------------------------------------------
function cycleGameTab(direction){const tabs=[...document.querySelectorAll('.tabs [data-tab]')].filter(b=>!b.classList.contains('hidden'));if(!tabs.length)return;const current=Math.max(0,tabs.findIndex(b=>b.classList.contains('active')));tabs[(current+direction+tabs.length)%tabs.length].click()}
// Whatever the pad should be talking to right now: a blocking modal if one
// is open, otherwise the topmost overlay/screen.
// The in-page confirm/alert/prompt is checked first because it is opened
// FROM the other modals (a level-up asks for confirmation while
// .statPointModal is still open) and is always painted above them - that
// check is what makes its ACEPTAR reachable with a pad at all.
// NOTE: no offsetParent filtering here. These are all position:fixed, and
// offsetParent is null for fixed elements, so filtering on it would discard
// every candidate and fall through to <body>. Visibility is already encoded
// in the selectors themselves (.open / :not(.hidden)).
function visibleGamepadScreen(){
 const prompt=document.getElementById('uiPromptModal');
 if(prompt?.classList.contains('open'))return prompt;
 const blockingModal=document.querySelector('.statPointModal.open,.skillChoiceModal.open');
 return blockingModal||[...document.querySelectorAll('.overlay:not(.hidden),.configScreen:not(.hidden),#app:not(.hidden)')].pop()||document.body;
}
function gamepadZones(){const screen=visibleGamepadScreen(),explicit=[...screen.querySelectorAll('[data-gamepad-zone]')].filter(el=>el.offsetParent!==null);let zones=explicit;if(!zones.length){zones=[...screen.querySelectorAll('.configTabs,.configTabPanel:not(.hidden),.landingActions,.wizardViewport,.wizardNav,.worldList,.configItemsList,.startActions,.tabs,.tabview:not(.hidden),.statChoiceGrid,.skillChoiceGrid')].filter(el=>el.offsetParent!==null&&el.querySelector('button:not([disabled]),input,select,[data-race],[data-class]'))}if(!zones.length)zones=[screen];const main=document.getElementById('globalMenuBtn');if(main?.offsetParent!==null&&!document.body.classList.contains('gameOnly'))zones.unshift(main);return [...new Set(zones)]}
// `.soulseekLoadoutCard`/`[data-soulseek-pick]` are here because the starting
// loadout picker builds clickable cards; they are <button>s now, but keeping
// the explicit hooks means any future card markup stays reachable too.
const GAMEPAD_NAVIGABLE_SELECTOR='button:not([disabled]):not(.hidden),input:not([disabled]),select:not([disabled]),summary,[data-race],[data-class],[data-soulseek-pick],[data-gamepad-focusable],[tabindex],.item,.skillCard,.visualSlot,.soulseekLoadoutCard';
function navigableElements(){let scope=visibleGamepadScreen();const zones=gamepadZones();if(gamepadUiMode==='zone'&&zones.length)scope=zones[Math.max(0,Math.min(gamepadZoneIndex,zones.length-1))];const elements=(scope.matches?.(GAMEPAD_NAVIGABLE_SELECTOR)?[scope]:[]).concat([...scope.querySelectorAll(GAMEPAD_NAVIGABLE_SELECTOR)]).filter(el=>el.offsetParent!==null);elements.forEach(el=>{if(!/^(BUTTON|INPUT|SELECT|SUMMARY)$/.test(el.tagName)&&!el.hasAttribute('tabindex'))el.tabIndex=0});return elements}
// Single place that moves the ring, so gamepadFocusedElement always matches
// what is actually highlighted.
function markGamepadFocus(el){document.querySelectorAll('.gamepadFocus').forEach(x=>x.classList.remove('gamepadFocus'));el.classList.add('gamepadFocus');el.focus({preventScroll:true});el.scrollIntoView({block:'nearest'});gamepadFocusedElement=el}
function navigateMenu(direction){const els=navigableElements();if(!els.length)return;let i=els.indexOf(document.activeElement);i=i<0?(direction>0?-1:0):i;markGamepadFocus(els[(i+direction+els.length)%els.length])}
function focusGamepadElement(element){if(!element)return;gamepadUiMode='zone';markGamepadFocus(element)}
function focusCurrentZone(){document.querySelectorAll('.gamepadFocus').forEach(el=>el.classList.remove('gamepadFocus'));navigateMenu(1)}
function shoulderNavigate(direction){if(gameplayInputActive()&&!document.body.classList.contains('gameOnly')){cycleGameTab(direction);gamepadUiMode='tab';const active=document.querySelector('.tabview:not(.hidden)');const first=active?.querySelector('button:not([disabled]),[tabindex],.item,.skillCard,.visualSlot');if(first){first.setAttribute('tabindex',first.getAttribute('tabindex')||'0');markGamepadFocus(first)}return}const zones=gamepadZones();if(!zones.length)return;gamepadUiMode='zone';gamepadZoneIndex=(gamepadZoneIndex+direction+zones.length)%zones.length;focusCurrentZone()}
function returnToGameplay(){gamepadUiMode='gameplay';document.querySelectorAll('.gamepadFocus').forEach(el=>el.classList.remove('gamepadFocus'));canvas?.focus?.({preventScroll:true})}

// True when there is a live run the stick can actually drive: a game in
// progress, the #app screen on top, and no modal/overlay stealing it. This
// is what keeps the stick from walking the hero around behind an open
// level-up or loadout modal.
function gameplayInputActive(){
 if(!game||game.over)return false;
 const app=document.getElementById('app');
 if(!app||app.classList.contains('hidden'))return false;
 return visibleGamepadScreen()===app;
}

// Keeps the focus ring alive while a pad is connected. Two jobs:
//  1) a modal/overlay appears -> focus its first control, so CONFIRM works
//     immediately instead of firing at whatever was focused underneath;
//  2) the focused element DISAPPEARS while the same screen stays open ->
//     focus the first control again. This second case is what unblocked the
//     Soulseek starting-loadout wizard: every step replaces the modal body's
//     innerHTML, which destroys the focused card, and document.activeElement
//     falls back to <body>. The screen element itself never changed, so
//     nothing re-focused, and the pad was left with no cursor and no way to
//     reach CONFIRMAR - the wizard was impossible to finish past the first
//     potion. Any other modal that re-renders itself in place gets the same
//     protection for free.
// Gated on gamepadConnected so mouse and keyboard players never see focus
// move on its own.
// Throttled: visibleGamepadScreen() walks the DOM, and running that on every
// animation frame just to notice a modal opened is wasted work. ~6 checks a
// second is imperceptible for focus latency.
const GAMEPAD_AUTOFOCUS_EVERY_FRAMES=10;
let gamepadAutoFocusTick=0;
// True when the element the PAD had highlighted stopped being usable. Three
// ways that happens in this codebase, all of them in the Soulseek loadout
// wizard alone:
//   - destroyed: the step re-renders the modal body, taking the focused card
//     with it (isConnected goes false);
//   - disabled: CONFIRMAR goes back to disabled at the start of every step,
//     and disabling a focused element blurs it;
//   - hidden: CONFIRMAR is hidden outright on the weapon-type step.
// Deliberately keyed on the ELEMENT, not on document.activeElement, so it
// never fires just because a mouse user clicked empty space - plugging a pad
// in must never make the page snatch focus or scroll on its own.
function gamepadFocusUsable(el){return !!el&&el.isConnected&&!el.disabled&&el.offsetParent!==null&&!el.classList.contains('hidden')}
function gamepadFocusDestroyed(){return !!gamepadFocusedElement&&!gamepadFocusUsable(gamepadFocusedElement)}
function autoFocusGamepadScreen(){
 if(!gamepadConnected)return;
 if(gamepadAutoFocusTick++%GAMEPAD_AUTOFOCUS_EVERY_FRAMES)return;
 const screen=visibleGamepadScreen();
 const screenChanged=screen!==gamepadAutoFocusedScreen;
 gamepadAutoFocusedScreen=screen;
 // Gameplay owns its own "focus": the stick drives the hero, so never pull
 // the ring onto a side-panel button on its own here.
 if(screen===document.body||screen.id==='app'){if(screenChanged)gamepadUiMode='gameplay';return}
 if(!screenChanged&&!gamepadFocusDestroyed())return;
 if(screenChanged){gamepadUiMode='zone';gamepadZoneIndex=0}
 const first=navigableElements()[0];
 if(first)focusGamepadElement(first);else gamepadFocusedElement=null;
}

// ---- On-board aiming cursor ------------------------------------------------
function moveTargetCursor(dx,dy){if(!pendingTargetAction||!game?.player)return;const range=pendingTargetAction.range||1,min=pendingTargetAction.minRange??1;if(!gamepadTargetCursor)gamepadTargetCursor={x:game.player.x,y:game.player.y};const x=Math.max(0,Math.min(COLS-1,gamepadTargetCursor.x+dx)),y=Math.max(0,Math.min(ROWS-1,gamepadTargetCursor.y+dy));gamepadTargetCursor={x,y};pendingAreaHover={x,y};if(pendingTargetAction.mode==='area'&&validateTargetCell(x,y,range,min)){pendingAreaCandidate={x,y};document.getElementById('confirmTargetBtn')?.classList.remove('hidden')}draw()}
function confirmTargetCursor(){if(!pendingTargetAction)return;if(!gamepadTargetCursor)gamepadTargetCursor={x:game.player.x,y:game.player.y};const {x,y}=gamepadTargetCursor;if(pendingTargetAction.mode==='area'){if(!pendingAreaCandidate)moveTargetCursor(0,0);if(pendingAreaCandidate)confirmAreaTarget();return}if(pendingTargetAction.kind==='companionCommand')resolveCompanionCommand(pendingTargetAction.companionId,x,y);else if(pendingTargetAction.kind==='skill')resolveTargetedSkill(pendingTargetAction.slot,x,y);else if(pendingTargetAction.kind==='potion')resolveTargetedPotion(pendingTargetAction.potionId,x,y);else if(pendingTargetAction.kind==='equipment')resolveTargetedEquipmentActive(pendingTargetAction.equipSlot,x,y);else resolveBasicAttack(x,y)}

// ---- Button actions --------------------------------------------------------
function gamepadAction(action){
 if(action==='menu'){openGamepadMenu();return}
 if(action==='fullscreen'){toggleGameOnly();return}
 if(action==='cancel'){
  if(!document.getElementById('gamepadOverlay')?.classList.contains('hidden'))closeGamepadMenu();
  // A cancellable in-page dialog answers "no" to CANCEL, exactly like the
  // native confirm() it replaced.
  else if(document.getElementById('uiPromptModal')?.classList.contains('open'))document.getElementById('uiPromptCancel')?.click();
  else if(pendingTargetAction)cancelTargeting();
  else if(game&&gamepadUiMode!=='gameplay')returnToGameplay();
  return
 }
 if(action==='confirm'){if(pendingTargetAction&&gameplayInputActive())confirmTargetCursor();else document.activeElement?.click?.();return}
 if(action==='prevTab'){shoulderNavigate(-1);return}
 if(action==='nextTab'){shoulderNavigate(1);return}
 // Everything below acts on the run itself, so it stays out of the way while
 // a modal/overlay is on top.
 if(!gameplayInputActive())return;
 if(action==='attack')beginBasicAttack();
 else if(action==='wait')waitBtn.click();
 else if(action.startsWith('skill'))useSkill(Number(action.slice(-1))-1)
}

// ---- Poll loop -------------------------------------------------------------
// Direction handling, split by device:
//  - D-pad: menu focus navigation, always. Edge-triggered plus a hold-repeat
//    so long lists are not one press per row.
//  - Stick: the aiming cursor when targeting, otherwise the character; only
//    falls back to menu navigation on screens with no playable run at all.
function gamepadDirections(pad,pressed,now){
 let dpadStep=0;
 for(const [button,dx,dy] of GAMEPAD_DPAD){
  if(!pressed[button])continue;
  const fresh=!gamepadPrevious[button];
  if(fresh||now>(gamepadRepeat[`d${button}`]||0)){
   gamepadRepeat[`d${button}`]=now+(fresh?GAMEPAD_REPEAT_MS*2:GAMEPAD_REPEAT_MS);
   dpadStep=dy||dx;
  }
 }
 if(dpadStep)navigateMenu(dpadStep);

 const ax=pad.axes[0]||0,ay=pad.axes[1]||0;
 const sx=Math.abs(ax)>GAMEPAD_STICK_DEADZONE?Math.sign(ax):0,sy=Math.abs(ay)>GAMEPAD_STICK_DEADZONE?Math.sign(ay):0;
 if(!sx&&!sy){gamepadRepeat.stick=0;return}
 if(now<=(gamepadRepeat.stick||0))return;
 gamepadRepeat.stick=now+GAMEPAD_REPEAT_MS;
 // One axis at a time: the grid is 4-directional, and the dominant axis is
 // what the player meant.
 const mx=Math.abs(sx)>Math.abs(sy)?sx:0,my=Math.abs(sy)>=Math.abs(sx)?sy:0;
 if(pendingTargetAction&&gameplayInputActive())moveTargetCursor(mx,my);
 else if(gameplayInputActive()){if(!busy&&!game.over)move(mx,my)}
 else navigateMenu(my||mx);
}
function pollGamepads(now=0){
 const pad=[...(navigator.getGamepads?.()||[])].find(Boolean),status=document.getElementById('gamepadStatus');
 gamepadConnected=!!pad;
 if(status){status.textContent=pad?`Conectado: ${pad.id}`:'Sin mando detectado';status.classList.toggle('connected',!!pad)}
 if(pad){
  const pressed=pad.buttons.map(b=>b.pressed);
  if(gamepadListening!==null){
   const index=pressed.findIndex((p,i)=>p&&!gamepadPrevious[i]);
   if(index>=0){gamepadBindings[gamepadListening]=index;gamepadListening=null;localStorage.setItem('gamepadBindings',JSON.stringify(gamepadBindings));renderGamepadBindings()}
  }else{
   autoFocusGamepadScreen();
   for(const [action,index] of Object.entries(gamepadBindings))if(pressed[index]&&!gamepadPrevious[index])gamepadAction(action);
   gamepadDirections(pad,pressed,now);
  }
  gamepadPrevious=pressed;
 }else{gamepadPrevious=[];gamepadAutoFocusedScreen=null;gamepadFocusedElement=null}
 requestAnimationFrame(pollGamepads);
}
addEventListener('gamepadconnected',()=>renderGamepadBindings());
requestAnimationFrame(pollGamepads);
