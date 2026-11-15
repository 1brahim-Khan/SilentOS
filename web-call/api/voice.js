export function finalizeWav(audio){
 if(audio.length<44||audio.toString('ascii',0,4)!=='RIFF'||audio.toString('ascii',8,12)!=='WAVE')throw Error('Invalid WAV');
 let offset=12,found=false;
 while(offset+8<=audio.length){const tag=audio.toString('ascii',offset,offset+4),size=audio.readUInt32LE(offset+4);if(tag==='data'){audio.writeUInt32LE(audio.length-offset-8,offset+4);found=true;break;}offset+=8+size+(size%2);}
 if(!found)throw Error('Missing WAV data');audio.writeUInt32LE(audio.length-8,4);return audio;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Use POST'});
 if(!process.env.GRADIUM_API_KEY||!process.env.GRADIUM_VOICE_ID)return res.status(503).json({error:'Gradium voice is not configured on the server.'});
 let text;try{const d=typeof req.body==='string'?JSON.parse(req.body):req.body;text=d?.text;if(typeof text!=='string'||!text.trim()||text.length>500)throw Error();}catch{return res.status(400).json({error:'Provide 1–500 characters of text.'});}
 try{
 const r=await fetch('https://api.gradium.ai/api/speech/tts',{method:'POST',headers:{'x-api-key':process.env.GRADIUM_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({text:text.trim(),voice_id:process.env.GRADIUM_VOICE_ID,output_format:'wav',only_audio:true}),signal:AbortSignal.timeout(45000)});
 if(!r.ok){await r.body?.cancel();return res.status(502).json({error:r.status===429?'Gradium rate limit reached. Caption remains available.':'Gradium rejected voice generation. Check the key, voice ID and credits.'});}
 if(!r.headers.get('content-type')?.startsWith('audio/wav'))throw Error('format');
 const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>4000000)throw Error('size');chunks.push(Buffer.from(chunk));}
 if(size<44)throw Error('empty');res.setHeader('Content-Type','audio/wav');res.setHeader('X-Voice-Provider','gradium');res.status(200).send(finalizeWav(Buffer.concat(chunks)));
 }catch{return res.status(502).json({error:'Gradium speech failed or timed out. Caption remains available.'});}
}
