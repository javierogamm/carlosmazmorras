// Public Supabase config for the browser: enables Realtime broadcast and
// direct REST on the multiplayer hot path (skips serverless cold starts).
// The anon key is the same one every /api proxy already uses unauthenticated.
module.exports=async(req,res)=>{
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;
 if(!url||!key)return res.status(500).json({error:'Faltan SUPABASE_URL o SUPABASE_ANON_KEY'});
 res.setHeader('Cache-Control','public, max-age=3600');
 return res.status(200).json({url:url.replace(/\/$/,''),key});
};
