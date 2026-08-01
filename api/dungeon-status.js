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
    // light=1: only the optimistic-lock revision, for cheap high-frequency polling
    if(req.query?.light){
     const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=id,rev:dungeon_status->>rev&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:headers(key)});
     const data=await r.json();
     if(!r.ok)return res.status(r.status).json(data);
     return res.status(200).json(Array.isArray(data)?data[0]||null:data);
    }
    const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,{headers:headers(key)});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json(data);
    return res.status(200).json(Array.isArray(data)?data[0]||null:data);
   }
   // light=1: session list without the heavy floor snapshots (JSON projections)
   if(req.query?.light){
    const sel='id,created_at,dungeon_world_id,"players_ID",multiplayer:dungeon_status->multiplayer,started:dungeon_status->started,hostUser:dungeon_status->>hostUser,currentFloor:dungeon_status->currentFloor,turn:dungeon_status->turn,roster:dungeon_status->roster';
    const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?select=${encodeURIComponent(sel)}&order=created_at.desc`,{headers:headers(key)});
    const data=await r.json();
    if(!r.ok)return res.status(r.status).json(data);
    return res.status(200).json((Array.isArray(data)?data:[]).map(row=>({id:row.id,created_at:row.created_at,dungeon_world_id:row.dungeon_world_id,players_ID:row.players_ID,dungeon_status:{multiplayer:row.multiplayer===true,started:row.started===true,hostUser:row.hostUser,currentFloor:Number(row.currentFloor)||1,turn:Number(row.turn)||0,roster:row.roster||[]}})));
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
   let filter=`id=eq.${encodeURIComponent(id)}`;
   const expectedRev=body.expectedRev;
   const hasExpectedRev=expectedRev!==undefined&&expectedRev!==null;
   if(hasExpectedRev)filter+=`&dungeon_status->>rev=eq.${encodeURIComponent(String(expectedRev))}`;
   // minimal=true (opt-in, used by the every-turn autosave which never reads
   // its own write back) skips echoing the whole floor snapshot - map,
   // enemies, chests... - down again. Same idea as the direct-Supabase
   // dsPatch() minimal path in game.js, just for callers stuck on this
   // serverless fallback instead of talking to Supabase REST directly.
   const minimal=!!body.minimal;
   const prefer=minimal?'return=minimal,count=exact':'return=representation';
   const r=await fetch(`${url}/rest/v1/${SUPABASE_TABLE}?${filter}`,{method:'PATCH',headers:{...headers(key),Prefer:prefer},body:JSON.stringify(row)});
   if(minimal){
    if(!r.ok){const err=await r.json().catch(()=>({error:'No se pudo actualizar'}));return res.status(r.status).json(err)}
    if(hasExpectedRev){
     const cr=r.headers.get('content-range');
     if(!cr||/\/0$/.test(cr))return res.status(409).json({conflict:true,error:'La sesión cambió mientras tanto, vuelve a intentarlo'});
    }
    return res.status(200).json({ok:true});
   }
   const data=await r.json();
   if(!r.ok)return res.status(r.status).json(data);
   if(hasExpectedRev&&Array.isArray(data)&&data.length===0)return res.status(409).json({conflict:true,error:'La sesión cambió mientras tanto, vuelve a intentarlo'});
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
