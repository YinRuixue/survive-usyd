# Survive USYD — Game Design Document

**Rules reviewed:** 30 October 2026 · activity balance version 2  
**Scope:** the current playable Python/HTML game. This document describes implemented rules, not proposed features. It contains story and ending spoilers.

[Project and launch instructions](../README.md) · [100% score + successful romance walkthrough](WALKTHROUGH.md)

## 1. Concept and player experience

Survive USYD is a single-player, pixel-art university life simulator. A new student arrives for O-Week, makes friends, plans thirteen teaching weeks, completes assessments and attempts to finish the semester. The target audience is university students and players who enjoy resource management and branching dialogue.

The central challenge is allocating limited time. Studying develops Knowledge but consumes Energy and creates Stress. Employment funds living expenses but adds pressure. Rest restores Energy, while Gaming is a much stronger way to reduce Stress. Friendships and optional romance compete for the same weekly activity slots as academic work.

The tone combines familiar student experiences with exaggerated consequences: getting lost on campus, looking for Coles yellow-ticket bargains, managing an unresponsive teammate, and discovering that one more game can become a missed class. An early ending is an intended outcome, and replaying with a different plan is part of the experience.

## 2. Characters

Both protagonist versions use the same story structure, activity values and success conditions. The selected gender changes the protagonist portrait, romantic partner, relevant wording and ending illustrations.

| Character | Portrait | Role and personality |
| --- | --- | --- |
| Player — female | <img src="../html-game/assets/fa6401dacec32260dd03ed9826c76f9715d94749.png" width="80" alt="Female player portrait"> | A new student whose name and decisions are chosen by the player. Tries to balance academic ambition, everyday survival and relationships. Her romantic partner is Noah. |
| Player — male | <img src="../html-game/assets/9f29ecadb06faab7d29539d6778c68569af0c56d.png" width="80" alt="Male player portrait"> | The equivalent male protagonist. His route uses the same mechanics and decisions, with Chloe as his romantic partner. |
| Noah | <img src="../html-game/assets/efee1cfc8d7f14f7849268f7849aa9d3337937cc.png" width="80" alt="Noah portrait"> | Helpful and sociable. Meets the female protagonist while giving directions during O-Week. The balloon conversation reveals that he can admit being frightened and still try something out of curiosity. |
| Chloe | <img src="../html-game/assets/4cb77f653958c1a7f2c4b9a5d3453a5a5b7b689d.png" width="80" alt="Chloe portrait"> | The male protagonist's romantic partner. Fills the same narrative role as Noah, with equivalent invitations, choices, intimacy rules and a separate romance CG. |
| Cassy | <img src="../html-game/assets/bc4a47c8a3d8194584c20b91be861b55650c9e5c.png" width="80" alt="Cassy portrait"> | A dependable tutorial classmate and group member. Helps agree on the work allocation, submits her section, checks the player's results, and privately shares her frustration about Alex. She also offers a friendship outing option. |
| Ethan | <img src="../html-game/assets/be9e756898b2629ad2fc8e96d57811f43fededa2.png" width="80" alt="Ethan portrait"> | The tutor. Introduces group formation, follows up with Alex if asked, and evaluates the Week 13 presentation. His praise is stronger for a completed 100% report. |
| Alex | <img src="../html-game/assets/098f1922f5c3eb456cabc96afd5890e43f9f6603.png" width="80" alt="Alex silhouette"> | An unfamiliar student who joins the group without introducing himself first. His messages sound enthusiastic, but his contribution and communication are unreliable. The silhouette keeps his identity visually uncertain. |

## 3. Semester structure

The usual loop is **dorm home → optional takeaway/status/target → three-slot weekly plan → scheduled event → sleep → weekly summary → next week**. Weeks 1, 5 and 11 include important scenes before planning.

