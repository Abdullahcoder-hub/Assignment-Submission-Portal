import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeBackendUrl, validateBackendList } from '../src/utils/backendRegistry.js';

test('normalizes valid backend origins and API URLs', () => {
  assert.equal(normalizeBackendUrl('https://primary.example.com/'), 'https://primary.example.com');
  assert.equal(normalizeBackendUrl('https://backup.example.com/api'), 'https://backup.example.com');
});

test('rejects malformed or credential-bearing backend URLs', () => {
  for (const url of [
    'not-a-url',
    'http://backend.example.com',
    'https://user:password@backend.example.com',
    'https://backend.example.com/api?token=secret',
    'https://backend.example.com/private',
  ]) {
    assert.throws(() => normalizeBackendUrl(url), undefined, url);
  }
});

test('validates and orders the configured primary and backups', () => {
  const backends = validateBackendList([
    { url: 'https://backup.example.com', enabled: true, priority: 1, isPrimary: false },
    { url: 'https://primary.example.com', enabled: true, priority: 0, isPrimary: true },
  ]);

  assert.deepEqual(backends.map(({ url, priority, isPrimary }) => ({ url, priority, isPrimary })), [
    { url: 'https://primary.example.com', priority: 0, isPrimary: true },
    { url: 'https://backup.example.com', priority: 1, isPrimary: false },
  ]);
});

test('rejects duplicate URLs, duplicate priorities, and a disabled primary', () => {
  assert.throws(() => validateBackendList([
    { url: 'https://same.example.com', enabled: true, priority: 0, isPrimary: true },
    { url: 'https://same.example.com/api', enabled: true, priority: 1, isPrimary: false },
  ]), /unique/);

  assert.throws(() => validateBackendList([
    { url: 'https://primary.example.com', enabled: true, priority: 0, isPrimary: true },
    { url: 'https://backup.example.com', enabled: true, priority: 0, isPrimary: false },
  ]), /unique priority/);

  assert.throws(() => validateBackendList([
    { url: 'https://primary.example.com', enabled: false, priority: 0, isPrimary: true },
  ]), /primary backend must be enabled/);
});
