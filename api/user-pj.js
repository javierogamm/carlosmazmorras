const SUPABASE_TABLE='user_pj';
const {randomBytes}=require('node:crypto');

function supabaseConfig(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key){return {apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};}
function requestId(req){return req.query?.id||req.body?.id||req.body?.pj_id||null}
// The original Supabase project generated the bigint primary key itself, but
// migrated tables are sometimes recreated as `int8 NOT NULL` without an
// identity/default. Keep the normal insert first (so identity columns continue
// to work) and only provide an explicit, JS-safe bigint when Postgres reports
// that `id` was null.
function generatedPjId(){return randomBytes(6).readUIntBE(0,6)+1}
function missingGeneratedId(error){
 return error?.code==='23502'&&/\bid\b/i.test(`${error.message||''} ${error.details||''}`);
}
// The `shards` column is a plain TEXT column (not jsonb), so the API always
// stores/reads a JSON-encoded string there - encode on the way in, decode on
// the way out, so callers never have to think about the storage format.
function shardsToText(v){try{return JSON.stringify(v&&typeof v==='object'?v:{})}catch{return '{}'}}
function shardsFromText(v){
 if(v&&typeof v==='object')return v;
 if(typeof v==='string'){try{const p=JSON.parse(v||'{}');return p&&typeof p==='object'?p:{}}catch{return {}}}
 return {};
}
function withParsedShards(row){if(row&&typeof row==='object'&&'shards' in row)row.shards=shardsFromText(row.shards);return row}
// Keeps `user.max_pj_lv`/`user.accumulated_points` in sync with the highest
// character level and the summed pj_score (the same number shown in the
// PUNTUACIONES/top-players table) across every character - alive or dead -
// that belongs to this username. Best-effort: a failure here must never
// block saving the character itself.
async function updateUserAggregates(url,key,nombre){
 if(!nombre)return;
 try{
  // Only pj_score and the nested player level are needed here - selecting the
  // full pj_json (every character's whole inventory/equipment) was pulling
  // megabytes of unused data out of Supabase on every single save, since this
  // runs after every character PUT (i.e. every turn during play).
  const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=pj_score,level:pj_json->player->>level&nombre=eq.${encodeURIComponent(nombre)}`,{headers:headers(key)});
  const rows=await r.json();
  if(!r.ok||!Array.isArray(rows))return;
  const maxLevel=rows.reduce((m,row)=>Math.max(m,Number(row.level)||1),0);
  const totalScore=rows.reduce((s,row)=>s+(Number(row.pj_score)||0),0);
  await fetch(`${url}/rest/v1/user?nombre=eq.${encodeURIComponent(nombre)}`,{method:'PATCH',headers:headers(key),body:JSON.stringify({max_pj_lv:maxLevel,accumulated_points:totalScore})});
 }catch(e){/* ignore - aggregate refresh is best-effort */}
}
function cleanPj(body){
 return {
  nombre:body.nombre??null,
  pj_name:body.pj_name??null,
  pj_json:body.pj_json??null,
  pj_status:body.pj_status??'alive',
  pj_score:body.pj_score??0,
  // tier shards from the Creator's Room disenchant altar - a real column,
  // not nested in pj_json, so it can be updated independently
  shards:shardsToText(body.shards),
  // items created/edited in the Creator's Room (craft system) - exclusive
  // to this character, not part of the shared config_items catalog
  custom_items:body.custom_items??[],
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
    return res.status(200).json(Array.isArray(data)?withParsedShards(data[0])||null:withParsedShards(data));
   }
   if(nombre){
    const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=*&nombre=eq.${encodeURIComponent(nombre)}&order=last_use.desc.nullslast`,{headers:headers(key)});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json(data);
    return res.status(200).json(Array.isArray(data)?data.map(withParsedShards):data);
   }
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,created_at,nombre,pj_name,pj_status,pj_score,last_use,pj_json,shards,custom_items&order=pj_score.desc.nullslast`,{headers:headers(key)});
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   return res.status(200).json(Array.isArray(data)?data.map(withParsedShards):data);
  }
  if(req.method==='POST'){
   const row=cleanPj(req.body||{});
   const insert=payload=>fetch(`${url}/rest/v1/${SUPABASE_TABLE}`,{method:'POST',headers:{...headers(key),Prefer:'return=representation'},body:JSON.stringify(payload)});
   let r=await insert(row);
   let data=await r.json();
   if(!r.ok&&missingGeneratedId(data)){
    row.id=generatedPjId();
    r=await insert(row);
    data=await r.json();
   }
   if(!r.ok)return res.status(r.status).json(data);
   await updateUserAggregates(url,key,row.nombre);
   return res.status(200).json(Array.isArray(data)?withParsedShards(data[0]):withParsedShards(data));
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
   if('shards' in body)row.shards=shardsToText(body.shards);
   if('custom_items' in body)row.custom_items=body.custom_items;
   row.last_use=body.last_use??new Date().toISOString();
   // minimal=true (opt-in, used by the every-turn autosave) skips echoing the
   // whole character - inventory, equipment, effects - back down on a write
   // nobody reads. Callers that still need the saved row keep the default.
   const minimal=!!body.minimal;
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...headers(key),Prefer:minimal?'return=minimal':'return=representation'},body:JSON.stringify(row)});
   if(minimal){
    if(!r.ok){const err=await r.json().catch(()=>({error:'No se pudo actualizar'}));return res.status(r.status).json(err)}
    await updateUserAggregates(url,key,body.nombre||null);
    return res.status(200).json({ok:true});
   }
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   const savedRow=Array.isArray(data)?data[0]:data;
   await updateUserAggregates(url,key,savedRow?.nombre);
   return res.status(200).json(Array.isArray(data)?data.map(withParsedShards):withParsedShards(data));
  }
  res.setHeader('Allow','GET, POST, PUT');return res.status(405).json({error:'Método no permitido'});
 }catch(e){return res.status(500).json({error:e.message});}
};
