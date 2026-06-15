# Orchestrator Grove Prototype v7

A self-contained 2D browser game prototype built with plain HTML, CSS, and JavaScript Canvas. It is inspired by automation loops where bots repeat jobs, but the key twist is that the player **cannot directly program bots**. Instead, an assistant chat panel turns player requests into validated function-call-style program assignments.

v7 adds testable Autonauts-like production requirements on top of the object-registry/zone build: loose sticks, mined stones, tree seeds, crude axes/pickaxes, pole processing, a crude tool bench, and a Basic Bot recipe.

## Run locally

From this folder:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

If port 8000 is already in use, choose another port, for example `python3 -m http.server 8017` and open `http://localhost:8017`.

No build step, npm install, bundler, or framework is required.

## Controls

- Move: `WASD` or arrow keys
- Interact: `E`
  - Near trees: chop manually only if a crude axe is nearby; drops logs, plus sticks/seeds when the tree falls
  - Near stone deposits: mine manually only if a crude pickaxe is nearby; drops loose stone
  - Near sawbench: manually process 1 log into 2 planks if logs are stored
  - Near sawbench with planks: manually process 1 plank into 2 poles
  - Near crude tool bench: insert nearby sticks/stones, then craft crude axes
  - Carrying a crude shovel on clear dirt: dig a new hole
  - Near bot factory: manually build a bot if the Basic Bot recipe is stored and the bot cap allows it
- Build drawer: `B` or the left-edge **Build** tab
- Bot drawer: right-edge **Bots** tab
- `Enter`: open/focus chat when it is closed
- `L`: toggle chat visibility
- `Esc`: close any currently open UI first; only open the settings/escape menu when no other gameplay UI is open
- Settings menu tabs:
  - `Controls`: movement/combat/build/chat reference
  - `Performance`: target FPS, bot cap, renderer status, GPU heuristic, and hardware-based recommendations
- Left-click interactables:
  - Bots: open the bot menu
  - Buildings: open the building menu
  - Trees: open the tree menu
  - Holes: open the hole menu
- Right-click interactables:
  - Buildings: open the building menu, or queue the relevant structure action if applicable
  - Trees: open the tree menu with actions such as **Chop tree** and **Search tree**
  - Holes: if the player is holding a `tree_seed`, queue movement to that exact hole and plant it there; otherwise open the hole menu
- Item Palette: place from Build -> Storage; first inserted item locks the palette to that item type
- Assistant chat: type natural requests like:
  - `Bot 2 mine stone`
  - `Bot 1 pick up logs from rect(x:100,y:200,w:140,h:90)`
  - `Bot 1 chop wood`
  - `Bot 2 dig holes in zone 1`
  - `Bot 2 plant trees in zone 1`
  - `Bot 2 haul logs to sawbench 2`
  - `Bot 3 make planks at sawbench 2`
  - `Bot 3 make poles at sawbench 2`
  - `Bot 4 craft axes at tool bench 1`
  - `Bot 4 haul planks from sawbench 2 to factory 1`
  - `Bot 1 chop trees in zone 1`
  - `Bot 1 chop trees in a small area around sawbench 2`
  - `Assign an idle bot to haul planks`
  - `Assign an idle bot to build bots`
  - `All bots idle`

## v5 object registry, slots, and zones

- Every bot, structure, loose item, and zone has a stable ref exposed through `window.getWorldObjects()` and `window.getGameState().objectRegistry`.
- Templates now declare parameter slots, e.g. `targetSawbench`, `sourceSawbench`, `targetFactory`, and `zone`.
- Commands can target structures: `Bot 2 make planks at sawbench 2` assigns the sawbench slot instead of choosing the nearest sawbench.
- Commands can use drawn rectangle coordinates: open/focus chat, left-drag a rectangle on the map, and the command gets `rect(x:...,y:...,w:...,h:...)` inserted at the cursor.
- Commands can still use saved drawn zones by name/ref: click **Draw zone**, drag a rectangle on the map, then reference `zone 1` in chat.
- Commands can use radius zones: `Bot 3 chop trees in a small area around sawbench 2` creates a runtime radius search area.
- Search steps such as tree finding and loose item pickup now respect the assigned zone.
- Ollama validation preserves `targetStructureId`, `sourceStructureId`, `targetFactoryId`, `zoneId`, and radius `zone` specs.

## v7 base resources, tools, and bot recipe

