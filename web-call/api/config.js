export default function handler(req,res){
 let iceServers=[{urls:'stun:stun.l.google.com:19302'}];
 try{if(process.env.ICE_SERVERS_JSON)iceServers=JSON.parse(process.env.ICE_SERVERS_JSON);}catch{ return res.status(500).json({error:'Invalid ICE server configuration'}); }
 res.setHeader('Cache-Control','no-store');
 res.json({modelConfigured:Boolean(process.env.FLARE_API_URL),iceServers});
}
