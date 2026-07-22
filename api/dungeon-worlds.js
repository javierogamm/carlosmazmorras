const SUPABASE_TABLE='dungeon_world';

function supabaseConfig(){
 const url=process.env.SUPABASE_KEY;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_KEY o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.method==='GET'){
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,created_at,world_name,world_json&order=created_at.desc`,{headers:headers(key)});
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
  res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Método no permitido'});
 }catch(e){return res.status(500).json({error:e.message});}
};
