const SUPABASE_TABLE='config_class';
// Race/class unlock gates (min PJ level + min accumulated points needed to
// pick that race/class at character creation) share this serverless function
// via ?kind=gates instead of getting their own file - Vercel's Hobby plan
// caps a project at 12 Serverless Functions and this repo is already at
// that limit (see config-floor.js's ?kind=object for the same pattern).
const GATES_TABLE='config_unlock_gates';
const RACES_TABLE='config_razas';

function supabaseConfig(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
function cleanClass(body){
 const item=body.class_json||body;
 return {
  nombre:body.nombre??item.name??item.nombre??null,
  icon:body.icon??item.icon??null,
  stats:body.stats??item.stats??null,
  skills:body.skills??item.skills??null,
  class_json:item,
  skills_json:body.skills_json??null,
  advanced:body.advanced??false
 };
}
function requestId(req){return req.query?.id||req.body?.id||req.body?.class_id||null}


async function handleRaces(req,res,url,key){
 const id=req.query?.id||req.body?.id||null;
 if(req.method==='GET'){
  const r=await fetch(`${url}/rest/v1/${RACES_TABLE}?select=id,created_at,nombre,skill,stats&order=nombre.asc`,{headers:headers(key)}),data=await r.json();
  return r.ok?res.status(200).json(data):res.status(r.status).json(data);
 }
 if(req.method==='POST'||req.method==='PUT'){
  if(req.method==='PUT'&&!id)return res.status(400).json({error:'Falta id para actualizar la raza'});
  const row={nombre:req.body?.nombre??null,skill:req.body?.skill??null,stats:req.body?.stats??null};
  const endpoint=req.method==='PUT'?`${url}/rest/v1/${RACES_TABLE}?id=eq.${encodeURIComponent(id)}`:`${url}/rest/v1/${RACES_TABLE}`;
  const r=await fetch(endpoint,{method:req.method==='PUT'?'PATCH':'POST',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)}),data=await r.json();
  return r.ok?res.status(200).json(Array.isArray(data)?data[0]:data):res.status(r.status).json(data);
 }
 if(req.method==='DELETE'){
  if(!id)return res.status(400).json({error:'Falta id para borrar la raza'});
  const r=await fetch(`${url}/rest/v1/${RACES_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{...headers(key),Prefer:'return=representation'}}),data=await r.json();
  return r.ok?res.status(200).json(data):res.status(r.status).json(data);
 }
 res.setHeader('Allow','GET, POST, PUT, DELETE');return res.status(405).json({error:'Método no permitido'});
}

async function handleGates(req,res,url,key){
 if(req.method==='GET'){
  const r=await fetch(`${url}/rest/v1/${GATES_TABLE}?select=type,key,min_level,min_points&order=type.asc,key.asc`,{headers:headers(key)});
  const data=await r.json();
  if(!r.ok)return res.status(r.status).json(data);
  return res.status(200).json(data);
 }
 if(req.method==='PUT'){
  const type=String(req.body?.type||'');
  const gateKey=String(req.body?.key||'');
  if(!['race','class'].includes(type)||!gateKey)return res.status(400).json({error:'Falta type (race/class) o key'});
  const row={type,key:gateKey,min_level:Number(req.body?.min_level)||0,min_points:Number(req.body?.min_points)||0};
  // Older installations do not necessarily have the composite UNIQUE
  // constraint required by PostgREST upsert. Locate the row explicitly so
  // both the update and insert paths work with either database schema.
  const lookup=await fetch(`${url}/rest/v1/${GATES_TABLE}?select=type&type=eq.${encodeURIComponent(type)}&key=eq.${encodeURIComponent(gateKey)}&limit=1`,{headers:headers(key)});
  const matches=await lookup.json();
  if(!lookup.ok)return res.status(lookup.status).json(matches);
  const exists=Array.isArray(matches)&&matches.length>0;
  const endpoint=exists
   ?`${url}/rest/v1/${GATES_TABLE}?type=eq.${encodeURIComponent(type)}&key=eq.${encodeURIComponent(gateKey)}`
   :`${url}/rest/v1/${GATES_TABLE}`;
  const r=await fetch(endpoint,{method:exists?'PATCH':'POST',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)});
  const data=await r.json();
  if(!r.ok)return res.status(r.status).json(data);
  return res.status(200).json(Array.isArray(data)?data[0]:data);
 }
 res.setHeader('Allow','GET, PUT');return res.status(405).json({error:'Método no permitido'});
}

module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.query?.kind==='gates')return handleGates(req,res,url,key);
  if(req.query?.kind==='races')return handleRaces(req,res,url,key);
  if(req.method==='GET'){
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,created_at,nombre,icon,stats,skills,class_json,skills_json,advanced&order=nombre.asc`,{headers:headers(key)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  if(req.method==='POST'){
   const row=cleanClass(req.body||{});
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}`,{method:'POST',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(Array.isArray(data)?data[0]:data);
  }
  if(req.method==='PUT'){
   const id=requestId(req);
   if(!id)return res.status(400).json({error:'Falta id para actualizar la clase'});
   const row=cleanClass(req.body||{});
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  res.setHeader('Allow','GET, POST, PUT');return res.status(405).json({error:'Método no permitido'});
 }catch(e){return res.status(500).json({error:e.message});}
};
