/* Cosmetic only: no camera access, network uploads, identity or transcription. */
'use strict';
var exports = {};
importScripts('/mesh-assets/vision_bundle.cjs');

let landmarker;
async function initialize() {
  const {FilesetResolver, FaceLandmarker} = exports;
  const files = await FilesetResolver.forVisionTasks('/mesh-assets/wasm');
  landmarker = await FaceLandmarker.createFromOptions(files, {
    baseOptions: {modelAssetPath: '/mesh-assets/face_landmarker.task', delegate: 'CPU'},
    runningMode: 'VIDEO', numFaces: 1,
    outputFaceBlendshapes: false, outputFacialTransformationMatrixes: false,
    minFaceDetectionConfidence: 0.55, minFacePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });
  const edges = connections => connections.map(({start, end}) => [start, end]);
  const contours = [...FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
    ...FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, ...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW];
  // De-duplicate the triangle edges, avoiding unnecessary overdraw.
  const unique = new Map();
  for (const [a, b] of edges(FaceLandmarker.FACE_LANDMARKS_TESSELATION)) {
    unique.set(a < b ? `${a},${b}` : `${b},${a}`, [a, b]);
  }
  postMessage({type: 'ready', mesh: [...unique.values()],
    contours: edges(contours), lips: edges(FaceLandmarker.FACE_LANDMARKS_LIPS)});
}
self.onmessage = async ({data}) => {
  if (data.type === 'init') {
    try { await initialize(); }
    catch (error) { postMessage({type: 'error', message: String(error)}); }
    return;
  }
  if (data.type === 'frame') {
    const started = performance.now();
    try {
      const result = landmarker.detectForVideo(data.bitmap, data.timestamp);
      // Only coordinates leave this worker, and only to the same page.
      postMessage({type: 'landmarks', points: result.faceLandmarks[0] || [],
        elapsed: performance.now() - started});
    } catch (error) { postMessage({type: 'error', message: String(error)}); }
    finally { data.bitmap.close(); }
  }
};
