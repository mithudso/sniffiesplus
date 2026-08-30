import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSocketFrame, isSniffiesApiUrl } from '../../lib/observe.js';

test('decodeSocketFrame parses Socket.IO 42[event,data] frames', () => {
  assert.deepEqual(decodeSocketFrame('42["chat",{"a":1}]'), { event: 'chat', data: { a: 1 } });
});

test('decodeSocketFrame drops Engine.IO ping/pong numeric frames', () => {
  assert.equal(decodeSocketFrame('2'), null);
  assert.equal(decodeSocketFrame('3'), null);
});

test('decodeSocketFrame handles a single-element tuple, raw JSON, and double-encoding', () => {
  assert.deepEqual(decodeSocketFrame('42[{"x":1}]'), { event: '', data: { x: 1 } });
  assert.deepEqual(decodeSocketFrame('{"y":2}'), { event: '', data: { y: 2 } });
  // double-encoded: the tuple's data is a JSON string that itself parses to an object
  assert.deepEqual(decodeSocketFrame('42["evt","{\\"z\\":3}"]'), { event: 'evt', data: { z: 3 } });
});

test('decodeSocketFrame drops oversized and unparseable frames', () => {
  assert.equal(decodeSocketFrame('x'.repeat(1_500_001)), null);
  assert.equal(decodeSocketFrame('42[not json'), null);
  assert.equal(decodeSocketFrame(''), null);
});

test('isSniffiesApiUrl requires a real sniffies host AND /api/, resisting lookalikes', () => {
  assert.equal(isSniffiesApiUrl('https://usw.api.sniffies.com/api/user/partials'), true);
  assert.equal(isSniffiesApiUrl('https://sniffies.com/api/foo'), true);
  assert.equal(isSniffiesApiUrl('https://sniffies.com/notapi'), false);
  assert.equal(isSniffiesApiUrl('https://evil.example/api/?ref=sniffies.com'), false);
  assert.equal(isSniffiesApiUrl('https://sniffies.com.evil.example/api/'), false);
});
