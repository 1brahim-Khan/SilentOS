# Hosted FLARE client

Public API verified November 14, 2026:
`https://triple-card-ministers-outsourcing.trycloudflare.com`

The tunnel runs on Amarel within job 63918217 on gpuk010, independently of
any laptop. The current allocation ends November 14 at 11:43 PM Eastern.
Readiness is `GET /ready`; transcription is `POST /transcribe` with multipart
field `video`. This is a temporary API URL, not a hosted camera webpage.
The tunnel log is `~/projects/flare_webcam_demo/reports/cloudflare-63918217.log`
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

Use a consented 2–5 second raw webcam recording, at most 8 seconds. MP4 or WebM; one face, front-facing and well lit. Do not crop or resize manually. For browser capture use `audio: false`. Uploading sends the video to the teammate's hosted service.

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

Check readiness once at session start. Transcription verifies a nonempty transcript and `audio_used: false`, without an extra readiness request. Clip duration is enforced by the server. Keep Start/Stop recording under 8 seconds, show processing state, and prevent duplicate submissions in your UI. These client helpers do not record video or execute agent actions; the local camera page below records video.

Next live check: upload a real clip, inspect transcript and timing, then test from the actual frontend origin. The guide reports a finite GPU allocation; reconfirm availability before a demo.

## Local camera app

```sh
cd SilentOS
python3 server.py
```

Open http://localhost:8000, allow camera access when prompted, then press Start. The camera opens automatically and stays on between phrases until the page closes. The backend must run on your laptop for this localhost URL to work there. Use `--port 8001` if necessary. No additional dependencies.

The browser captures audio-free MP4/WebM clips with an eight-second default (3, 5, and 6 seconds are also available) and sends raw video bodies to local `POST /api/transcribe`. Eight-second capture stops about 100ms early to allow recorder shutdown within the API limit. The backend forwards multipart uploads using the existing FLARE client, validates responses, and removes temporary files. `GET /api/ready` proxies model readiness. The camera preview is mirrored; uploaded frames are not intentionally mirrored.

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

## Command assembly

Press Start and record one instruction across multiple clips. The Current command
panel joins returned clips in capture order with a space; it preserves wording,
punctuation, and repetitions rather than guessing missing or overlapping words.
Finish phrase (or Pause) pauses capture without closing the command. Start adds
more clips to that same draft. Finish command stops capture and waits for the
last recording and all queued uploads before marking the text Ready for review.
With Continuous unchecked, each clip pauses capture but still belongs to the
current command until Finish command is pressed.

Review or edit the command while capture and uploads are idle. New command clears
the current command without clearing transcript history. Recording, camera, or
transcription failures mark the command Incomplete and require New command before
recording another instruction. Clips shorter than half a second are still skipped.
Commands live only in browser memory and are lost on reload. Ready means all clips
returned, not that the instruction is semantically complete or correctly recognized.
Finished commands now feed a parser and persistent local handoff queue; see below.
The application itself does not send messages.

Checks: `node tests/command.cjs`, `node tests/queue.cjs`, and
`python3 -m unittest discover -s tests -p 'test_*.py'`.

## Message parsing and HeyClicky connector

After finishing a command, the Message handoff panel extracts explicit instructions
such as `Send Alex on WhatsApp saying I will be there soon`. Review app, recipient,
and exact message, choose draft or send mode, then queue it. Optional automatic
queueing is off by default. The SQLite queue survives restarts and the local MCP
connector supplies atomic claim and result-reporting tools for HeyClicky.

See [HEYCLICKY.md](HEYCLICKY.md) for setup, supported phrasing, draft testing,
recovery, and privacy. A connected **active** HeyClicky job is still needed; no
automatic external wakeup or live message sending has been verified. Queueing
alone never opens a messaging app or sends. End-to-end tests are still required.
