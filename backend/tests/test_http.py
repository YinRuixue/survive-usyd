import http.client
import json
import sys
import tempfile
import threading
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import create_server


class HTTPTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / "http.sqlite3"
        self.cookie = None
        self.start_server()

    def start_server(self):
        self.server = create_server(0, self.database)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def tearDown(self):
        self.stop_server()
        self.temp.cleanup()

    def request(self, path, body=None, headers=None):
        port = self.server.server_port
        conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        fields = {"Origin": f"http://127.0.0.1:{port}", "Content-Type": "application/json"}
        if self.cookie: fields["Cookie"] = self.cookie
        fields.update(headers or {})
        conn.request("POST" if body is not None else "GET", path, json.dumps(body) if body is not None else None, fields)
        response = conn.getresponse()
        cookie = response.getheader("Set-Cookie")
        if cookie:
            self.assertIn("HttpOnly", cookie)
            self.assertIn("SameSite=Strict", cookie)
            self.cookie = cookie.split(";")[0]
        raw = response.read()
        result = json.loads(raw) if response.getheader("Content-Type", "").startswith("application/json") else raw
        status = response.status
        conn.close()
        return status, result

    def mutate(self, operation, **payload):
        status, result = self.request("/api/" + operation, {"requestId": uuid.uuid4().hex, "revision": self.current["revision"], **payload})
        self.assertEqual(status, 200, result)
        self.current = result
        return result

    def test_full_frontend_protocol_and_restart_persistence(self):
        self.assertEqual(self.request("/")[0], 200)
        self.assertEqual(self.request("/backend-client.js")[0], 200)
        self.assertEqual(self.request("/audio.js")[0], 200)
        self.assertEqual(self.request("/display-format.js")[0], 200)
        status, sound = self.request("/assets/audio/button-click.wav")
        self.assertEqual(status, 200)
        self.assertEqual(sound[:4], b"RIFF")
        status, self.current = self.request("/api/session")
        self.assertEqual(status, 200)
        self.mutate("action", action="442:8423", playerName="Backend Player")
        self.mutate("action", action="71:26", playerName="Backend Player")
        for slot in range(9): self.mutate("save", slot=slot)
        self.mutate("action", action="65:102")
        self.assertEqual(self.current["state"]["frame"], "html:w0-intro-leaving")
        self.stop_server()
        self.start_server()
        _, self.current = self.request("/api/session")
        self.assertEqual(self.current["state"]["frame"], "html:w0-intro-leaving")
        self.mutate("load", slot=8)
        self.assertEqual(self.current["state"]["frame"], "65:14")
        self.mutate("new-game")
        self.assertEqual(self.current["state"]["frame"], "3:138")
        self.assertIsNone(self.current["autosave"])
        self.assertEqual(sum(bool(s) for s in self.request("/api/saves")[1]["slots"]), 9)

    def test_request_validation_origin_and_static_boundaries(self):
        _, self.current = self.request("/api/session")
        request = {"requestId": uuid.uuid4().hex, "revision": 0, "action": "71:26", "playerName": "Test Player"}
        self.assertEqual(self.request("/api/action", request, {"Origin": "https://example.org"})[0], 403)
        self.assertEqual(self.request("/api/action", request, {"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.request("/api/action", {**request, "action": "65:174"})[0], 400)
        self.assertEqual(self.request("/api/session", headers={"Host": "example.org"})[0], 403)
        for path in ("/../backend/server.py", "/backend/data/survive.sqlite3", "/assets/%2e%2e/%2e%2e/backend/server.py", "/data/game.json"):
            self.assertEqual(self.request(path)[0], 404)
        status, accepted = self.request("/api/action", request)
        self.assertEqual(status, 200)
        self.assertEqual(self.request("/api/action", request)[1], accepted)
        self.assertEqual(self.request("/api/action", {**request, "requestId": uuid.uuid4().hex})[0], 409)

    def test_new_character_requires_a_name(self):
        _, self.current = self.request("/api/session")
        # Choosing a character is allowed before filling in the name.
        self.mutate("action", action="442:8423", playerName="")
        for name in (None, "", "   ", "\t\n", "\u3000"):
            request = {"requestId": uuid.uuid4().hex, "revision": self.current["revision"], "action": "71:26"}
            if name is not None: request["playerName"] = name
            status, result = self.request("/api/action", request)
            self.assertEqual(status, 400, result)
            _, unchanged = self.request("/api/session")
            self.assertEqual(unchanged["revision"], self.current["revision"])
            self.assertEqual(unchanged["state"]["frame"], "3:138")
            self.assertIsNone(unchanged["autosave"])
        self.mutate("action", action="71:26", playerName="  Lumi  ")
        self.assertEqual(self.current["state"]["playerName"], "Lumi")
        self.assertEqual(self.current["state"]["frame"], "65:14")
        self.mutate("save", slot=0)
        self.mutate("new-game")
        self.assertEqual(self.current["state"]["playerName"], "")
        # Loading a saved character does not require a new name on the title screen.
        self.mutate("load", slot=0)
        self.assertEqual(self.current["state"]["playerName"], "Lumi")
        self.assertEqual(self.current["state"]["frame"], "65:14")


if __name__ == "__main__": unittest.main()
