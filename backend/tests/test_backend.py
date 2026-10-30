import copy
import gzip
import json
import os
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from game_backend.engine import Game, GameError, Rules
from game_backend.store import Conflict, Store

ROOT = Path(__file__).resolve().parents[2]
RULES = Rules(json.loads((ROOT / "html-game/data/game.json").read_text()))


class BackendTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "save.sqlite3"
        self.store = Store(self.path, RULES)
        self.sid, _, self.current = self.store.session(None)

    def tearDown(self): self.temp.cleanup()

    def mutate(self, operation, **fields):
        request = {"revision": self.current["revision"], "requestId": uuid.uuid4().hex, **fields}
        self.current = self.store.mutate(self.sid, operation, request)
        return self.current

    def start(self):
        self.mutate("action", action="442:8423", playerName="Test Player")
        return self.mutate("action", action="71:26", playerName="Test Player")

    def test_persistence_all_nine_slots_and_reload(self):
        self.start()
        for slot in range(9): self.mutate("save", slot=slot)
        self.mutate("action", action="65:102")
        self.store = Store(self.path, RULES)
        _, created, result = self.store.session(self.sid)
        self.assertFalse(created)
        self.assertEqual(result["state"]["frame"], "html:w0-intro-leaving")
        self.assertEqual(len([s for s in result["slots"] if s]), 9)
        self.current = result
        self.mutate("load", slot=8)
        self.assertEqual(self.current["state"]["frame"], "65:14")
        self.assertEqual(self.current["state"]["playerName"], "Test Player")

    def test_retry_is_exactly_once_and_conflict_is_atomic(self):
        self.start()
        request = {"revision": self.current["revision"], "requestId": uuid.uuid4().hex, "action": "65:102"}
        first = self.store.mutate(self.sid, "action", request)
        self.assertEqual(self.store.mutate(self.sid, "action", request), first)
        with self.assertRaises(Conflict):
            self.store.mutate(self.sid, "action", {**request, "requestId": uuid.uuid4().hex})
        with self.assertRaises(Conflict):
            self.store.mutate(self.sid, "action", {**request, "action": "71:26"})
        self.assertEqual(self.store.session(self.sid)[2]["revision"], first["revision"])

    def test_reject_out_of_scene_and_hidden_choices(self):
        self.start()
        for action in ("65:174", "282:3606", "made-up", ["65:102"]):
            with self.assertRaises((GameError, TypeError)):
                self.mutate("action", action=action)
        self.assertEqual(self.store.session(self.sid)[2]["state"]["frame"], "65:14")

    def test_new_game_keeps_slots_and_isolates_profiles(self):
        self.start()
        self.mutate("save", slot=0)
        self.mutate("new-game")
        self.assertIsNone(self.current["autosave"])
        self.assertEqual(self.current["state"]["frame"], RULES.data["start"])
        self.assertIsNotNone(self.store.saved_games(self.sid)["slots"][0])
        other, _, result = self.store.session(None)
        self.assertNotEqual(other, self.sid)
        self.assertEqual(result["slots"], [None] * 9)

    def test_import_validated_atomically_without_overwriting_slots(self):
        self.start()
        saved = self.current["state"]
        self.mutate("save", slot=0)
        backup = {"version": 1, "slots": [saved] * 9, "autosave": saved}
        bad = copy.deepcopy(backup)
        bad["slots"][7]["values"][RULES.by_name["home/energy"]] = "bad"
        with self.assertRaises(GameError): self.mutate("import", backup=bad)
        self.assertEqual(sum(bool(s) for s in self.store.saved_games(self.sid)["slots"]), 1)
        self.mutate("import", backup=backup)
        self.assertEqual(sum(bool(s) for s in self.current["slots"]), 9)

    def test_load_empty_or_invalid_slot_does_not_change_game(self):
        self.start()
        for slot in (0, 9, -1, True):
            with self.assertRaises(GameError): self.mutate("load", slot=slot)
        self.assertEqual(self.store.session(self.sid)[2]["state"]["frame"], "65:14")

    def test_all_authored_routes_match_javascript(self):
        fixtures = os.environ.get("SURVIVE_BACKEND_FIXTURES")
        routes = json.loads(Path(fixtures).read_text()) if fixtures else json.loads(gzip.decompress((Path(__file__).parent / "fixtures/routes.json.gz").read_bytes()))
        count = 0
        for route in routes:
            game = Game(RULES, random_index=lambda count: route.get("prize", 3))
            expected = copy.deepcopy(game.values)
            for step in route["controls"]:
                # The HTML accepts the name on the character creation screen.
                if step["id"] == "71:26": game.player_name = "Test Player"
                with self.subTest(route=route["route"], scene=step["from"], action=step["id"]):
                    self.assertEqual(game.frame, step["from"])
                    game.click(step["id"])
                    expected.update(step["expected"]["delta"])
                    self.assertEqual(game.frame, step["to"])
                    differences = {RULES.data["variables"][key]["name"]: (value, expected[key])
                                   for key, value in game.values.items() if value != expected[key]}
                    self.assertEqual(differences, {})
                    self.assertEqual(game.overlays, step["expected"]["overlays"])
                count += 1
        print(f"Verified {count} Python transitions against {len(routes)} JavaScript routes.")

    def test_failure_boundaries_match_javascript(self):
        fixtures = json.loads(gzip.decompress((Path(__file__).parent / "fixtures/boundaries.json.gz").read_bytes()))
        for index, item in enumerate(fixtures):
            game, expected = Game(RULES), Game(RULES)
            game.restore(item["before"])
            expected.restore(item["after"])
            game.click(item["id"])
            self.assertEqual(game.frame, expected.frame, f"Boundary {index}")
            differences = {RULES.data["variables"][key]["name"]: (value, expected.values[key])
                           for key, value in game.values.items() if value != expected.values[key]}
            self.assertEqual(differences, {}, f"Boundary {index}")
        print(f"Verified {len(fixtures)} boundary transitions, including resource and triple-activity endings.")


if __name__ == "__main__": unittest.main()
