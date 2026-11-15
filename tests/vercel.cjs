// Verify static output isolation and the browser's direct multipart transport.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const result = spawnSync(process.execPath, ['scripts/build.mjs'], {encoding: 'utf8'});
assert.equal(result.status, 0, result.stderr);
const config = JSON.parse(fs.readFileSync('public/config.json', 'utf8'));
assert.equal(config.transport, 'direct');
assert.match(config.api_url, /^https:\/\//);
for (const name of ['index.html', 'face-mesh.js', 'face-mesh-worker.js', 'prism.js',
  'mesh-assets/face_landmarker.task', 'mesh-assets/wasm/vision_wasm_internal.wasm']) {
  assert.ok(fs.existsSync('public/' + name), name);
}
for (const name of ['server.py', 'flare.py', 'hosted', '.git', '.env', 'presentation']) {
  assert.equal(fs.existsSync('public/' + name), false, name);
}
const invalid = spawnSync(process.execPath, ['scripts/build.mjs'], {
  env: {...process.env, FLARE_API_URL: 'http://insecure.example'}, encoding: 'utf8',
});
assert.notEqual(invalid.status, 0);
const routes = JSON.parse(fs.readFileSync('vercel.json'));
assert.deepEqual(routes.rewrites, [{source: '/api/config', destination: '/config.json'}]);

const calls = [], elements = {};
const el = id => elements[id] ??= {dataset: {}, checked: true, value: '8000'};
let rejectUpload = false;
const context = {
  Blob, FormData, AbortSignal, console,
  document: {getElementById: el}, performance: {now: () => 0},
  navigator: {mediaDevices: {getUserMedia: () => new Promise(() => {})}},
  window: {MediaRecorder: function(){}, addEventListener() {}},
  fetch: async (url, options) => {
    calls.push({url, options});
    if (url === '/api/config') return {ok: true, json: async () => ({api_url: 'https://model.example', transport: 'direct'})};
    if (url === 'https://model.example/ready') return {ok: true, json: async () => ({model_loaded: true})};
    assert.equal(url, 'https://model.example/transcribe');
    if (rejectUpload) return {ok: false, status: 422, json: async () => ({detail: 'Invalid test clip'})};
    return {ok: true, json: async () => ({text: 'test phrase', audio_used: false})};
  },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("static/command.js", "utf8"), context);
vm.runInContext(fs.readFileSync('static/index.html', 'utf8').split('<script>')[1].split('</script>')[0], context);
(async () => {
  await new Promise(resolve => setImmediate(resolve));
  // Larger than a function's 4.5 MB limit: it must go straight to FLARE.
  context.clip = new Blob([new Uint8Array(5 * 1024 * 1024)], {type: 'video/webm;codecs=vp8'});
  const transcript = await vm.runInContext("api('/api/transcribe',{method:'POST',headers:{'Content-Type':clip.type},body:clip})", context);
  assert.equal(transcript.text, 'test phrase');
  const upload = calls.at(-1);
  assert.ok(upload.options.body instanceof FormData);
  assert.equal(upload.options.headers, undefined);
  assert.equal(upload.options.body.get('video').size, context.clip.size);
  assert.equal(upload.options.body.get('video').name, 'recording.webm');
  assert.equal(calls.filter(call => call.url === '/api/config').length, 1);
  rejectUpload = true;
  await assert.rejects(vm.runInContext("api('/api/transcribe',{body:clip})", context), /Invalid test clip/);
  assert.equal(calls.filter(call => call.url.endsWith('/transcribe')).length, 2, 'no automatic upload retries');
  console.log('PASS: Vercel static build, private-file exclusion, config, direct large multipart uploads, model errors');
})().catch(error => {console.error(error); process.exitCode = 1;});
