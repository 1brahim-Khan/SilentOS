import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import transcribe from '../api/transcribe.js';
import ready from '../api/ready.js';
function response(){return {code:200,setHeader(){},status(c){this.code=c;return this;},json(d){this.data=d;return this;}};}
function request(body='clip',type='video/webm'){const req=Readable.from([Buffer.from(body)]);req.method='POST';req.headers={'content-type':type};return req;}
const original=globalThis.fetch;
delete process.env.FLARE_API_URL;let res=response();await ready({},res);assert.equal(res.code,503);
process.env.FLARE_API_URL='https://example.invalid';let calls=0;
globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://example.invalid/transcribe');assert.ok(options.body instanceof FormData);return {ok:true,json:async()=>({text:'hello',audio_used:false})};};
res=response();await transcribe(request(),res);assert.equal(res.data.text,'hello');assert.equal(calls,1);
res=response();await transcribe(request('x','text/plain'),res);assert.equal(res.code,415);
res=response();await transcribe(request(''),res);assert.equal(res.code,400);
globalThis.fetch=async()=>({ok:true,json:async()=>({text:'hello',audio_used:true})});res=response();await transcribe(request(),res);assert.equal(res.code,502);
globalThis.fetch=async()=>{throw Error('offline')};res=response();await transcribe(request(),res);assert.equal(res.code,502);
globalThis.fetch=original;console.log('PASS: configuration, upload, validation, no extra readiness call, upstream errors');
