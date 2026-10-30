"""Atomic SQLite sessions, autosaves and nine manual slots per browser profile."""
import hashlib
import json
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

from .engine import Game, GameError


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


class Conflict(GameError):
    pass


class Store:
    def __init__(self, path, rules):
        self.path = str(path)
        self.rules = rules
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as db:
            db.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY, state TEXT NOT NULL, autosave TEXT,
                    revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS slots (
                    session_id TEXT NOT NULL REFERENCES sessions(id), slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 8),
                    snapshot TEXT NOT NULL, PRIMARY KEY(session_id, slot));
                CREATE TABLE IF NOT EXISTS requests (
                    session_id TEXT NOT NULL REFERENCES sessions(id), request_id TEXT NOT NULL,
                    fingerprint TEXT NOT NULL, response TEXT NOT NULL,
                    PRIMARY KEY(session_id, request_id));
            """)

    @contextmanager
    def connection(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def slots(self, db, session_id):
        slots = [None] * 9
        for row in db.execute("SELECT slot,snapshot FROM slots WHERE session_id=?", (session_id,)):
            slots[row["slot"]] = json.loads(row["snapshot"])
        return slots

    def session(self, session_id):
        with self.connection() as db:
            row = db.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone() if session_id else None
            created = row is None
            if created:
                session_id = secrets.token_hex(32)
                db.execute("INSERT INTO sessions(id,state,updated_at) VALUES(?,?,?)",
                           (session_id, encode(Game(self.rules).snapshot()), int(time.time())))
                row = db.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
            return session_id, created, {
                "state": json.loads(row["state"]), "revision": row["revision"],
                "autosave": json.loads(row["autosave"]) if row["autosave"] else None,
                "slots": self.slots(db, session_id), "backend": "python-sqlite", "version": 1,
            }

    def saved_games(self, session_id):
        with self.connection() as db:
            row = db.execute("SELECT autosave FROM sessions WHERE id=?", (session_id,)).fetchone()
            if not row: raise PermissionError("Please reload the game to connect.")
            return {"slots": self.slots(db, session_id), "autosave": json.loads(row[0]) if row[0] else None}

    def mutate(self, session_id, operation, payload):
        request_id = payload.get("requestId")
        revision = payload.get("revision")
        if not isinstance(request_id, str) or not re.fullmatch(r"[a-zA-Z0-9-]{16,80}", request_id):
            raise GameError("Invalid request ID.")
        if not isinstance(revision, int) or isinstance(revision, bool) or revision < 0:
            raise GameError("Invalid game revision.")
        fingerprint = hashlib.sha256(encode([operation, payload]).encode()).hexdigest()
        with self.connection() as db:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
            if not row: raise PermissionError("Please reload the game to connect.")
            repeated = db.execute("SELECT fingerprint,response FROM requests WHERE session_id=? AND request_id=?",
                                  (session_id, request_id)).fetchone()
            if repeated:
                if repeated["fingerprint"] != fingerprint: raise Conflict("This request ID has already been used.")
                return json.loads(repeated["response"])
            if revision != row["revision"]:
                raise Conflict("This game changed in another tab. Reload the page before continuing.")
            game = Game(self.rules)
            game.restore(json.loads(row["state"]))
            autosave = row["autosave"]
            include_slots = False
            message = None
            if operation == "action":
                if game.frame == game.data["start"]:
                    name = payload.get("playerName", game.player_name)
                    if not isinstance(name, str) or len(name) > 24: raise GameError("Use a name of at most 24 characters.")
                    game.player_name = name.strip()
                    if payload.get("action") == "71:26" and not game.player_name:
                        raise GameError("Please enter your name before starting.")
                game.click(payload.get("action"))
                autosave = encode(game.snapshot()) if game.frame != game.data["start"] else None
            elif operation == "new-game":
                game.reset()
                autosave = None
            elif operation == "save":
                slot = self.check_slot(payload.get("slot"))
                if game.frame == game.data["start"]: raise GameError("Start a game before saving.")
                db.execute("INSERT INTO slots VALUES(?,?,?) ON CONFLICT(session_id,slot) DO UPDATE SET snapshot=excluded.snapshot",
                           (session_id, slot, encode(game.snapshot())))
                include_slots = True
            elif operation == "load":
                slot = payload.get("slot")
                if slot is None:
                    saved = autosave
                else:
                    self.check_slot(slot)
                    entry = db.execute("SELECT snapshot FROM slots WHERE session_id=? AND slot=?", (session_id, slot)).fetchone()
                    saved = entry[0] if entry else None
                if not saved: raise GameError("This slot is empty.")
                game.restore(json.loads(saved))
                autosave = encode(game.snapshot())
            elif operation == "import":
                backup = payload.get("backup")
                if not isinstance(backup, dict) or backup.get("version") != 1 or not isinstance(backup.get("slots"), list) or len(backup["slots"]) != 9:
                    raise GameError("Choose a Survive USYD save backup.")
                imported = backup["slots"] + [backup.get("autosave")]
                for saved in imported:
                    if saved is not None:
                        game.validate(saved)
                        if saved["frame"] == game.data["start"]: raise GameError("The title screen cannot be imported as a save.")
                count = 0
                for index, saved in enumerate(backup["slots"]):
                    if saved is not None:
                        count += db.execute("INSERT OR IGNORE INTO slots VALUES(?,?,?)", (session_id, index, encode(saved))).rowcount
                if autosave is None and backup.get("autosave") is not None:
                    autosave = encode(backup["autosave"])
                    count += 1
                include_slots = True
                message = f"Imported {count} saves. Occupied slots were kept."
            else:
                raise GameError("Unknown game operation.")
            snapshot = game.snapshot()
            new_revision = revision + 1
            db.execute("UPDATE sessions SET state=?,autosave=?,revision=?,updated_at=? WHERE id=?",
                       (encode(snapshot), autosave, new_revision, int(time.time()), session_id))
            response = {"state": snapshot, "revision": new_revision,
                        "autosave": json.loads(autosave) if autosave else None}
            if include_slots: response["slots"] = self.slots(db, session_id)
            if message: response["message"] = message
            db.execute("INSERT INTO requests VALUES(?,?,?,?)", (session_id, request_id, fingerprint, encode(response)))
            # Retain recent retry receipts, bounding database growth per player.
            db.execute("DELETE FROM requests WHERE session_id=? AND rowid NOT IN (SELECT rowid FROM requests WHERE session_id=? ORDER BY rowid DESC LIMIT 100)",
                       (session_id, session_id))
            return response

    @staticmethod
    def check_slot(slot):
        if type(slot) is not int or not 0 <= slot < 9: raise GameError("Choose a slot from 1 to 9.")
        return slot
