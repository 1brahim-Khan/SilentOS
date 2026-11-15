import json
from pathlib import Path
import socket
import sys
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import flare
import server


class BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.httpd.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join()

    def call(self, path, data=None, headers=None):
        req = urllib.request.Request(self.url + path, data=data, headers=headers or {})
        try:
            response = urllib.request.urlopen(req, timeout=5)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            return response.status, response.read()

    def test_camera_page_and_config(self):
        code, body = self.call('/')
        self.assertEqual(code, 200)
        self.assertIn(b'Finish phrase', body)
        self.assertEqual(json.loads(self.call('/api/config')[1])['api_url'], server.BASE_URL)

    def test_mesh_local_assets_and_route_restrictions(self):
        for path in ('/face-mesh.js', '/face-mesh-worker.js', '/mesh-geometry.js',
                     '/mesh-assets/wasm/vision_wasm_internal.js'):
            code, body = self.call(path)
            self.assertEqual(code, 200)
            self.assertTrue(body)
        self.assertEqual(self.call('/mesh-assets/../server.py')[0], 404)
        self.assertEqual(self.call('/mesh-assets/unknown.wasm')[0], 404)

    def test_local_origin_required(self):
        self.assertEqual(self.call('/api/config', headers={'Host': 'evil.example'})[0], 403)
        self.assertEqual(self.call('/api/config', headers={'Origin': 'https://evil.example'})[0], 403)

    def test_ready_outage(self):
        with patch.object(server, 'ready', side_effect=RuntimeError('Tunnel unavailable')):
            code, body = self.call('/api/ready')
        self.assertEqual(code, 503)
        self.assertIn(b'Tunnel unavailable', body)

    def test_upload_cleanup_and_timings(self):
        paths = []
        def recognize(path, base_url):
            paths.append(path)
            self.assertEqual(path.read_bytes(), b'video')
            return {'text': 'hello', 'audio_used': False}
        with patch.object(server, 'transcribe', side_effect=recognize):
            code, body = self.call('/api/transcribe', b'video', {'Content-Type':'video/webm;codecs=vp8'})
        self.assertEqual(code, 200)
        result = json.loads(body)
        self.assertEqual(result['text'], 'hello')
        self.assertIn('proxy_ms', result)
        self.assertFalse(paths[0].exists())

    def test_reject_invalid_type_and_busy(self):
        self.assertEqual(self.call('/api/transcribe', b'video', {'Content-Type':'text/plain'})[0], 415)
        with server.BUSY:
            self.assertEqual(self.call('/api/transcribe', b'video', {'Content-Type':'video/mp4'})[0], 429)

    def test_dns_failure_is_actionable(self):
        with patch.object(flare.urllib.request, 'urlopen', side_effect=urllib.error.URLError(socket.gaierror('DNS failure'))):
            with self.assertRaisesRegex(RuntimeError, 'temporary tunnel may have expired'):
                flare.ready()


if __name__ == '__main__':
    unittest.main()
