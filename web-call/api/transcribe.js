export const config={api:{bodyParser:false}};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Use POST'});
 if(!process.env.FLARE_API_URL)return res.status(503).json({error:'FLARE_API_URL is not configured.'});
 const mime=(req.headers['content-type']||'').split(';')[0];
 if(!['video/mp4','video/webm'].includes(mime))return res.status(415).json({error:'MP4 or WebM required'});
 try{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4000000)return res.status(413).json({error:'Clip exceeds 4 MB. Record a shorter phrase.'});chunks.push(chunk);}
 if(!size)return res.status(400).json({error:'Empty recording'});
 const form=new FormData();form.append('video',new Blob(chunks,{type:mime}),mime==='video/mp4'?'clip.mp4':'clip.webm');
 const r=await fetch(process.env.FLARE_API_URL.replace(/\/$/,'')+'/transcribe',{method:'POST',body:form,signal:AbortSignal.timeout(50000)});const d=await r.json();
 if(!r.ok)return res.status(502).json({error:typeof d.detail==='string'?d.detail:'FLARE rejected the recording'});
 if(typeof d.text!=='string'||!d.text.trim()||d.audio_used!==false)return res.status(502).json({error:'Invalid visual-only transcript'});
 res.json(d);
 }catch{res.status(502).json({error:'Transcription failed or timed out. No message was sent. Please retry.'});}
}
