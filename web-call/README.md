# SilentOS hosted call

Deploy this directory as a Vercel project (Framework: Other). Static output is `public`; API routes proxy the existing FLARE GPU service. Set `FLARE_API_URL` to its current HTTPS base URL. No model weights run on Vercel.

```
cd web-call
vercel --prod
```

Create a call, allow camera access, and copy the invitation to the second laptop. The recipient joins with camera and microphone permission. The silent speaker's microphone is never requested. Both start in phone view with camera sharing disabled. Show video and Share my camera are independent choices. Enable call sound if browser playback is blocked. Use headphones. Record short phrases, review the transcript, then send. The recipient speaks back through WebRTC; both can type messages.

PeerJS 1.5.5 is loaded from a pinned CDN URL and uses PeerJS Cloud for signaling. Invitations are bearer secrets; share privately. This is a two-person demo. Keep the creator tab open. No room database or Vercel WebSocket server is needed. A TURN relay is still necessary on some restrictive networks; optionally set `ICE_SERVERS_JSON` to a JSON ICE server array (including short-lived TURN credentials), returned to browsers by `/api/config`. STUN-only operation is the default and does not guarantee connectivity.

Vercel's upload limit is 4.5 MB. This demo enforces 4 MB, records at a requested 700 kbps, and caps clips at five seconds. No long clips, fake transcription, or automatic send. The proxy requires a reachable FLARE service; typed messages and WebRTC do not. Browser TTS uses the listener device's installed voices. Local HeyClicky integration remains in the root app; it is not exposed in the hosted interface.

Deployment requires a valid Vercel login. Live two-device browser tests are required before claiming the call works. Source syntax and API behavior tests do not establish actual microphone/camera connectivity.


Deployment on November 14, 2026: https://silentos-call.vercel.app. Public page and deployed `/api/ready` verified; GPU service reported model_load_count:1. A real audio-free MP4 posted through the deployed HTTPS proxy returned “set a reminder for tomorrow” with 3734.17ms server processing and audio_used:false. Two-laptop media/audio playback is still unverified.

Vercel GitHub linking needs a GitHub login connection; deployment currently uses direct CLI uploads. This deployment uses --env FLARE_API_URL=...; set the project environment variable in Vercel for subsequent deployments or repeat the flag with the current URL.

## Camera studio and silent calling

The hosted interface restores the original camera-dominant glass/prism studio. The call creator requests video only and explicitly excludes every audio track from the outgoing WebRTC stream. The invited participant can speak back normally. FLARE always records a separate video-only stream. Five-second phrase capture remains bounded by Vercel upload limits.

Speak FLARE results automatically is enabled for the silent speaker: a successful transcription is sent to the connected peer, where the browser synthesizes it. Uncheck it to review and edit before sending. If the peer disconnects, the transcript stays in the draft for retry; no speech message is fabricated. Show other person's video and Share my camera remain independent options, both off initially. Typed replies remain available.

Regression: `node tests/silent-flow.cjs` verifies video-only capture, absence of outgoing speaker microphone tracks, automatic text delivery, and review-before-send mode using simulated browser APIs.

## Participant modes and call controls

Join/create is the green phone icon in the camera control bar; hang up is the red icon beside it. Both have accessible labels and tooltips. Each participant has an independent Silent mode toggle, available before joining and during idle parts of a call. Creator defaults to silent; invitee defaults to microphone. Either can capture video-only FLARE phrases and send synthesized speech in silent mode. Switching to silent replaces the outgoing microphone track with silence and stops microphone capture; switching to microphone requests permission and replaces the silent track. A silent placeholder audio track keeps the negotiated audio channel available for switching without redialing. FLARE clips always exclude audio. Mode changes are locked during recording and transcription.

## Mobile call layout

The hosted call page includes safe-area padding for notched phones, a camera-first portrait layout, compact touch controls, a scrollable conversation panel, 16px form inputs to avoid text-entry zoom, and a landscape layout. The browser requests the front camera at a preferred 720p/30fps; actual capture settings depend on the device. Share call link uses the phone's native share sheet when available; Copy invitation remains available.

Audio initialization begins on the Join/Create gesture. Local and remote media remain inline, and Enable sound retries playback after browser autoplay restrictions. Switching apps or locking the screen can interrupt media; an active phrase is discarded on backgrounding instead of auto-sending an incomplete transcript. Keep the app visible during calls. Simulated tests cover both participants, silent/microphone switching and background interruption. Actual iOS/Android device playback, camera permissions, orientation, and network connectivity still need physical-device verification.
