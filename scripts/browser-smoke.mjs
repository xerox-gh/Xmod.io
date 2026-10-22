import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { createGameServer } from '../server/server.js';
import { mkdir } from 'node:fs/promises';
// Real browser smoke: menu, pointer lock, catalog, commands, weapons and two peers.
const server = createGameServer();
const address = await server.listen(0, '127.0.0.1');
const vite = await createServer({
  server: {
    host: '127.0.0.1',
    port: 5177,
    proxy: {
      '/api': `http://127.0.0.1:${address.port}`,
      '/ws': { target: `ws://127.0.0.1:${address.port}`, ws: true },
    },
  },
});
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
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(e.message));
const base = 'http://127.0.0.1:5177';
async function play(p = page) {
  const button = p.locator('#play');
  if (await button.isVisible()) await button.click();
  await expect.poll(() => p.evaluate(() => !!document.pointerLockElement)).toBe(true);
  await expect(p.locator('#game')).toHaveAttribute('data-pointer-locked', 'true');
}
async function command(text, p = page) {
  await p.keyboard.press('Backquote');
  await expect(p.getByLabel('Console command')).toBeVisible();
  await p.getByLabel('Console command').fill(text);
  await p.getByLabel('Console command').press('Enter');
  await p.keyboard.press('Escape');
  await play(p);
}
try {
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'Big ideas. Zero rules.' })).toBeVisible();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/menu.png' });
  await page.locator('#settings').click();
  await page.getByRole('slider', { name: 'Field of view' }).fill('100');
  await page.locator('#back').click();
  await page.locator('#controls').click();
  await expect(page.getByText('Toggle noclip')).toBeVisible();
  await page.locator('#back').click();
  await play();
  await page.keyboard.press('KeyQ');
  await expect(page.locator('.catalog')).toBeVisible();
  await page.getByLabel('Search props').fill('barrel');
  await page.locator('[data-prop="barrel"]').click();
  await expect(page.locator('#body-count')).toContainText('7 /');
  await page.getByRole('button', { name: 'Close spawn menu' }).click();
  await play();
  await command('/spawn ragdoll');
  await expect(page.locator('#body-count')).toContainText('17 /');
  await page.keyboard.press('KeyZ');
  await expect(page.locator('#body-count')).toContainText('7 /');
  await page.keyboard.press('Digit5');
  await page.mouse.click(720, 450);
  await expect(page.locator('#tool-mode')).toContainText('11 / 12');
  await page.keyboard.press('Digit2');
  await page.keyboard.press('KeyR');
  await expect(page.locator('#tool-mode')).toContainText('Rope');
  await command('/gravity 0');
  await page.keyboard.press('KeyV');
  await expect(page.locator('#movement-status')).toContainText('NOCLIP');
  await page.keyboard.down('Space');
  await page.waitForTimeout(150);
  await page.keyboard.up('Space');
  await page.keyboard.press('KeyV');
  await command('/spawn car');
  await expect(page.locator('#body-count')).toContainText('8 /');
  await page.screenshot({ path: 'test-results/playground.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-screen')).toBeVisible();
  await page.locator('#multiplayer').click();
  await page.getByLabel('Player name').fill('BuilderA');
  await page.getByLabel('New room ID').fill('browser-smoke');
  await page.locator('#create-room').click();
  await expect.poll(() => server.rooms.get('browser-smoke')?.players.size).toBe(1);
  await play();
  const peer = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  peer.on('pageerror', (e) => errors.push(e.message));
  await peer.goto(base);
  await peer.locator('#multiplayer').click();
  await peer.getByLabel('Player name').fill('BuilderB');
  await peer.locator('.room-row').filter({ hasText: 'browser-smoke' }).click();
  await expect.poll(() => server.rooms.get('browser-smoke')?.players.size).toBe(2);
  await play(peer);
  await command('/spawn barrel', peer);
  await expect(peer.locator('#body-count')).toContainText('5 /');
  await expect(page.locator('#body-count')).toContainText('5 /');
  await peer.keyboard.press('KeyT');
  await peer.getByLabel('Chat message').fill('<b>hello playground</b>');
  await peer.getByLabel('Chat message').press('Enter');
  await expect(page.locator('.chat-log')).toContainText('<b>hello playground</b>');
  await expect(page.locator('.chat-log b')).toHaveCount(0);
  await peer.close();
  await expect.poll(() => server.rooms.get('browser-smoke')?.players.size).toBe(1);
  await expect(page.locator('#body-count')).toContainText('4 /');
  expect(errors).toEqual([]);
  console.log(
    'Browser smoke passed: UI, settings, pointer lock, spawning, undo, weapons, noclip, two-peer sync and escaped chat.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/failure.png' });
  console.log(
    'Browser failure state:',
    await page.evaluate(() => ({
      locked: !!document.pointerLockElement,
      focus: document.activeElement?.outerHTML,
      menuHidden: document.querySelector('.menu-screen').hidden,
      consoleHidden: document.querySelector('.console-panel').hidden,
    })),
  );
  throw error;
} finally {
  await browser.close();
  await vite.close();
  await server.close();
}
