import { buildFlatgrass } from './flatgrass.js';
export const mapFactories = { flatgrass: buildFlatgrass };
export function loadMap(id, scene) {
  if (!mapFactories[id]) throw new Error(`Unknown map: ${id}`);
  return mapFactories[id](scene);
}
