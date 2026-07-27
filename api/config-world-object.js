const SUPABASE_TABLE='config_world_object';

function supabaseConfig(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}

// Icon overrides for fixed, non-user-created world props (altars, keys,
// stairs down, traps, per-room-type markers) - one row per object_key,
// upserted on that column instead of the usual id-based CRUD every other
// config table uses, since the full set of keys is known upfront in the
// client (WORLD_OBJECT_KINDS) rather than admin-created.
module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.method==='GET'){
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=object_key,icon&order=object_key.asc`,{headers:headers(key)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  if(req.method==='PUT'){
   const objectKey=req.body?.object_key;
   if(!objectKey)return res.status(400).json({error:'Falta object_key'});
   const row={object_key:objectKey,icon:req.body?.icon??''};
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?on_conflict=object_key`,{method:'POST',headers:{...headers(key),Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(Array.isArray(data)?data[0]:data);
  }
  res.setHeader('Allow','GET, PUT');return res.status(405).json({error:'Método no permitido'});
 }catch(e){return res.status(500).json({error:e.message});}
};
