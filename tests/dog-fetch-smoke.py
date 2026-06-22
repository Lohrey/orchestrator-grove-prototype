#!/usr/bin/env python3
"""Regression checks for the dog fetch workflow and praise learning curve."""

from __future__ import annotations

import functools
import http.server
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002 - stdlib API name
        pass


with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}/index.html"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            page.goto(url, wait_until="networkidle")
            page.wait_for_function("() => window.getGameState && window.teachDebug && window.dogDebug")
            page.evaluate("window.gameMenuDebug?.closeMainMenu?.()")

            starter_dogs = page.evaluate("window.getGameState().bots.filter(b => b.kind === 'dog')")
            assert len(starter_dogs) >= 1, starter_dogs
            dog_id = starter_dogs[0]["id"]
            assert starter_dogs[0]["program"] == "dog_fetch", starter_dogs[0]
            assert starter_dogs[0]["knowledgePacks"] == ["dog_fetch"], starter_dogs[0]
            page.evaluate("window.teachDebug.movePlayerTo(650, 410)")
            start_distance = page.evaluate(
                """
                () => {
                  const state = window.getGameState();
                  const dog = state.bots.find(b => b.kind === 'dog');
                  return Math.hypot(dog.x - state.player.x, dog.y - state.player.y);
                }
                """
            )
            page.evaluate("window.teachDebug.tickWorld(1)")
            after_distance = page.evaluate(
                """
                () => {
                  const state = window.getGameState();
                  const dog = state.bots.find(b => b.kind === 'dog');
                  return Math.hypot(dog.x - state.player.x, dog.y - state.player.y);
                }
                """
            )
            assert after_distance < start_distance, (start_distance, after_distance)

            dog_state = page.evaluate("window.getGameState().bots.find(b => b.kind === 'dog')")
            assert dog_state["kind"] == "dog", dog_state
            assert dog_state["knowledgePacks"] == ["dog_fetch"], dog_state

            page.evaluate(f"window.teachDebug.setBotInventory({dog_id}, 'stick')")
            page.evaluate(f"window.teachDebug.openBotMenu({dog_id})")
            page.wait_for_function("() => !document.getElementById('dogPopup').hidden && !!document.querySelector('#dogPopup [data-dog-popup-praise]')")
            assert page.locator("#botMenu").is_hidden(), "dog popup should not use the bot menu"
            assert "Brought stick." in page.locator("#dogPopup").text_content(), "reward popup should summarize what the dog brought"
            assert page.locator("#dogPopup [data-dog-popup-praise]").is_visible(), "praise button must show for a carried item"
            assert page.locator("#dogPopup [data-dog-popup-reject]").is_visible(), "reject button must show for a carried item"

            page.evaluate(f"window.teachDebug.setBotInventory({dog_id}, null)")
            page.evaluate(f"window.teachDebug.openBotMenu({dog_id})")
            page.wait_for_function("() => !document.getElementById('dogPopup').hidden && !!document.querySelector('#dogPopup [data-dog-fetch-command]')")
            assert page.locator("#dogPopup [data-dog-fetch-command]").is_visible(), "fetch input must show when paws are empty"
            assert page.locator("#dogPopup [data-dog-fetch-submit]").is_visible(), "send button must show in the dog popup"
            assert page.locator("#dogPopup [data-dog-popup-mic]").is_visible(), "mic button must show in the dog popup"
            assert page.evaluate("() => document.activeElement?.matches('#dogPopup [data-dog-fetch-command]')"), "fetch input must auto focus"
            selection = page.evaluate("() => ({ start: document.activeElement?.selectionStart ?? -1, end: document.activeElement?.selectionEnd ?? -1, value: document.activeElement?.value ?? '' })")
            assert selection["start"] == 0 and selection["end"] == len(selection["value"]), selection

            learned_count = page.evaluate(
                """
                () => {
                  const botId = __DOG_ID__;
                  window.teachDebug.setInventory(null);
                  for (let i = 0; i < 10; i += 1) {
                    window.teachDebug.setBotInventory(botId, 'stick');
                    const res = window.dogDebug.praise(botId);
                    if (!res.ok) throw new Error(res.error);
                    window.teachDebug.setInventory(null);
                  }
                  const bot = window.getGameState().bots.find(b => b.id === botId);
                  return {
                    praiseCount: bot.dogFetchMemory.praiseCounts.stick,
                    preferredType: bot.dogFetchMemory.preferredType,
                    lastTargetType: bot.dogFetchMemory.lastTargetType
                  };
                }
                """.replace("__DOG_ID__", str(dog_id))
            )
            assert learned_count["praiseCount"] == 10, learned_count
            assert learned_count["preferredType"] == "stick", learned_count
            assert learned_count["lastTargetType"] == "stick", learned_count

            fetch_range = page.evaluate(
                """
                () => {
                  const state = window.getGameState();
                  const dog = state.bots.find(b => b.kind === 'dog');
                  window.teachDebug.movePlayerTo(1800, 1000);
                  window.teachDebug.tickWorld(20);
                  window.teachDebug.spawnItem('pole', 3300, 1000, 1);
                  return window.dogDebug.fetch(dog.id, 'go fetch me a pole');
                }
                """
            )
            assert fetch_range["ok"] is True, fetch_range
            assert fetch_range["targetType"] == "pole", fetch_range

            fetch_target = page.evaluate(
                """
                () => {
                  const bot = window.getGameState().bots.find(b => b.id === __DOG_ID__);
                  const near = [
                    { type: 'stick', x: bot.x + 46, y: bot.y + 2 },
                    { type: 'log', x: bot.x + 66, y: bot.y + 4 }
                  ];
                  for (const item of near) window.teachDebug.spawnItem(item.type, item.x, item.y, 1);
                  return window.dogDebug.fetch(__DOG_ID__, 'bring me something nearby');
                }
                """.replace("__DOG_ID__", str(dog_id))
            )
            assert fetch_target["ok"] is True, fetch_target
            assert fetch_target["targetType"] == "stick", fetch_target

            page.evaluate("window.teachDebug.setInventory(null)")
            page.evaluate(f"window.teachDebug.setBotInventory({dog_id}, 'stick')")
            page.evaluate(f"window.teachDebug.openBotMenu({dog_id})")
            page.wait_for_function("() => !document.getElementById('dogPopup').hidden && !!document.querySelector('#dogPopup [data-dog-popup-praise]')")
            praise_box = page.evaluate(
                """
                () => {
                  const r = document.querySelector('#dogPopup [data-dog-popup-praise]')?.getBoundingClientRect();
                  return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
                }
                """
            )
            page.mouse.click(praise_box["x"] + praise_box["width"] / 2, praise_box["y"] + praise_box["height"] / 2)
            page.wait_for_function("() => window.getGameState().player.inventory?.type === 'stick'")
            final_state = page.evaluate(f"window.getGameState().bots.find(b => b.id === {dog_id})")
            assert final_state["dogFetchMemory"]["praiseCounts"]["stick"] == 11, final_state

            page.evaluate(f"window.dogDebug.fetch({dog_id}, 'go fetch me a stick')")
            page.evaluate(f"window.teachDebug.setBotInventory({dog_id}, 'log')")
            page.evaluate(
                """
                () => {
                  const state = window.getGameState();
                  const dog = state.bots.find(b => b.kind === 'dog');
                  window.teachDebug.movePlayerTo(dog.x, dog.y);
                }
                """
            )
            page.evaluate(f"window.teachDebug.openBotMenu({dog_id})")
            page.wait_for_function("() => !document.getElementById('dogPopup').hidden && !!document.querySelector('#dogPopup [data-dog-popup-praise]')")
            wrong_box = page.evaluate(
                """
                () => {
                  const r = document.querySelector('#dogPopup [data-dog-popup-praise]')?.getBoundingClientRect();
                  return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
                }
                """
            )
            page.mouse.click(wrong_box["x"] + wrong_box["width"] / 2, wrong_box["y"] + wrong_box["height"] / 2)
            page.wait_for_timeout(150)
            assert page.locator("#dogPopup").is_visible(), "wrong praise should keep the popup open"
            assert page.locator("#dogPopup [data-dog-popup-praise]").is_visible(), "wrong praise should not dismiss the button"
            reject_box = page.evaluate(
                """
                () => {
                  const r = document.querySelector('#dogPopup [data-dog-popup-reject]')?.getBoundingClientRect();
                  return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
                }
                """
            )
            page.mouse.click(reject_box["x"] + reject_box["width"] / 2, reject_box["y"] + reject_box["height"] / 2)
            page.wait_for_function("() => document.getElementById('dogPopup').hidden === true")

            browser.close()
    finally:
        server.shutdown()
        thread.join(timeout=1)

print("dog fetch smoke passed")
