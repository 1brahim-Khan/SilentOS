# Hosted FLARE client

Public API verified November 14, 2026:
`https://continually-priest-rural-moments.trycloudflare.com`

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

## Two-device caption and voice demo

This is a one-way, turn-based conversation demo: the speaker records and reviews text on the Mac, and a listener sees captions and can use their browser's text-to-speech. It does **not** yet provide live video, microphone return audio, automatic transcript stitching, or a telephone call. Room transport uses short HTTP polling, not WebSockets. A working FLARE endpoint is required for transcription; a message can also be typed into Current command and finished for a text-only room test.

On the speaker's Mac, connect both devices to a trusted LAN/hotspot that permits device-to-device traffic, then run:

```sh
python3 server.py --lan --api-url https://CURRENT-FLARE-HOST
```

Open `http://localhost:8000` on the Mac (localhost is needed for camera permission). Create a room in **Two-device conversation**. Find the Mac's LAN IPv4 address in Wi-Fi settings, or run `ipconfig getifaddr en0` on macOS (your active interface might differ). Enter it in Host LAN IP, copy the generated link, and share it privately with the listener. The listener opens that link on the second device and taps **Enable voice** and **Test voice**. The listener page needs neither camera nor microphone permission.

On the speaker, record a phrase, click **Finish command**, review/edit the command, and click **Send reviewed command to listener**. The status indicates that the listener fetched the message; it does not prove audio played. Browser voices and autoplay policies vary: test the actual listener device. Captions arriving before voice is enabled are shown as text only. The browser queues spoken messages in order.

Rooms expire after one hour, are held only in server memory, and disappear on restart. Listener links grant access to captions to anyone who holds them; create a fresh room if a link leaks. This LAN demo uses **unencrypted HTTP**, so use it only on a trusted private network; it is not suitable for sensitive conversations or public exposure. Camera/video upload and room creation are restricted to the server machine. The listener can only read and acknowledge captions, not submit speaker messages. Messages are retained in memory until room expiry/restart (maximum 200 per room). A receipt means the listener page received text, not that speech played. For remote devices or HTTPS on both phones, use a properly authenticated HTTPS deployment; do not expose the development server directly to the internet.

If the listener cannot connect, check the IP address, server's `--lan` flag, firewall permissions, and client isolation on Wi-Fi. If transcription fails, get the current FLARE API URL; an expired tunnel cannot be fixed by the room. The room and UI tests are automated, but a real second device and actual audio playback still require manual validation.
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

## Two-way video call (experimental)

The speaker can send camera video while keeping their microphone off; the listener can send camera video and microphone audio. Approved captions and listener-side text-to-speech remain separate from the WebRTC media connection. Both people must click their call button and grant permission. The silent speaker's recorded FLARE clips still use video only.

The listener must open the room through HTTPS with a certificate its browser trusts. The existing HTTP LAN link is not a secure context and cannot request camera/microphone access. One way to prepare a **trusted private-network certificate** is `mkcert`: install and initialize it on the host, generate a certificate for the host's current LAN IP, then install its local CA certificate on the listener laptop through the OS's certificate trust settings. Trust only a CA controlled by someone you trust; never copy the CA private key to the second device. Refer to mkcert's documentation for your operating systems. Store the leaf certificate and private key outside the repository.

With the current LAN IP substituted:

```sh
mkcert -install
mkcert -cert-file /private/tmp/silentos-cert.pem -key-file /private/tmp/silentos-key.pem 192.168.1.25
python3 server.py --lan --port 8000 --tls-port 8443 \
  --tls-cert /private/tmp/silentos-cert.pem --tls-key /private/tmp/silentos-key.pem \
  --api-url https://CURRENT-FLARE-HOST
```

Open `http://localhost:8000` on the speaker's Mac. Create a new room, enter its actual LAN IP and HTTPS port 8443, then share the generated `https://.../listen#...` link privately. The listener must trust the issuing CA and use the same IP covered by the certificate. Click **Start video call** on the speaker and **Join video call** on the listener. Listener grants camera/microphone access; use headphones to avoid speech playback feeding back into the microphone. End call stops the listener's camera/microphone and closes WebRTC; the speaker camera remains active for FLARE until the page closes. Create a new room for a fresh call after a reconnect or failure.

The server uses HTTP polling for signaling and a public STUN service for ICE discovery. No TURN relay is configured: direct peer connections may fail on isolated/restricted Wi-Fi, even when signaling works. Both devices need to reach the host's HTTPS port. This is an experimental trusted-LAN demo, not a production conferencing service. Do not expose the server directly to the public Internet. WebRTC signaling and room APIs were tested with simulated requests; actual camera/microphone and two-device connectivity have not been verified.

### Phone and video views

The call starts in **phone view**: incoming video is visually hidden while call audio remains available. Choose **Video view** to display the other participant's video if they share it. Each participant separately controls **Share my camera**, which starts off. The silent speaker's lip-reading camera continues to run locally even when camera sharing is off; sharing uses a separate cloned track. The listener's microphone is requested when joining and is sent to the speaker. The listener's camera is requested for optional sharing but its video track starts disabled. Test actual device behavior and permissions before relying on these controls; video-call connectivity and playback are still unverified on two physical devices.

## Hosted two-laptop call

The simpler HTTPS demo is in `web-call/`, deployed at https://silentos-call.vercel.app. Open it on the silent speaker laptop, create a call, and copy the invitation to the second laptop. No LAN addresses, local certificate setup, or local Python server are needed. The second laptop joins with microphone/camera permission; both start with camera sharing off and can choose phone or video view. Use headphones and click Enable call sound if playback is blocked. See `web-call/README.md` for deployment and networking limits.

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
