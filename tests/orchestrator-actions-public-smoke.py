#!/usr/bin/env python3
"""Smoke checks for Orchestrator Grove executable actions, including manager delegation."""

from __future__ import annotations

import functools
import http.server
import json
import os
import socketserver
import threading
from math import hypot
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
TAG = "t_building_kits_0618"
SHOT = ROOT / f"{TAG}-public-smoke.png"
NEW_OPS = [
    "rename_bot",
    "promote_to_manager",
    "delegate_to_manager",
    "guard_area",
    "patrol_route",
    "equip_item",
    "craft_smithery",
    "craft_bowmaker",
    "deploy_building_kit",
    "disassemble_building_to_kit",
]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


def distance(a: dict, b: dict) -> float:
    return hypot(a["x"] - b["x"], a["y"] - b["y"])


def tick(page, seconds: float, step: float = 0.05) -> None:
    page.evaluate(
        """
        ([seconds, step]) => {
          for (let t = 0; t < seconds; t += step) window.teachDebug.tickWorld(step);
        }
        """,
        [seconds, step],
    )


def start_game(page) -> None:
    page.wait_for_function("() => window.getGameState && window.teachDebug && window.generateAssistantDsl && window.actionStepChainRows", timeout=45000)
    paused = page.evaluate("() => window.gameMenuDebug?.isPaused?.() || !!window.getGameState().paused")
    if paused:
        page.evaluate("() => window.gameMenuDebug?.startTest?.()")
        page.wait_for_function("() => !window.getGameState().paused", timeout=15000)


