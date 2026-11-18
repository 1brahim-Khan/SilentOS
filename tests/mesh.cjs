const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {containRect, project} = require('../static/mesh-geometry.js');

// 16:9 camera in a square viewport: account for letterboxing, then mirror.
const rect = containRect(800, 800, 1280, 720);
assert.deepEqual(rect, {x: 0, y: 175, width: 800, height: 450});
assert.deepEqual(project({x: .25, y: .5}, rect), {x: 600, y: 400});
assert.deepEqual(project({x: .25, y: .5}, rect, false), {x: 200, y: 400});
assert.deepEqual(containRect(1200, 600, 600, 1200), {x: 450, y: 0, width: 300, height: 600});
assert.equal(containRect(0, 500, 1280, 720), null);

// Lifecycle and one-frame backpressure, isolated from all camera/recording code.
const listeners = {}, videoListeners = {}, workers = [], frames = new Map();
let nextFrame = 0, resolveBitmap, closed = 0, disconnected = false;
const video = {readyState: 2, videoWidth: 1280, videoHeight: 720, paused: false,
  ended: false, currentTime: 1, srcObject: {active: true},
  addEventListener: (name, fn) => videoListeners[name] = fn,
  removeEventListener: name => delete videoListeners[name],
  getBoundingClientRect: () => ({width: 800, height: 800})};
const ctx = new Proxy({}, {get: () => () => {}});
const canvas = {getContext: () => ctx};
const toggle = {checked: true, addEventListener: (name, fn) => listeners.toggle = fn,
  removeEventListener() {}};
class Worker {
  constructor() { workers.push(this); this.messages = []; }
  postMessage(data) { this.messages.push(data); }
  terminate() { this.terminated = true; }
}
const context = {console, Worker, OffscreenCanvas: function(){}, SilentMeshGeometry: {containRect, project},
  document: {hidden: false, getElementById: id => ({preview: video, faceMesh: canvas, meshEnabled: toggle})[id],
    addEventListener: (name, fn) => listeners[name] = fn, removeEventListener() {}},
  matchMedia: () => ({matches: false}), devicePixelRatio: 2, performance: {now: () => 200},
  ResizeObserver: class {observe() {} disconnect() {disconnected = true;}},
  requestAnimationFrame: fn => {frames.set(++nextFrame, fn); return nextFrame;},
  cancelAnimationFrame: id => frames.delete(id),
  createImageBitmap: () => new Promise(resolve => resolveBitmap = resolve),
  addEventListener: (name, fn) => listeners[name] = fn};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/face-mesh.js', 'utf8'), context);
const tick = now => { const [id, fn] = frames.entries().next().value; frames.delete(id); fn(now); };
(async () => {
  assert.equal(workers.length, 1);
  workers[0].onmessage({data: {type: 'ready', mesh: [], contours: [], lips: []}});
  tick(200); tick(250); assert.equal(workers[0].messages.length, 1, 'only init while bitmap pending');
  // Stop before the snapshot promise finishes: release it and never post to dead worker.
  toggle.checked = false; listeners.toggle();
  resolveBitmap({close() {closed++;}}); await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, 1); assert.ok(workers[0].terminated); assert.equal(frames.size, 0);
  toggle.checked = true; listeners.toggle(); assert.equal(workers.length, 2);
  video.srcObject.active = false; tick(300);
  assert.ok(workers[1].terminated); assert.equal(frames.size, 0);
  listeners.pagehide(); assert.ok(disconnected);
  console.log('PASS: mesh mirroring, aspect ratios, resize geometry, frame backpressure, stale bitmap cleanup, toggle, camera end, page cleanup');
})().catch(error => {console.error(error); process.exitCode = 1;});

