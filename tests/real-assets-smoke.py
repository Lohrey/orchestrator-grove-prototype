#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:8098/index.html?v=t_ded5df60'
SHOT = Path('/root/autonauts-orchestrator-prototype/t_ded5df60-real-assets-local.png')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    errors = []
    page.on('console', lambda msg: errors.append(f'{msg.type}: {msg.text}') if msg.type in ('error','warning') else None)
    page.on('pageerror', lambda exc: errors.append(f'pageerror: {exc}'))
    page.goto(URL, wait_until='domcontentloaded', timeout=15000)
    page.wait_for_function('() => window.getGameState', timeout=15000)
    page.wait_for_timeout(700)
    state = page.evaluate('window.getGameState()')
    assert len(state['structures']) >= 5, state['structures']
    assert any(s['type'] == 'smithery' for s in state['structures']), state['structures']
    assert any(s['type'] == 'defensetower' for s in state['structures']), state['structures']
    page.screenshot(path=str(SHOT), full_page=False)
    browser.close()
    if errors:
        raise AssertionError('\n'.join(errors[:20]))
print(f'asset smoke passed: {SHOT}')
