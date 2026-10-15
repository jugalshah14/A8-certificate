import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, fingerprintOf, chainIdOf } from '../src/fingerprint.js';

test('canonical JSON ignores key order', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: 'x' } }), canonicalJson({ a: { c: 'x', d: [1, { x: 1, y: 2 }] }, b: 1 }));
});

test('any change to the payload changes the fingerprint', () => {
  const payload = { id: 'abc', recipient: { name: 'Asha Patel' }, role: { label: 'Winner' } };
  const original = fingerprintOf(payload);
  assert.match(original, /^0x[0-9a-f]{64}$/);
  assert.equal(fingerprintOf(structuredClone(payload)), original);
  assert.notEqual(fingerprintOf({ ...payload, role: { label: '1st Runner-Up' } }), original);
  assert.notEqual(fingerprintOf({ ...payload, recipient: { name: 'Asha  Patel' } }), original);
});

test('chain ids are namespaced per certificate', () => {
  assert.notEqual(chainIdOf('abc'), chainIdOf('abd'));
  assert.equal(chainIdOf('abc'), chainIdOf('abc'));
});
