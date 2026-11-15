import json
from pathlib import Path
import socket
import sys
import threading
import tempfile
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import flare
import server
from commands import CommandStore


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

    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.saved_store = server.STORE
        server.STORE = CommandStore(Path(self.folder.name) / 'commands.sqlite3')

    def tearDown(self):
        server.STORE = self.saved_store
        self.folder.cleanup()

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

    def test_command_api_auth_parse_queue_cancel(self):
        self.assertEqual(self.call('/api/commands')[0], 403)
        token = json.loads(self.call('/api/config')[1])['session_token']
        headers = {'X-SilentOS-Token': token, 'Content-Type':'application/json'}
        code, body = self.call('/api/commands/parse', json.dumps({'text':'Send Alex on WhatsApp saying hello'}).encode(), headers)
        self.assertEqual(code, 200)
        payload = json.loads(body)
        self.assertTrue(payload['parsed'])
        payload.update(transcript='Send Alex on WhatsApp saying hello',request_key='test',mode='draft')
        code, body = self.call('/api/commands', json.dumps(payload).encode(), headers)
        self.assertEqual(code, 200)
        command = json.loads(body)
        self.assertEqual(json.loads(self.call('/api/commands',headers=headers)[1])['commands'][0]['id'], command['id'])
        self.assertEqual(self.call('/api/commands/cancel', json.dumps({'id':command['id']}).encode(), headers)[0],200)
        self.assertEqual(self.call('/api/commands/parse', b'[]', headers)[0],400)
        self.assertEqual(self.call('/api/commands/parse', b'{}', {**headers,'Origin':'https://evil.example'})[0],403)
        self.assertEqual(self.call('/api/config', headers={'Host':'evil.example'})[0],403)
        for path in ['/command.js','/handoff.js']:
            self.assertEqual(self.call(path)[0],200)

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

class RoomTests(BackendTests):
    def test_room_delivery_and_permissions(self):
        def post(path, payload):
            return self.call(path, json.dumps(payload).encode(), {'Content-Type': 'application/json'})
        code, data = post('/api/room/create', {})
        self.assertEqual(code, 200)
        credentials = json.loads(data)
        room_id = credentials['room']
        speaker = credentials['speaker_token']
        listener = credentials['listener_token']
        code, _ = post('/api/room/send', {'room': room_id, 'token': listener, 'text': 'wrong role'})
        self.assertEqual(code, 400)
        code, data = post('/api/room/send', {'room': room_id, 'token': speaker, 'text': 'hello'})
        self.assertEqual(json.loads(data)['id'], 1)
        path = '/api/room/poll?room=' + room_id + '&role=listener&after=0'
        code, data = self.call(path, headers={'Authorization': 'Bearer ' + listener})
        self.assertEqual(json.loads(data)['messages'][0]['text'], 'hello')
        self.assertEqual(post('/api/room/ack', {'room': room_id, 'token': listener, 'id': 1})[0], 200)
        code, data = self.call('/api/room/poll?room=' + room_id + '&role=speaker', headers={'Authorization': 'Bearer ' + speaker})
        self.assertEqual(json.loads(data)['received_through'], 1)
        self.assertTrue(json.loads(data)['listener_connected'])
        self.assertEqual(self.call(path, headers={'Authorization': 'Bearer invalid'})[0], 403)
        self.assertEqual(self.call('/listen')[0], 200)

class SignalingTests(BackendTests):
    def test_offer_answer_and_role_validation(self):
        def post(path, payload):
            return self.call(path, json.dumps(payload).encode(), {'Content-Type':'application/json'})
        _, data = post('/api/room/create', {})
        c = json.loads(data)
        base = {'room':c['room'], 'role':'speaker', 'token':c['speaker_token']}
        self.assertEqual(post('/api/room/signal', {**base, 'payload':{'type':'offer','sdp':'sample'}})[0], 200)
        q = f"/api/room/signals?room={c['room']}&role=listener&after=0"
        code, data = self.call(q, headers={'Authorization':'Bearer '+c['listener_token']})
        self.assertEqual(json.loads(data)['events'][0]['sdp'], 'sample')
        self.assertEqual(self.call(q, headers={'Authorization':'Bearer incorrect'})[0], 403)
        bad = {'room':c['room'], 'role':'listener','token':c['listener_token'],'payload':{'type':'offer','sdp':'sample'}}
        self.assertEqual(post('/api/room/signal', bad)[0], 400)
        answer = {**bad, 'payload':{'type':'answer','sdp':'response'}}
        self.assertEqual(post('/api/room/signal', answer)[0], 200)
        self.assertEqual(self.call('/call.js')[0], 200)
