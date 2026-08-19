// ============================================================================
// NORMAL MODE - "Creando personaje"/"Creando dungeon" loading overlays.
// Loaded after game.js (and, harmlessly, after every Soulseek file - it has
// no dependency on them and works identically whether or not Soulseek mode
// is ever touched). Same shared-scope classic-script pattern as the
// Soulseek files: nothing here edits game.js's source.
//
// game.js binds both target buttons with a direct property assignment
// (`startBtn.onclick=start;createWorldBtn.onclick=createDungeonWorld;`),
// which copies the function VALUE at that moment - reassigning the global
// `start`/`createDungeonWorld` names afterwards would never be seen by
// those already-bound handlers (the same lesson learned wiring the
// Soulseek buttons), so both buttons are rebound directly here instead.
// finishCharacterCreation() is different: it's only ever invoked as a bare
// identifier call from inside the skill-choice modal's click handler, so
// reassigning that global is enough on its own.
// ============================================================================

(function injectLoadingOverlayStyles(){
 const style=document.createElement('style');
 style.textContent=`
  #loadingOverlay{position:fixed;inset:0;z-index:10500;background:#050308f0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px;text-align:center}
  #loadingOverlay.open{display:flex}
  #loadingOverlay .loadingHourglass{font-size:64px;animation:loadingHourglassFlip 1.6s ease-in-out infinite}
  #loadingOverlay .loadingText{color:#e8d6ff;font-size:15px;letter-spacing:.04em}
  @keyframes loadingHourglassFlip{0%,15%{transform:rotate(0)}45%,55%{transform:rotate(180deg)}85%,100%{transform:rotate(360deg)}}
 `;
 document.head.appendChild(style);
})();

function loadingEnsureOverlay(){
 if(document.getElementById('loadingOverlay'))return;
 const div=document.createElement('div');
 div.id='loadingOverlay';
 div.innerHTML=`<div class="loadingHourglass">⏳</div><div class="loadingText" id="loadingOverlayText">Cargando...</div>`;
 document.body.appendChild(div);
}
function loadingShow(text){
 loadingEnsureOverlay();
 const el=document.getElementById('loadingOverlayText');
 if(el)el.textContent=text||'Cargando...';
 document.getElementById('loadingOverlay').classList.add('open');
}
function loadingHide(){
 document.getElementById('loadingOverlay')?.classList.remove('open');
}

(function wireNormalModeLoadingOverlays(){
 loadingEnsureOverlay();

 // -- character creation: start() itself only spans the async setup (load
 // -- config, build the game object, open the initial skill-choice modal)
 // -- and returns as soon as that modal is open - it never awaits the
 // -- player's pick, so wrapping it shows the spinner exactly during the
 // -- network-bound wait and hides it right as the modal appears. --
 const startBtn=document.getElementById('startBtn');
 if(startBtn){
  const originalStartClick=startBtn.onclick;
  startBtn.onclick=async function(...args){
   loadingShow('Creando personaje...');
   try{
    await originalStartClick?.apply(this,args);
   }finally{
    loadingHide();
   }
  };
 }
 // -- the actual save (POST + navigate away) happens later, once the
 // -- player picks their first skill - a second, separate wait. --
 const originalFinishCharacterCreation=finishCharacterCreation;
 finishCharacterCreation=async function(...args){
  loadingShow('Creando personaje...');
  try{
   return await originalFinishCharacterCreation.apply(this,args);
  }finally{
   loadingHide();
  }
 };

 // -- admin's "CREAR DUNGEON Y CALCULAR CONTENIDOS" - precomputes every
 // -- floor of a brand new dungeon_world up front, which can take a
 // -- noticeable moment for a many-floor world. --
 const createWorldBtn=document.getElementById('createWorldBtn');
 if(createWorldBtn){
  const originalCreateWorldClick=createWorldBtn.onclick;
  createWorldBtn.onclick=async function(...args){
   loadingShow('Creando dungeon...');
   try{
    await originalCreateWorldClick?.apply(this,args);
   }finally{
    loadingHide();
   }
  };
 }
})();
