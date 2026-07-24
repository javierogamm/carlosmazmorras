const SUPABASE_TABLE='user';

function supabaseConfig(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
function publicUser(row){return {id:row.id,nombre:row.nombre,admin:!!row.config};}

module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.method!=='POST'){
   res.setHeader('Allow','POST');
   return res.status(405).json({error:'Método no permitido'});
  }
  const nombre=String(req.body?.nombre||'').trim();
  const pass=String(req.body?.pass||'').trim();
  if(!nombre||!pass)return res.status(400).json({error:'Faltan usuario o contraseña'});
  const selectUrl=`${url}/rest/v1/${SUPABASE_TABLE}?select=id,created_at,nombre,pass,config&nombre=eq.${encodeURIComponent(nombre)}&limit=1`;
  const found=await fetch(selectUrl,{headers:headers(key)});
  const users=await found.json();
  if(!found.ok)return res.status(found.status).json(users);
  const existing=Array.isArray(users)?users[0]:null;
  if(!existing)return res.status(404).json({error:'Usuario no existe'});
  if(String(existing.pass||'')!==pass)return res.status(401).json({error:'Contraseña incorrecta'});
  return res.status(200).json(publicUser(existing));
 }catch(e){return res.status(500).json({error:e.message});}
};
