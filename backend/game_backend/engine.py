"""Execute the same authored rules used by the HTML prototype."""
import copy
import math
import secrets
import time


class GameError(ValueError):
    pass


def truthy(value):
    # JavaScript treats even empty arrays / objects as true.
    return not (value is None or value is False or value == "" or
                isinstance(value, (int, float)) and (value == 0 or math.isnan(value)))


def js_string(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(int(value)) if float(value).is_integer() else str(value)
    return str(value)


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


class Rules:
    def __init__(self, data):
        self.data = data
        self.by_name = {v["name"]: key for key, v in data["variables"].items()}
        self.parents = {child: n["id"] for n in data["nodes"].values() for child in n.get("children", [])}
        self.frames = {f["id"] for f in data["frames"]}


class Game:
    def __init__(self, rules, random_index=None):
        self.rules = rules
        self.data = rules.data
        self.random_index = random_index or secrets.randbelow
        self.reset()

    def reset(self):
        self.values = {key: copy.deepcopy(v["value"]) for key, v in self.data["variables"].items()}
        self.frame = self.data["start"]
        self.overlays = []
        self.player_name = ""
        self.history = []

    def get(self, name):
        return self.values[self.rules.by_name[name]]

    def evaluate(self, expression):
        kind = expression[0]
        if kind == "l":
            return expression[1]
        if kind == "v":
            return self.values[expression[1]]
        args = [self.evaluate(e) for e in expression[2]]
        op = expression[1]
        a = args[0]
        b = args[1] if len(args) > 1 else None
        if op == "ADDITION":
            return js_string(a) + js_string(b) if isinstance(a, str) or isinstance(b, str) else a + b
        if op == "SUBTRACTION": return a - b
        if op == "MULTIPLICATION": return a * b
        if op == "DIVISION":
            if b == 0: raise GameError("Invalid division in game rule.")
            return a / b
        if op in ("EQUALS", "NOT_EQUAL"):
            same_type = type(a) is type(b) or number(a) and number(b)
            equal = same_type and a == b
            return equal if op == "EQUALS" else not equal
        if op == "LESS_THAN": return a < b
        if op == "LESS_THAN_OR_EQUAL": return a <= b
        if op == "GREATER_THAN": return a > b
        if op == "GREATER_THAN_OR_EQUAL": return a >= b
        if op == "AND": return b if truthy(a) else a
        if op == "OR": return a if truthy(a) else b
        if op == "NOT": return not truthy(a)
        if op == "NEGATE": return -a
        raise GameError("Unsupported expression: " + op)

    def run(self, ids, depth=0):
        if depth > 80: raise GameError("Circular game rule.")
        for index in ids:
            action = self.data["actionPool"][index]
            kind = action[0]
            if kind == "r":
                index = self.random_index(action[2])
                if type(index) is not int or not 0 <= index < action[2]:
                    raise GameError("Invalid random result.")
                self.values[action[1]] = index
            elif kind == "s":
                self.values[action[1]] = self.evaluate(action[2])
            elif kind == "c":
                for condition, actions in action[1]:
                    if condition is None or truthy(self.evaluate(condition)):
                        self.run(actions, depth + 1)
                        break
            elif kind == "n":
                if action[1] not in self.data["nodes"]: raise GameError("Missing scene.")
                if action[2] == "OVERLAY": self.overlays.append(self.frame)
                elif action[2] == "NAVIGATE": self.overlays = []
                self.frame = action[1]
            elif kind == "x":
                if self.overlays: self.frame = self.overlays.pop()
            elif kind == "b":
                if self.history: self.frame = self.history.pop()
            else:
                raise GameError("Unsupported action.")

    def flush(self):
        for _ in range(100):
            if not self.data["nodes"][self.frame]["name"].startswith("SYSTEM"): return
            reactions = [r for r in self.data["actions"].get(self.frame, [])
                         if r.get("trigger", {}).get("type") == "AFTER_TIMEOUT"]
            if not reactions: raise GameError("Unfinished automatic transition.")
            for reaction in reactions: self.run(reaction["actions"])
        raise GameError("Automatic transition loop.")

    def value(self, binding, fallback):
        if not binding: return fallback
        if isinstance(binding, list): return self.value(binding[0], fallback)
        return self.values[binding["id"]] if binding.get("type") == "VARIABLE_ALIAS" else fallback

    def visible(self, node_id):
        while node_id is not None:
            node = self.data["nodes"][node_id]
            if self.value(node.get("bind", {}).get("visible"), node.get("visible", True)) is False: return False
            node_id = self.rules.parents.get(node_id)
        return True

    def descendants(self, node_id):
        yield node_id
        for child in self.data["nodes"][node_id].get("children", []):
            yield from self.descendants(child)

    def choices(self):
        return {key for key in self.descendants(self.frame) if self.visible(key)
                and not self.data["nodes"][key]["name"].startswith("FEEDBACK")
                and any(r.get("trigger", {}).get("type") == "ON_CLICK"
                        for r in self.data["actions"].get(key, []))}

    def click(self, node_id):
        # Clients submit only a visible control, never their own statistics or next scene.
        if node_id not in self.choices(): raise GameError("That choice is not available in this scene.")
        before = self.frame
        for reaction in self.data["actions"][node_id]:
            if reaction.get("trigger", {}).get("type") == "ON_CLICK": self.run(reaction["actions"])
        self.flush()
        if before != self.frame: self.history.append(before)
        self.history = self.history[-40:]
        if self.frame == self.data["start"] and before != self.frame: self.player_name = ""

    def snapshot(self):
        return {"version": 1, "source": self.data["source"], "frame": self.frame,
                "values": copy.deepcopy(self.values), "overlays": list(self.overlays),
                "playerName": self.player_name, "savedAt": int(time.time() * 1000)}

    def validate(self, saved):
        if not isinstance(saved, dict) or saved.get("version") != 1 or saved.get("source") != self.data["source"]:
            raise GameError("This save is not compatible.")
        frame = saved.get("frame")
        if not isinstance(frame, str) or frame not in self.rules.frames or self.data["nodes"][frame]["name"].startswith("SYSTEM"):
            raise GameError("Invalid saved scene.")
        values = saved.get("values")
        if not isinstance(values, dict): raise GameError("Incomplete saved values.")
        for name in ("player/isMale", "home/week", "home/knowledge", "home/energy", "home/stress", "home/money"):
            if self.rules.by_name[name] not in values: raise GameError("Incomplete saved values.")
        for key, value in values.items():
            variable = self.data["variables"].get(key)
            if not variable: continue
            kind = variable["type"]
            valid = (kind == "FLOAT" and number(value) or kind == "BOOLEAN" and isinstance(value, bool)
                     or kind == "STRING" and isinstance(value, str) and len(value) <= 10000
                     or kind == "COLOR" and isinstance(value, dict) and all(number(value.get(c)) for c in ("r", "g", "b")))
            if not valid: raise GameError("Invalid saved value.")
        wheel = self.data.get("wheel")
        if wheel and wheel["indexVariable"] in values:
            index = values[wheel["indexVariable"]]
            if not number(index) or int(index) != index or not -1 <= index < len(wheel["prizes"]):
                raise GameError("Invalid saved prize.")
        overlays = saved.get("overlays", [])
        if not isinstance(overlays, list) or len(overlays) > 40 or any(not isinstance(i, str) or i not in self.rules.frames for i in overlays):
            raise GameError("Invalid saved overlay.")
        if not isinstance(saved.get("playerName", ""), str): raise GameError("Invalid player name.")
        if "savedAt" in saved and not number(saved["savedAt"]): raise GameError("Invalid save date.")

    def restore(self, saved):
        self.validate(saved)
        self.values = {key: copy.deepcopy(saved["values"].get(key, v["value"])) for key, v in self.data["variables"].items()}
        self.frame = saved["frame"]
        self.overlays = list(saved.get("overlays", []))
        self.player_name = saved.get("playerName", "")[:24]
        self.history = []
        self.flush()
        wheel = self.data.get("wheel")
        if wheel and wheel["indexVariable"] not in saved["values"]:
            if saved["frame"] in wheel["beforeFrames"]:
                for key in wheel["legacyMoneyVariables"]: self.values[key] -= 12
            else:
                # Old saves have already received the original fixed voucher.
                self.values[wheel["indexVariable"]] = 3
                self.run(wheel["prizes"][3]["displayActions"])
        self.refresh_group_plan()

    def refresh_group_plan(self):
        """Refresh old planner caches without changing progress or selected slots."""
        week = js_string(self.get("home/week"))
        config = self.data.get("groupPlanning", {}).get(week)
        prefix = "w" + week + "/"
        if not config or not any(frame in config["frames"] for frame in [self.frame] + self.overlays):
            return
        if self.get(prefix + "settlementApplied"):
            return
        was_valid = self.get(prefix + "groupPlanValid")
        remaining = self.get(prefix + "groupRemaining")
        self.run(config["refresh"])
        if remaining != self.get(prefix + "groupRemaining") or was_valid != self.get(prefix + "groupPlanValid"):
            if not self.get(prefix + "groupPlanValid"):
                self.run(config["invalid"])
            elif not was_valid:
                self.run(config["normal"])
