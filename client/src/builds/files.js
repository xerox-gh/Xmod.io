import { captureBuild, validateBuild, encodeBuild, decodeBuild } from '../../../shared/builds.js';
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadJSON(value, name) {
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), name);
}
export function currentBuild(game) {
  const ids = game.selection?.ids.size
    ? [...game.selection.ids]
    : [...game.sim.entities.values()]
        .filter((e) => game.owner === 'local' || e.owner === game.owner || e.owner === 'world')
        .map((e) => e.id);
  return captureBuild(game.sim, ids);
}
export async function importBuildFile(game, file) {
  if (!file) return;
  if (file.size > 262144) throw new Error('Build file is too large (256 KB maximum)');
  game.action({ kind: 'loadBuild', build: validateBuild(JSON.parse(await file.text())) });
}
export { encodeBuild, decodeBuild };
