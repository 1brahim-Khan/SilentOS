/* A separate visual layer. Never touches the MediaStream, MediaRecorder or API. */
(() => {
  'use strict';
  const video = document.getElementById('preview');
  const canvas = document.getElementById('faceMesh');
  const toggle = document.getElementById('meshEnabled');
  const ctx = canvas?.getContext('2d');
  if (!video || !canvas || !ctx || !window.SilentMeshGeometry) return;
  const {containRect, project} = window.SilentMeshGeometry;
  let worker, workerReady = false, pending = false, epoch = 0, disposed = false;
  let frame, lastDraw = 0, lastSent = 0, lastVideoTime = -1, lastResult = 0;
  let interval = 100, target = [], smooth = [], missing = 0;
  let mesh = [], contours = [], lips = [], lipIndices = new Set();
  let width = 0, height = 0, ratio = 1, resizePending = true;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const active = () => !disposed && !document.hidden && (!toggle || toggle.checked) &&
    (!video.srcObject || video.srcObject.active) && video.readyState >= 2 && video.videoWidth > 0 && !video.paused && !video.ended;
  const clear = () => {
    ctx.clearRect(0, 0, width, height);
    target = []; smooth = []; lastResult = 0; missing = 0;
  };
  function stop() {
    ++epoch; cancelAnimationFrame(frame); frame = undefined;
    worker?.terminate(); worker = undefined; workerReady = false; pending = false;
    lastVideoTime = -1; lastSent = 0; clear();
  }
  function fail(error) {
    // Decoration failure must never change the camera, recording or app status.
    console.warn('SilentOS decorative face mesh unavailable:', error);
    stop();
  }
  function start() {
    if (!active() || worker) return;
    if (!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) return;
    const generation = ++epoch;
    try {
      worker = new Worker('/face-mesh-worker.js');
      worker.onerror = event => { if (generation === epoch) fail(event.message); };
      worker.onmessage = ({data}) => {
        if (generation !== epoch) return;
        if (data.type === 'ready') {
          ({mesh, contours, lips} = data);
          lipIndices = new Set(lips.flat()); workerReady = true;
        } else if (data.type === 'landmarks') {
          pending = false;
          // Back off on slower laptops rather than building an inference queue.
          interval = Math.max(100, Math.min(300, data.elapsed * 2));
          if (data.points.length) {
            target = data.points; lastResult = performance.now(); missing = 0;
          } else if (++missing >= 2) clear();
        } else if (data.type === 'error') fail(data.message);
      };
      worker.postMessage({type: 'init'});
      frame = requestAnimationFrame(tick);
    } catch (error) { fail(error); }
  }
  async function send(now) {
    pending = true; lastSent = now; lastVideoTime = video.currentTime;
    const generation = epoch;
    try {
      // A small read-only snapshot of the EXISTING preview, never captureStream().
      const scale = Math.min(1, 384 / Math.max(video.videoWidth, video.videoHeight));
      const bitmap = await createImageBitmap(video, {
        resizeWidth: Math.max(1, Math.round(video.videoWidth * scale)),
        resizeHeight: Math.max(1, Math.round(video.videoHeight * scale)),
      });
      if (generation !== epoch || !active()) { bitmap.close(); return; }
      worker.postMessage({type: 'frame', bitmap, timestamp: now}, [bitmap]);
    } catch (error) { if (generation === epoch) fail(error); }
  }
  function stroke(edges, points, color, lineWidth, glow = 0) {
    ctx.beginPath();
    for (const [a, b] of edges) {
      if (!points[a] || !points[b]) continue;
      ctx.moveTo(points[a].x, points[a].y); ctx.lineTo(points[b].x, points[b].y);
    }
    ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
    ctx.shadowColor = '#53dfff'; ctx.shadowBlur = glow; ctx.stroke(); ctx.shadowBlur = 0;
  }
  function draw(now) {
    if (resizePending) {
      const box = video.getBoundingClientRect(); width = box.width; height = box.height;
      ratio = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); resizePending = false;
    }
    ctx.clearRect(0, 0, width, height);
    if (!target.length || now - lastResult > 500) { smooth = []; return; }
    const rect = containRect(width, height, video.videoWidth, video.videoHeight);
    if (!rect) return;
    // The existing preview uses object-fit:contain and scaleX(-1). Mirror ONCE.
    if (smooth.length !== target.length || motion.matches) smooth = target.map(p => ({...p}));
    else for (let i = 0; i < target.length; i++) {
      smooth[i].x += (target[i].x - smooth[i].x) * .58;
      smooth[i].y += (target[i].y - smooth[i].y) * .58;
    }
    const points = smooth.map(p => project(p, rect));
    ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.width, rect.height); ctx.clip();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    stroke(mesh, points, 'rgba(83,210,255,.17)', .55);
    stroke(contours, points, 'rgba(104,224,255,.48)', .8);
    stroke(lips, points, 'rgba(145,241,255,.86)', 1.05, 4);
    // Most points remain very small; lips get a restrained, brighter accent.
    ctx.fillStyle = 'rgba(135,232,255,.56)'; ctx.beginPath();
    for (let i = 0; i < points.length; i += 2) {
      if (lipIndices.has(i)) continue;
      ctx.moveTo(points[i].x + .75, points[i].y); ctx.arc(points[i].x, points[i].y, .75, 0, Math.PI * 2);
    }
    ctx.fill(); ctx.fillStyle = 'rgba(180,249,255,.93)'; ctx.beginPath();
    for (const i of lipIndices) {
      const p = points[i]; ctx.moveTo(p.x + 1.05, p.y); ctx.arc(p.x, p.y, 1.05, 0, Math.PI * 2);
    }
    ctx.fill(); ctx.restore();
  }
  function tick(now) {
    if (!active()) { stop(); return; }
    if (workerReady && !pending && now - lastSent >= interval && video.currentTime !== lastVideoTime) send(now);
    if (now - lastDraw >= 1000 / 30) { draw(now); lastDraw = now; }
    if (worker) frame = requestAnimationFrame(tick);
  }
  function sync() { if (active()) start(); else stop(); }
  const observer = new ResizeObserver(() => { resizePending = true; }); observer.observe(video);
  const events = ['playing', 'loadeddata', 'pause', 'emptied', 'ended'];
  for (const event of events) video.addEventListener(event, sync);
  document.addEventListener('visibilitychange', sync);
  toggle?.addEventListener('change', sync);
  window.addEventListener('pagehide', () => {
    disposed = true; stop(); observer.disconnect();
    for (const event of events) video.removeEventListener(event, sync);
    document.removeEventListener('visibilitychange', sync); toggle?.removeEventListener('change', sync);
  });
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  sync();
})();
