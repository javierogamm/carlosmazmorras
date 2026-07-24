const SUPABASE_TABLE='user_pj';

function supabaseConfig(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
function requestId(req){return req.query?.id||req.body?.id||req.body?.pj_id||null}
function cleanPj(body){
 return {
  nombre:body.nombre??null,
  pj_name:body.pj_name??null,
  pj_json:body.pj_json??null,
  pj_status:body.pj_status??'alive',
  pj_score:body.pj_score??0,
  last_use:body.last_use??new Date().toISOString()
 };
}

module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.method==='GET'){
   const id=req.query?.id||null;
   const nombre=req.query?.nombre||null;
   if(id){
    const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:headers(key)});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json(data);
    return res.status(200).json(Array.isArray(data)?data[0]||null:data);
   }
   if(nombre){
    const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=*&nombre=eq.${encodeURIComponent(nombre)}&order=last_use.desc.nullslast`,{headers:headers(key)});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json(data);
    return res.status(200).json(data);
   }
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,created_at,nombre,pj_name,pj_status,pj_score,last_use,pj_json&order=pj_score.desc.nullslast`,{headers:headers(key)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  if(req.method==='POST'){
   const row=cleanPj(req.body||{});
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}`,{method:'POST',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(Array.isArray(data)?data[0]:data);
  }
  if(req.method==='PUT'){
   const id=requestId(req);
   if(!id)return res.status(400).json({error:'Falta id para actualizar el personaje'});
   const body=req.body||{};
   const row={};
   if('pj_json' in body)row.pj_json=body.pj_json;
   if('pj_status' in body)row.pj_status=body.pj_status;
   if('pj_score' in body)row.pj_score=body.pj_score;
   if('pj_name' in body)row.pj_name=body.pj_name;
   row.last_use=body.last_use??new Date().toISOString();
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  res.setHeader('Allow','GET, POST, PUT');return res.status(405).json({error:'Método no permitido'});
 }catch(e){return res.status(500).json({error:e.message});}
};
