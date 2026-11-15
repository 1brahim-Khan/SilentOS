# Locally hosted cosmetic face mesh dependencies

MediaPipe Tasks Vision **0.10.21** (Apache 2.0):
https://registry.npmjs.org/@mediapipe/tasks-vision/-/tasks-vision-0.10.21.tgz

Files copied without modification: vision_bundle.cjs and wasm/ runtime loaders
and binaries. LICENSE is the Google MediaPipe Apache 2.0 license.

Face Landmarker float16 model, version 1:
https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task

Documentation:
https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js

All files are served from the local SilentOS origin. No CDN, installation command,
API key, second camera stream or external landmark-inference service is needed.
The classic worker provides the CommonJS exports object expected by the bundle;
WASM inference runs on the CPU in that worker. This is purely UI decoration.
