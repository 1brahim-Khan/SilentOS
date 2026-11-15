const $=id=>document.getElementById(id);
const invite=new URLSearchParams(location.hash.slice(1));const target=invite.get('peer'),secret=invite.get('key')||crypto.randomUUID();
const listener=Boolean(target);let peer,data,media,source,shared,recorder,timer,starting=false,processing=false,ending=false,microphone=null,audioContext=null,silence=null,outbound=null,modeChanging=false,session=0;
const seen=new Set();let rtcConfig;
$('join').title=listener?'Join call':'Create call';
$('silentMode').checked=!listener;
function renderMode(){const silent=$('silentMode').checked;$('record').hidden=!silent;$('finish').hidden=!silent;$('autoSendLabel').hidden=!silent;$('local').hidden=false;$('view').classList.toggle('listener',!silent&&listener);$('modeStatus').textContent=silent?'Silent mode · Microphone off · FLARE voice':'Microphone mode · Your voice is shared';$('intro').textContent=silent?'Mouth a phrase. FLARE turns it into speech for the other person.':'Speak normally, or switch to silent mode to use lip-reading.';$('record').disabled=!source||processing||modeChanging;$('silentMode').disabled=starting||modeChanging||processing||recorder?.state==='recording';}
renderMode();
async function selectMicrophone(){const silent=$('silentMode').checked;let next=null;try{
 if(!silent){microphone=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});if(ending){microphone.getTracks().forEach(t=>t.stop());microphone=null;throw Error('Call ended.');}next=microphone.getAudioTracks()[0];}else next=silence;
 const sender=media?.peerConnection?.getSenders().find(s=>s.track?.kind==='audio');
 if(sender)await sender.replaceTrack(next);
 if(outbound){outbound.getAudioTracks().forEach(t=>outbound.removeTrack(t));outbound.addTrack(next);}
 if(silent){microphone?.getTracks().forEach(t=>t.stop());microphone=null;}
 }catch(e){microphone?.getTracks().forEach(t=>t.stop());microphone=null;$('silentMode').checked=true;const sender=media?.peerConnection?.getSenders().find(s=>s.track?.kind==='audio');if(sender&&silence)await sender.replaceTrack(silence);throw e;}}
