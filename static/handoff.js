// The browser queues only finalized commands. The connector never runs from here.
(()=>{
 const el=id=>document.getElementById(id);
 const config=fetch('/api/config',{signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw new Error('Cannot read local configuration');return r.json();});
 const states=new WeakMap();
 let current=null,revision=0,parsing=false,submitting=false,parseTimer,refreshVersion=0,lastQueueSnapshot; config.catch(()=>{});
 async function request(path,data){
  const c=await config;
  const r=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'X-SilentOS-Token':c.session_token,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(15000)});
  const result=await r.json();if(!r.ok)throw new Error(result.error||`HTTP ${r.status}`);return result;
 }
 function fieldsLocked(value){for(const id of ['messageApp','messageRecipient','messageBody','messageMode'])el(id).disabled=value;}
 function valid(){return el('messageRecipient').value.trim()&&el('messageBody').value.trim();}
 function render(){
  const state=current&&states.get(current);
  const available=current?.state==='ready'&&!parsing&&!submitting&&!state?.queued;
  el('queueCommand').disabled=!available||!valid();
  el('queueCommand').textContent=state?.queued?'Queued':submitting?'Queueing…':'Queue for HeyClicky';
  fieldsLocked(!available||Boolean(state?.payload));
 }
 async function parse(command,text,version){
  try{
   const result=await request('/api/commands/parse',{text});
   if(current!==command||revision!==version)return;
   el('messageApp').value=result.app||'imessage';el('messageRecipient').value=result.recipient||'';el('messageBody').value=result.message||'';
   el('handoffStatus').textContent=result.reason;
   parsing=false;render();
   if(result.parsed&&el('autoQueue').checked&&!states.get(command).attempted)await enqueue();
  }catch(e){if(current===command&&revision===version){parsing=false;el('handoffStatus').textContent=e.message;render();}}
 }
 window.renderCommandHandoff=command=>{
  const prior=current;current=command;
  let state=states.get(command);
  if(!state){state={text:null,key:crypto.randomUUID(),queued:false,attempted:false};states.set(command,state);}
  if(command.state==='ready'&&state.text!==command.text&&!state.queued){
   state.text=command.text;const version=++revision;parsing=true;
   clearTimeout(parseTimer);el('messageRecipient').value='';el('messageBody').value='';el('handoffStatus').textContent='Extracting app, recipient, and message…';
   parseTimer=setTimeout(()=>parse(command,command.text,version),200);
  }else if(command.state!=='ready'){
   ++revision;clearTimeout(parseTimer);parsing=false;state.text=null;
   if(prior!==command){el('messageRecipient').value='';el('messageBody').value='';}
   el('handoffStatus').textContent=command.state==='incomplete'?'Incomplete command — record a new instruction.':'Finish a command to extract its message.';
  }
  render();
 };
 async function enqueue(){
  if(el('queueCommand').disabled)return;
  const command=current,state=states.get(command);submitting=true;state.attempted=true;command.handoffLocked=true;el('commandText').readOnly=true;render();
  // Freeze the exact payload for an uncertain HTTP retry, including its idempotency key.
  const payload=state.payload??={request_key:state.key,transcript:command.text,app:el('messageApp').value,recipient:el('messageRecipient').value,message:el('messageBody').value,mode:el('messageMode').value};
  try{
   const result=await request('/api/commands',payload);state.queued=true;
   if(current===command)el('handoffStatus').textContent=`Queued ${result.mode==='draft'?'draft':'send request'} for ${result.recipient}. Waiting for an active HeyClicky job.`;
   await refresh();
  }catch(e){
   // Keep payload frozen: retry must not create a second command after a lost response.
   if(current===command)el('handoffStatus').textContent=e.message+' Retry queues the same request. Use New command to change it.';
  }finally{submitting=false;render();if(current===command&&state.payload&&!state.queued)fieldsLocked(true);}
 }
 async function refresh(){
  const version=++refreshVersion;
  try{
   const {commands}=await request('/api/commands');if(version!==refreshVersion)return;
   const snapshot=JSON.stringify(commands);if(snapshot===lastQueueSnapshot)return;lastQueueSnapshot=snapshot;el('commandQueue').replaceChildren();
   for(const c of commands){
    const item=document.createElement('li');const text=document.createElement('span');
    text.textContent=`${c.status} · ${c.mode} · ${c.app} → ${c.recipient}: ${c.message}${c.detail?' — '+c.detail:''}`;item.append(text);
    if(c.status==='queued'){
     const cancel=document.createElement('button');cancel.className='subtle';cancel.textContent='Cancel';
     cancel.onclick=async()=>{cancel.disabled=true;try{await request('/api/commands/cancel',{id:c.id});await refresh();}catch(e){el('queueError').textContent=e.message;cancel.disabled=false;}};item.append(cancel);
    }
    if(c.status==='claimed'){
     const help=document.createElement('p');help.textContent='An agent owns this command. If it stopped, stop the HeyClicky job first, then resolve it as uncertain. Never repeat until you check the conversation.';item.append(help);
     const resolve=document.createElement('button');resolve.className='subtle';resolve.textContent='Job stopped: mark uncertain';
     resolve.onclick=async()=>{resolve.disabled=true;try{await request('/api/commands/resolve',{id:c.id});await refresh();}catch(e){el('queueError').textContent=e.message;resolve.disabled=false;}};item.append(resolve);
    }
    el('commandQueue').append(item);
   }
   if(!commands.length){const li=document.createElement('li');li.textContent='No commands queued.';el('commandQueue').append(li);}
   el('queueError').textContent='';
  }catch(e){if(version===refreshVersion)el('queueError').textContent=e.message;}
 }
 el('queueCommand').onclick=enqueue;el('refreshCommands').onclick=refresh;
 for(const id of ['messageApp','messageRecipient','messageBody','messageMode'])el(id).oninput=()=>render();
 el('copyConnector').onclick=async()=>{try{const c=await config;await navigator.clipboard.writeText(c.connector_command);el('queueError').textContent='Connector command copied. Add it in HeyClicky Settings → Integrations → Add custom connector → local command.';}catch(e){el('queueError').textContent=e.message;}};
 // Catch up if the main script rendered before this deferred script loaded.
 window.renderCommandHandoff(command);
 refresh();setInterval(()=>{if(!document.hidden)refresh();},5000);
})();
