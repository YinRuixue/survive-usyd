"""Add the short, gender-aware arrival sequence using existing scene artwork."""
import copy
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = json.loads((root / "data/game.json").read_text())
nodes = data["nodes"]
prefix = "html:w0-intro-"
assert not any(key.startswith(prefix) for key in nodes), "Intro already installed"


def clone_scene(source, key, title):
    mapping = {}

    def clone(node_id):
        new_id = prefix + key if node_id == source else prefix + key + "-" + node_id.replace(":", "-")
        mapping[node_id] = new_id
        node = copy.deepcopy(nodes[node_id])
        node["id"] = new_id
        if "children" in node:
            node["children"] = [clone(child) for child in node["children"]]
        nodes[new_id] = node
        return new_id

    frame_id = clone(source)
    nodes[frame_id]["name"] = title
    data["frames"].append({"id": frame_id, "name": title, "w": 1280, "h": 720, "helper": False})
    return mapping


def connect(button, destination):
    index = len(data["actionPool"])
    data["actionPool"].append(["n", destination, "NAVIGATE"])
    data["actions"][button] = [{"trigger": {"type": "ON_CLICK"}, "actions": [index]}]


def day_dorm(node):
    node["name"] = "BACKGROUND / day dorm"
    node["fills"] = copy.deepcopy(nodes["166:825"]["fills"])


# Keep the original entry ID so starting a game and existing saves stay compatible.
nodes["65:14"]["name"] = "W0 / 01 · A New Start"
next(frame for frame in data["frames"] if frame["id"] == "65:14")["name"] = nodes["65:14"]["name"]
day_dorm(nodes["65:15"])
nodes["65:85"]["text"] = "DORM · O-WEEK MORNING"
nodes["65:97"]["text"] = (
    "You've arrived in Sydney and moved into your dorm.\n"
    "With classes still a week away, today is for getting to know USYD."
)

leaving = clone_scene("77:26", "leaving", "W0 / 01A · Heading Out / ME")
day_dorm(nodes[leaving["77:27"]])
nodes[leaving["77:97"]]["text"] = "DORM · O-WEEK MORNING"
nodes[leaving["77:112"]]["text"] = (
    "Student card, campus tour... I'd better go and have a look.\n"
    "Apparently there's free food at O-Week, too. That's a good start."
)

campus = clone_scene("92:161", "campus", "W0 / 01B · O-Week Stalls")
nodes[campus["92:176"]]["text"] = "USYD · O-WEEK"
nodes[campus["92:188"]]["text"] = (
    "The Quad is buzzing with new students and club stalls.\n"
    "You follow the smell of a sausage sizzle, then notice a colourful spinning wheel."
)
nodes[campus["92:188"]]["w"] = 1100

wheel = clone_scene("77:26", "wheel", "W0 / 01C · Just One Spin / ME")
nodes[wheel["77:97"]]["text"] = "O-WEEK · FREE GAMES"
nodes[wheel["77:112"]]["text"] = (
    "One free spin, and everyone wins something?\n"
    "All right. One spin, then I'll find the student card office."
)

# Only the protagonist speaks here; retain both gender-bound portraits.
for mapping in (leaving, wheel):
    unused = mapping["77:118"]
    nodes[mapping["77:26"]]["children"].remove(unused)
    del nodes[unused]

connect("65:102", leaving["77:26"])
connect(leaving["77:117"], campus["92:161"])
connect(campus["92:193"], wheel["77:26"])
connect(wheel["77:117"], "65:103")

encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
(root / "data/game.json").write_text(encoded + "\n")
(root / "game-data.js").write_text("window.SURVIVE_DATA=" + encoded + ";\n")
print("Updated arrival and connected three short scenes to the existing lucky wheel.")
