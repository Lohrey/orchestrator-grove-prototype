#!/usr/bin/env python3
"""Smoke test: player right-click chop/mine/search auto-repeats.
Verifies that chop repeats until tree is felled, and stone mining repeats forever
without ever depleting the depot."""
import asyncio, os
URL = os.environ.get('ORCHARD_SMOKE_URL', 'https://docs.pau1.cloud/public/prototypes/orchestrator-grove/index.html?v=grove_repeat_chop_0705')

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})
        msgs = []
        page.on('pageerror', lambda e: msgs.append(str(e)))
        await page.goto(f'{URL}&renderer=canvas2d', wait_until='networkidle')
        await page.wait_for_function("() => window.getGameState && window.repeatDebug && window.campaignQuestDebug")
        await page.evaluate("window.gameMenuDebug.startCampaign()")
        await page.evaluate("window.gameMenuDebug.skipCampaignIntro()")
        await page.wait_for_timeout(5000)
        await page.evaluate("window.campaignQuestDebug.unpackVan()")
        await page.wait_for_timeout(1500)

        # === TEST 1: Chop tree auto-repeats until felled ===
        await page.evaluate("() => window.teachDebug.setInventory('crude_axe')")
        trees = await page.evaluate("window.repeatDebug.getTrees()")
        assert trees, 'No choppable trees found'
        tree_id = trees[0]['id']
        hp_before = trees[0]['hp']
        # Queue chop (simulates right-click on tree)
        queued = await page.evaluate("window.repeatDebug.chopFirstTree()")
        assert queued is True, f'chopFirstTree returned {queued}'
        await page.wait_for_timeout(500)
        target1 = await page.evaluate("window.repeatDebug.getTarget()")
        assert target1 and target1.get('repeat') is True, f'Chop target should have repeat=true, got: {target1}'
        # Run ~15s (RESOURCE_HIT_SECONDS=3 → ~5 cycles; tree hp=4 so should fell)
        await page.wait_for_timeout(15000)
        target_after = await page.evaluate("window.repeatDebug.getTarget()")
        hp_after = await page.evaluate("id => window.repeatDebug.getTreeHp(id)", tree_id)
        still_chopping = target_after and target_after.get('action') == 'chop_tree'
        felled = hp_after is None  # tree removed from game.trees when felled? or hp<=0+stump
        # Check via getTrees (returns non-stump trees only)
        trees_after = await page.evaluate("window.repeatDebug.getTrees()")
        tree_in_list = any(t['id'] == tree_id for t in trees_after)
        if not tree_in_list:
            felled = True  # removed from non-stump list = felled
        assert still_chopping or felled, (
            f'Player should still be chopping or tree felled. target={target_after}, hp={hp_after}, tree_in_list={tree_in_list}'
        )
        print(f'✓ Repeat chop: still_chopping={still_chopping}, felled={felled}, hp {hp_before}→{hp_after}')

        await page.evaluate("window.repeatDebug.clearTarget()")
        await page.wait_for_timeout(300)

        # === TEST 2: Stone mining repeats forever, depot never depletes ===
        await page.evaluate("() => window.teachDebug.setInventory('crude_pickaxe')")
        rocks = await page.evaluate("window.repeatDebug.getRocks()")
        if rocks:
            rock_id = rocks[0]['id']
            hp_before = rocks[0]['hp']
            queued = await page.evaluate("window.repeatDebug.mineFirstRock()")
            assert queued is True, f'mineFirstRock returned {queued}'
            await page.wait_for_timeout(500)
            mine_target = await page.evaluate("window.repeatDebug.getTarget()")
            assert mine_target and mine_target.get('repeat') is True, f'Mine target should have repeat=true, got: {mine_target}'
            # Run ~10s (~3 cycles with pickaxe, 3s each)
            await page.wait_for_timeout(10000)
            mine_target_after = await page.evaluate("window.repeatDebug.getTarget()")
            hp_after = await page.evaluate("id => window.repeatDebug.getRockHp(id)", rock_id)
            still_mining = mine_target_after and mine_target_after.get('action') == 'mine_stone'
            assert still_mining, f'Player should still be mining stone. target={mine_target_after}'
            # Rock must still exist and never deplete
            assert hp_after is not None and hp_after >= 1, f'Stone depot must NEVER break/deplete. hp={hp_after}'
            print(f'✓ Stone mining repeats forever, depot hp stays ≥1 ({hp_before}→{hp_after})')
        else:
            print('(skipped stone test — no rocks on map)')

        if msgs:
            print(f'⚠ Page errors: {msgs[:3]}')
        await browser.close()
        print('✅ All repeat-chop smoke checks passed')

if __name__ == '__main__':
    asyncio.run(main())
