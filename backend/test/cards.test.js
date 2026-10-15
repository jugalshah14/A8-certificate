import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A throwaway database for this test file.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'a8-cards-'));
const { createEvent } = await import('../src/events.js');
const { createBatch, listCards, parseCode, claimableCard, assignCard, voidCard, nextBlankCard, cardStats } = await import('../src/cards.js');

const event = (name) => createEvent({ name, roles: [{ key: 'participant', label: 'Participant' }], fields: [] });

test('reads a code from a bare code or a scanned link', () => {
  assert.equal(parseCode('abcDEF2345'), 'abcDEF2345');
  assert.equal(parseCode(' https://cards.example.com/c/abcDEF2345?x=1 '), 'abcDEF2345');
  assert.equal(parseCode('http://10.0.0.5:5173/c/abcDEF2345/'), 'abcDEF2345');
});

test('batches number on from the last card of the event', () => {
  const ev = event('Numbering');
  const first = createBatch(ev.id, { count: 3, note: 'run 1' });
  const second = createBatch(ev.id, { count: 2 });
  assert.deepEqual([first.first, first.last, second.first, second.last], [1, 3, 4, 5]);
  assert.deepEqual(
    listCards({ eventId: ev.id }).map((c) => c.label),
    ['#0001', '#0002', '#0003', '#0004', '#0005']
  );
  assert.throws(() => createBatch(ev.id, { count: 0 }), /between 1 and/);
  assert.throws(() => createBatch('evt_missing', { count: 1 }), /Event not found/);
});

test('a card is issued once, to its own event only', () => {
  const ev = event('Claiming');
  const other = event('Other');
  createBatch(ev.id, { count: 3 });
  const [a, b, c] = listCards({ eventId: ev.id });

  assert.throws(() => claimableCard(a.code, other.id), /different event/);
  assert.equal(claimableCard(`https://x/c/${a.code}`, ev.id).code, a.code);

  assignCard(a.code, a.code, 'staff@example.com');
  assert.throws(() => claimableCard(a.code, ev.id), /already issued/);
  assert.throws(() => assignCard(a.code, 'someOtherId', null), /just used/);
  assert.throws(() => voidCard(a.code), /Revoke the certificate/);

  voidCard(b.code);
  assert.throws(() => claimableCard(b.code, ev.id), /voided/);

  assert.equal(nextBlankCard(ev.id).code, c.code);
  assert.deepEqual(cardStats(ev.id), { total: 3, issued: 1, voided: 1, blank: 1 });
});
