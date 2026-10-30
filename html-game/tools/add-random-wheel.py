"""Add a shared, equally weighted O-Week prize draw to the exported rules."""
import json
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / "data/game.json").read_text())
if "wheel" in data:
    raise SystemExit("Random wheel rules already installed.")
variables, nodes, pool = data["variables"], data["nodes"], data["actionPool"]
names = {v["name"]: key for key, v in variables.items()}


def variable(name, value):
    key = "html:" + name
    variables[key] = {"name": name, "type": "STRING" if isinstance(value, str) else "FLOAT", "value": value}
    names[name] = key
    return key


def action(value):
    pool.append(value)
    return len(pool) - 1


def set_value(name, value):
    return action(["s", names[name], ["l", value]])


def bind(node_id, name):
    nodes[node_id].setdefault("bind", {})["characters"] = {"type": "VARIABLE_ALIAS", "id": names[name]}


index = variable("wheel/prizeIndex", -1)
for name in ("title", "delta", "flavor", "narration", "summary", "balance", "balanceNote"):
    variable("wheel/" + name, "")

prizes = [
    ("Campus Shopping Voucher", "CAMPUS SHOPPING\nVOUCHER", "money", 10, "65:158", "You pocket the campus shopping voucher."),
    ("Free Snack Pack", "FREE SNACK\nPACK", "energy", 8, "65:161", "You open the snack pack and have a quick bite before moving on."),
    ("New Student Study Kit", "NEW STUDENT\nSTUDY KIT", "knowledge", 3, "65:164", "You look through the study kit. There are some useful tips for your first classes."),
    ("Coffee & Dining Voucher", "COFFEE & DINING\nVOUCHER", "money", 12, "65:167", "You pocket the coffee and dining voucher."),
    ("Energy Supply Pack", "ENERGY SUPPLY\nPACK", "energy", 10, "74:26", "You take a short break with the food and drink in your energy pack."),
    ("Study Tips Handbook", "STUDY TIPS\nHANDBOOK", "knowledge", 4, "74:29", "You skim the handbook and pick up a few useful study tips."),
    ("Lucky Grand Prize Voucher", "LUCKY GRAND\nPRIZE VOUCHER", "money", 15, "74:32", "The grand prize voucher is yours. You tuck it safely into your bag."),
    ("Deluxe Snack Pack", "DELUXE SNACK\nPACK", "energy", 12, "74:35", "You enjoy a few snacks from the deluxe pack and save the rest for later."),
    ("Academic Resource Pack", "ACADEMIC\nRESOURCE PACK", "knowledge", 5, "74:38", "You browse the resource pack and learn a few things before classes have even started."),
    ("Free Fitness Challenge", "FREE FITNESS\nCHALLENGE", "fitness", 1, "74:41", "You try the short fitness challenge at the stall before heading off."),
]
wheel = {"frame": "65:103", "control": "65:174", "indexVariable": index,
         "beforeFrames": [data["start"], "65:14", "html:w0-intro-leaving", "html:w0-intro-campus", "html:w0-intro-wheel", "65:103"],
         "legacyMoneyVariables": [names["home/money"], names["weekStartMoney"]], "prizes": []}

# The prototype had already included the fixed voucher in its opening balance.
for key in wheel["legacyMoneyVariables"]:
    variables[key]["value"] = 80
    for rule in pool:
        if rule[:2] == ["s", key] and rule[2] == ["l", 92]:
            rule[2] = ["l", 80]

branches = []
for i, (name, title, stat, amount, card, narration) in enumerate(prizes):
    delta = "Money +AU$" + str(amount) if stat == "money" else stat.capitalize() + " +" + str(amount)
    balance = 80 + (amount if stat == "money" else 0)
    display = [set_value("wheel/" + k, v) for k, v in {
        "title": title, "delta": delta, "flavor": "O-Week prize collected!", "narration": narration,
        "summary": name + "\n" + delta, "balance": "MONEY   AU$" + str(balance),
        "balanceNote": "AU$80 starting money" + (" + AU$" + str(amount) + " voucher" if stat == "money" else " · Non-cash prize collected"),
    }.items()]
    key = names["home/" + stat]
    effects = [action(["s", key, ["e", "ADDITION", [["v", key], ["l", amount]]]])]
    carry = "fitness" if stat == "fitness" else "weekStart" + stat.capitalize()
    effects.append(action(["s", names[carry], ["v", key]]))
    branches.append([["e", "EQUALS", [["v", index], ["l", i]]], effects + display])
    wheel["prizes"].append({"name": name, "title": title, "stat": stat, "amount": amount,
                            "delta": delta, "card": card, "displayActions": display})

draw = action(["r", index, len(prizes)])
apply = action(["c", branches])
once = action(["c", [[["e", "EQUALS", [["v", index], ["l", -1]]], [draw, apply]]]])
data["actions"][wheel["control"]][0]["actions"].insert(0, once)
data["wheel"] = wheel

# New-game resets are authored as automatic scenes; clear the prize there too.
reset = [set_value(v["name"], v["value"]) for v in list(variables.values()) if v["name"].startswith("wheel/")]
data["actions"]["519:8412"][0]["actions"][0:0] = reset

for node_id, name in {
    "65:204": "title", "65:206": "delta", "74:45": "flavor",
    "I375:11141;118:117": "narration", "I372:10635;372:6398": "delta",
    "167:745": "summary", "167:766": "balance", "167:767": "balanceNote",
}.items():
    bind(node_id, "wheel/" + name)
for node_id, stat in [("167:751", "knowledge"), ("167:755", "energy"), ("167:759", "stress"), ("167:763", "fitness")]:
    bind(node_id, "weekStartStress" if stat == "stress" else "home/" + stat)
nodes["167:743"]["h"] += 21
nodes["167:745"]["h"] += 21
nodes["167:746"]["y"] += 21

# Match the legend to the actual clockwise wedge colours in the existing art.
svg = ET.parse(ROOT / "assets/imgGameTenSegmentPrizeWheel.svg")
for i, prize in enumerate(wheel["prizes"]):
    colour = next(p.attrib["fill"] for p in svg.iter() if p.attrib.get("id") == "Vector_" + str(i + 3))
    prefix, number = prize["card"].split(":")
    accent = nodes[prefix + ":" + str(int(number) + 1)]
    accent["fills"][0]["color"] = {c: int(colour[1 + j * 2:3 + j * 2], 16) / 255 for j, c in enumerate("rgb")}

encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
(ROOT / "data/game.json").write_text(encoded)
(ROOT / "game-data.js").write_text("window.SURVIVE_DATA=" + encoded + ";\n")
print("Installed 10 equally weighted prizes and dynamic reward / O-Week summary text.")
