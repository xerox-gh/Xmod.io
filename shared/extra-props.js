const prop = (name, category, shape, size, mass, color, icon = '▣', extra = {}) => ({
  name,
  category,
  shape,
  size,
  mass,
  color,
  icon,
  ...extra,
});
export const EXTRA_PROPS = {
  cabinet: prop('Workshop cabinet', 'Furniture', 'box', [1.5, 2.4, 0.7], 28, '#86b4ba'),
  bed: prop('Bouncy bed', 'Furniture', 'box', [2.1, 0.8, 3.3], 35, '#b8c9df'),
  desk: prop('Corner desk', 'Furniture', 'box', [3, 1.5, 1.5], 24, '#c3a279'),
  shelf: prop('Storage shelf', 'Furniture', 'box', [2.5, 3, 0.65], 24, '#9aab9b'),
  ramp: prop('Build ramp', 'Construction', 'ramp', [4, 2, 5], 50, '#d3ad77', '◩'),
  pipe: prop('Hollow pipe', 'Construction', 'pipe', [0.6, 3, 0.6], 15, '#b2c8c7', '◎'),
  tire: prop('Rubber tire', 'Construction', 'cylinder', [0.8, 0.5, 0.8], 9, '#354447', '⊙'),
  cone: prop('Traffic cone', 'Construction', 'cone', [0.6, 1.6, 0.6], 3, '#f0a16b', '▲'),
  explosive_barrel: prop(
    'Explosive barrel',
    'Behavior',
    'cylinder',
    [0.65, 1.8, 0.65],
    18,
    '#d36f65',
    '⚡',
    { behavior: { explosive: true } },
  ),
  trampoline: prop('Trampoline', 'Behavior', 'box', [4, 0.55, 3], 80, '#84b9a5', '↟', {
    anchored: true,
  }),
  conveyor: prop('Conveyor belt', 'Behavior', 'box', [3, 0.6, 5], 100, '#6d969b', '⇢', {
    anchored: true,
  }),
  button: prop('Toggle button', 'Behavior', 'box', [0.9, 0.4, 0.9], 4, '#e7a27c', '●', {
    anchored: true,
    behavior: { pressed: false },
  }),
  door: prop('Hinged door', 'Behavior', 'box', [1.7, 3, 0.2], 20, '#b7c68c', '▯', {
    assembly: true,
    behavior: { open: false },
  }),
  door_frame: prop('Door jamb', 'internal', 'box', [0.22, 3.4, 0.45], 20, '#728a86', '▯', {
    anchored: true,
  }),
  lamp: prop('Workshop lamp', 'Lighting', 'box', [0.6, 2.7, 0.6], 8, '#f4d28d', '☀', {
    behavior: { lit: true },
  }),
  neon: prop('Neon tube', 'Lighting', 'box', [3, 0.2, 0.2], 3, '#a986e9', '━', {
    behavior: { lit: true },
  }),
  target: prop('Range target', 'Targets', 'box', [1.5, 2.8, 0.35], 12, '#e8d7b8', '⊕', {
    anchored: true,
    behavior: { hits: 0 },
  }),
  npc: prop('Walking dummy', 'Targets', 'box', [0.7, 1, 0.4], 12, '#90c6a1', '♟', {
    assembly: true,
  }),
  boat: prop('Pond skiff', 'Vehicles', 'box', [2.4, 0.8, 4.8], 150, '#8fced4', '≈', {
    vehicle: 'boat',
    assembly: true,
  }),
  plane: prop('Skyhopper plane', 'Vehicles', 'box', [1.3, 1, 5.5], 120, '#e6d58e', '✈', {
    vehicle: 'plane',
    assembly: true,
  }),
  tank: prop('Crawler tank', 'Vehicles', 'box', [3.2, 1.1, 4.4], 420, '#9eaf7c', '▰', {
    vehicle: 'tank',
    assembly: true,
  }),
  bike: prop('Trail motorbike', 'Vehicles', 'box', [0.65, 0.8, 2.3], 85, '#c78e7e', '◉', {
    vehicle: 'bike',
    assembly: true,
  }),
};