- Loose base resources now exist in the world/object registry: `stick`, `stone`, `tree_seed`, plus `log`, `plank`, `pole`, `crude_axe`, `crude_pickaxe`, and `crude_shovel`.
- Dug holes are terrain objects in the registry; bots can `dig_holes`, and the player can plant a `tree_seed` by right-clicking a specific open hole while holding it.
- `mine_stone` bots must equip a loose `crude_pickaxe` and mine stone deposits before loose `stone` exists for crafting.
- `pickup_item` bots can pick a specific item type from an `item_palette` storage source or from loose ground items inside inserted `rect(x,y,w,h)` coordinates.
- `chop_wood` bots must equip a loose `crude_axe` from anywhere on the map; stones are not valid bot chopping tools, and each axe lasts 100 chops.
- `craft_axes` supplies a crude tool bench with `1 stick + 1 stone`, then outputs a loose `crude_axe`.
- `make_poles` processes `1 plank => 2 poles` at a sawbench.
- `build_bots` now feeds the bot factory the Basic Bot test recipe: `1 log + 3 planks + 1 pole + 1 tree_seed`.
- The factory worker can fetch logs/planks/poles from the selected sawbench and loose tree seeds from the map, so the full chain can be tested with the current bot mechanics.

## v5 fullscreen UI, drawers, and storage

- Game display is fullscreen; canvas backing size now tracks its CSS size 1:1 so the game no longer stretches.
- Bots list is a right-edge drawer instead of a permanent side panel.
- Build menu is a left-edge drawer with `B` shortcut and category tabs.
- Build → Storage starts with `Item Palette`; once a log/plank is inserted, that palette only accepts that item type.
- Successful assignments show a short top-border status overlay when chat is closed.
- Settings now separates `Controls` from `Performance`, so hardware tuning and gameplay reference no longer share the same tab.

## v4 UI/backend additions

- `Esc` now behaves like a layered close key: it dismisses whatever UI is currently open first, and only opens settings when no other gameplay UI is open.
- Chat/command input now lives in a centered bottom overlay with formatted message bubbles.
- `Enter` opens/focuses chat when it is closed; `L` toggles chat visibility.
- Frontend settings default to Paul-compatible local Ollama names: `gemma4:12b` selected, `gemma4-26b-a4b-local:latest`, `bonsai8b-q1:latest`, and `llama3:latest` available as fallbacks.
- Backend Ollama now has Gemma4 12B Q4 plus small models installed and old Gemma3 models removed.
- Voice settings now offer two Sherpa modes: Zipformer live partials + Whisper finalizer, or Whisper direct with no Zipformer and final-only transcript after stop.

## v3 interaction/UI additions

- Chat input now behaves like a normal text field when focused: WASD/E/arrow keys type or move the caret instead of triggering game controls.
- Bots are mouse-hoverable and clickable. Clicking a bot opens a small menu with its current status and DSL loop JSON.
- The build panel lets the player place more `sawbench`, `crude tool bench`, and `bot factory` structures on the map.
- Structures can be right-clicked to open a cursor-position menu. Choosing **Add to chat** inserts names like `sawbench 2` at the current chat cursor.
- Trees and holes are hover-highlighted and open their own context menus; right-clicking a hole while holding a `tree_seed` queues planting at that exact hole.
- The old monolithic `game.js` was reduced to a small boot file; implementation now lives in `src/` modules.

## DSL bot programs

Built-in bot templates are data objects exposed at runtime as `window.programTemplates`. Each bot has a program counter and scratch memory, and the interpreter runs allowlisted operations such as:

- `find_nearest_tree`
- `find_item`
- `find_stone_deposit`
- `find_dig_spot`
- `find_dug_hole`
- `mine_stone`
- `dig_hole`
- `plant_seed`
- `pick_up_from_storage`
- `pick_up_specific`
- `move_to_target`
- `chop_tree`
- `pick_up`
- `deliver_to_sawbench`
- `process_sawbench`
- `process_poles`
- `fetch_plank_from_sawbench`
- `fetch_pole_from_sawbench`
- `deliver_to_workbench`
- `craft_workbench`
- `deliver_to_factory`
- `assemble_bot`
- `idle_parking`
- `wait`
- `loop`

Available built-in templates:

- `chop_wood`
- `mine_stone`
- `dig_holes`
- `pickup_item`
- `plant_trees`
- `haul_logs`
- `make_planks`
- `make_poles`
- `haul_planks`
- `craft_axes`
- `build_bots`
- `idle`

The page includes a **DSL Templates** panel so the current template JSON can be inspected without opening dev tools.

### Function-call API

The local mock assistant and the Ollama mode both route through the same tool shape:

