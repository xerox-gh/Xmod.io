import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
const vite = await createServer({ server: { host: '127.0.0.1', port: 5182 } });
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
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function locked() {
  await expect(page.locator('#game')).toHaveAttribute('data-pointer-locked', 'true');
}
async function work(tab) {
  await page.keyboard.press('KeyB');
  await expect(page.locator('.workbench-tabs')).toBeVisible();
  await expect(page.locator('#game')).toHaveAttribute('data-pointer-locked', 'false');
  await page.locator(`[data-worktab="${tab}"]`).click();
}
async function back() {
  await page.locator('#workbench-play').click();
  await locked();
}
async function code() {
  await page.locator('#make-code').click();
  return page.getByLabel('Build share code').inputValue();
}
function decode(code) {
  return JSON.parse(Buffer.from(code.slice(6), 'base64').toString());
}
try {
  await mkdir('test-results', { recursive: true });
  await page.goto('http://127.0.0.1:5182');
  await page.locator('#play').click();
  await locked();
  await page.keyboard.press('KeyQ');
  await page.getByLabel('Search props').fill('barrel');
  await page.locator('[data-favorite="barrel"]').click();
  await expect(page.locator('[data-favorite="barrel"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-category="Favorites"]').click();
  await page.locator('[data-prop="barrel"]').click();
  await expect(page.locator('#body-count')).toContainText('7 /');
  await page.locator('[data-category="Recent"]').click();
  await expect(page.locator('[data-prop="barrel"]')).toBeVisible();
  await page.getByRole('button', { name: 'Close spawn menu' }).click();
  await locked();
  await page.keyboard.press('KeyP');
  await expect(page.locator('.world-tag')).toContainText('×0');
  await work('builds');
  const original = await code();
  expect(decode(original).entities.length).toBe(7);
  const downloadBuild = page.waitForEvent('download');
  await page.locator('#save-build').click();
  const file = await downloadBuild;
  const saved = await readFile(await file.path(), 'utf8');
  expect(JSON.parse(saved).entities.length).toBe(7);
  await page.locator('#clear-build').click();
  expect(decode(await code()).entities.length).toBe(0);
  await page.getByLabel('Build share code').fill(original);
  await page.locator('#paste-build').click();
  expect(decode(await code()).entities.length).toBe(7);
  await page.locator('#clear-build').click();
  await page
    .locator('#load-build')
    .setInputFiles({
      name: 'build.json',
      mimeType: 'application/json',
      buffer: Buffer.from(saved),
    });
  await expect.poll(async () => decode(await code()).entities.length).toBe(7);
  await back();
  // Reset the view, then spawn a fresh barrel on the crosshair while frozen.
  await work('world');
  await page.getByLabel('Map', { exact: true }).selectOption('flatgrass');
  await page.locator('#apply-map').click();
  await back();
  await page.keyboard.press('KeyQ');
  await page.locator('[data-prop="barrel"]').click();
  await page.getByRole('button', { name: 'Close spawn menu' }).click();
  await locked();
  await work('tools');
  await page.getByLabel('Tool mode', { exact: true }).selectOption({ label: 'Duplicator' });
  await page.locator('#equip-tool').click();
  await locked();
  // Headless pointer lock can emit cursor-warp deltas after menu clicks. Aim at
  // the actual prop through the player camera, then use the real tool input.
  await page.evaluate(async () => {
    const { game: g } = await import('/src/main.js');
    const e = [...g.sim.entities.values()].at(-1),
      p = g.view.camera.position,
      dx = e.body.position.x - p.x,
      dy = e.body.position.y - p.y,
      dz = e.body.position.z - p.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.asin(dy / Math.hypot(dx, dy, dz));
    g.input.dx = g.input.dy = 0;
    g.player.updateCamera(0);
    g.view.camera.updateMatrixWorld(true);
    for (const mesh of g.props.meshes.values()) mesh.updateMatrixWorld(true);
    return g.props.aim(g.view.camera)?.id;
  });
  await page.waitForTimeout(100);
  await page.dispatchEvent('#game', 'mousedown', { button: 0, bubbles: true });
  await page.dispatchEvent('#game', 'mouseup', { button: 0, bubbles: true });
  await expect(page.locator('#body-count')).toContainText('2 /');
  await page.keyboard.press('KeyZ');
  await expect(page.locator('#body-count')).toContainText('1 /');
  await page.keyboard.press('KeyG');
  await expect(page.locator('.selection-overlay')).toBeVisible();
  await page.mouse.move(100, 180);
  await page.mouse.down();
  await page.mouse.move(1340, 850, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#selection-count')).not.toContainText('0 selected');
  await page.locator('#selection-move').click();
  await page.locator('#selection-delete').click();
  await page.locator('#selection-close').click();
  await locked();
  await page.keyboard.press('KeyZ');
  await work('world');
  for (const id of ['hills', 'obstacle', 'city', 'void', 'flatgrass']) {
    await page.getByLabel('Map', { exact: true }).selectOption(id);
    await page.locator('#apply-map').click();
    await page.waitForTimeout(80);
  }
  await page.getByLabel('Gravity preset').selectOption('3.3');
  await page.locator('#apply-gravity').click();
  await page.getByLabel('Sky', { exact: true }).selectOption('sunset');
  await page.getByLabel('Weather', { exact: true }).selectOption('snow');
  await page.getByLabel('Quality', { exact: true }).selectOption('low');
  await page.screenshot({ path: 'test-results/workbench-world.png' });
  await back();
  await page.keyboard.press('F3');
  await expect(page.locator('.debug-overlay')).toBeVisible();
  await expect(page.locator('.debug-overlay')).toContainText('sleeping');
  await page.keyboard.press('F3');
  await work('tools');
  await page.getByLabel('Weapon', { exact: true }).selectOption('flamethrower');
  await page.locator('#equip-weapon').click();
  await locked();
  await expect(page.locator('#tool-name')).toHaveText('Flamethrower');
  await page.mouse.down();
  await page.waitForTimeout(300);
  await page.mouse.up();
  await work('tools');
  await page.getByLabel('Vehicle', { exact: true }).selectOption('boat');
  await page.locator('#equip-vehicle').click();
  await locked();
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('#body-count')).toContainText('1 /');
  await page.keyboard.press('F5');
  await work('capture');
  await expect(page.getByLabel('Camera mode')).toHaveValue('third');
  await page.getByLabel('Camera mode').selectOption('free');
  await page.locator('#record-replay').click();
  await back();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyD');
  await work('capture');
  await page.locator('#record-replay').click();
  const replayDownload = page.waitForEvent('download');
  await page.locator('#save-replay').click();
  const replay = await replayDownload;
  const replayFile = await readFile(await replay.path(), 'utf8');
  expect(JSON.parse(replayFile).frames.length).toBeGreaterThan(2);
  await page
    .locator('#load-replay')
    .setInputFiles({
      name: 'replay.json',
      mimeType: 'application/json',
      buffer: Buffer.from(replayFile),
    });
  await page.locator('#play-replay').click();
  await locked();
  await page.waitForTimeout(250);
  await work('capture');
  await page.locator('#stop-replay').click();
  const pngDownload = page.waitForEvent('download');
  await page.locator('#screenshot').click();
  expect((await pngDownload).suggestedFilename()).toMatch(/\.png$/);
  await page.screenshot({ path: 'test-results/workbench-capture.png' });
  await page.locator('#video').click();
  await back();
  await page.waitForTimeout(400);
  await work('capture');
  const videoDownload = page.waitForEvent('download');
  await page.locator('#video').click();
  const video = await videoDownload;
  expect(video.suggestedFilename()).toBe('xmod-video.webm');
  expect((await readFile(await video.path())).length).toBeGreaterThan(100);
  expect(errors).toEqual([]);
  console.log(
    'Expansion browser passed: build downloads/import/share codes, favorites/recents, duplication, box selection, five maps, time/gravity, weather, quality/F3, new loadouts, free camera, replay save/load/playback and PNG capture.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/expansion-failure.png' });
  console.log('Expansion browser errors:', errors);
  console.log(
    'Game state',
    await page.evaluate(async () => {
      const { game: g } = await import('/src/main.js');
      const hit = g.props.aim(g.view.camera);
      return {
        yaw: g.player.yaw,
        pitch: g.player.pitch,
        position: g.player.state.body.position.toArray(),
        camera: g.view.camera.position.toArray(),
        direction: g.direction().toArray(),
        hit: hit?.id,
        tool: g.toolId,
        mode: g.toolMode,
        locked: g.input.locked,
        toast: document.querySelector('#toast').textContent,
        props: JSON.stringify([...g.sim.entities.values()].map((e) => g.sim.serialize(e))),
      };
    }),
  );
  throw e;
} finally {
  await browser.close();
  await vite.close();
}
