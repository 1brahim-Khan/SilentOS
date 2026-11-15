const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const window={};vm.runInNewContext(fs.readFileSync('static/call.js','utf8'),{window,clearTimeout,console});
const call=new window.SilentCall({room:'r',token:'t',role:'speaker',remote:{},status(){}});
assert.throws(()=>call.setVideoSharing(true),/Join/);
let stopped=0;call.running=true;call.sharedVideo={enabled:false,stop(){stopped++}};
call.setVideoSharing(true);assert.equal(call.sharedVideo.enabled,true);
call.setVideoSharing(false);assert.equal(call.sharedVideo.enabled,false);
call.close();assert.equal(stopped,1);assert.equal(call.running,false);
console.log('PASS: camera sharing starts explicitly and stops with call');
