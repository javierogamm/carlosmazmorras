const SUPABASE_TABLE='config_items';

function supabaseConfig(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
function cleanItem(body){
 const item=body.item_json||body;
 return {
  nombre:body.nombre??item.name??item.nombre??null,
  slot:body.slot??item.slot??null,
  tier:body.tier??item.rarity??item.tier??null,
  icon:body.icon??item.icon??null,
  stats:body.stats??(item.affixes?JSON.stringify(item.affixes):null),
  ilvl:String(body.ilvl??item.itemLevel??item.ilvl??'1'),
  item_json:item
 };
}
module.exports=async(req,res)=>{
 try{
  const {url,key}=supabaseConfig();
  if(req.method==='GET'){
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,created_at,nombre,slot,tier,icon,stats,ilvl,item_json&order=created_at.desc`,{headers:headers(key)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  if(req.method==='POST'){
   const incoming=Array.isArray(req.body)?req.body:[req.body||{}];
   const rows=incoming.map(cleanItem);
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}`,{method:'POST',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(rows)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(data);
  }
  res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Método no permitido'});
 }catch(e){return res.status(500).json({error:e.message});}
};
