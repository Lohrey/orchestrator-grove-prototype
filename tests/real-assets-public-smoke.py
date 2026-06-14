#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = 'https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_ded5df60'
SHOT = Path('/root/agent-api-hub/public/prototypes/orchestrator-grove/t_ded5df60-real-assets-public.png')
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    errors = []
    page.on('console', lambda msg: errors.append(f'{msg.type}: {msg.text}') if msg.type in ('error','warning') else None)
    page.on('pageerror', lambda exc: errors.append(f'pageerror: {exc}'))
    page.goto(URL, wait_until='domcontentloaded', timeout=20000)
    page.wait_for_function('() => window.getGameState', timeout=20000)
    page.wait_for_timeout(900)
    state = page.evaluate('window.getGameState()')
    assert len(state['structures']) >= 5, state['structures']
    assert any(s['type'] == 'smithery' for s in state['structures']), state['structures']
    assert any(s['type'] == 'defensetower' for s in state['structures']), state['structures']
    page.screenshot(path=str(SHOT), full_page=False)
    browser.close()
    if errors:
        raise AssertionError('\n'.join(errors[:20]))
print(f'public asset smoke passed: {URL}')
print(f'screenshot: https://docs.pau1.cloud/public/prototypes/orchestrator-grove/{SHOT.name}')
