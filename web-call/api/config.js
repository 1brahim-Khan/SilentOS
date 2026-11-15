export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 let iceServers=[{urls:'stun:stun.l.google.com:19302'}];
 try{
  if(process.env.ICE_SERVERS_JSON){iceServers=JSON.parse(process.env.ICE_SERVERS_JSON);if(!Array.isArray(iceServers)||!iceServers.length||iceServers.some(s=>!s||!(typeof s.urls==='string'||Array.isArray(s.urls))))throw Error('Invalid ICE configuration');}
 }catch{return res.status(500).json({error:'Invalid ICE_SERVERS_JSON server configuration'});}
 const relayConfigured=iceServers.some(s=>[s.urls].flat().some(url=>/^turns?:/i.test(url)));
 res.json({voiceProvider:'gradium',voiceConfigured:Boolean(process.env.GRADIUM_API_KEY&&process.env.GRADIUM_VOICE_ID),modelConfigured:Boolean(process.env.FLARE_API_URL),relayConfigured,iceServers});
}