| Stage | Main content and order |
| --- | --- |
| O-Week | Character creation and arrival scenes; random prize wheel; student-card search; meet Noah/Chloe and optionally exchange contact details. |
| Week 1 | Evening timetable, optional dinner, first lecture and semester goals, then the first weekly plan. |
| Week 2 | Plan first; meet Cassy in a tutorial, agree to form a group, visit Coles and optionally buy dinner. Cassy outings become available from the next weekly plan. |
| Week 3 | An ordinary week of planning and routine. |
| Week 4 | Plan first; a dorm message from Cassy reveals that Alex joined the group. She has already emailed him. The player agrees to let him join WhatsApp. |
| Week 5 | Assignment released; the player and Cassy agree on 30% each, post the allocation and ask Alex to check it. Then plan the week. Alex replies positively on the final evening. |
| Week 6 | Plan first; a late-night gaming and oversleeping event creates a series of choices. Return to the dorm, sleep and see the summary. |
| Week 7 | A routine week without a special event. |
| Week 8 | Plan first; Cassy submits her 30% contribution and asks Alex about his progress. He does not reply. |
| Week 9 | Plan first; an eligible player receives a balloon invitation. A separate dorm conversation offers a confession decision for players who exchanged contact details, whether or not they attended the balloon event. |
| Week 10 | Plan, travel to the midterm and take it, return to the dorm, decide whether to ask Alex for an update, then check the midterm result before bed. |
| Week 11 | If Alex was asked in Week 10, choose to wait or contact Ethan before planning. If Ethan is contacted, Alex submits a small section on the final evening. Otherwise he stays silent. |
| Week 12 | Execute the plan before submitting the group report on the last evening. This week's Group Work counts toward submission. |
| Week 13 | Plan, present the project, receive Ethan's feedback and his good-luck message for the final. The summary leads to finals week. |
| Finals | Dorm menu replaces Plan with Go to Exam. Confirm departure, walk across campus, take the exam, see its effects, return to the dorm and select Next day. |
| Results | Check the weighted semester score; Cassy reacts to the result. Alex celebrates in the group, the protagonist reacts silently, and Cassy complains privately. Show the academic ending, then the romance epilogue only if the relationship succeeded. |

## 4. Core statistics and survival rules

These are the initial stored values before the random O-Week prize:

| Statistic | Initial value | Role and limits |
| --- | ---: | --- |
| Knowledge, `K` | 20 | Academic readiness; clamped to 0–100. Determines the midterm and final pass gates. |
| Energy, `E` | 75 | Capacity to keep going; recovery is capped at 100. **Below 0 ends the run.** Exactly 0 is allowed. |
| Stress, `S` | 28 | Pressure; reductions stop at 0. **100 or above ends the run.** |
| Fitness, `F` | 0 | Improves recovery and stress relief; capped at 100. |
| Money, `M` | AU$80 | Pays for living costs, outings and food. **Below AU$0 ends the run.** Exactly AU$0 is allowed. |
| Report progress, `G` | 0% | Capped at 100%; at least 90% is required at submission. |
| Intimacy, `I` | 0 | Derived from completed relationship activities and Week 9 choices. |

The opening Week 1 lecture's +3 Stress is already included in the initial Stress 28 baseline. After the introductory dinner and lecture sequence, the first plan begins with Stress `28 − 5 × recovery multiplier` if dinner was accepted, or 28 otherwise. The introductory scenes recompute their own first-week snapshot; they should not be added again as a second weekly charge.

Survival checks happen when relevant gameplay effects settle. A resource failure stops further story progression and takes priority over a special three-identical-activities ending. When several resource limits fail at the same check, the implemented priority is **Energy → Stress → Money**. A final exam can therefore end the run through exhaustion or Stress even when Knowledge is sufficient.

Visible fractional values use at most one decimal place. Display formatting does not replace the underlying values used for rule checks. This matters near a threshold: players should leave a margin rather than relying on a rounded display.

## 5. Weekly planning and recovery

Each teaching week has exactly three activity slots. The player can replace selected slots before confirming. The planner accumulates the three activities' changes into a weekly settlement, applies its limits and checks, and charges living costs once. It does not simulate three separately playable days. Repeating a confirmation does not award the same effects again.

### Activity values

The table shows **base** effects. Multiply positive Energy and negative Stress effects by the applicable Fitness recovery multiplier. Energy costs and Stress increases are not multiplied.

| Activity | Knowledge | Energy | Stress | Fitness | Money | Other result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Study | +8 | −14 | +12 | — | — | Builds academic readiness. |
| Rest | — | +28 | −3 | — | — | Main Energy recovery option. |
| Gaming | — | −2 | −24 | — | — | Main low-cost Stress relief option. |
| Work | — | −16 | +12 | — | +45 | Funds later weeks. |
| Exercise | — | −8 | −10 | +10 | — | Invests in future recovery. |
| Hang out with Noah/Chloe | — | +12 | −10 | — | −15 | Adds one completed partner outing and +1 Intimacy. Requires exchanged contacts and an open relationship route. |
| Hang out with Cassy | — | +12 | −10 | — | −15 | Same resource effects as a partner outing, without romantic Intimacy. Available after meeting Cassy. |
| Group Work | — | −16 | +14 | — | — | Adds up to 10 percentage points to the report. Available from the Week 5 release through Week 12 submission. |

