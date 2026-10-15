import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, fieldsForRole } from '../src/events.js';

const base = {
  name: 'Code Sprint',
  roles: [
    { key: 'champion', label: 'Champion', tier: 'gold' },
    { key: 'mentor', label: 'Mentor', fields: ['track', 'missing'] },
  ],
  fields: [
    { key: 'track', label: 'Track', type: 'select', options: ['AI', 'Climate'] },
    { key: 'project', label: 'Project' },
  ],
};

test('fills defaults and keeps only known role fields', () => {
  const e = normalizeEvent(base);
  assert.equal(e.roles[1].tier, 'rose');
  assert.deepEqual(e.roles[1].fields, ['track']);
  assert.equal(e.theme.headingFont, 'Noto Sans');
  assert.equal(e.authSponsor, null);
});

test('a role with no field list asks every field', () => {
  const e = normalizeEvent(base);
  assert.deepEqual(fieldsForRole(e, e.roles[0]).map((f) => f.key), ['track', 'project']);
  assert.deepEqual(fieldsForRole(e, e.roles[1]).map((f) => f.key), ['track']);
});

test('rejects bad configs with every problem listed', () => {
  assert.throws(
    () => normalizeEvent({ name: '', roles: [], fields: [{ key: 'A B', label: '', type: 'select' }] }),
    (err) => err.status === 400 && err.problems.length >= 4
  );
});

test('drops unsafe image URLs', () => {
  const e = normalizeEvent({ ...base, images: { emblem: 'javascript:alert(1)', hero: '/media/x.png' } });
  assert.equal(e.images.emblem, '');
  assert.equal(e.images.hero, '/media/x.png');
});