```js
assignBotProgram({
  botId: 2,
  program: "haul_logs",
  targetStructureId: 3,
  zoneId: "zone:1",
  reason: "Bring logs from zone 1 to sawbench 2"
})
```

The safe LLM surface is parameterized templates, not arbitrary JavaScript. Important assignment fields:

- `targetStructureId`: destination/operated sawbench, e.g. sawbench 2.
- `sourceStructureId`: source sawbench for planks.
- `targetFactoryId`: destination/operated factory.
- `zoneId`: drawn rectangle zone such as `zone:1`.
- `zone`: runtime radius zone, e.g. `{ "kind": "radius", "centerStructureId": 3, "radius": 95 }`.

Returned calls are validated against current bot IDs, structures, zones, and known programs. Validation helpers are exposed as `window.validateAssistantToolCalls(rawCalls)`, `window.validateDslProgram(program)`, and `window.allowedProgramOps`.

## Local Ollama / Gemma / Qwen mode

The **Local Ollama / Benchmark** panel supports:

- Endpoint input, defaulting to `/ollama-proxy` on the public build and `http://127.0.0.1:11434` locally
- Preset buttons: **Use server proxy** and **Use my local Ollama**
- Model select populated from `GET /api/tags`
- Refresh button
- Mock parser vs Local Ollama mode
- JSON tool-call benchmark button
- Latency and token/eval count display when Ollama returns those fields
- OpenAI/ChatGPT relay was intentionally skipped in this build because the server has no OpenAI API key configured; a ChatGPT subscription alone is not enough for server API relay.

Expected Ollama setup example:

```bash
docker exec ollama-local ollama pull gemma4:12b
```

The browser sends `POST /api/chat` with `format: "json"` and asks the model to return only:

```json
{
  "tool_calls": [
    {
      "name": "assignBotProgram",
      "arguments": {
        "botId": 2,
        "program": "haul_logs",
        "targetStructureId": 3,
        "zoneId": "zone:1",
        "reason": "Bring logs from zone 1 to sawbench 2"
      }
    }
  ]
}
```

Returned calls are validated against current bot ids and known programs. If Ollama is unavailable, blocked by CORS, returns invalid JSON, or emits invalid calls, the game falls back to the deterministic mock parser.

### CORS, localhost, and server note

The public `docs.pau1.cloud` build defaults to a same-origin `/ollama-proxy` endpoint. That proxy is intentionally capped for this prototype: allowlisted models only, `stream:false`, limited `num_predict`, limited `num_ctx`.

For direct browser calls to your own local Ollama server, open Settings → Local AI, click **Use my local Ollama**, then **Refresh**. The endpoint becomes `http://127.0.0.1:11434`, which is resolved by the **browser machine**. Ollama must allow the page origin; for the public game use `OLLAMA_ORIGINS='https://docs.pau1.cloud'`, or `OLLAMA_ORIGINS='*'` for local prototype work.

Local GPU quick setup:

```bash
ollama pull gemma4:12b
OLLAMA_HOST=127.0.0.1:11434 OLLAMA_ORIGINS=https://docs.pau1.cloud ollama serve
```

If Ollama already runs as a desktop app/service, set `OLLAMA_ORIGINS=https://docs.pau1.cloud`, restart Ollama, then click **Refresh** in the game.

Important: `http://127.0.0.1:11434` is resolved by the **browser machine**, not by the web server. If you open the public HTTPS page from your laptop and want to bypass the proxy and hit the VPS Ollama directly, create an SSH tunnel first:

```bash
ssh -L 11434:127.0.0.1:11434 root@<server>
```

Then set the game endpoint to `http://127.0.0.1:11434`.

## Performance and renderer controls

- Idle bots park in a depot ring instead of all following the assistant.
- The `Performance` tab now owns renderer and hardware tuning settings.
- Browser settings auto-save when changed and auto-load on the next visit.
- The browser does a best-effort WebGPU probe, infers a known GPU profile when possible, and shows the inferred VRAM/profile recommendation in the menu.
- `Auto-detect` applies hardware-based target FPS and bot-limit recommendations; manual slider changes switch the profile to `Custom`.
- The max bot slider is no longer hard-capped to 80. It can scale up into the hundreds based on the detected hardware profile, with an absolute UI ceiling of 1000.
- The factory and manual bot creation still honor the active bot cap.
- The HUD shows FPS, bot count, cap, and renderer status.
- Bot list rendering is throttled and capped to 14 visible rows.
- Nearest-tree and nearest-item searches use linear scans instead of full-array sorting each tick.

## WebGPU progressive enhancement

