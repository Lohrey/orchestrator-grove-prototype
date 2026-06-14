#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = 'https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=t_d28f2a9b'
SHOT = Path('/root/agent-api-hub/public/prototypes/orchestrator-grove/t_d28f2a9b-tool-visuals-public.png')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 900, "height": 420})
    errors = []
    page.on('console', lambda msg: errors.append(f'{msg.type}: {msg.text}') if msg.type in ('error','warning') else None)
    page.on('pageerror', lambda exc: errors.append(f'pageerror: {exc}'))
    page.goto(URL, wait_until='domcontentloaded', timeout=20000)
    page.wait_for_function('() => window.getGameState', timeout=20000)
    result = page.evaluate("""async () => {
      document.body.innerHTML = '<canvas id="toolSmoke" width="900" height="420" style="background:#142319;width:900px;height:420px"></canvas>';
      const canvas = document.getElementById('toolSmoke');
      const c = canvas.getContext('2d');
      c.strokeStyle = 'rgba(255,255,255,.05)';
      for (let x = 0; x < 900; x += 90) { c.beginPath(); c.moveTo(x,0); c.lineTo(x,420); c.stroke(); }
      for (let y = 0; y < 420; y += 90) { c.beginPath(); c.moveTo(0,y); c.lineTo(900,y); c.stroke(); }
      const mod = await import('./src/visual-assets.js?v=t_d28f2a9b');
      const items = ['crude_axe', 'crude_pickaxe', 'crude_shovel', 'wooden_sword', 'wooden_shield', 'bow'];
      items.forEach((type, i) => {
        c.save();
        c.translate(90 + i * 140, 185);
        c.scale(4, 4);
        mod.drawItemAsset(c, type);
        c.restore();
        c.fillStyle = '#e8dfc8';
        c.font = '16px sans-serif';
        c.textAlign = 'center';
        c.fillText(type, 90 + i * 140, 285);
      });
      const data = c.getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (!(data[i] === 20 && data[i+1] === 35 && data[i+2] === 25)) changed++;
      }
      const importUsed = performance.getEntriesByType('resource').some(e => e.name.includes('visual-assets.js?v=t_d28f2a9b'));
      return { changed, items: items.length, importUsed };
    }""")
    assert result['items'] == 6, result
    assert result['changed'] > 5000, result
    assert result['importUsed'], result
    page.screenshot(path=str(SHOT), full_page=False)
    browser.close()
    if errors:
        raise AssertionError('\n'.join(errors[:20]))
print(f'public tool visuals smoke passed: {URL}')
print(f'screenshot: https://docs.pau1.cloud/public/prototypes/orchestrator-grove/{SHOT.name}')
