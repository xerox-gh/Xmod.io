import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeServerUrl } from '../client/src/net/endpoint.js';
test('static hosting permits solo mode and validates a separately hosted server', () => {
  assert.equal(normalizeServerUrl(''), '');
  assert.equal(normalizeServerUrl('https://example.com/'), 'https://example.com');
  assert.equal(normalizeServerUrl('http://localhost:3001', 'http:'), 'http://localhost:3001');
  for (const address of [
    'http://example.com',
    'ws://example.com',
    'https://user:pass@example.com',
    'https://example.com/api',
    'https://example.com/?token=secret',
  ]) {
    assert.throws(() => normalizeServerUrl(address));
  }
});
