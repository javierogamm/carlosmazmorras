const SUPABASE_TABLE='dungeon_world';

function supabaseConfig(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
function setJsonPath(document,path,value){
 const copy=document&&typeof document==='object'?structuredClone(document):{};
 let cursor=copy;
 for(let i=0;i<path.length-1;i++){
  const key=path[i];
  if(!cursor[key]||typeof cursor[key]!=='object')cursor[key]={};
  cursor=cursor[key];
 }
 cursor[path[path.length-1]]=value;
 return copy;
}
module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.method==='GET'){
   const id=req.query?.id||null;
   if(id){
    // single-world fetch: the only place that needs the full (potentially
    // heavy) world_json payload, so listing screens never have to pull it.
    const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,created_at,world_name,world_json&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:headers(key)});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json(data);
    return res.status(200).json(Array.isArray(data)?data[0]||null:data);
   }
   // light=1: listing/lookup views only need id/name/date, not the full
   // precomputed-floors JSON, which grows unbounded with every saved world
   // and can otherwise blow past the serverless response size limit.
   const sel=req.query?.light?'id,created_at,world_name':'id,created_at,world_name,world_json';
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=${sel}&order=created_at.desc`,{headers:headers(key)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  if(req.method==='POST'){
   const body=req.body||{};
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}`,{method:'POST',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify({world_name:body.world_name,world_json:body.world_json})});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(Array.isArray(data)?data[0]:data);
  }
  if(req.method==='PATCH'){
   const body=req.body||{},id=body.id||req.query?.id,changes=Array.isArray(body.changes)?body.changes:[];if(!id)return res.status(400).json({error:'Falta id'});
   if(!changes.length&&body.world_name==null)return res.status(400).json({error:'No hay parámetros modificados'});
   if(changes.some(change=>!Array.isArray(change?.path)||!change.path.length))return res.status(400).json({error:'Cada cambio necesita un path JSON no vacío'});
   // The RPC performs jsonb_set for each changed leaf inside PostgreSQL: the
   // large world_json (maps, enemies and rooms) never travels to this API and
   // is never rewritten from a client-provided full document.
   const r=await fetch(`${url}/rest/v1/rpc/patch_dungeon_world_json`,{method:'POST',headers:headers(key),body:JSON.stringify({p_id:Number(id),p_world_name:body.world_name??null,p_changes:changes})});
   const data=await r.json();
   if(r.ok)return res.status(200).json(Array.isArray(data)?data[0]||null:data);
   const missingRpc=r.status===404||['PGRST202','42883'].includes(data?.code);
   if(!missingRpc)return res.status(r.status).json(data);
   // Compatibilidad con instalaciones antiguas que aún no tienen la RPC.
   const currentResponse=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,world_name,world_json&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:headers(key)});
   const rows=await currentResponse.json();
   if(!currentResponse.ok)return res.status(currentResponse.status).json(rows);
   const current=Array.isArray(rows)?rows[0]:null;
   if(!current)return res.status(404).json({error:'La dungeon ya no existe'});
   const worldJson=changes.reduce((json,change)=>setJsonPath(json,change.path,change.value),current.world_json);
   const payload={world_json:worldJson};if(body.world_name!=null)payload.world_name=body.world_name;
   const fallback=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(payload)});
   const fallbackData=await fallback.json();
   if(!fallback.ok)return res.status(fallback.status).json(fallbackData);
   return res.status(200).json(Array.isArray(fallbackData)?fallbackData[0]||null:fallbackData);
  }
  if(req.method==='DELETE'){
   const id=req.query?.id||req.body?.id;if(!id)return res.status(400).json({error:'Falta id'});const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{...headers(key),Prefer:'return=representation'}});if(!r.ok)return res.status(r.status).json(await r.json());return res.status(200).json({ok:true});
  }
  res.setHeader('Allow','GET, POST, PATCH, DELETE');return res.status(405).json({error:'Método no permitido'});
 }catch(e){return res.status(500).json({error:e.message});}
};
