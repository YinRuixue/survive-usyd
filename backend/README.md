# Python Program — Game Rules and Saves

[Back to the project overview](../README.md) · [Game design and formulas](../design-and-walkthrough/GAME_DESIGN.md)

This folder contains the **main Python program**. “Backend” means the part that processes player actions, applies game rules and stores progress. The browser interface lives in `html-game/` and displays the state returned by Python.

## Run the project

From the project root:

```sh
python3 backend/server.py --open-browser
```

On Windows, use `py` instead of `python3`. On macOS, the root-level `Start Game.command` is a double-click alternative.

Requirements: **Python 3.9 or newer**, a modern browser, and no third-party Python packages. Keep the terminal open while playing; press **Ctrl+C** to stop. The address is `http://127.0.0.1:8765`. Add `--port 8766` if the default port is occupied.

## Suggested code-reading order

| File | Responsibility | Concepts to look for |
| --- | --- | --- |
| [server.py](server.py) | Starts the local HTTP server, serves the interface, validates requests and dispatches actions. | Functions, request handling, input validation and exception handling. |
| [game_backend/engine.py](game_backend/engine.py) | Loads and executes authored scenes and rules, including weekly plans, random rewards, assessment scores and endings. | Classes, dictionaries/lists, conditionals, recursive rule evaluation and file-based data. |
| [game_backend/store.py](game_backend/store.py) | Saves sessions and nine manual slots, imports backups and applies mutations transactionally. | SQLite persistence, serialization, validation and transaction/error handling. |
| [tests/](tests/) | Exercises rules, complete routes, boundaries, persistence and the HTTP interface. | Automated checks using `unittest` and temporary databases. |

The engine reads [html-game/data/game.json](../html-game/data/game.json). This is declarative scene and rule data. Python evaluates it and returns the current playable state; the browser renders that state and submits an available action.

## Behaviour covered by Python

- Story transitions, weekly activities, Fitness recovery, romance decisions, group work, exam marks and ending conditions.
- An independent random wheel draw using ten equally likely rewards, stored before the animation completes. Retries do not grant the reward twice.
- Automatic progress and nine independent manual save slots, including character details, story position, statistics, plans, choices and overlay return state.
- New-game resets that retain manual save slots.
- Request identifiers to prevent duplicate charges or rewards, and revision checks to prevent conflicting updates from multiple tabs.
- Validation that an action is available on the current screen; the client cannot simply supply arbitrary statistics or jump to an arbitrary scene.

## Save files and backup

The default database is `backend/data/survive.sqlite3`, created on first use and excluded from GitHub. Each browser profile is associated with its own session through a persistent cookie. Use the same browser and address to continue.

Use **Export saves** before clearing browser data or changing browsers. **Import saves** validates the backup and fills empty manual slots without overwriting occupied ones. To migrate from the optional standalone HTML version, export from its original browser page, start the Python version and import there.

The server listens on `127.0.0.1` for local play. It does not provide internet accounts or cloud saves. Stop the server before moving the project or copying the complete `backend/data/` folder as a database backup.

## API reference

The browser and API share the same origin. Session cookies use `HttpOnly` and `SameSite=Strict`. Mutation requests use JSON with a `revision` and unique `requestId`; successful responses include the updated state and revision. Repeated requests return the stored result; conflicting revisions return HTTP 409.

| Method and path | Purpose | Additional fields |
| --- | --- | --- |
| GET `/api/health` | Check that the server is running. | None |
| GET `/api/session` | Read current progress and save metadata. | None |
| GET `/api/saves` | Read the nine slots and automatic save. | None |
| POST `/api/action` | Execute a currently available control. | `action`; character creation can include `playerName` |
| POST `/api/new-game` | Reset the current run. | None |
| POST `/api/save` | Save into a manual slot. | `slot`: 0–8 |
| POST `/api/load` | Restore a manual or automatic save. | `slot`: 0–8, or `null` for automatic progress |
| POST `/api/import` | Import a validated backup into empty slots. | `backup` |

## Tests

From the project root:

```sh
python3 -m unittest discover -s backend/tests -v
```

Tests use temporary databases and do not modify existing player saves. They cover:

- Complete story routes for both protagonists, successful and unsuccessful romance, and all ten wheel rewards.
- Agreement between the Python rule interpreter and the recorded browser-engine fixtures.
- Activity values, plan boundaries, repeated-activity endings, resource failure priority, scoring and takeaway limits.
- Group Work availability from Week 5 through submission, the 100% total cap and rejection of unusable extra slots.
- Nine-slot persistence, restart recovery, session separation, validated imports, duplicate requests and revision conflicts.
- HTTP request validation and limits on exposed files.

Compressed reference fixtures live in [tests/fixtures/](tests/fixtures/). If authored rules change, update both `html-game/data/game.json` and `html-game/game-data.js`, then regenerate the corresponding reference fixtures and rerun the tests.
