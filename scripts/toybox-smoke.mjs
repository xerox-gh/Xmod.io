import { createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
const vite = await createServer({ server: { host: '127.0.0.1', port: 5186 } });
await vite.listen();
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-features=WebRtcHideLocalIpsWithMdns',
  ],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  acceptDownloads: true,
});
await context.addInitScript(() =>
  localStorage.setItem(
    'xmod.settings',
    JSON.stringify({ quality: 'low', shadows: false, pixelRatio: 1, volume: 0 }),
  ),
);
const page = await context.newPage(),
  errors = [];
let peerPages = [];
const watch = (p) => p.on('pageerror', (e) => errors.push(e.message));
watch(page);
const base = 'http://127.0.0.1:5186';
const game = (p, fn, arg) =>
  p.evaluate(
    async ({ source, arg }) => {
      const { game: g } = await import('/src/main.js');
      return new Function('g', 'arg', `return (${source})(g,arg)`)(g, arg);
    },
    { source: fn.toString(), arg },
  );
const rendered = (p) =>
  p.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
async function open(tab, p = page) {
  await game(p, (g, tab) => g.lab.open(tab), tab);
  await expect(p.locator(`[data-labtab="${tab}"]`)).toHaveClass(/active/);
}
async function aimClick(p, id) {
  await game(
    p,
    (g, id) => {
      const e = g.sim.entities.get(id),
        camera = g.view.camera,
        delta = e.body.position.vsub(g.player.state.body.position);
      delta.y -= 0.65;
      g.player.yaw = Math.atan2(-delta.x, -delta.z);
      g.player.pitch = Math.asin(delta.y / delta.length());
      g.input.dx = g.input.dy = 0;
      g.player.updateCamera(0);
      camera.updateMatrixWorld(true);
      for (const mesh of g.props.meshes.values()) mesh.updateMatrixWorld(true);
      g.input.canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
      g.input.canvas.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
    },
    id,
  );
  await rendered(p);
}
function triangleGLTF() {
  const positions = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0, 1, 0]);
  return JSON.stringify({
    asset: { version: '2.0' },
    buffers: [
      {
        uri:
          'data:application/octet-stream;base64,' +
          Buffer.from(positions.buffer).toString('base64'),
        byteLength: 36,
      },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [-0.5, 0, 0],
        max: [0.5, 1, 0],
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  });
}
try {
  await mkdir('test-results', { recursive: true });
  await page.goto(base);
  await page.locator('#toybox').click();
  await expect(page.getByRole('heading', { name: 'The Toybox' })).toBeVisible();
  await page.locator('#spawn-hoverball').click();
  await expect.poll(() => game(page, (g) => g.sim.entities.size)).toBe(7);
  await page.getByLabel('Advanced tool').selectOption('properties');
  await page.getByLabel('Physics material').selectOption('lead');
  await page.locator('#lab-configure').click();
  expect(await game(page, (g) => g.sim.entities.get(g.lab.target).body.mass)).toBe(16);
  await open('wiring');
  await page.locator('#spawn-logic_clock').click();
  const clock = await game(page, (g) => g.lab.target);
  await page.locator('#spawn-digital_screen').click();
  const screen = await game(page, (g) => g.lab.target);
  await game(
    page,
    (g, ids) => {
      g.action({ kind: 'time', value: 0 });
      g.player.state.body.position.set(0, 2, 10);
      ids.forEach((id, i) => {
        const e = g.sim.entities.get(id);
        e.body.position.set(i ? 2 : -2, 2, 4);
        g.action({ kind: 'freeze', id });
      });
    },
    [clock, screen],
  );
  await page.locator('#lab-wire').click();
  await expect(page.locator('#game')).toHaveAttribute('data-pointer-locked', 'true');
  await aimClick(page, clock);
  await aimClick(page, screen);
  await expect
    .poll(() =>
      game(page, (g) => [...g.sim.constraints.values()].filter((c) => c.type === 'wire').length),
    )
    .toBe(1);
  await game(page, (g) => g.action({ kind: 'time', value: 1 }));
  await expect
    .poll(() =>
      game(page, (g, id) => g.lab.visuals.records.get(id)?.texture?.isCanvasTexture, screen),
    )
    .toBe(true);
  await open('garage');
  await page.getByLabel('Garage save name').fill('Wire workshop');
  await page.locator('#garage-save').click();
  await expect(page.locator('.garage-card strong')).toHaveText('Wire workshop');
  const count = await game(page, (g) => g.sim.entities.size);
  await page.locator('#build-link').click();
  await expect(page.getByLabel('Build link')).toHaveValue(/#build=g\./);
  const url = await page.getByLabel('Build link').inputValue();
  const cardDownload = page.waitForEvent('download');
  await page.locator('#garage-card').click();
  const card = await cardDownload,
    cardBytes = await readFile(await card.path());
  expect(cardBytes.length).toBeGreaterThan(1000);
  await game(page, (g) => g.action({ kind: 'clear' }));
  await page
    .locator('#asset-files')
    .setInputFiles({ name: 'build.png', mimeType: 'image/png', buffer: cardBytes });
  await expect.poll(() => game(page, (g) => g.sim.entities.size)).toBe(count);
  await page.reload();
  await page.locator('#toybox').click();
  await open('garage');
  await expect(page.locator('.garage-card strong')).toHaveText('Wire workshop');
  await page.locator('.garage-card').getByRole('button', { name: 'Load', exact: true }).click();
  await expect.poll(() => game(page, (g) => g.sim.entities.size)).toBe(count + 6);
  const linked = await context.newPage();
  watch(linked);
  await linked.goto(url);
  await expect
    .poll(() =>
      game(linked, (g) => [...g.sim.constraints.values()].filter((c) => c.type === 'wire').length),
    )
    .toBe(1);
  await linked.close();
  await page.locator('#asset-files').setInputFiles({
    name: 'triangle.gltf',
    mimeType: 'model/gltf+json',
    buffer: Buffer.from(triangleGLTF()),
  });
  await expect
    .poll(() =>
      game(page, (g) => [...g.sim.entities.values()].some((e) => e.type === 'custom_model')),
    )
    .toBe(true);
  expect(
    await game(
      page,
      (g) =>
        [...g.sim.entities.values()].find((e) => e.type === 'custom_model').body.shapes[0]
          .halfExtents.x,
    ),
  ).toBeGreaterThan(1);
  await open('actors');
  const imageBytes = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ab82bc';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#ecf3d9';
      ctx.fillRect(10, 12, 12, 20);
      ctx.fillRect(42, 12, 12, 20);
      return c.toDataURL('image/png').split(',')[1];
    }),
    'base64',
  );
  await page
    .locator('#chaser-image')
    .setInputFiles({ name: 'chaser.png', mimeType: 'image/png', buffer: imageBytes });
  await expect
    .poll(() => game(page, (g) => [...g.sim.entities.values()].some((e) => e.type === 'nextbot')))
    .toBe(true);
  await open('camera');
  for (const filter of ['crt', 'vhs', 'night', 'pixel', 'comic', 'none']) {
    await page.getByLabel('Camera filter').selectOption(filter);
    await rendered(page);
  }
  await page.locator('#spawn-cctv').click();
  const cctv = await game(page, (g) => g.lab.target);
  await page.locator('#spawn-monitor').click();
  const monitor = await game(page, (g) => g.lab.target);
  await page.locator('#spawn-mirror').click();
  const mirror = await game(page, (g) => g.lab.target);
  await game(
    page,
    (g, ids) => {
      ids.forEach((id, i) => {
        const e = g.sim.entities.get(id);
        e.body.position.set(i === 2 ? -4 : 0, i === 0 ? 5 : 2, i === 0 ? 10 : 4);
        if (!e.frozen) g.action({ kind: 'freeze', id });
      });
      g.action({ kind: 'tool', mode: 'cameraLink', id: ids[0], other: ids[1] });
    },
    [cctv, monitor, mirror],
  );
  await expect
    .poll(() =>
      game(
        page,
        (g) =>
          [...g.lab.visuals.optics.records.values()].filter((r) => r.target || r.reflector).length,
      ),
    )
    .toBe(2);
  await rendered(page);
  expect(
    await game(
      page,
      (g, id) => {
        const r = g.lab.visuals.optics.records.get(id),
          pixels = new Uint8Array(256 * 144 * 4);
        g.view.renderer.readRenderTargetPixels(r.target, 0, 0, 256, 144, pixels);
        const colors = new Set();
        for (let i = 0; i < pixels.length; i += 16)
          colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
        return colors.size;
      },
      monitor,
    ),
    { timeout: 15000 },
  ).toBeGreaterThan(4);
  await page.screenshot({ path: 'test-results/toybox-camera.png' });
  await open('modes');
  await page.getByLabel('Mini-gamemode').selectOption('lava');
  await page.locator('#start-mode').click();
  await expect(page.locator('.mode-hud')).toContainText('Rising Lava');
  await expect.poll(() => game(page, (g) => g.sim.lab.modes.state.lava)).toBeGreaterThan(0);
  await open('modes');
  await page.getByLabel('Mini-gamemode').selectOption('horde');
  await page.locator('#start-mode').click();
  await expect.poll(() => game(page, (g) => g.sim.lab.modes.state.wave)).toBe(1);
  await open('modes');
  await page.locator('#stop-mode').click();
  await open('garage');
  await page.screenshot({ path: 'test-results/toybox-garage.png' });
  await context.close();
  // Two real browser contexts exchange manual SDP codes. No WebSocket server,
  // signaling endpoint, STUN, TURN or database participates in this connection.
  if (!process.env.XMOD_SKIP_PEER_TEST) {
    const direct = await browser.newContext({ viewport: { width: 1120, height: 740 } });
    await direct.addInitScript(() =>
      localStorage.setItem(
        'xmod.settings',
        JSON.stringify({ quality: 'low', shadows: false, pixelRatio: 1, volume: 0 }),
      ),
    );
    const host = await direct.newPage(),
      guest = await direct.newPage();
    peerPages = [host, guest];
    watch(host);
    watch(guest);
    await host.goto(base);
    await guest.goto(base);
    await open('peers', host);
    await open('peers', guest);
    await host.getByLabel('Peer name').fill('Local host');
    await host.locator('#peer-offer').click();
    await expect(host.getByLabel('Outgoing peer code')).toHaveValue(/^XMODP2P1\./, {
      timeout: 15000,
    });
    const offer = await host.getByLabel('Outgoing peer code').inputValue();
    await guest.getByLabel('Peer name').fill('Direct guest');
    await guest.getByLabel('Incoming peer code').fill(offer);
    await guest.locator('#peer-answer').click();
    await expect(guest.getByLabel('Outgoing peer code')).toHaveValue(/^XMODP2P1\./, {
      timeout: 15000,
    });
    await host
      .getByLabel('Incoming peer code')
      .fill(await guest.getByLabel('Outgoing peer code').inputValue());
    await host.locator('#peer-finish').click();
    await expect.poll(() => game(guest, (g) => g.net.connected), { timeout: 20000 }).toBe(true);
    expect(await game(host, (g) => g.lab.peers.pc.getConfiguration().iceServers.length)).toBe(0);
    await game(guest, (g) => g.action({ kind: 'spawn', prop: 'barrel', p: [4, 2, 9] }));
    await expect.poll(() => game(host, (g) => g.sim.entities.size)).toBe(7);
    await expect.poll(() => game(guest, (g) => g.sim.entities.size)).toBe(7);
    await game(host, (g) => g.action({ kind: 'mode', mode: 'hunt', role: 'hunter' }));
    await expect.poll(() => game(guest, (g) => g.lab.remoteMode?.id)).toBe('hunt');
    await expect.poll(() => game(guest, (g) => g.lab.remoteMode?.players.peer.role)).toBe('hider');
    await game(guest, (g) => {
      const e = [...g.sim.entities.values()].find((e) => e.type === 'barrel');
      g.action({ kind: 'modeAction', op: 'disguise', id: e.id });
    });
    await expect.poll(() => game(guest, (g) => g.actor.disguise?.type)).toBe('barrel');
    await game(host, (g) => {
      g.actor.state.body.position.set(0, 2, 15);
      g.lab.peers.actor.state.body.position.set(0, 2, 8);
      g.actor.state.yaw = 0;
      g.actor.state.pitch = 0;
      g.action({ kind: 'fire', weapon: 'pistol' });
    });
    await expect.poll(() => game(guest, (g) => g.actor.health)).toBe(75);
    await host.screenshot({ path: 'test-results/toybox-peers.png' });
    await direct.close();
  } else
    console.log(
      'Direct peer portion skipped explicitly: this executor denies WebRTC sockets. CI must run it without XMOD_SKIP_PEER_TEST.',
    );
  expect(errors).toEqual([]);
  console.log(
    'Toybox browser passed: advanced tools, physical material, visual wires/screens, IndexedDB reload, gzip links, PNG save cards, local glTF/image imports, shader filters, CCTV/mirror, modes.' +
      (process.env.XMOD_SKIP_PEER_TEST
        ? ' Peer socket checks deferred explicitly.'
        : ' Direct server-free peer physics, disguises and health passed.'),
  );
} catch (error) {
  if (!page.isClosed()) {
    await page.screenshot({ path: 'test-results/toybox-failure.png' });
    console.log(
      'Toybox state:',
      await game(page, (g) => ({
        tool: g.toolId,
        target: g.lab.target,
        overlay: g.overlay,
        toast: g.root.querySelector('#toast').textContent,
        entities: g.sim.entities.size,
      })),
    );
  }
  for (let i = 0; i < peerPages.length; i++)
    if (!peerPages[i].isClosed()) {
      await peerPages[i].screenshot({ path: `test-results/toybox-peer-${i}-failure.png` });
      console.log(
        'Peer state:',
        await game(peerPages[i], (g) => ({
          status: g.lab.peers.status,
          ice: g.lab.peers.pc?.iceGatheringState,
          candidates: (g.lab.peers.pc?.localDescription?.sdp.match(/a=candidate:/g) || []).length,
          toast: g.root.querySelector('#toast').textContent,
          connected: g.net.connected,
          role: g.lab.peers.role,
          owner: g.owner,
          health: g.actor.health,
          mode: g.lab.remoteMode || g.sim.lab.modes.snapshot(),
        })),
      );
    }
  console.log('Toybox browser errors:', errors);
  throw error;
} finally {
  await browser.close();
  await vite.close();
}
