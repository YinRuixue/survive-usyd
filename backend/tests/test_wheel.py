import gzip
import json
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from game_backend.engine import Game, GameError, Rules
from game_backend.store import Store

ROOT = Path(__file__).resolve().parents[2]
RULES = Rules(json.loads((ROOT / "html-game/data/game.json").read_text()))
WHEEL = RULES.data["wheel"]
ROUTES = json.loads(gzip.decompress((Path(__file__).parent / "fixtures/routes.json.gz").read_bytes()))
ROUTE = next(r["controls"] for r in ROUTES if r["route"] == "female_solo")
INITIAL = {"knowledge": 20, "energy": 75, "stress": 28, "fitness": 0, "money": 80}


class WheelTest(unittest.TestCase):
    def test_all_prizes_apply_once_and_carry_into_week_one(self):
        for index, prize in enumerate(WHEEL["prizes"]):
            with self.subTest(prize=prize["name"]):
                calls = []
                def draw(count):
                    calls.append(count)
                    return index
                game = Game(RULES, random_index=draw)
                for step in ROUTE:
                    game.click(step["id"])
                    if step["id"] == WHEEL["control"]:
                        self.assertEqual(game.get("wheel/prizeIndex"), index)
                        self.assertEqual(game.get("wheel/delta"), prize["delta"])
                        for stat, base in INITIAL.items():
                            self.assertEqual(game.get("home/" + stat), base + (prize["amount"] if stat == prize["stat"] else 0))
                        saved = game.snapshot()
                        with self.assertRaises(GameError): game.click(WHEEL["control"])
                        restored = Game(RULES, random_index=lambda count: self.fail("Unexpected redraw"))
                        restored.restore(saved)
                        restored.frame = WHEEL["frame"]
                        restored.click(WHEEL["control"])
                        self.assertEqual(restored.values, saved["values"])
                    if "Dorm Home" in RULES.data["nodes"][game.frame]["name"]: break
                self.assertEqual(calls, [10])
                for stat, base in INITIAL.items():
                    expected = base + (prize["amount"] if stat == prize["stat"] else 0)
                    self.assertEqual(game.get("home/" + stat), expected)

    def test_legacy_save_migration_preserves_existing_reward(self):
        for frame in WHEEL["beforeFrames"] + ["65:175", "65:732"]:
            with self.subTest(frame=frame):
                saved = Game(RULES).snapshot()
                saved["frame"] = frame
                for key, variable in RULES.data["variables"].items():
                    if variable["name"].startswith("wheel/"): saved["values"].pop(key)
                for key in WHEEL["legacyMoneyVariables"]: saved["values"][key] = 92
                game = Game(RULES)
                game.restore(saved)
                pending = frame in WHEEL["beforeFrames"]
                self.assertEqual(game.get("home/money"), 80 if pending else 92)
                self.assertEqual(game.get("wheel/prizeIndex"), -1 if pending else 3)
                restored = Game(RULES)
                restored.restore(game.snapshot())
                self.assertEqual(restored.values, game.values)

    def test_server_retry_reload_and_save_do_not_redraw(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "test.sqlite3"
            store = Store(path, RULES)
            sid, _, current = store.session(None)
            for step in ROUTE:
                if step["id"] == WHEEL["control"]: break
                current = store.mutate(sid, "action", {"revision": current["revision"], "requestId": uuid.uuid4().hex, "action": step["id"], "playerName": "Wheel test"})
            request = {"revision": current["revision"], "requestId": uuid.uuid4().hex, "action": WHEEL["control"]}
            with patch("game_backend.engine.secrets.randbelow", return_value=6) as draw:
                won = store.mutate(sid, "action", request)
                self.assertEqual(store.mutate(sid, "action", request), won)
                self.assertEqual(draw.call_count, 1)
            store = Store(path, RULES)
            self.assertEqual(store.session(sid)[2]["state"], won["state"])
            self.assertEqual(won["state"]["values"][RULES.by_name["home/money"]], 95)
            current = store.mutate(sid, "save", {"revision": won["revision"], "requestId": uuid.uuid4().hex, "slot": 0})
            current = store.mutate(sid, "load", {"revision": current["revision"], "requestId": uuid.uuid4().hex, "slot": 0})
            self.assertEqual(current["state"]["values"], won["state"]["values"])
            current = store.mutate(sid, "new-game", {"revision": current["revision"], "requestId": uuid.uuid4().hex})
            self.assertEqual(current["state"]["values"][WHEEL["indexVariable"]], -1)
            # A real new-game request must draw again, while retries of that draw must not.
            with patch("game_backend.engine.secrets.randbelow", return_value=2) as draw:
                for step in ROUTE:
                    current = store.mutate(sid, "action", {"revision": current["revision"], "requestId": uuid.uuid4().hex, "action": step["id"], "playerName": "Wheel test"})
                    if step["id"] == WHEEL["control"]: break
                self.assertEqual(draw.call_count, 1)
            self.assertEqual(current["state"]["values"][WHEEL["indexVariable"]], 2)
            self.assertEqual(current["state"]["values"][RULES.by_name["home/knowledge"]], 23)
            self.assertEqual(current["state"]["values"][RULES.by_name["home/money"]], 80)

    def test_production_rng_can_reach_every_prize(self):
        game = Game(RULES)
        self.assertEqual({game.random_index(10) for _ in range(1000)}, set(range(10)))
