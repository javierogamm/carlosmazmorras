const SUPABASE_TABLE='user';
const USER_PJ_TABLE='user_pj';

function supabaseConfig(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
// soulseek_races/classes/skills are permanent account-level unlock pools
// (Fase 3's shop); soulseek_session_items is the ephemeral item stash the
// shop fills, consumed by the next Soulseeker character created and
// cleared on that character's death. All four are json columns - parse
// defensively since a fresh row (or a legacy one predating this feature)
// may still have the SQL default '[]' as a string, null, or already-parsed
// json depending on the driver.
function parseJsonArray(v){
 if(Array.isArray(v))return v;
 if(typeof v==='string'){try{const p=JSON.parse(v||'[]');return Array.isArray(p)?p:[]}catch{return []}}
 return [];
}
function publicUser(row){return {id:row.id,nombre:row.nombre,admin:!!row.config,max_pj_lv:Number(row.max_pj_lv)||0,accumulated_points:Number(row.accumulated_points)||0,souls:Number(row.souls)||0,soulseek_races:parseJsonArray(row.soulseek_races),soulseek_classes:parseJsonArray(row.soulseek_classes),soulseek_skills:parseJsonArray(row.soulseek_skills),soulseek_session_items:parseJsonArray(row.soulseek_session_items)};}
// Recomputes max_pj_lv/accumulated_points straight from user_pj on every
// login, instead of trusting the cached columns - self-heals any user whose
// aggregates went stale (character saved before this feature existed, a
// write that raced/failed, etc.) without needing a manual backfill.
async function syncUserAggregates(url,key,nombre,row){
 try{
  const r=await fetch(`${url}/rest/v1/${USER_PJ_TABLE}?select=pj_score,level:pj_json->player->>level&nombre=eq.${encodeURIComponent(nombre)}`,{headers:headers(key)});
  const chars=await r.json();
  if(!r.ok||!Array.isArray(chars))return row;
  const maxLevel=chars.reduce((m,c)=>Math.max(m,Number(c.level)||1),0);
  const totalScore=chars.reduce((s,c)=>s+(Number(c.pj_score)||0),0);
  const fresh={...row,max_pj_lv:maxLevel,accumulated_points:totalScore};
  // Aggregate persistence is best-effort and must never invalidate valid
  // credentials. Supabase may return 204/empty data (or [] under restrictive
  // RLS) even when the PATCH succeeds, so do not parse or return that body.
  await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?nombre=eq.${encodeURIComponent(nombre)}`,{method:'PATCH',headers:{...headers(key),Prefer:'return=minimal'},body:JSON.stringify({max_pj_lv:maxLevel,accumulated_points:totalScore})});
  return fresh;
 }catch{return row}
}

module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.method==='PUT'){
   // Soulseek Mode's account-level Soul Spike bank: souls kept permanently
   // when a Soulseeker character is let die instead of revived (Fase 1),
   // and spent on unlocks later (Fase 3). Distinct from user_pj.souls, the
   // per-character spendable stash used for in-run revives.
   const nombre=String(req.body?.nombre||'').trim();
   if(!nombre)return res.status(400).json({error:'Falta usuario'});
   const selectUrl=`${url}/rest/v1/${SUPABASE_TABLE}?select=id,nombre,souls&nombre=eq.${encodeURIComponent(nombre)}&limit=1`;
   const found=await fetch(selectUrl,{headers:headers(key)});
   const users=await found.json();
   if(!found.ok)return res.status(found.status).json(users);
   const existing=Array.isArray(users)?users[0]:null;
   if(!existing)return res.status(404).json({error:'Usuario no encontrado'});
   const current=Number(existing.souls)||0;
   const next=Object.prototype.hasOwnProperty.call(req.body||{},'soulsDelta')
    ?Math.max(0,current+(Number(req.body.soulsDelta)||0))
    :Math.max(0,Number(req.body?.souls)||0);
   const patch={souls:next};
   // Fase 3: the shop persists unlock pools/session items through this
   // same endpoint - only touch a field the caller actually sent, so a
   // plain souls-only PUT (revive-or-bank on death) never has to know
   // about them.
   for(const field of ['soulseek_races','soulseek_classes','soulseek_skills','soulseek_session_items'])
    if(Object.prototype.hasOwnProperty.call(req.body||{},field))patch[field]=Array.isArray(req.body[field])?req.body[field]:[];
   const patched=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?nombre=eq.${encodeURIComponent(nombre)}`,{method:'PATCH',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(patch)});
   const data=await patched.json();
   if(!patched.ok)return res.status(patched.status).json(data);
   return res.status(200).json(publicUser(Array.isArray(data)?data[0]:data));
  }
  if(req.method!=='POST'){
   res.setHeader('Allow','POST, PUT');
   return res.status(405).json({error:'Método no permitido'});
  }
  const nombre=String(req.body?.nombre||'').trim();
  const pass=String(req.body?.pass||'').trim();
  if(!nombre||!pass)return res.status(400).json({error:'Faltan usuario o contraseña'});
  const selectUrl=`${url}/rest/v1/${SUPABASE_TABLE}?select=id,created_at,nombre,pass,config,max_pj_lv,accumulated_points,souls,soulseek_races,soulseek_classes,soulseek_skills,soulseek_session_items&nombre=eq.${encodeURIComponent(nombre)}&limit=1`;
  const found=await fetch(selectUrl,{headers:headers(key)});
  const users=await found.json();
  if(!found.ok)return res.status(found.status).json(users);
  const existing=Array.isArray(users)?users[0]:null;
  if(existing){
   if(String(existing.pass||'')!==pass)return res.status(401).json({error:'Contraseña incorrecta'});
   const fresh=await syncUserAggregates(url,key,existing.nombre,existing);
   return res.status(200).json(publicUser(fresh));
  }
  const created=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}`,{method:'POST',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify({nombre,pass,config:false})});
  const data=await created.json();
  if(!created.ok)return res.status(created.status).json(data);
  return res.status(200).json(publicUser(Array.isArray(data)?data[0]:data));
 }catch(e){return res.status(500).json({error:e.message});}
};
