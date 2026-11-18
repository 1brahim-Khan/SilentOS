# Hosted FLARE client

Public readiness verified November 19, 2026 (`model_loaded: true`):
`https://hrs-expansion-erp-turned.trycloudflare.com`

The tunnel runs on Amarel within job 64050686 on gpu040 (L40S), independently of
any laptop. The current allocation ends November 19 at 5:34:35 PM Eastern.
Readiness is `GET /ready`; transcription is `POST /transcribe` with multipart
field `video`. This is a temporary API URL, not a hosted camera webpage.
The tunnel log is `~/projects/flare_webcam_demo/reports/cloudflare-64050686.log`
on Amarel. A new allocation and tunnel will be needed after the job ends.

## Windows quick start

Double-click `Start-SilentOS.cmd` to start the local server and open your browser.
Python 3 is required; no extra packages are needed. The server runs in the
background. Its logs are `server.log` and `server-error.log`.

From PowerShell, stop it with `./Start-SilentOS.ps1 -Stop`. If the temporary
FLARE service expires, stop the app, then launch with the current address:

```powershell
./Start-SilentOS.ps1 -ApiUrl https://CURRENT-FLARE-HOST
```

The local interface works without the hosted service, but transcription requires
a reachable FLARE model. The camera opens automatically after browser permission; press Start to record.

The hosted model reported ready during setup on November 14, 2026. A real clip has not yet been transcribed with these clients. No local GPU, model installation, or Python packages are required.

From the HackPrinceton workspace:

```sh
python3 flare.py
python3 flare.py /absolute/path/to/clip.mp4
```

Use a consented 2–5 second raw webcam recording, at most 60 seconds. MP4 or WebM; one face, front-facing and well lit. Do not crop or resize manually. For browser capture use `audio: false`. Uploading sends the video to the teammate's hosted service.

The tunnel is temporary. Override it without editing code:

```sh
python3 flare.py --url https://NEW-HOST.trycloudflare.com /path/to/clip.webm
```

Alternatively set `FLARE_API_URL` for the Python client.

For an existing browser application:

```js
import { transcribeVideo } from './flare.mjs';
const result = await transcribeVideo(recordedBlob);
// Display result.text for review before submitting to Deep Agents.
```

The browser helper accepts an optional second argument for a replacement URL. Browser calls require the server to permit your origin through CORS. Python success does not prove browser success. Do not manually set multipart Content-Type. Do not retry timed-out uploads automatically: the GPU may still be processing them.

Check readiness once at session start. Transcription verifies a nonempty transcript and `audio_used: false`, without an extra readiness request. Clip duration is enforced by the server. Keep recordings under 60 seconds, show processing state, and prevent duplicate submissions in your UI. These client helpers do not record video or execute agent actions; the local camera page below records video.

Next live check: upload a real clip, inspect transcript and timing, then test from the actual frontend origin. The guide reports a finite GPU allocation; reconfirm availability before a demo.

## Local camera app

```sh
cd SilentOS
python3 server.py
```

Open http://localhost:8000, allow camera access when prompted, then press Start. The camera opens automatically and stays on between phrases until the page closes. The backend must run on your laptop for this localhost URL to work there. Use `--port 8001` if necessary. No additional dependencies.

The browser captures audio-free MP4/WebM clips with an eight-second default (3, 5, 6, 15, 30, and 60 seconds are also available) and sends raw video bodies to local `POST /api/transcribe`. The 60-second option stops about 150ms early to allow recorder shutdown within the API limit. The backend forwards multipart uploads using the existing FLARE client, validates responses, and removes temporary files. `GET /api/ready` proxies model readiness. The camera preview is mirrored; uploaded frames are not intentionally mirrored.

Continue recording mode captures the next phrase while the previous upload processes. Finish phrase submits early and pauses recording without disabling the camera. Press Start to resume, including while a prior phrase is processing. There is one in-flight request and at most two waiting clips. Capture pauses when the queue is full and resumes when space opens; watch the Recording/Catching up status. Clips remain separate phrases; automatic cut points can split words. Pause (under Details) submits the final partial recording and keeps the camera ready; a request already processing can still return its transcript. No transcript triggers agent execution.

Validation: the local backend returned the real transcript “set a reminder for tomorrow” from the supplied audio-free MP4, with `audio_used: false`. Python and browser script syntax checks passed. Live camera permissions and recording behavior still need browser testing. The tunnel and GPU allocation are temporary; update FLARE_API_URL before starting the server if they change. This server is intended for local development only, not public deployment.


## Latency improvements

Each result displays capture duration, queue wait, full browser request duration, start-to-text latency, upstream preprocessing/inference/server totals, local body receipt, and proxy timing. Proxy timing includes upstream request/upload and temporary-file handling; it is not a pure network measurement. On failure the session stops and unsent clips are discarded with a visible count. No automatic retry occurs. Use Check connection, then Start to resume. Stop submits the final partial clip and drains queued clips.

Restart the Python server and reload the browser after updating. Simulated queue tests: `node tests/queue.cjs`. Actual webcam behavior and latency improvement still require a live browser test; no speedup has been measured for this revision.

## Service recovery

If the temporary tunnel expires, the app displays the configured endpoint and an actionable connection error. Launch against the replacement service with:

```sh
python3 flare-client/server.py --port 8001 --api-url https://CURRENT-FLARE-HOST
```

