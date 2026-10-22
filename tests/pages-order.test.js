import test from 'node:test';
import assert from 'node:assert/strict';
import { waitForBranchPages } from '../scripts/pages-order.mjs';
test('game deploy waits for branch Pages on the same commit, ignoring unrelated workflows', async () => {
  let checks = 0,
    waits = 0;
  await waitForBranchPages({
    sha: 'current',
    listRuns: async () => [
      { head_sha: 'old', path: 'dynamic/pages/pages-build-deployment', status: 'in_progress' },
      { head_sha: 'current', path: '.github/workflows/ci.yml', status: 'in_progress' },
      {
        head_sha: 'current',
        path: 'dynamic/pages/pages-build-deployment',
        status: checks++ ? 'completed' : 'queued',
      },
    ],
    wait: async () => waits++,
  });
  assert.equal(waits, 1);
  assert.equal(checks, 2);
});
test('Actions-only Pages deployment proceeds and a stuck branch deploy is explicit', async () => {
  await waitForBranchPages({ sha: 'current', listRuns: async () => [] });
  await assert.rejects(
    waitForBranchPages({
      sha: 'current',
      attempts: 2,
      listRuns: async () => [
        {
          head_sha: 'current',
          path: 'dynamic/pages/pages-build-deployment',
          status: 'in_progress',
        },
      ],
      wait: async () => {},
    }),
    /did not finish/,
  );
});
