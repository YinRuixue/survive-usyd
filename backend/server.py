#!/usr/bin/env python3
"""Run with python3 backend/server.py. No third-party packages required."""
import argparse
import json
import mimetypes
import re
import sqlite3
import threading
import webbrowser
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from game_backend.engine import GameError, Rules
from game_backend.store import Conflict, Store, encode

ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = ROOT / "html-game"
PUBLIC_FILES = {"index.html", "app.js", "audio.js", "display-format.js", "engine.js", "save-store.js", "save-menu.js", "backend-client.js",
                "game-data.js", "style.css", "使用说明.txt"}


def create_server(port=8765, database=None):
    rules = Rules(json.loads((WEB_ROOT / "data/game.json").read_text()))
    store = Store(database or ROOT / "backend/data/survive.sqlite3", rules)

    class Handler(BaseHTTPRequestHandler):
        server_version = "SurviveUSYD/1.0"

        def valid_host(self):
            return self.headers.get("Host") in {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}

        def session_id(self):
            cookies = SimpleCookie()
            try: cookies.load(self.headers.get("Cookie", ""))
            except Exception: return None
            cookie = cookies.get("survive_session")
            return cookie.value if cookie and re.fullmatch(r"[a-f0-9]{64}", cookie.value) else None

        def reply(self, status, body, content_type="application/json; charset=utf-8", cookie=None):
            raw = body if isinstance(body, bytes) else encode(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(raw)))
            self.send_header("Cache-Control", "no-store" if content_type.startswith("application/json") else "no-cache")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "same-origin")
            if cookie:
                self.send_header("Set-Cookie", f"survive_session={cookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000")
            self.end_headers()
            if self.command != "HEAD": self.wfile.write(raw)

        def do_HEAD(self): self.do_GET()

        def do_GET(self):
            if not self.valid_host(): return self.reply(403, {"error": "Use the local game address."})
            path = unquote(urlsplit(self.path).path)
            try:
                if path == "/api/health": return self.reply(200, {"ok": True, "service": "survive-usyd", "version": 1})
                if path == "/api/session":
                    sid, created, result = store.session(self.session_id())
                    return self.reply(200, result, cookie=sid)
                if path == "/api/saves": return self.reply(200, store.saved_games(self.session_id()))
                relative = "index.html" if path == "/" else path.lstrip("/")
                asset = relative.startswith("assets/") and ".." not in Path(relative).parts
                target = (WEB_ROOT / relative).resolve()
                if (relative not in PUBLIC_FILES and not asset) or WEB_ROOT not in target.parents or not target.is_file():
                    return self.reply(404, {"error": "Not found."})
                mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
                return self.reply(200, target.read_bytes(), mime)
            except PermissionError as error: self.reply(401, {"error": str(error)})
            except (OSError, sqlite3.Error): self.reply(503, {"error": "Save storage is unavailable. Please try again."})

        def do_POST(self):
            if not self.valid_host() or self.headers.get("Origin") != "http://" + self.headers.get("Host", ""):
                return self.reply(403, {"error": "Open the game from its local address."})
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self.reply(415, {"error": "Send JSON."})
            path = urlsplit(self.path).path
            if path not in {"/api/action", "/api/new-game", "/api/save", "/api/load", "/api/import"}:
                return self.reply(404, {"error": "Not found."})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                limit = 4_000_000 if path == "/api/import" else 4096
                if length <= 0 or length > limit:
                    self.close_connection = True
                    return self.reply(413, {"error": "Request is too large or empty."})
                payload = json.loads(self.rfile.read(length), parse_constant=lambda value: (_ for _ in ()).throw(ValueError("Non-finite JSON")))
                if not isinstance(payload, dict): raise GameError("Expected an object.")
                result = store.mutate(self.session_id(), path.removeprefix("/api/"), payload)
                return self.reply(200, result)
            except Conflict as error: self.reply(409, {"error": str(error)})
            except PermissionError as error: self.reply(401, {"error": str(error)})
            except (GameError, ValueError, TypeError, KeyError) as error: self.reply(400, {"error": str(error)})
            except (OSError, sqlite3.Error): self.reply(503, {"error": "The change could not be saved. Your previous save is kept."})

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--database", type=Path, default=ROOT / "backend/data/survive.sqlite3")
    parser.add_argument("--open-browser", action="store_true")
    args = parser.parse_args()
    try:
        server = create_server(args.port, args.database)
    except OSError as error:
        print(f"Cannot start the game: {error}\nClose the existing server or choose another --port.")
        return 1
    url = f"http://127.0.0.1:{server.server_port}"
    print(f"Survive USYD is ready: {url}\nSaves: {args.database}\nPress Ctrl+C to stop.", flush=True)
    if args.open_browser: threading.Timer(.3, lambda: webbrowser.open(url)).start()
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
