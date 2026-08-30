import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from '../../lib/limiter.js';

test('run serializes calls and returns their results', async () => {
  const l = createLimiter({ minIntervalMs: 0, maxPerMinute: 100 });
  const order = [];
  const a = l.run(async () => { order.push('a'); return 1; });
  const b = l.run(async () => { order.push('b'); return 2; });
  assert.equal(await a, 1);
  assert.equal(await b, 2);
  assert.deepEqual(order, ['a', 'b']);
});

test('reportRejection opens a cooldown window', () => {
  const l = createLimiter({ cooldownMs: 600_000 });
  assert.equal(l.cooldownRemainingMs(), 0);
  l.reportRejection();
  assert.ok(l.cooldownRemainingMs() > 590_000);
});

test('a rejected task does not wedge the serialized chain', async () => {
  const l = createLimiter({ minIntervalMs: 0 });
  await assert.rejects(() => l.run(async () => { throw new Error('boom'); }));
  assert.equal(await l.run(async () => 'ok'), 'ok');
});

test('pending() reflects outstanding work', async () => {
  const l = createLimiter({ minIntervalMs: 0 });
  const p = l.run(async () => 'x');
  assert.ok(l.pending() >= 1);
  await p;
  assert.equal(l.pending(), 0);
});
