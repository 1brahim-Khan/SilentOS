// Use the call's AudioContext so Enable sound also resumes mobile speech playback.
window.GradiumVoice=class{
 constructor(context,report){this.context=context;this.report=report;this.queue=[];this.busy=false;this.epoch=0;this.node=null;this.controller=null;this.finish=null;}
 enqueue(text){const chunks=text.match(/[\s\S]{1,450}(?:\s|$)|[\s\S]{1,450}/g)||[];if(this.queue.length+chunks.length>12){this.report('Speech queue full. Read the captions.');return;}this.queue.push(...chunks);this.drain();}
 async drain(){if(this.busy||!this.queue.length)return;this.busy=true;const epoch=this.epoch,text=this.queue.shift();try{
 const context=this.context();if(!context||context.state==='closed')throw Error('Join the call to hear speech.');
 this.controller=new AbortController();const timeout=setTimeout(()=>this.controller?.abort(),50000);let r;try{r=await fetch('/api/voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal:this.controller.signal});}finally{clearTimeout(timeout);}
 if(!r.ok){let d;try{d=await r.json();}catch{}throw Error(d?.error||'Gradium voice unavailable.');}
 const bytes=await r.arrayBuffer();if(epoch!==this.epoch)return;const buffer=await context.decodeAudioData(bytes);if(epoch!==this.epoch)return;
 this.node=context.createBufferSource();this.node.buffer=buffer;this.node.connect(context.destination);
 await new Promise(resolve=>{this.finish=resolve;this.node.onended=resolve;this.node.start();if(context.state!=='running')this.report('Tap Enable sound to hear your Gradium voice.');});
 }catch(e){if(epoch===this.epoch)this.report(e.message);}finally{if(epoch===this.epoch){this.node?.disconnect();this.node=null;this.finish=null;this.busy=false;this.drain();}}}
 stop(){this.epoch++;this.queue=[];this.controller?.abort();this.finish?.();if(this.node){try{this.node.stop();}catch{}this.node.disconnect();}this.node=null;this.finish=null;this.busy=false;}
};
