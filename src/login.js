// Login bootstrap intentionally lives outside game.js. If an unrelated gameplay,
// editor or dungeon-generation initializer fails, authentication must remain
// available and must report the server response instead of leaving SIGN IN inert.
(function bootstrapLogin(){
 const form=document.getElementById('loginForm');
 const button=document.getElementById('loginBtn');
 const status=document.getElementById('loginStatus');
 const name=document.getElementById('loginName');
 const pass=document.getElementById('loginPass');
 if(!form||!button||!status||!name||!pass||form.dataset.loginReady==='1')return;
 form.dataset.loginReady='1';
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(button.disabled)return;
  button.disabled=true;
  status.textContent='Entrando...';
  try{
   const response=await fetch('/api/user',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({nombre:name.value,pass:pass.value})
   });
   const text=await response.text();
   let data={};
   try{data=text?JSON.parse(text):{}}catch{data={error:text||`Respuesta inválida (HTTP ${response.status})`}}
   if(!response.ok)throw new Error(data.error||data.message||`No se pudo iniciar sesión (HTTP ${response.status})`);
   window.currentUser=data;
   try{localStorage.setItem('mazmorraUser',JSON.stringify(data))}catch{}
   status.textContent=`Sesión iniciada: ${data.nombre}${data.admin?' · admin':''}`;
   const stats=document.getElementById('userProgressStats');
   if(stats){stats.textContent=`Nivel máximo de PJ: ${data.max_pj_lv||0} · PUNTUACIÓN: ${Math.round(data.accumulated_points||0)}`;stats.classList.remove('hidden')}
   document.getElementById('mainMenuActions')?.classList.remove('hidden');
   form.classList.add('hidden');
  }catch(error){status.textContent=error?.message||'No se pudo iniciar sesión'}
  finally{button.disabled=false}
 });
})();
