const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const guest=process.argv.includes('--guest');
const elements={},el=id=>elements[id]??={checked:true,value:'',dataset:{},classList:{toggle(){}},append(){},play:async()=>{}};
const events={},sent=[],constraints=[];let outbound,recorded;
let micStopped=false;const video={kind:'video',clone:()=>({kind:'video',enabled:true,stop(){}}),stop(){}},audio={kind:'audio',stop(){micStopped=true}},silent={kind:'audio',stop(){}};
class Stream{constructor(tracks){this.tracks=tracks}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}getTracks(){return this.tracks}removeTrack(t){this.tracks=this.tracks.filter(x=>x!==t)}addTrack(t){this.tracks.push(t)}}
class Peer{on(k,f){events[k]=f}destroy(){}}
class Recorder{static isTypeSupported(){return true}constructor(s){recorded=s;this.state='inactive'}start(){this.state='recording'}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['video'])});this.onstop()}}
const c={document:{getElementById:el,createElement:()=>({})},URLSearchParams,URL,location:{hash:guest?'#peer=host&key=secret':'',href:'https://example.test'},crypto:{randomUUID:()=>String(Math.random())},navigator:{mediaDevices:{getUserMedia:async s=>{constraints.push(s);return new Stream(s.video===false?[audio]:[video])}}},AudioContext:class{async resume(){}createMediaStreamDestination(){return {stream:new Stream([silent])}}close(){}},MediaStream:Stream,MediaRecorder:Recorder,Blob,AbortSignal,performance:{now:()=>100},setTimeout:()=>1,clearTimeout(){},window:{Peer,addEventListener(){}},Peer,fetch:async path=>({ok:true,json:async()=>path==='/api/config'?{iceServers:[]}:path==='/api/transcribe'?{text:'hello from FLARE',audio_used:false}:{model_loaded:true}})};
vm.createContext(c);vm.runInContext(fs.readFileSync('public/app.js','utf8'),c);
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
 await el('join').onclick();assert.equal(constraints[0].audio,false);if(guest){assert.equal(constraints.at(-1).video,false);el('silentMode').checked=true;await el('silentMode').onchange();assert.equal(el('record').hidden,false);}
 const conn={metadata:{secret:vm.runInContext('secret',c)},peer:'listener',open:true,on(){},send(m){sent.push(m)},close(){}};
 if(guest){c.testConnection=conn;vm.runInContext('bindData(testConnection)',c);}else events.connection(conn);const incoming={metadata:conn.metadata,peer:'listener',peerConnection:{getSenders:()=>[{track:silent,replaceTrack:async t=>{globalThis.replaced=t}}]},on(){},answer(s){outbound=s},close(){}};if(guest){c.testCall=incoming;vm.runInContext('bindMedia(testCall)',c);outbound=vm.runInContext('outbound',c);}else events.call(incoming);
 assert.equal(outbound.getAudioTracks()[0],silent);
 el('record').onclick();assert.equal(recorded.getAudioTracks().length,0);el('finish').onclick();await flush();assert.equal(sent.length,1);assert.equal(sent[0].text,'hello from FLARE');
 el('autoSend').checked=false;el('record').onclick();el('finish').onclick();await flush();assert.equal(sent.length,1);assert.equal(el('draft').value,'hello from FLARE');
 el('silentMode').checked=false;await el('silentMode').onchange();assert.equal(constraints.at(-1).audio.echoCancellation,true);assert.equal(outbound.getAudioTracks()[0],audio);el('silentMode').checked=true;await el('silentMode').onchange();assert.equal(micStopped,true);assert.equal(globalThis.replaced,silent);assert.equal(outbound.getAudioTracks()[0],silent);
 console.log('PASS: no host microphone request, silent audio placeholder, live microphone switching, video-only capture, automatic FLARE speech message, review mode');
})().catch(e=>{console.error(e);process.exitCode=1});
