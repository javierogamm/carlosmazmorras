const SUPABASE_TABLE='config_floor';
// World-object icon overrides (altars, keys, stairs, traps, room markers)
// share this serverless function via ?kind=object instead of getting their
// own file - Vercel's Hobby plan caps a project at 12 Serverless Functions,
// and this repo was already at that limit before this table existed.
const WORLD_OBJECT_TABLE='config_world_object';

function supabaseConfig(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
function cleanFloor(body){
 const floor=body.floor_json||body;
 return {floor_name:body.floor_name??floor.name??floor.floor_name??'Floor sin nombre',floor_json:floor};
}
function requestId(req){return req.query?.id||req.body?.id||req.body?.floor_id||null}

// User-created decoration assets are world-object rows whose object_key
// carries this prefix, so they can be told apart from the fixed catalog of
// system keys (altars, traps, stairs...) that only ever get their icon
// edited, never created/deleted through the API.
const ASSET_KEY_PREFIX='asset_';

async function handleWorldObjects(req,res,url,key){
 if(req.method==='GET'){
  const r=await fetch(`${url}/rest/v1/${WORLD_OBJECT_TABLE}?select=id,object_key,icon,name,tiles_number&order=object_key.asc`,{headers:headers(key)});
  const data=await r.json();
  if(!r.ok)return res.status(r.status).json(data);
  return res.status(200).json(data);
 }
 if(req.method==='POST'){
  const objectKey=`${ASSET_KEY_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
  const row={object_key:objectKey,icon:req.body?.icon??'',name:req.body?.name||'Asset sin nombre',tiles_number:req.body?.tiles_number||'1;1'};
  const r=await fetch(`${url}/rest/v1/${WORLD_OBJECT_TABLE}`,{method:'POST',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)});
  const data=await r.json();
  if(!r.ok)return res.status(r.status).json(data);
  return res.status(200).json(Array.isArray(data)?data[0]:data);
 }
 if(req.method==='PUT'){
  const objectKey=req.body?.object_key;
  if(!objectKey)return res.status(400).json({error:'Falta object_key'});
  const row={object_key:objectKey,icon:req.body?.icon??''};
  if(req.body?.name!==undefined)row.name=req.body.name;
  if(req.body?.tiles_number!==undefined)row.tiles_number=req.body.tiles_number;
  const r=await fetch(`${url}/rest/v1/${WORLD_OBJECT_TABLE}?on_conflict=object_key`,{method:'POST',headers:{...headers(key),Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});
  const data=await r.json();
  if(!r.ok)return res.status(r.status).json(data);
  return res.status(200).json(Array.isArray(data)?data[0]:data);
 }
 if(req.method==='DELETE'){
  const objectKey=req.query?.object_key||req.body?.object_key;
  if(!objectKey)return res.status(400).json({error:'Falta object_key'});
  if(!objectKey.startsWith(ASSET_KEY_PREFIX))return res.status(400).json({error:'Solo se pueden borrar assets (object_key con prefijo asset_)'});
  const r=await fetch(`${url}/rest/v1/${WORLD_OBJECT_TABLE}?object_key=eq.${encodeURIComponent(objectKey)}`,{method:'DELETE',headers:{...headers(key),Prefer:'return=representation'}});
  const data=await r.json();
  if(!r.ok)return res.status(r.status).json(data);
  return res.status(200).json(data);
 }
 res.setHeader('Allow','GET, POST, PUT, DELETE');return res.status(405).json({error:'Método no permitido'});
}

module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.query?.kind==='object')return handleWorldObjects(req,res,url,key);
  if(req.method==='GET'){
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,created_at,floor_name,floor_json&order=floor_name.asc`,{headers:headers(key)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  if(req.method==='POST'){
   const row=cleanFloor(req.body||{});
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}`,{method:'POST',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(Array.isArray(data)?data[0]:data);
  }
  if(req.method==='PUT'){
   const id=requestId(req);
   if(!id)return res.status(400).json({error:'Falta id para actualizar el floor'});
   const row=cleanFloor(req.body||{});
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  if(req.method==='DELETE'){
   const id=requestId(req);
   if(!id)return res.status(400).json({error:'Falta id para borrar el floor'});
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{...headers(key),Prefer:'return=representation'}});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  res.setHeader('Allow','GET, POST, PUT, DELETE');return res.status(405).json({error:'Método no permitido'});
 }catch(e){return res.status(500).json({error:e.message});}
};
