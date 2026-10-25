// Browser toybox extensions share data with the ordinary simulation and builds.
const prop = (name, category, size, color, behavior = {}, shape = 'box', mass = 6) => ({
  name,
  category,
  size,
  color,
  behavior,
  shape,
  mass,
  icon: '◇',
});
export const LAB_PROPS = {
  hoverball: prop(
    'Altitude hoverball',
    'Devices',
    [0.45],
    '#86e6d4',
    { hover: true, height: 4 },
    'sphere',
    2,
  ),
  glass: prop('Breakable glass pane', 'Destructibles', [3, 2.5, 0.12], '#b1e3ed', {
    breakable: true,
  }),
  pot: prop(
    'Ceramic pot',
    'Destructibles',
    [0.6, 1.3, 0.6],
    '#cf937e',
    { breakable: true },
    'cylinder',
  ),
  glass_shard: prop('Glass fragment', 'internal', [0.5, 0.5, 0.12], '#b1e3ed', {}, 'box', 0.3),
  ceramic_shard: prop('Pot fragment', 'internal', [0.24], '#cf937e', {}, 'sphere', 0.4),
  gravity_zone: prop('Gravity volume', 'Environment', [8, 6, 8], '#a58de4', {
    gx: 0,
    gy: 0,
    gz: 0,
  }),
  wing: prop('Glider airfoil', 'Devices', [5, 0.15, 1.5], '#dfdda5', { lift: 2 }, 'box', 4),
  telepad: prop('Momentum portal pad', 'Devices', [3, 0.2, 3], '#a78de8'),
  laser_sensor: prop('Ranger laser sensor', 'Wire', [0.65, 0.45, 0.65], '#e58b7e', { range: 20 }),
  proximity_sensor: prop('Proximity sensor', 'Wire', [0.65, 0.45, 0.65], '#deb989', { range: 8 }),
  speed_sensor: prop('Speedometer sensor', 'Wire', [0.65, 0.45, 0.65], '#90c6bf'),
  altimeter: prop('Altimeter sensor', 'Wire', [0.65, 0.45, 0.65], '#a7c3df'),
  logic_and: prop('AND chip', 'Wire', [0.8, 0.18, 0.8], '#a1cc90'),
  logic_or: prop('OR chip', 'Wire', [0.8, 0.18, 0.8], '#9bbfdd'),
  logic_not: prop('NOT chip', 'Wire', [0.8, 0.18, 0.8], '#d49abe'),
  logic_xor: prop('XOR chip', 'Wire', [0.8, 0.18, 0.8], '#e2c18d'),
  logic_clock: prop('Timer / clock chip', 'Wire', [0.8, 0.18, 0.8], '#a5a0da', { period: 1 }),
  logic_latch: prop('Toggle latch chip', 'Wire', [0.8, 0.18, 0.8], '#c8a2b0'),
  sound_emitter: prop('Synth sound emitter', 'Wire', [0.8, 0.7, 0.65], '#d3bd8d', {
    frequency: 220,
    waveform: 'sine',
  }),
  digital_screen: prop('Digital graph screen', 'Wire', [2.4, 1.5, 0.2], '#73b9ad', {
    text: 'SIGNAL',
    display: 'number',
  }),
  turret: prop('Gimbal / defense turret', 'Wire', [1.2, 1.2, 1.2], '#b1b894', { turret: false }),
  cctv: prop('CCTV camera', 'Optics', [0.65, 0.55, 1], '#9ebbbf'),
  monitor: prop('CCTV monitor', 'Optics', [2.4, 1.5, 0.25], '#7a999b'),
  mirror: prop('Mirror panel', 'Optics', [2.5, 3, 0.12], '#b4c9de'),
  nextbot: prop('Billboard chaser', 'Targets', [1, 2, 0.4], '#cf9d9b', {
    nextbot: true,
    speed: 12,
  }),
  core: prop('Defense core beacon', 'Gamemodes', [1.5, 2.5, 1.5], '#a6e7d2', { health: 100 }),
  checkpoint: prop('Race checkpoint', 'Gamemodes', [5, 4, 0.2], '#dcc897'),
  custom_model: prop('Imported model', 'internal', [1, 1, 1], '#b6cbd0'),
};
export const LAB_TOOLS = [
  ['hover', 'Hoverball'],
  ['winch', 'Winch'],
  ['hydraulic', 'Hydraulic'],
  ['pulley', 'Pulley'],
  ['upright', 'Keep Upright'],
  ['axis', 'Axis'],
  ['ballsocket', 'Ball Socket'],
  ['nocollide', 'No-Collide'],
  ['properties', 'Physical Properties'],
  ['magnet', 'Magnetize'],
  ['buoyancy', 'Buoyancy'],
  ['trail', 'Trails'],
  ['wire', 'Visual Wire'],
  ['portalLink', 'Link Teleporters'],
  ['cameraLink', 'Link CCTV'],
];
export const PAIR_TOOLS = [
  'winch',
  'hydraulic',
  'pulley',
  'axis',
  'ballsocket',
  'nocollide',
  'wire',
  'portalLink',
  'cameraLink',
];
export const LAB_JOINTS = [
  'winch',
  'hydraulic',
  'pulley',
  'axis',
  'ballsocket',
  'nocollide',
  'wire',
];
export const MATERIALS = {
  normal: { friction: 0.45, restitution: 0.12, density: 1, drag: 0.12 },
  rubber: { friction: 0.85, restitution: 0.95, density: 0.7, drag: 0.08 },
  ice: { friction: 0, restitution: 0.02, density: 1, drag: 0.005 },
  foam: { friction: 0.8, restitution: 0.1, density: 0.08, drag: 0.85 },
  lead: { friction: 0.6, restitution: 0, density: 8, drag: 0.08 },
};
export const LAB_DEFAULTS = {
  height: 4,
  speed: 3,
  bind: 'KeyJ',
  downBind: 'KeyK',
  material: 'rubber',
  strength: 12,
  radius: 10,
  buoyancy: 1.3,
  trail: 'rainbow',
  input: 'a',
  range: 15,
  gx: 0,
  gy: 0,
  gz: 0,
  zoneSize: 8,
  frequency: 220,
  waveform: 'sine',
  period: 1,
  text: 'SIGNAL',
  display: 'graph',
  faction: 'friendly',
  command: 'wander',
  npcWeapon: 'melee',
  targetX: 0,
  targetY: 2,
  targetZ: 0,
  turret: false,
};
const numeric = {
  height: [-20, 100],
  speed: [-25, 25],
  strength: [-30, 30],
  radius: [1, 25],
  buoyancy: [0, 5],
  range: [1, 60],
  gx: [-40, 40],
  gy: [-40, 40],
  gz: [-40, 40],
  zoneSize: [2, 30],
  frequency: [40, 2000],
  period: [0.1, 10],
  targetX: [-170, 170],
  targetY: [-30, 100],
  targetZ: [-170, 170],
  lift: [0, 8],
};
const enums = {
  material: Object.keys(MATERIALS),
  trail: ['off', 'light', 'smoke', 'rainbow'],
  input: ['a', 'b', 'x', 'y', 'z'],
  waveform: ['sine', 'square', 'sawtooth'],
  display: ['number', 'text', 'graph'],
  faction: ['red', 'blue', 'green', 'hostile', 'friendly'],
  command: ['wander', 'follow', 'guard'],
  npcWeapon: ['melee', 'ranged'],
  bind: ['KeyF', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI', 'KeyO'],
  downBind: ['KeyF', 'KeyJ', 'KeyK', 'KeyL', 'KeyU', 'KeyI', 'KeyO'],
};
export function cleanLabSettings(source = {}) {
  const out = {};
  for (const [key, [lo, hi]] of Object.entries(numeric))
    if (Number.isFinite(source[key])) out[key] = Math.max(lo, Math.min(hi, source[key]));
  for (const [key, values] of Object.entries(enums))
    if (values.includes(source[key])) out[key] = source[key];
  if (typeof source.text === 'string') out.text = source.text.slice(0, 80);
  for (const key of [
    'hover',
    'upright',
    'magnet',
    'turret',
    'breakable',
    'nextbot',
    'burning',
    'cryo',
    'hiding',
  ])
    if (typeof source[key] === 'boolean') out[key] = source[key];
  return out;
}
export function safeLabBehavior(source = {}) {
  const out = cleanLabSettings(source);
  for (const key of ['portal', 'camera', 'asset'])
    if (typeof source[key] === 'string' && /^[\w-]{1,64}$/.test(source[key]))
      out[key] = source[key];
  for (const key of ['char', 'burnTime', 'health', 'guardX', 'guardZ'])
    if (Number.isFinite(source[key])) out[key] = Math.max(-200, Math.min(200, source[key]));
  if (
    Array.isArray(source.polygon) &&
    source.polygon.length >= 3 &&
    source.polygon.length <= 12 &&
    source.polygon.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((n) => Number.isFinite(n) && Math.abs(n) < 10),
    )
  ) {
    const p = source.polygon,
      n = p.length,
      area = p.reduce((s, a, i) => s + a[0] * p[(i + 1) % n][1] - a[1] * p[(i + 1) % n][0], 0);
    const crosses = p.map((a, i) => {
      const b = p[(i + 1) % n],
        c = p[(i + 2) % n];
      return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    });
    if (Math.abs(area) > 1e-5 && crosses.every((c) => c >= -1e-7))
      out.polygon = p.map((a) => [...a]);
  }
  return out;
}
