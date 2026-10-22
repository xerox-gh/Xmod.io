import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// Serve only built files under a repository subpath, with no API or WebSocket server.
const app = express();
app.use('/Xmod.io', express.static(resolve('dist')));
const server = createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [],
  failures = [],
  apiRequests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (response.status() >= 400) failures.push(response.url());
});
page.on('request', (request) => {
  if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url());
});
try {
  const url = `http://127.0.0.1:${server.address().port}/Xmod.io/`;
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Big ideas. Zero rules.' })).toBeVisible();
  await page.locator('#play').click();
  await expect(page.locator('#game')).toHaveAttribute('data-pointer-locked', 'true');
  await page.keyboard.press('KeyQ');
  await expect(page.locator('.catalog')).toBeVisible();
  await page.locator('[data-prop="barrel"]').click();
  await expect(page.locator('#body-count')).toContainText('7 /');
  await page.getByRole('button', { name: 'Close spawn menu' }).click();
  await expect(page.locator('#game')).toHaveAttribute('data-pointer-locked', 'true');
  await page.keyboard.press('KeyV');
  await expect(page.locator('#movement-status')).toContainText('NOCLIP');
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-screen')).toBeVisible();
  await page.locator('#multiplayer').click();
  await expect(page.locator('#room-status')).toContainText('Solo play is ready');
  await expect(page.locator('#create-room')).toBeDisabled();
  await expect(page.getByLabel('Multiplayer server URL')).toHaveValue('');
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/pages.png' });
  expect(errors).toEqual([]);
  expect(failures).toEqual([]);
  expect(apiRequests).toEqual([]);
  console.log(
    'Pages smoke passed: built assets load below /Xmod.io/, solo spawning/noclip work, and no backend is required.',
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
