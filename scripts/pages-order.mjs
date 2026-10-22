import { pathToFileURL } from 'node:url';
// Repositories using branch publishing can also queue GitHub's built-in Jekyll
// deploy. Publish the Vite artifact after that run, so it cannot restore README.
export async function waitForBranchPages({
  listRuns,
  sha,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  attempts = 180,
}) {
  for (let i = 0; i < attempts; i++) {
    const runs = await listRuns();
    const pending = runs.some(
      (run) =>
        run.head_sha === sha &&
        run.path?.startsWith('dynamic/pages/') &&
        run.status !== 'completed',
    );
    if (!pending) return;
    if (i === 0) console.log('Waiting for branch Pages publishing before deploying the game…');
    await wait(2000);
  }
  throw new Error(
    'Branch Pages publishing did not finish; retry this deployment after it completes',
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { GITHUB_REPOSITORY: repo, GITHUB_SHA: sha, GITHUB_TOKEN: token } = process.env;
  if (!repo || !sha || !token)
    throw new Error('This script runs in GitHub Actions with actions:read permission');
  await waitForBranchPages({
    sha,
    listRuns: async () => {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/actions/runs?per_page=30`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) throw new Error(`Cannot inspect Pages publishing (${response.status})`);
      return (await response.json()).workflow_runs;
    },
  });
  console.log('Pages publishing order is clear.');
}
