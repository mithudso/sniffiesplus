import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeProfileId, profileIdFromHref, profileIdFromAssetUrl, route, profileUrlForId,
} from '../../lib/dom.js';

test('normalizeProfileId extracts + lowercases 6+ hex', () => {
  assert.equal(normalizeProfileId('/profile/660DEE38d1ac42d4'), '660dee38d1ac42d4');
  assert.equal(normalizeProfileId('abc123'), 'abc123');
  assert.equal(normalizeProfileId('xyz'), null);
  assert.equal(normalizeProfileId(null), null);
});

test('profileIdFromHref pulls the id out of a /profile/ href (and /chat)', () => {
  assert.equal(profileIdFromHref('https://sniffies.com/profile/aaaaaa/chat'), 'aaaaaa');
  assert.equal(profileIdFromHref('/profile/deadbeef123'), 'deadbeef123');
  assert.equal(profileIdFromHref('/nope'), null);
});

test('profileIdFromAssetUrl decodes the avatar CDN path', () => {
  assert.equal(
    profileIdFromAssetUrl("url('https://profile.sniffiesassets.com/6930ac77f5a006d4/pic-thumb.jpeg')"),
    '6930ac77f5a006d4',
  );
  assert.equal(profileIdFromAssetUrl('https://site.sniffiesassets.com/default.png'), null);
});

test('route classifies the SPA states the site distinguishes', () => {
  assert.equal(route({ pathname: '/global-chat', href: 'https://sniffies.com/global-chat' }), 'global-chat');
  assert.equal(route({ pathname: '/profile/aaaaaa/chat', href: 'x' }), 'profile-chat');
  assert.equal(route({ pathname: '/profile/aaaaaa', href: 'https://sniffies.com/profile/aaaaaa' }), 'profile');
  assert.equal(route({ pathname: '/', href: 'https://sniffies.com/' }), 'map');
});

test('profileUrlForId builds canonical URL, falls back to root', () => {
  assert.equal(profileUrlForId('AbC123'), 'https://sniffies.com/profile/abc123');
  assert.equal(profileUrlForId('xyz'), 'https://sniffies.com/');
});
