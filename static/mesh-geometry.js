/* Pure preview geometry, shared by the decorative overlay and its tests. */
(function (root) {
  'use strict';
  function containRect(width, height, videoWidth, videoHeight) {
    if (!(width > 0 && height > 0 && videoWidth > 0 && videoHeight > 0)) return null;
    const scale = Math.min(width / videoWidth, height / videoHeight);
    const w = videoWidth * scale, h = videoHeight * scale;
    return {x: (width - w) / 2, y: (height - h) / 2, width: w, height: h};
  }
  function project(point, rect, mirrored = true) {
    return {x: rect.x + (mirrored ? 1 - point.x : point.x) * rect.width,
      y: rect.y + point.y * rect.height};
  }
  const api = {containRect, project};
  if (typeof module !== 'undefined') module.exports = api;
  else root.SilentMeshGeometry = api;
})(typeof window === 'undefined' ? globalThis : window);
