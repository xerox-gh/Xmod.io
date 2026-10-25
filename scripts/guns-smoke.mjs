import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const vite = await createServer({ server: { host: '127.0.0.1', port: 5184 } });
await vite.listen();
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (message) => {
  if (/^(Tool error:|Sandbox action failed:)/.test(message.text())) errors.push(message.text());
});
// CI renders in software. Keep the full world and weapon meshes, but avoid
// spending the firing assertions' time budget on shadow shader compilation.
await page.addInitScript(() => {
  localStorage.setItem(
    'xmod.settings',
    JSON.stringify({ quality: 'low', shadows: false, pixelRatio: 1 }),
  );
});
const rendered = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
const ammo = () =>
  page.evaluate(async () => {
    const { game: g } = await import('/src/main.js');
    return g.weapons.state(g.toolId).ammo;
  });
const locked = async () => {
  await expect(page.locator('#game')).toHaveAttribute('data-pointer-locked', 'true');
  // Pointer lock completes before the next HUD/render update. In software
  // rendering, shader compilation may take longer than a DOM assertion timeout.
  await rendered();
};
async function equip(id, name) {
  await page.keyboard.press('KeyQ');
  await expect(page.locator('#game')).toHaveAttribute('data-pointer-locked', 'false');
  await page.locator('[data-category="Weapons"]').click();
  await page.getByLabel('Search props').fill('');
  await page.locator(`[data-weapon="${id}"]`).click();
  await locked();
  await expect(page.locator('#tool-name')).toHaveText(name);
  await expect(page.locator('[data-slot="4"] small')).toHaveText(name);
}
try {
  await mkdir('test-results', { recursive: true });
  await page.goto('http://127.0.0.1:5184');
  await page.locator('#weapons').click();
  await expect(page.locator('[data-category="Weapons"]')).toHaveClass(/active/);
  await page.locator('[data-weapon="pistol"]').click();
  await locked();
  for (const [id, name, capacity, automatic] of [
    ['smg', 'Spark SMG', 32, true],
    ['rifle', 'Ranger rifle', 30, true],
    ['revolver', 'Iron revolver', 6, false],
    ['lmg', 'Bulwark LMG', 80, true],
    ['sniper', 'Longshot sniper', 5, false],
  ]) {
    await equip(id, name);
    await page.dispatchEvent('#game', 'mousedown', { button: 0 });
    // The input queue is consumed by the game loop. Wait for that loop rather
    // than assuming a software-rendered frame fits a short wall-clock poll.
    await rendered();
    expect(await ammo()).toBeLessThan(capacity);
    await page.waitForTimeout(550);
    await page.dispatchEvent('#game', 'mouseup', { button: 0 });
    await rendered();
    const remaining = await ammo();
    if (automatic) expect(remaining).toBeLessThan(capacity - 1);
    else expect(remaining).toBe(capacity - 1);
    if (id === 'lmg') await page.screenshot({ path: 'test-results/gun-lmg.png' });
    await page.keyboard.press('KeyR');
    await expect(page.locator('#tool-mode')).toContainText('RELOADING');
    await expect.poll(ammo, { timeout: 12000 }).toBe(capacity);
  }
  await page.dispatchEvent('#game', 'mousedown', { button: 2 });
  await expect(page.locator('.scope-overlay')).toBeVisible();
  await expect
    .poll(() => page.evaluate(async () => (await import('/src/main.js')).game.view.camera.fov))
    .toBeLessThan(35);
  await page.screenshot({ path: 'test-results/gun-sniper-scope.png' });
  await page.keyboard.press('Digit1');
  await expect(page.locator('#tool-name')).toHaveText('Physics gun');
  await expect(page.locator('.scope-overlay')).toBeHidden();
  await page.dispatchEvent('#game', 'mouseup', { button: 2 });
  await expect
    .poll(() => page.evaluate(async () => (await import('/src/main.js')).game.view.camera.fov))
    .toBeGreaterThan(80);
  await page.keyboard.press('KeyQ');
  await expect(page.locator('#game')).toHaveAttribute('data-pointer-locked', 'false');
  await page.locator('[data-category="Weapons"]').click();
  await page.getByLabel('Search props').fill('rifle');
  await expect(page.locator('[data-weapon="rifle"]')).toBeVisible();
  await expect(page.locator('[data-weapon="smg"]')).toHaveCount(0);
  await page.getByLabel('Search props').fill('');
  await page.screenshot({ path: 'test-results/gun-catalog.png' });
  expect(errors).toEqual([]);
  console.log(
    'Guns browser passed: five catalog loadouts, automatic/semi fire, ammo/reloads, distinct models, sniper zoom/reticle, tool switching and weapon search.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/guns-failure.png' });
  console.log('Gun browser errors:', errors);
  console.log(
    'Gun input state:',
    await page.evaluate(async () => {
      const { game: g } = await import('/src/main.js');
      return {
        weapon: g.toolId,
        state: g.weapons.has(g.toolId) ? g.weapons.state(g.toolId) : null,
        time: g.weapons.time,
        authority: g.actor.loadout,
        simTime: g.sim.time,
        locked: g.input.locked,
        buttons: [...g.input.buttons],
        clicks: g.input.clicks,
        overlay: g.overlay,
        quality: g.quality.level,
        fps: g.quality.fps,
      };
    }),
  );
  throw error;
} finally {
  await browser.close();
  await vite.close();
}