**Weekly living cost:** AU$12, once per teaching-week plan. It changes Money only. Finals has no additional three-slot weekly plan or extra weekly living charge.

### Fitness multiplier

```text
recovery multiplier = 1 + F / 200
Energy recovered = base recovery × multiplier
Stress relieved = base relief × multiplier
```

For planning, the current week's starting Fitness is used. Exercise selected in that plan does not retrospectively improve the other activities in the same plan. Its benefit is available for subsequent planning. Story events use their authored Fitness snapshot; the Week 6 and Week 9 events use starting Fitness. Takeaway uses the applicable dorm/week Fitness value.

For example, at Fitness 10 the multiplier is 1.05: Rest restores 29.4 Energy and relieves 3.15 Stress (displayed as 3.2); Gaming relieves 25.2 Stress and still costs only 2 Energy. At Fitness 100 the multiplier is 1.5.

### Takeaway

Food uses Money without consuming an activity slot. There is one order per teaching week; it is separate from the fixed story dinner choices. The finals dorm also exposes a takeaway menu.

| Item | Price | Base Energy recovery | Base Stress relief |
| --- | ---: | ---: | ---: |
| Snack | AU$6 | +5 | −3 |
| Hot meal | AU$12 | +10 | −6 |

Food effects use the applicable recovery multiplier and respect Energy/Stress limits. The second click on an already completed purchase does not charge or reward again. Food bought after an exam cannot change the marks already captured for that exam.

## 6. O-Week prize wheel

Python uses `secrets.randbelow(10)` to select one of ten prizes with equal probability. Each prize has a 10% chance. The standalone browser version has its own random draw. The wheel animation presents the selected result; it does not determine or repeatedly redraw it.

| Prize | Reward |
| --- | --- |
| Campus Shopping Voucher | Money +AU$10 |
| Free Snack Pack | Energy +8 |
| New Student Study Kit | Knowledge +3 |
| Coffee & Dining Voucher | Money +AU$12 |
| Energy Supply Pack | Energy +10 |
| Study Tips Handbook | Knowledge +4 |
| Lucky Grand Prize Voucher | Money +AU$15 |
| Deluxe Snack Pack | Energy +12 |
| Academic Resource Pack | Knowledge +5 |
| Free Fitness Challenge | Fitness +1 |

The result is saved when the spin is accepted. Reloading, retrying or loading a post-spin save does not grant a second reward. Starting a new run allows a new draw, which can legitimately repeat an earlier prize.

## 7. Event effects

These effects are in addition to weekly activities. A multiplier symbol `r` means the relevant Fitness recovery multiplier. Knowledge gains, costs and Stress increases remain fixed.

| Event/choice | Effect |
| --- | --- |
| Week 1 dinner with partner | AU$15 cost and +1 Intimacy; the completed introductory sequence has 5r less Stress than declining dinner. No weekly activity slot is used. |
| Week 2 walk with Cassy | Energy −5; Stress −5r. |
| Week 2 optional Coles dinner | Money −12; Energy +10r; Stress −6r. |
| Week 6: play for a bit | Stress −8r; no Energy cost at this first choice. |
| Week 6: continue for one more game | Energy −20; no further Stress relief. |
| Week 6: first extra sleep | Energy +12r; Stress −4r. |
| Week 6: sleep again after feeling rested | No additional Energy recovery; advances toward the late-for-class decision. |
| Week 6: arrive on time | Knowledge +8. |
| Week 6: rush to class after oversleeping | Energy −8 and Stress +8, followed by Knowledge +6. |
| Week 6: skip class and keep sleeping | Energy +5r; Stress −5r; Knowledge −6. |
| Week 8: Cassy's file | Cassy's contribution becomes 30%; the report gains up to the remaining space before 100%. |
| Week 9: balloon ride | +1 Intimacy; no ticket payment by the protagonist. |
| Week 9: supportive balloon reply | +1 additional Intimacy. The other two replies add none. |
| Week 9: successful confession | Stress −10r. |
| Week 9: rejected confession | Stress +30; the later sleepless night costs Energy −15. The romantic outing option closes. |
| Week 10 midterm | Energy −12; Stress +15, applied before the mark snapshot. |
| Week 11: Alex's file after tutor contact | Alex's contribution becomes 10%; the report gains only the space still available before 100%. |
| Final exam | Energy −15; Stress +10, applied before the mark snapshot. |

In Week 6, declining the game or logging off at the first bedtime decision leads to the on-time class route. The oversleeping decisions occur after choosing to keep playing. The later dorm sleep/Next day scene is a narrative transition, not an automatic extra Energy reward.

