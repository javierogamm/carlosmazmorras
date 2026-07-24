const SUPABASE_TABLE='dungeon_status';

function supabaseConfig(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
function requestId(req){return req.query?.id||req.body?.id||req.body?.session_id||null}

module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.method==='GET'){
   const id=req.query?.id||null;
   if(id){
    const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:headers(key)});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json(data);
    return res.status(200).json(Array.isArray(data)?data[0]||null:data);
   }
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,created_at,dungeon_world_id,"players_ID",dungeon_status&order=created_at.desc`,{headers:headers(key)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  if(req.method==='POST'){
   const body=req.body||{};
   const row={dungeon_world_id:body.dungeon_world_id??null,players_ID:body.players_ID??null,dungeon_status:body.dungeon_status??null};
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}`,{method:'POST',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(Array.isArray(data)?data[0]:data);
  }
  if(req.method==='PUT'){
   const id=requestId(req);
   if(!id)return res.status(400).json({error:'Falta id para actualizar la sesión'});
   const body=req.body||{};
   const row={};
   if('dungeon_status' in body)row.dungeon_status=body.dungeon_status;
   if('players_ID' in body)row.players_ID=body.players_ID;
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  if(req.method==='DELETE'){
   const id=requestId(req);
   if(!id)return res.status(400).json({error:'Falta id para borrar la sesión'});
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{...headers(key),Prefer:'return=representation'}});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  res.setHeader('Allow','GET, POST, PUT, DELETE');return res.status(405).json({error:'Método no permitido'});
 }catch(e){return res.status(500).json({error:e.message});}
};
