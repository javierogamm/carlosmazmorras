const SUPABASE_TABLE='config_class';

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
  class_json:item
 };
}
function requestId(req){return req.query?.id||req.body?.id||req.body?.class_id||null}
module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.method==='GET'){
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,created_at,nombre,icon,stats,skills,class_json&order=nombre.asc`,{headers:headers(key)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
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
  res.setHeader('Allow','GET, PUT');return res.status(405).json({error:'Método no permitido'});
 }catch(e){return res.status(500).json({error:e.message});}
};