Story events that change resources show a separate dialogue page with green, bold change text. They do not combine the numerical notification with the preceding narrative. Once a run has ended, ending scenes do not display meaningless additional stat changes.

## 8. Group assignment

The initial agreement is 30% per member: 90% is sufficient to pass. The final 10% is a bonus for more complete work; it is not discussed during the initial allocation conversation.

Let `P`, `C` and `A` be the player's, Cassy's and Alex's contributions:

```text
G = min(100, P + C + A)
Group Work gain = min(10, 100 − G)
```

There is no longer a personal 40% cap or a Week 11 restriction on covering missing work. From the Week 5 release, the player may continue until the actual report reaches 100%, provided it has not been submitted. A final partial slot is allowed and has the normal activity cost. A slot that would begin after completion is rejected before the plan is charged.

Cassy contributes 30% in Week 8. Alex contributes 10% in Week 11 only when the player **asked Alex in Week 10 and contacted Ethan in Week 11**. Waiting or not asking produces no Alex contribution. Later teammate submissions cannot push the displayed report above 100%; their notification shows the actual added progress.

Submission happens after the Week 12 plan:

- Below 90%: **The Missing Pieces**, an immediate failed-project ending.
- 90–99%: pass, with the submitted percentage used as the project mark.
- 100%: full project marks and stronger presentation praise in Week 13. The bonus flag also checks that the player supplied at least 40%; in the reachable 100% routes, covering the missing work satisfies this.

A reliable full-mark allocation is **player 60% + Cassy 30% + Alex 10%**. Without Alex's file the player needs 70% for full marks, or 60% for a 90% pass.

## 9. Exams and semester scoring

### Pass gates and capture timing

| Assessment | Pass gate | Weight |
| --- | --- | ---: |
| Week 10 midterm | Knowledge ≥55 | 25% |
| Week 12 group report | Submitted progress ≥90% | 25% |
| Final exam | Knowledge ≥85 | 50% |

An exam's pass gate uses Knowledge only. Energy and Stress affect its numerical mark, while the separate survival limits still apply. A numeric mark alone does not override a failed Knowledge gate.

The engine captures Knowledge, Energy and Stress **after applying the exam's own effects**. Later meals or rest cannot improve that recorded mark. Target shows the weights, reveals the midterm mark after it is checked, and updates the project mark after submission.

Define:

```text
penalty(E, S) = max(0, 60 − E) / 5 + max(0, S − 30) / 5
clamp(x, low, high) = min(high, max(low, x))
```

### Midterm mark

```text
base = clamp((100 / 65) × K, 0, 100)
raw = max(0, base − penalty(E, S))
if K ≥ 55: raw = max(50, raw)
midterm mark = ceil(raw)
```

The midterm mark is rounded upward to a whole number. Knowledge 65 gives the maximum base mark, but Energy and Stress can still reduce the final mark. A sufficient no-penalty target is **K ≥65, E ≥60, S ≤30 at capture**. Before sitting the midterm, that means **Energy ≥72 and Stress ≤15** because the exam costs 12 Energy and adds 15 Stress.

### Final exam mark

```text
base = clamp(50 + ((K − 85) / 15) × 50, 0, 100)
raw = max(0, base − penalty(E, S))
if K ≥ 85: raw = max(50, raw)
final mark = floor(raw × 10 + epsilon) / 10
```

Here `epsilon = 0.00001` corrects floating-point noise. The current rule truncates the mark to one decimal place. The base is 50 at Knowledge 85 and reaches 100 at Knowledge 100.

A sufficient full-mark target before departure is **Knowledge 100, Energy ≥75 and Stress ≤20**. After the exam's −15 Energy and +10 Stress, that leaves no mark penalty.

### Weighted semester result

```text
project mark = submitted report percentage
weighted result = 0.25 × midterm mark
                + 0.25 × project mark
                + 0.50 × final mark
semester result = floor(weighted result × 10 + epsilon) / 10
```

Only the midterm is rounded upward to an integer. The final exam and weighted result retain the current one-decimal truncation rule. These are fictional game rules, not a statement of university grading policy.

All component marks are capped at 100, so the 100-point academic ending requires **100 in all three components**. A 90% report with both exams at 100 produces `25 + 22.5 + 50 = 97.5`, which is HD but not a perfect score.

## 10. Romance

Exchanging contacts during O-Week opens the partner route. Cassy remains a friendship option and does not contribute to romantic Intimacy.

