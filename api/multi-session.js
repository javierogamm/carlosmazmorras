const SUPABASE_TABLE='multi_session';

function supabaseConfig(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
function requestId(req){return req.query?.id||req.body?.id||null}

module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.method==='GET'){
   const online=req.query?.online;
   const since=req.query?.since;
   if(online){
    let q=`${url}/rest/v1/${SUPABASE_TABLE}?select=id,login_time,user_id&logout_time=is.null&order=login_time.desc`;
    if(since)q+=`&login_time=gte.${encodeURIComponent(since)}`;
    const r=await fetch(q,{headers:headers(key)});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json(data);
    return res.status(200).json(data);
   }
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,login_time,user_id,logout_time&order=login_time.desc`,{headers:headers(key)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  if(req.method==='POST'){
   const body=req.body||{};
   const row={user_id:body.user_id??null};
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
   if(body.heartbeat)row.login_time=new Date().toISOString();
   if(body.logout)row.logout_time=new Date().toISOString();
   if(!Object.keys(row).length)return res.status(400).json({error:'Nada que actualizar'});
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(row)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  res.setHeader('Allow','GET, POST, PUT');return res.status(405).json({error:'Método no permitido'});
 }catch(e){return res.status(500).json({error:e.message});}
};
