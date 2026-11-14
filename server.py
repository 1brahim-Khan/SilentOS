"""Local camera application. Run: python3 server.py"""
import argparse
import errno
from urllib.parse import urlparse
import json
import os
from pathlib import Path
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from flare import DEFAULT_URL, ready, transcribe

BASE_URL = os.environ.get('FLARE_API_URL', DEFAULT_URL)
BUSY = threading.Lock()
PAGE = Path(__file__).parent / 'static' / 'index.html'


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(130)

    def send(self, status, payload, content_type='application/json'):
        body = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass  # The browser may close while inference is still running.

    def do_GET(self):
        if self.path == '/':
            self.send(200, PAGE.read_bytes(), 'text/html; charset=utf-8')
        elif self.path == '/prism.js':
            self.send(200, (PAGE.parent / 'prism.js').read_bytes(), 'text/javascript; charset=utf-8')
        elif self.path == '/api/config':
            self.send(200, {'api_url': BASE_URL})
        elif self.path == '/api/ready':
            try:
                self.send(200, ready(BASE_URL))
            except Exception as exc:
                self.send(503, {'error': str(exc)})
        else:
            self.send(404, {'error': 'Not found'})

    def do_POST(self):
        if self.path != '/api/transcribe':
            self.send(404, {'error': 'Not found'})
            return
        # Only the local page should be able to submit camera recordings.
        origin = self.headers.get('Origin')
        if origin and origin not in {f'http://localhost:{self.server.server_port}', f'http://127.0.0.1:{self.server.server_port}'}:
            self.send(403, {'error': 'Origin not allowed'})
            return
        mime = self.headers.get('Content-Type', '').split(';')[0]
        if mime not in {'video/webm', 'video/mp4'}:
            self.send(415, {'error': 'Send a WebM or MP4 video body'})
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            size = 0
        if not 0 < size <= 50 * 1024 * 1024:
            self.send(413, {'error': 'Video must be between 1 byte and 50 MiB'})
            return
        if not BUSY.acquire(blocking=False):
            self.send(429, {'error': 'Another clip is processing; wait for it to finish'})
            return
        try:
            received = time.monotonic()
            data = self.rfile.read(size)
            if len(data) != size:
                raise ValueError('Incomplete upload')
            started = time.monotonic()
            with tempfile.TemporaryDirectory(prefix='flare-') as folder:
                path = Path(folder) / ('clip.webm' if mime == 'video/webm' else 'clip.mp4')
                path.write_bytes(data)
                result = transcribe(path, BASE_URL)
            result['receive_ms'] = round((started - received) * 1000)
            result['proxy_ms'] = round((time.monotonic() - started) * 1000)
            self.send(200, result)
        except Exception as exc:
            self.send(502, {'error': str(exc)})
        finally:
            BUSY.release()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--api-url', default=BASE_URL, help='Current hosted FLARE base URL (or FLARE_API_URL environment variable)')
    args = parser.parse_args()
    BASE_URL = args.api_url.rstrip('/')
    parsed = urlparse(BASE_URL)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        parser.error('--api-url must be an HTTP(S) base URL without credentials, query, or fragment')
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    except OSError as exc:
        if exc.errno == errno.EADDRINUSE:
            parser.exit(1, f'Port {args.port} is already in use. Open http://localhost:{args.port}, stop the old server, or choose --port {args.port + 1}.\n')
        raise
    print(f'Camera app: http://localhost:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
