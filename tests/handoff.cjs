// Exercise the browser handoff with deferred parsing and lost queue responses.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const Assembly=require('../static/command.js');
const elements={};const el=id=>elements[id]??={value:'',disabled:false,checked:false,textContent:'',children:[],append(x){this.children.push(x)},replaceChildren(){this.children=[]}};
el('messageMode').value='draft';
let timer,parseRequests=[],queuePayloads=[],failQueue=false;
const first=new Assembly();first.enqueue();first.accept('Send Alex on WhatsApp saying hello');first.finish();
const context={command:first,crypto:require('node:crypto'),AbortSignal,window:{},document:{getElementById:el,hidden:false,createElement:()=>({append(){}})},navigator:{clipboard:{writeText:async()=>{}}},setTimeout:fn=>(timer=fn,1),clearTimeout:()=>{timer=null},setInterval(){},fetch:async(path,options)=>{
 if(path==='/api/config')return{ok:true,json:async()=>({session_token:'test',connector_command:'python3 test.py'})};
 if(path==='/api/commands/parse')return new Promise(resolve=>parseRequests.push(resolve));
 if(path==='/api/commands'&&options.method==='POST'){
  queuePayloads.push(JSON.parse(options.body));if(failQueue)throw new Error('lost response');
  return{ok:true,json:async()=>({mode:'draft',recipient:'Alex'})};
 }
 return{ok:true,json:async()=>({commands:[]})};
}};
vm.createContext(context);vm.runInContext(fs.readFileSync(__dirname+'/../static/handoff.js','utf8'),context);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const parsed=()=>({ok:true,json:async()=>({parsed:true,app:'whatsapp',recipient:'Alex',message:'hello',reason:'Review'})});
(async()=>{
 timer();await flush();assert.equal(parseRequests.length,1);assert.equal(el('queueCommand').disabled,true);
 parseRequests[0](parsed());await flush();assert.equal(el('queueCommand').disabled,false);assert.equal(el('messageBody').value,'hello');
 failQueue=true;await el('queueCommand').onclick();assert.equal(queuePayloads.length,1);assert.equal(el('messageBody').disabled,true);assert.equal(first.handoffLocked,true);
 failQueue=false;await el('queueCommand').onclick();assert.equal(queuePayloads.length,2);assert.deepEqual(queuePayloads[0],queuePayloads[1]);assert.equal(el('queueCommand').disabled,true);
 context.window.renderCommandHandoff(first);assert.equal(queuePayloads.length,2);
 const second=new Assembly();second.enqueue();second.accept('Send Sam on SMS saying later');second.finish();
 context.window.renderCommandHandoff(second);timer();await flush();assert.equal(parseRequests.length,2);
 const third=new Assembly();context.window.renderCommandHandoff(third);
 parseRequests[1](parsed());await flush();assert.equal(el('messageBody').value,'');assert.equal(el('queueCommand').disabled,true);
 // Explicit opt-in queues only successfully parsed completed commands, once.
 el('autoQueue').checked=true;
 const fourth=new Assembly();fourth.enqueue();fourth.accept('Send Alex on WhatsApp saying hello');fourth.finish();
 context.window.renderCommandHandoff(fourth);timer();await flush();parseRequests[2](parsed());await flush();
 assert.equal(queuePayloads.length,3);assert.equal(queuePayloads[2].mode,'draft');
 context.window.renderCommandHandoff(fourth);assert.equal(queuePayloads.length,3);
 console.log('PASS: review fields, lost-response idempotency, frozen payload, stale parse rejection, opt-in auto queue');
})().catch(e=>{console.error(e);process.exitCode=1});
