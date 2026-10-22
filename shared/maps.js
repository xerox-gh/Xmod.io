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
export const MAPS = { flatgrass: FLATGRASS };
