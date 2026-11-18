"""Optional visual smoke test using an explicitly selected public/test video.

python tests/mesh_preview.py --video /path/to/nonprivate-face.mp4
Open http://localhost:8002/mesh-preview-test. Never opens a camera or uploads.
"""
import argparse
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import Handler, ThreadingHTTPServer


class PreviewHandler(Handler):
    def do_GET(self):
        if not self.local_request():
            return
        if self.path == '/mesh-preview-test':
            self.send(200, b'''<!doctype html><html><meta charset="utf-8">
<title>Decorative mesh smoke test</title><style>
body{background:#080e1a;color:white;font:14px system-ui;margin:24px}
.camera{position:relative;width:min(100%,1000px);height:65vh;border:1px solid #537b98;border-radius:24px;overflow:hidden}
video,canvas{position:absolute;inset:0;width:100%;height:100%}video{object-fit:contain;transform:scaleX(-1)}canvas{pointer-events:none}
</style><h1>Decorative mesh smoke test</h1><p>Public test footage. Local processing only.</p>
<div class="camera"><video id="preview" autoplay muted playsinline loop src="/mesh-test-clip"></video><canvas id="faceMesh" aria-hidden="true"></canvas></div>
<p><label><input id="meshEnabled" type="checkbox" checked> Mesh</label></p>
<script src="/mesh-geometry.js"></script><script src="/face-mesh.js"></script></html>''',
                      'text/html; charset=utf-8')
        elif self.path == '/mesh-test-clip':
            self.send(200, self.server.fixture.read_bytes(), 'video/mp4')
        else:
            super().do_GET()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', type=Path, required=True)
    args = parser.parse_args()
    if not args.video.is_file():
        parser.error('Test video does not exist')
    httpd = ThreadingHTTPServer(('127.0.0.1', 8002), PreviewHandler)
    httpd.fixture = args.video
    print('Mesh smoke test: http://localhost:8002/mesh-preview-test', flush=True)
    httpd.serve_forever()
