export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!process.env.FLARE_API_URL)return res.status(503).json({error:'FLARE_API_URL has not been configured for this deployment.'});
 try{const r=await fetch(process.env.FLARE_API_URL.replace(/\/$/,'')+'/ready',{signal:AbortSignal.timeout(15000)});const d=await r.json();res.status(r.ok&&d.model_loaded===true?200:503).json(d);}
 catch{res.status(503).json({error:'The FLARE service is unavailable. Typed messages and the call still work.'});}
}
