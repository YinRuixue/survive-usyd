# Browser Interface and Game Assets

[Back to the project overview](../README.md) · [Python program guide](../backend/README.md)

This folder contains the game's **visual interface**: scenes, dialogue, menus, animation, music and artwork. For the complete Python project, start the game from the repository root:

```sh
python3 backend/server.py --open-browser
```

Use `py` on Windows. Python runs the game rules and saves; the browser displays the result and sends player actions to it.

## File guide

| File or folder | Purpose |
| --- | --- |
| [index.html](index.html) | Browser entry page. |
| [app.js](app.js) | Scene rendering, controls and player interaction. |
| [style.css](style.css) | Layout, pixel-art presentation and visual styling. |
| [backend-client.js](backend-client.js) | Sends actions to Python and receives game/save state. |
| [save-menu.js](save-menu.js) | Save/load menus, slot selection and backup controls. |
| [display-format.js](display-format.js) | Shared display formatting for numerical values. |
| [audio.js](audio.js) | Background music, click sounds and audio preferences. |
| [data/game.json](data/game.json) | Authored scene and rule data read by the Python program. |
| [game-data.js](game-data.js) | Browser-loadable version of the authored data. |
| [engine.js](engine.js) and [save-store.js](save-store.js) | Rule execution and local storage for the optional standalone browser mode. |
| [assets/](assets/) | In-game backgrounds, portraits, ending illustrations, fonts and audio. |
| [tools/](tools/) | Optional development utilities and browser-engine tests. Not required to play. |
| [使用说明.txt](使用说明.txt) | Detailed Chinese player instructions. |

## Optional standalone mode

Opening `index.html` directly uses the JavaScript interpreter and browser-local saves. This is separate from the Python version and its database. For assessment of the Python project, use the Python launch command above.

A static web host or GitHub Pages cannot run the Python server. Keep this folder's assets and scripts together when downloading the project.

## Artwork and presentation images

`assets/` contains files used **inside the game**. The root-level [screenshots/](../screenshots/) folder contains screenshots used to **present the project**, including the README preview. Written design and strategy documents are in [design-and-walkthrough/](../design-and-walkthrough/).

Audio provenance is described in [assets/audio/README.txt](assets/audio/README.txt). Bundled font licences are in [assets/licenses/](assets/licenses/).
