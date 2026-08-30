import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLastActiveTs, extractAttitudeFromPartial, createApi, PARTIALS_BODY_SHAPES } from '../../lib/api.js';
import { createLimiter } from '../../lib/limiter.js';

test('computeLastActiveTs = min(now, max(connect, disconnect)) and clamps the future', () => {
  assert.equal(computeLastActiveTs({ data: { connectUpdateTime: 1000, disconnectTime: 2000 } }, 5000), 2000);
  assert.equal(computeLastActiveTs({ connectUpdateTime: 99999 }, 5000), 5000); // future clamped to now
  assert.equal(computeLastActiveTs({}, 5000), 0);
  assert.equal(computeLastActiveTs(null, 5000), 0);
});

test('extractAttitudeFromPartial distinguishes absent from explicit null', () => {
  assert.equal(extractAttitudeFromPartial({ data: { profile: { extended: { sexuality: { attitude: 'top' } } } } }), 'top');
  assert.equal(extractAttitudeFromPartial({ data: { profile: { extended: { sexuality: { attitude: null } } } } }), null);
  assert.equal(extractAttitudeFromPartial({ data: { profile: { extended: { sexuality: {} } } } }), undefined);
  assert.equal(extractAttitudeFromPartial({}), undefined);
});

test('getPartials probes body shapes and remembers the one that returns an array', async () => {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    seen.push(Object.keys(body).length ? Object.keys(body)[0] : 'array');
    // Only the third shape ('ids') returns an array; earlier shapes return a non-array object.
    if (Object.prototype.hasOwnProperty.call(body, 'ids')) {
      return { ok: true, status: 200, json: async () => [{ _id: 'aaaaaa' }] };
    }
    return { ok: true, status: 200, json: async () => ({ error: 'wrong shape' }) };
  };
  const remembered = {};
  const api = createApi({ bases: ['https://usw.api.sniffies.com/api/user/partials'], remember: (k, v) => { remembered[k] = v; } });
  const rows = await api.getPartials(['aaaaaa']);
  assert.deepEqual(rows, [{ _id: 'aaaaaa' }]);
  assert.deepEqual(seen, ['userIds', 'profileIds', 'ids']); // probed in order until array
  assert.equal(remembered.partialsShape, 'ids');
  assert.equal(api.preferredShape, 'ids');
});

test('getPartials caps a batch at 50 ids', async () => {
  let sentCount = -1;
  globalThis.fetch = async (url, init) => {
    sentCount = JSON.parse(init.body).userIds.length;
    return { ok: true, status: 200, json: async () => [] };
  };
  const api = createApi({ bases: ['https://usw.api.sniffies.com/api/user/partials'] });
  await api.getPartials(Array.from({ length: 200 }, (_, i) => String(i).padStart(6, '0')));
  assert.equal(sentCount, 50);
});

test('a 429 routes through the limiter cooldown and stops probing', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return { ok: false, status: 429, json: async () => ({}) }; };
  const limiter = createLimiter();
  const api = createApi({ bases: ['https://usw.api.sniffies.com/api/user/partials'], limiter });
  await assert.rejects(() => api.getPartials(['aaaaaa']));
  assert.equal(calls, 1); // bailed on the first 429, did not keep probing shapes/bases
  assert.ok(limiter.cooldownRemainingMs() > 0); // cooldown opened
});

test('PARTIALS_BODY_SHAPES is the documented probe order', () => {
  assert.deepEqual(PARTIALS_BODY_SHAPES, ['userIds', 'profileIds', 'ids', 'array']);
});
