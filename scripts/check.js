import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`])),
    )
  ).flat();
}
const paths = (await Promise.all(['client/src', 'shared', 'server', 'scripts', 'tests'].map(walk)))
  .flat()
  .filter((f) => /\.(m?js)$/.test(f));
for (const file of paths) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status) {
    process.stderr.write(result.stderr);
    process.exit(1);
  }
}
console.log(`Syntax checked ${paths.length} JavaScript modules.`);