The game always renders through Canvas 2D for compatibility. On browsers with `navigator.gpu`, v2 requests an adapter/device and runs a tiny compute pass that counts active entity categories (bots + items + trees). This acts as a meaningful WebGPU feature probe and debug path while keeping Canvas 2D as the fallback renderer.

Debug state is available in the console:

```js
window.getGameState()
```

It includes:

- `renderer`
- `webgpuAvailable`
- `webgpuReason`
- `webgpuEntityProbe`
- `targetFps`
- `fps`
- `maxBots`
- bot programs, target slots, and zones
- world object registry
- resource stores
- parameterized DSL templates

## MVP loop

1. Sticks, stones, logs, and tree seeds exist as base loose resources.
2. The crude tool bench crafts `crude_axe` from `1 stick + 1 stone`.
3. Trees are chopped by bots with crude axes into loose logs; felled trees add sticks/seeds.
4. Logs are hauled to the sawbench.
5. Logs are processed into planks at the sawbench.
6. Planks are processed into poles at the sawbench.
7. `build_bots` supplies `1 log + 3 planks + 1 pole + 1 tree_seed` to the factory.
8. The factory consumes the recipe and creates a new idle bot.
9. The assistant assigns each bot a looping DSL program.

## Live voice input with Sherpa + faster-whisper modes

The chat input has a mic button. The default Sherpa modes record raw mono PCM in the browser with WebAudio, downsample to 16 kHz, and stream `Float32Array` chunks over WebSocket to:

```text
wss://docs.pau1.cloud/asr/ws?mode=zipformer_whisper
wss://docs.pau1.cloud/asr/ws?mode=whisper_direct
wss://docs.pau1.cloud/asr/ws?mode=faster_whisper
```

The Settings → Voice mode `faster_whisper` uses the server-side `faster-whisper` model already cached for Telegram voice messages. In the browser it records with `MediaRecorder`, uploads the finished clip, and inserts the returned final transcript:

```text
POST https://docs.pau1.cloud/asr/transcribe?mode=faster_whisper
multipart/form-data file=<audio/webm|ogg|mp4|wav>
```

The API runs `sherpa-onnx` with two local models:

```text
sherpa-onnx-streaming-zipformer-en-20M-2023-02-17   # true live partials
sherpa-onnx-whisper-tiny.en                          # offline second-pass final text
```

Whisper in Sherpa is not true streaming. In `zipformer_whisper` mode it is used honestly as a second-pass finalizer after the streaming Zipformer pass. In `whisper_direct` mode Zipformer is bypassed completely and Whisper returns only the final transcript when recording stops. `faster_whisper` is also final-only: the browser uploads the finished recording to `/asr/transcribe?mode=faster_whisper` and the server returns JSON with `text`/`transcript` plus segment metadata.

Protocol:

- Browser → server: binary `Float32Array` PCM mono 16 kHz chunks for WebSocket modes, or `multipart/form-data` audio upload for `faster_whisper`.
- Browser → server: text `Done` to flush/finalize.
- Server → browser: JSON events:
  - `{ "type": "ready", "sampleRate": 16000 }`
  - `{ "type": "partial", "text": "bot one", "segment": 0, "final": false }`
  - `{ "type": "final", "text": "bot one chop wood", "segment": 0, "final": true }`
  - `{ "type": "closed" }`

Health endpoint:

```text
https://docs.pau1.cloud/asr/health
```

Cursor behavior:

- Partial transcripts replace the previous partial range instead of appending duplicates.
- Final transcripts commit with spacing.
- The app tracks `selectionStart`/`selectionEnd`, so users can pause, click into the command, insert variable chips like `{{factory}}`, and continue speaking at that cursor position.
- Arrow keys work inside the chat input; game movement keys are ignored while typing.

## Files

- `index.html` - fullscreen page structure, canvas, canvas chat overlay, bot/build drawers, settings overlay, Ollama controls, Stats/DSL tabs, status toast
- `styles.css` - dark neutral responsive layout and UI styling
- `styles-interactions.css` - bot/structure menus and building active-state styling
- `game.js` - small dynamic-import boot file
- `src/data.js` - parameterized program templates, allowed ops, default zones, building definitions
- `src/utils.js` - geometry, canvas, escaping helpers
- `src/chat.js` - cursor-aware chat input, variable insertion, Sherpa ASR mic client
- `src/assistant.js` - mock parser, Ollama calls, slot/zone-aware tool-call validation
- `src/world.js` - Canvas world simulation, object registry, zones, bots, structures, menus, building placement