```text
Intimacy = accepted Week 1 dinner (0 or 1)
         + completed partner outing slots
         + completed balloon ride (0 or 1)
         + supportive balloon response (0 or 1)
```

Balloon eligibility is based on exchanged contacts and **at least three partner outing slots completed by the end of Week 8**. The Week 1 story dinner does not count as one of those outings, and an outing first scheduled in Week 9 is too late for the invitation check.

The supportive reply is **“LOOK AHEAD. THE SUN'S COMING UP.”** It responds to the partner's nerves without making the earlier relationship automatically romantic.

At the end-of-Week-9 dorm conversation:

- Confess with Intimacy ≥6: successful relationship.
- Confess below 6: rejection, Stress +30, a later Energy −15 sleepless night, and closed romantic outings.
- Do not confess: no romantic ending; the academic route continues.
- No exchanged contacts: the partner-message/confession route is unavailable.

The balloon is optional for confession. A player who exchanged contacts can still reach the dorm decision without taking the ride; enough earlier outings can supply the required Intimacy instead.

The documented walkthrough reaches exactly **1 dinner + 3 outings + 1 balloon + 1 supportive reply = 6**. Noah and Chloe use the same calculation.

## 11. Endings and navigation

| Type | Condition | Ending |
| --- | --- | --- |
| Resource | Energy <0 | Running on Empty |
| Resource | Stress ≥100 | Too Much at Once |
| Resource | Money <0 | Out of Funds |
| Academic failure | Midterm Knowledge gate fails | Midterm Not Passed |
| Academic failure | Report below 90% at submission | The Missing Pieces |
| Academic failure | Final Knowledge gate fails | Final Exam Not Passed |
| Weekly special | Three Gaming slots in one plan | One More Match |
| Weekly special | Three Work slots in one plan | The Part-Time Emperor |
| Weekly special | Three Exercise slots in one plan | Bachelor of Gains |
| Weekly special | Three Study slots in one plan | The Library Ghost |
| Weekly special | Three Rest slots in one plan | Five More Minutes |
| Semester completed | Result ≤85, after passing all gates | You Survived USYD! |
| Semester completed | 85 < result <100 | High Distinction! |
| Semester completed | Result =100 | Academic Legend |
| Optional epilogue | Successful relationship and semester completed | A Day Together |

The five special endings are based on three identical choices **within one weekly plan**, not six activities across two weeks. Group Work and social outings are not in this five-activity rule. The Part-Time Emperor is an ironic alternative career outcome, but still ends the attempt to survive the semester academically.

Bad endings have short lead-in scenes before the ending card. Academic endings also follow the results and group-chat sequence. An academic ending shows **Continue** when a successful romance epilogue remains; otherwise it shows **Start new game**. The romance ending also finishes with **Start new game**, returning to the initial title/character-creation flow.

## 12. Interface and Python implementation

The dorm is the main navigation hub. Plan selects activities; Status shows current resources; Target explains assessment weights and progress; Takeaway offers food; Save and Load open closable nine-slot menus. The title screen's Continue game opens Load. Pixel-art backgrounds, character portraits, dialogue panels, a spinning prize wheel and local audio support the presentation.

The Python entry point is [`backend/server.py`](../backend/server.py). It runs a local HTTP server and serves the interface. The [`Game`/`Rules` classes](../backend/game_backend/engine.py) load declarative scenes and actions from [`game.json`](../html-game/data/game.json), evaluate conditions and apply transitions. The browser renders the resulting state. The optional file-based HTML mode uses a parallel JavaScript interpreter over the same authored data.

The [`Store` class](../backend/game_backend/store.py) saves sessions, automatic progress and nine manual slots in SQLite transactions. Input validation, request identifiers and revision checks protect against invalid choices, repeated charges and conflicting tabs. Imported saves are validated and only fill empty manual slots. A new game resets the run while preserving manual saves.

The project demonstrates functions, classes, file I/O, exception handling, dictionaries/lists, recursive traversal of scene/rule structures, and database persistence. The Python runtime uses the standard library. No internet connection is required for gameplay once the repository is downloaded.

## 13. Verification and maintenance

The existing Python suite covers persistence, request handling, random rewards, complete routes and boundary conditions. For these documents, the walkthrough was additionally replayed through the Python engine for **both genders × all 10 wheel prizes = 20 complete runs**. Every run reached midterm 100, project 100, final 100, a 100-point semester result and the successful romance epilogue without a survival failure.

When activity values, event effects or scoring change, update this document and rerun the walkthrough. The bundled executable rules remain the source of truth; do not rebalance the game by editing this document alone.