$('silentMode').onchange=async()=>{if(starting||processing||recorder?.state==='recording'){ $('silentMode').checked=!$('silentMode').checked;status('Finish the current phrase before changing modes.');return;}modeChanging=true;$('silentMode').disabled=true;try{if(source)await selectMicrophone();}catch(e){status('Microphone unavailable: '+e.message);}finally{modeChanging=false;$('silentMode').disabled=false;renderMode();}};
function status(t){$('connection').textContent=t;}
async function api(path,options={}){const r=await fetch(path,{...options,signal:AbortSignal.timeout(55000)});let d;try{d=await r.json();}catch{throw Error('Service returned an invalid response. Try a shorter recording.');}if(!r.ok)throw Error(d.error||'Service unavailable');return d;}
function log(text,label){const li=document.createElement('li');li.textContent=label+': '+text;$('log').append(li);}
function sendText(text){if(!data?.open)throw Error('The other participant is not connected. Transcript kept for retry.');if(!text.trim()||text.length>2000)throw Error('Keep messages between 1 and 2000 characters.');data.send({id:crypto.randomUUID(),text});log(text,'You');$('caption').textContent=text;}
function receive(message){if(!message||typeof message.id!=='string'||seen.has(message.id)||typeof message.text!=='string'||message.text.length>2000)return;seen.add(message.id);log(message.text,'Them');$('caption').textContent=message.text;if($('voice').checked&&'speechSynthesis' in window){const speech=new SpeechSynthesisUtterance(message.text);speech.onerror=()=>status('Caption received; speech playback failed.');speechSynthesis.speak(speech);}}
function bindData(conn){data=conn;conn.on('open',()=>{status('Connected. You can send messages.');$('send').disabled=false;});conn.on('data',receive);conn.on('close',()=>{status('Other participant disconnected. Create a fresh call to reconnect.');$('send').disabled=true;});conn.on('error',e=>status(e.message));}
function bindMedia(call){media=call;call.on('stream',remote=>{$('remote').srcObject=remote;$('remote').play().catch(()=>status('Tap Enable call sound to hear the other participant.'));});call.on('error',e=>status(e.message));call.on('close',()=>status('Media call ended.'));}
$('join').onclick=async()=>{if(starting||peer)return;starting=true;ending=false;$('join').disabled=true;$('silentMode').disabled=true;try{
 if(!window.Peer)throw Error('Call library failed to load. Check internet access and reload.');
 if(!navigator.mediaDevices)throw Error('Open this page over HTTPS to allow camera and microphone.');
 audioContext=new (window.AudioContext||window.webkitAudioContext||AudioContext)();await audioContext.resume();
 rtcConfig=await api('/api/config');
 source=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:false});
 if(ending){source.getTracks().forEach(t=>t.stop());return;}
 $('local').srcObject=source;$('local').play().catch(()=>status('Tap Enable sound to start camera playback.'));
 const video=source.getVideoTracks()[0];shared=video.clone();shared.enabled=false;
 const destination=audioContext.createMediaStreamDestination();silence=destination.stream.getAudioTracks()[0];
 outbound=new MediaStream([shared,silence]);await selectMicrophone();
 peer=new Peer(undefined,{config:{iceServers:rtcConfig.iceServers}});
 peer.on('error',e=>status('Connection error: '+e.message));
 peer.on('disconnected',()=>status('Signaling disconnected. Existing media may continue. Recreate the call if needed.'));
 peer.on('open',id=>{if(listener){const conn=peer.connect(target,{reliable:true,metadata:{secret}});bindData(conn);conn.on('open',()=>{const call=peer.call(target,outbound,{metadata:{secret}});bindMedia(call);});status('Connecting to speaker…');}
 else{const link=new URL(location.href);link.hash=new URLSearchParams({peer:id,key:secret}).toString();$('invite').value=link.href;$('invite').hidden=false;$('copy').hidden=false;$('shareInvite').hidden=!navigator.share;status('Share the invitation; waiting for the other participant.');}});
 if(!listener){peer.on('connection',conn=>{if(conn.metadata?.secret!==secret||data){conn.close();return;}bindData(conn);});peer.on('call',call=>{if(call.metadata?.secret!==secret||!data||call.peer!==data.peer||media){call.close();return;}bindMedia(call);call.answer(outbound);});}
 $('end').disabled=false;renderMode();
 api('/api/ready').then(()=>{$('recordStatus').textContent='Model ready. Record a short phrase, then review and send.';}).catch(e=>{$('recordStatus').textContent=e.message;});
 }catch(e){status(e.message);cleanup();}finally{starting=false;renderMode();}}
