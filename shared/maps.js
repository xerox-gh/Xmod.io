// Rendering and collision read the same level data. Add maps here and a visual factory in /client/src/maps.
export const FLATGRASS = {
  id: 'flatgrass',
  name: 'Flatgrass',
  spawn: [0, 2.2, 14],
  boxes: [
    // Four slabs leave a real opening for the sunken water pit.
    { p: [-67.5, -1, 0], s: [105, 2, 240], color: '#a2c380', ground: true },
    { p: [77.5, -1, 0], s: [85, 2, 240], color: '#a2c380', ground: true },
    { p: [10, -1, -52.5], s: [50, 2, 135], color: '#a2c380', ground: true },
    { p: [10, -1, 87.5], s: [50, 2, 65], color: '#a2c380', ground: true },
    { p: [10, -8, 35], s: [50, 2, 40], color: '#537d89' },
    { p: [-13.5, -4, 35], s: [3, 8, 40], color: '#78918e' },
    { p: [33.5, -4, 35], s: [3, 8, 40], color: '#78918e' },
    { p: [10, -4, 16.5], s: [50, 8, 3], color: '#78918e' },
    { p: [10, -4, 53.5], s: [50, 8, 3], color: '#78918e' },
    { p: [-20, 1.9, -12], s: [8, 0.8, 15], rx: -0.24, color: '#f3ad67' },
    { p: [-20, 3.7, -22], s: [8, 1, 6], color: '#f3ad67' },
    { p: [-35, 2.8, 1], s: [7, 0.8, 18], rx: 0.3, color: '#dcb786' },
    { p: [-35, 5.6, 12], s: [7, 1, 6], color: '#dcb786' },
    { p: [30, 0.3, -27], s: [17, 0.6, 16], color: '#dedbc9' },
    { p: [30, 6, -34.5], s: [17, 12, 0.6], color: '#e9e6d7' },
    { p: [21.8, 6, -27], s: [0.6, 12, 16], color: '#e9e6d7' },
    { p: [38.2, 6, -27], s: [0.6, 12, 16], color: '#e9e6d7' },
    { p: [30, 12, -27], s: [17, 0.6, 16], color: '#f4a974' },
    { p: [24.8, 6, -19.2], s: [6.5, 12, 0.6], color: '#e9e6d7' },
    { p: [35.2, 6, -19.2], s: [6.5, 12, 0.6], color: '#e9e6d7' },
    ...[0, 1, 2, 3, 4].map((i) => ({
      p: [-4 + i * 4, 0.5 + i * 0.65, -33 - i * 4],
      s: [3, 1, 3],
      color: '#a5bac0',
    })),
  ],
  water: { p: [10, -3, 35], s: [44, 34] },
};
// Terrain vertices are shared by the renderer and cannon-es heightfield collider.
const terrain = { vertices: [], indices: [] };
const cells = 40,
  spacing = 6;
for (let z = 0; z <= cells; z++)
  for (let x = 0; x <= cells; x++) {
    const wx = (x - cells / 2) * spacing,
      wz = (z - cells / 2) * spacing;
    const h =
      Math.hypot(wx, wz) < 20 ? 0 : 2.3 + Math.sin(wx * 0.055) * 3.4 + Math.sin(wz * 0.07) * 2.3;
    terrain.vertices.push(wx, h, wz);
  }
for (let z = 0; z < cells; z++)
  for (let x = 0; x < cells; x++) {
    const a = z * (cells + 1) + x,
      b = a + 1,
      c = a + cells + 1,
      d = c + 1;
    terrain.indices.push(a, c, b, b, c, d);
  }
const ground = { p: [0, -1, 0], s: [240, 2, 240], color: '#a4bd91', ground: true };
export const MAPS = {
  flatgrass: FLATGRASS,
  hills: {
    id: 'hills',
    name: 'Open hills',
    spawn: [0, 2.2, 12],
    boxes: [],
    terrain,
    water: null,
    theme: 'hills',
  },
  obstacle: {
    id: 'obstacle',
    name: 'Obstacle course',
    spawn: [0, 2.2, 25],
    water: null,
    boxes: [
      ground,
      ...Array.from({ length: 20 }, (_, i) => ({
        p: [Math.sin(i * 0.8) * 10, i * 0.42 + 1, 12 - i * 6],
        s: [4, 1, 4],
        color: i % 2 ? '#dfb987' : '#8eb8be',
      })),
      ...[-1, 1].map((x) => ({
        p: [x * 18, 3, -30],
        s: [3, 1, 35],
        rx: x * 0.18,
        color: '#d4a576',
      })),
    ],
  },
  city: {
    id: 'city',
    name: 'City block',
    spawn: [0, 2.2, 18],
    water: null,
    boxes: [
      { ...ground, color: '#a6b2ad' },
      { p: [0, 0.03, 0], s: [13, 0.08, 220], color: '#4b5f61' },
      { p: [0, 0.03, -25], s: [210, 0.08, 12], color: '#4b5f61' },
      ...[-1, 1].flatMap((side) =>
        Array.from({ length: 6 }, (_, i) => ({
          p: [side * (24 + (i % 2) * 8), (12 + (i % 3) * 8) / 2, i * 27 - 85],
          s: [18, 12 + (i % 3) * 8, 19],
          color: ['#c3bcad', '#aebec3', '#d1c4a9'][i % 3],
        })),
      ),
    ],
  },
  void: {
    id: 'void',
    name: 'The void',
    spawn: [0, 2.2, 6],
    water: null,
    boxes: [{ p: [0, -0.5, 0], s: [32, 1, 32], color: '#65788a', ground: true }],
    theme: 'void',
  },
};