def run_smoke(url: str) -> None:
    errors: list[str] = []
    captured: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        def fake_ollama(route, request):
            body = request.post_data_json
            captured.append(body)
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "dsl_assignments": [
                                        {
                                            "botId": 2,
                                            "program": {
                                                "id": "manager_assigned_loop",
                                                "name": "Manager assigned chop",
                                                "steps": [{"op": "chop_tree"}, {"op": "loop"}],
                                            },
                                            "reason": "Manager delegated woodworking task.",
                                        }
                                    ]
                                }
                            )
                        }
                    }
                ),
            )

        page.route("**/fake-ollama/api/chat", fake_ollama)
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        start_game(page)

        allowed = page.evaluate("() => window.allowedProgramOps")
        rows = page.evaluate("() => window.actionStepChainRows.map(r => r.op)")
        missing_allowed = [op for op in NEW_OPS if op not in allowed]
        missing_rows = [op for op in NEW_OPS if op not in rows]
        assert not missing_allowed, {"missingAllowed": missing_allowed, "allowed": allowed}
        assert not missing_rows, {"missingRows": missing_rows, "rows": rows}
        assert len(rows) == 49, rows

        page.evaluate("window.setAssistantLoadout(['starter_automation', 'combat'])")
        debug = page.evaluate("window.getAssistantLoadoutDebug()")
        for op in NEW_OPS:
            assert op in debug["unlockedOps"], {"op": op, "debug": debug}

        invalid = page.evaluate("() => window.validateDslProgram({ steps: [{ op: 'equip_item', type: 'crude_axe' }] })")
        assert invalid["ok"] is False and "only sword, shield, or bow" in invalid["error"], invalid

        rename_valid = page.evaluate("() => window.validateDslProgram({ steps: [{ op: 'rename_bot', name: '  Guard\\nOne<>  ' }, { op: 'loop' }] })")
        assert rename_valid["ok"] is True and rename_valid["program"]["steps"][0]["name"] == "GuardOne", rename_valid

        rename_parsed = page.evaluate("window.generateAssistantDsl('Rename bot 2 to Guard')")
        rename_assignment = (rename_parsed.get("dslAssignments") or [])[0]
        assert rename_assignment["botId"] == 2, rename_parsed
        assert rename_assignment["program"]["steps"][0]["op"] == "rename_bot", rename_parsed
        assert rename_assignment["program"]["steps"][0]["name"] == "Guard", rename_parsed
        assigned = page.evaluate("assignment => window.assignCustomDslProgram(assignment)", rename_assignment)
        assert assigned["ok"] is True, assigned
        tick(page, 0.2)
        renamed_bot = page.evaluate("() => window.getGameState().bots.find(b => b.id === 2)")
        assert renamed_bot["name"] == "Guard", renamed_bot

        promote_parsed = page.evaluate("window.generateAssistantDsl('Promote bot 1 to manager')")
        promote_assignment = (promote_parsed.get("dslAssignments") or [])[0]
        assert promote_assignment["program"]["steps"][0]["op"] == "promote_to_manager", promote_parsed

        page.evaluate("window.teachDebug.openBotMenu(1)")
        assert page.locator("#botMenu [data-promote-manager]").is_visible()
        page.locator("#botMenu [data-promote-manager]").click()
        page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 1).status === 'manager'")
        assert page.locator("#botMenu [data-manager-section]").is_visible()
        assert page.locator("#botMenu [data-send-manager-message]").is_visible()
        if page.locator('#botMenu [data-manager-pack="woodworking"]').count():
            page.locator('#botMenu [data-manager-pack="woodworking"]').check()
        packs_after_ui = page.evaluate("window.managerDebug.getPacks(1)")
        assert "starter_automation" in packs_after_ui or "woodworking" in packs_after_ui, packs_after_ui

        page.evaluate("window.managerDebug.setPacks(1, ['woodworking'])")
        page.evaluate(
            """
            () => {
              document.getElementById('llmMode').value = 'ollama';
              document.getElementById('ollamaEndpoint').value = '/fake-ollama';
              document.getElementById('ollamaModel').value = 'manager-test-model';
              window.teachDebug.openBotMenu(1);
            }
            """
        )
        page.fill("#botMenu [data-manager-message]", "make bot 2 chop trees")
        page.click("#botMenu [data-send-manager-message]")
        page.wait_for_function("() => window.getGameState().bots.find(b => b.id === 2).program === 'taught_loop'", timeout=15000)
        assert captured, "manager LLM request was not captured"
        manager_user_prompt = captured[-1]["messages"][1]["content"]
        assert '"id":"woodworking"' in manager_user_prompt, manager_user_prompt
        assert '"chop_tree"' in manager_user_prompt, manager_user_prompt
        assert '"id":"combat"' not in manager_user_prompt, manager_user_prompt

        delegate_valid = page.evaluate("() => window.validateDslProgram({ steps: [{ op: 'delegate_to_manager', recipient: 'Bot 1', message: 'make bot 2 chop trees' }, { op: 'loop' }] })")
        assert delegate_valid["ok"] is True, delegate_valid

        guard_parsed = page.evaluate("window.generateAssistantDsl('Bot 1 guard nearby radius 240')")
        guard_assignment = (guard_parsed.get("dslAssignments") or [])[0]
        assert guard_assignment["program"]["steps"][0]["op"] == "guard_area", guard_parsed

        patrol_parsed = page.evaluate("window.generateAssistantDsl('Bot 2 patrol radius 180')")
        patrol_assignment = (patrol_parsed.get("dslAssignments") or [])[0]
        assert patrol_assignment["program"]["steps"][0]["op"] == "patrol_route", patrol_parsed

        equip_parsed = page.evaluate("window.generateAssistantDsl('Bot 3 equip bow')")
        equip_assignment = (equip_parsed.get("dslAssignments") or [])[0]
        assert equip_assignment["program"]["steps"][0]["op"] == "equip_item", equip_parsed
        assert equip_assignment["program"]["steps"][0]["type"] == "bow", equip_parsed

        bot1 = page.evaluate("() => window.getGameState().bots.find(b => b.id === 1)")
        monster = page.evaluate(
            """
            ([x, y]) => {
              const m = window.teachDebug.spawnMonster(x, y, { name: 'guard public smoke monster', type: 'night_monster', kind: 'night_monster', hostile: true, passive: false, hp: 3, maxHp: 3, ownerId: 'wild', speed: 0, roamRadius: 0 });
              return { id: m.id, ref: m.ref, hp: m.hp, x: m.x, y: m.y };
            }
            """,
            [bot1["x"] + 90, bot1["y"]],
        )
        assigned = page.evaluate("assignment => window.assignCustomDslProgram(assignment)", guard_assignment)
        assert assigned["ok"] is True, assigned
        tick(page, 6)
        objects = page.evaluate("window.getWorldObjects()")
        monster_after = next(obj for obj in objects if obj.get("id") == monster["ref"])
        bot1_after = page.evaluate("() => window.getGameState().bots.find(b => b.id === 1)")
        assert monster_after["hp"] <= 0, {"monsterBefore": monster, "monsterAfter": monster_after, "bot": bot1_after}
        assert bot1_after["taughtLoop"][0]["op"] == "guard_area", bot1_after

        bot3 = page.evaluate("() => window.getGameState().bots.find(b => b.id === 3)")
        page.evaluate("([x, y]) => window.teachDebug.spawnItem('bow', x, y)", [bot3["x"], bot3["y"]])
        assigned = page.evaluate("assignment => window.assignCustomDslProgram(assignment)", equip_assignment)
        assert assigned["ok"] is True, assigned
        tick(page, 2)
        bot3_after = page.evaluate("() => window.getGameState().bots.find(b => b.id === 3)")
        equipment_text = str(bot3_after.get("equipment"))
        assert "bow" in equipment_text, bot3_after

        page.screenshot(path=str(SHOT), full_page=True)
        browser.close()

    assert not errors, errors


base_url = os.environ.get("BASE_URL")
if base_url:
    run_smoke(f"{base_url.rstrip('/')}/index.html?v={TAG}")
else:
    with socketserver.TCPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))) as server:
        port = server.server_address[1]
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            run_smoke(f"http://127.0.0.1:{port}/index.html?v={TAG}")
        finally:
            server.shutdown()

print("orchestrator actions public smoke passed")