function cleanup(){session++;processing=false;clearTimeout(timer);if(recorder?.state==='recording'){recorder.onstop=null;recorder.stop();}media?.close();data?.close();peer?.destroy();source?.getTracks().forEach(t=>t.stop());shared?.stop();microphone?.getTracks().forEach(t=>t.stop());microphone=null;silence?.stop();silence=null;audioContext?.close();audioContext=null;outbound=null;peer=data=media=source=shared=null;$('remote').srcObject=null;$('local').srcObject=null;$('join').disabled=false;$('end').disabled=true;$('record').disabled=true;$('finish').disabled=true;$('send').disabled=true;$('share').checked=false;$('silentMode').disabled=false;$('invite').hidden=true;$('copy').hidden=true;$('shareInvite').hidden=true;if('speechSynthesis' in window)speechSynthesis.cancel();}
$('end').onclick=()=>{ending=true;cleanup();status('Call ended. Create a fresh invitation to call again.');};
$('share').onchange=()=>{if(!shared){$('share').checked=false;return;}shared.enabled=$('share').checked;};
$('viewVideo').onchange=()=>{$('view').classList.toggle('video',$('viewVideo').checked);$('view').classList.toggle('phone',!$('viewVideo').checked);};
$('play').onclick=()=>{audioContext?.resume().catch(()=>{});if(source)$('local').play().catch(()=>{});$('remote').play().catch(()=>status('No incoming audio yet.'));if('speechSynthesis' in window){speechSynthesis.resume();const s=new SpeechSynthesisUtterance('Call sound enabled');speechSynthesis.speak(s);}};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('invite').value);status('Invitation copied.');}catch{$('invite').select();status('Copy the selected invitation manually.');}};
$('shareInvite').onclick=async()=>{try{if($('invite').value)await navigator.share({title:'Join my SilentOS call',url:$('invite').value});}catch(e){if(e.name!=='AbortError')status('Use Copy invitation to share this call.');}};
$('send').onclick=()=>{try{sendText($('draft').value.trim());$('draft').value='';}catch(e){status(e.message);}};
$('record').onclick=()=>{if(processing||!source||!$('silentMode').checked||modeChanging)return;if(!window.MediaRecorder){$('recordStatus').textContent='Video recording unavailable. Open Safari or Chrome, or type a reply.';return;}const takeSession=session;let interrupted=false;const type=['video/webm;codecs=vp8','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));if(!type){$('recordStatus').textContent='Recording unsupported. Type a message instead.';return;}const chunks=[];const began=performance.now();
 try{recorder=new MediaRecorder(new MediaStream(source.getVideoTracks()),{mimeType:type,videoBitsPerSecond:700000});}catch(e){$('recordStatus').textContent=e.message;return;}
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onerror=()=>{interrupted=true;$('recordStatus').textContent='Recording failed. Try again.';$('record').disabled=false;$('finish').disabled=true;clearTimeout(timer);};
 recorder.onstop=async()=>{if(takeSession!==session)return;$('view').dataset.recording='false';clearTimeout(timer);$('finish').disabled=true;processing=true;try{if(interrupted||recorder.interrupted)throw Error('Recording interrupted. Keep the app visible and repeat the phrase.');if(performance.now()-began>8000)throw Error('Clip exceeded 8 seconds. Keep this tab visible and retry.');const blob=new Blob(chunks,{type});if(!blob.size||blob.size>4000000)throw Error('Clip empty or over 4 MB. Try a shorter phrase.');$('recordStatus').textContent='Transcribing…';const result=await api('/api/transcribe',{method:'POST',headers:{'Content-Type':type},body:blob});if(!ending&&takeSession===session){$('draft').value=result.text;$('caption').textContent=result.text;if($('autoSend').checked){sendText(result.text);$('recordStatus').textContent='FLARE phrase sent as synthesized speech.';$('draft').value='';}else{$('recordStatus').textContent='Review the transcript, then send.';}}}catch(e){$('recordStatus').textContent=e.message;}finally{if(takeSession===session){processing=false;renderMode();}}};
 recorder.onpause=()=>{interrupted=true;};recorder.start();$('silentMode').disabled=true;$('view').dataset.recording='true';$('record').disabled=true;$('finish').disabled=false;$('recordStatus').textContent='Recording silently — up to 5 seconds.';timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},5000);};
$('finish').onclick=()=>{if(recorder?.state==='recording')recorder.stop();};
document.addEventListener?.('visibilitychange',()=>{if(document.hidden){if(recorder?.state==='recording'){recorder.interrupted=true;recorder.stop();}if(peer)status('Keep SilentOS open during the call; your phone may pause camera or audio in the background.');}else if(source){$('local').play().catch(()=>status('Tap Enable sound to resume playback.'));audioContext?.resume().catch(()=>{});}});
window.addEventListener('pagehide',()=>{ending=true;cleanup();});