The URL must be the FLARE HTTP API exposing `/ready` and `/transcribe`, not an AWS notebook login URL. Without a reachable model service, the local page and camera can load but transcription cannot run. There is no mock transcription fallback.

Port conflicts now show a concise recovery message. Finish phrase is disabled while a recorder is stopping, connection checks cannot race active recording, disconnected cameras require re-enabling, and clips shorter than half a second are skipped.

Regression checks:

```sh
node tests/queue.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

Backend tests use simulated upstream responses. Live model accuracy and actual camera permissions require an available API and a browser test.

## SilentOS interface

The camera opens on page load, with audio disabled; capture begins only on Start.
The latest completed phrase appears over the video; the full transcript is editable
in the side panel. Start rechecks service readiness after an error without a reload.
Prism Gradient uses Componentry’s WebGL shader adapted to plain JavaScript
(`static/prism.js`, MIT attribution in `static/COMPONENTRY-LICENSE.txt`), with
reduced-motion support and a CSS fallback when WebGL2 is unavailable.

## Longer recordings

Eight seconds remains the default; 15, 30, and 60 seconds are also available.
Each clip is uploaded in one request and transcribed as a whole, without browser
segmentation. Captions arrive after the entire clip is processed. Continuous
starts another clip automatically; uncheck it to stop after one clip.
Finish phrase submits early and pauses.

The hosted preprocessing duration limit is 60 seconds, with a 3,601-source-frame
budget (up to 60 FPS). Model dataset filtering and cropping limits are 1,502
frames to preserve a full minute resampled to 25 FPS. Input-frame preservation
is checked before inference. The existing 50 MiB local upload limit still applies.
The backend update is deployed in the existing Amarel model project; its source
is managed separately from this client repository. A real 60-second repeated
public-footage upload preserved all 1,500 frames and returned a transcript through
the local proxy and public tunnel. This checks capacity, not long-form accuracy.

Regression: `node tests/long_capture.cjs`.

## Decorative face mesh

The existing mirrored camera preview has a transparent cyan wireframe canvas,
with brighter lips and subtle facial contours. It is cosmetic, not recognition,
confidence, model output, or a measure of lip-reading quality. It is never drawn
into recordings or sent to FLARE. The media stream and recorder are unchanged.

MediaPipe 0.10.21 and the Face Landmarker model are bundled in
`static/mesh-assets/`, including attribution and source URLs. The browser reads
small (at most 384px) snapshots of the existing video and processes them locally
in a worker. No extra permission or camera stream is used. Detection is capped
at 10 Hz and backs off on slow devices, with one frame in flight; canvas drawing
is capped at 30 Hz. Worker CPU overhead still depends on hardware. Disable it
using **Details → Face mesh** if needed. Unsupported or failed initialization
leaves the camera and transcription working without a mesh. Workers and canvas
are cleared when video stops, the tab is hidden, the switch is off, or the page
closes. Camera permission handling remains the existing browser flow.

Tests: `node tests/mesh.cjs` covers mirrored/letterboxed geometry, backpressure,
stale snapshots, toggle, camera end and cleanup. Existing queue, long recording,
and backend tests cover pipeline regressions. Visual testing
used moving public LRS3 footage in `tests/mesh_preview.py`; actual live webcam
FPS and performance vary by device and have not been benchmarked.

## Vercel hosting

The connected Vercel project uses `vercel.json`: build command
`node scripts/build.mjs`, framework **Other**, output directory **public**, and
repository root as Root Directory. No Python server or package install is needed
on Vercel. Pushes to the production branch build and deploy the static app.

The build copies only `static/` and a generated public configuration file into
`public/`. Python sources, model-host code, local recordings and presentation
files are not served. MediaPipe/WASM assets remain on the site's own origin.
HTTPS supports the existing camera permission flow.

On Vercel, `/api/config` resolves to the generated config. Readiness and multipart
video requests go directly from the browser to the hosted FLARE API. This avoids
Vercel Function upload-size limits for long recordings. The FLARE API must permit
the website origin through CORS (the current API permits `*`). Raw audio-free
recordings are sent only to that configured model service. Transcripts and the
cosmetic face mesh still work as before; the mesh never leaves the browser.

Optional Vercel build variable: `FLARE_API_URL` overrides the default in
`flare.mjs`. It is a **public browser-visible URL**, not a secret; use an HTTPS
base URL without credentials/query/fragment. Redeploy after changing it. Static
hosting does not keep the Amarel GPU job or temporary Cloudflare tunnel alive.
The model must remain running separately for transcription to work.

Local `python server.py` continues to proxy uploads as before. Checks:
`node tests/vercel.cjs`, `node tests/queue.cjs`, `node tests/long_capture.cjs`,
`node tests/mesh.cjs`, and the Python backend tests.

## Experimental Real-Time Communication Pipeline

[@Paarth-Rana](https://github.com/Paarth-Rana) developed a standalone prototype integrating FLARE lip-reading, LiveKit real-time communication, and Gradium text-to-speech for SilentOS.

The prototype records silent video, sends it to FLARE for transcription, allows users to review or edit the generated text, and converts the message into speech delivered to another participant through LiveKit.

This experimental implementation is maintained separately to preserve the architecture of the main SilentOS application.

**Source code:** [LiveKit-Gradium](https://github.com/Paarth-Rana/LiveKit-Gradium)
