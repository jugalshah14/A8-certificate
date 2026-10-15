import crypto from 'node:crypto';
import { db } from './db.js';
import { getEvent } from './events.js';

// Same alphabet as certificate ids: no 0/O or 1/l/I, so printed codes stay readable.
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
export const MAX_BATCH = 1000;

const httpError = (status, message) => Object.assign(new Error(message), { status });

/** A new id that is unused as a card code and as a certificate id. */
export function newCode(length = 10) {
  const taken = db.prepare('SELECT 1 FROM cards WHERE code = ? UNION SELECT 1 FROM certificates WHERE id = ?');
  for (;;) {
    const code = Array.from(crypto.randomBytes(length), (b) => ALPHABET[b % ALPHABET.length]).join('');
    if (!taken.get(code, code)) return code;
  }
}

function rowToCard(row) {
  if (!row) return null;
  const status = row.voided_at ? 'void' : row.certificate_id ? 'issued' : 'blank';
  return {
    code: row.code,
    eventId: row.event_id,
    serial: row.serial,
    label: `#${String(row.serial).padStart(4, '0')}`,
    batchId: row.batch_id,
    batchNote: row.batch_note,
    createdAt: row.created_at,
    status,
    certificateId: row.certificate_id,
    recipientName: row.recipient_name ?? null,
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
    nfc: { uid: row.nfc_uid, writtenAt: row.nfc_written_at },
  };
}

const SELECT = `SELECT k.*, c.recipient_name FROM cards k LEFT JOIN certificates c ON c.id = k.certificate_id`;

/** Accepts a bare code or a scanned card URL such as https://host/c/<code>. */
export function parseCode(input) {
  const s = String(input || '').trim();
  const match = s.match(/\/c\/([A-Za-z0-9]+)\/?(?:[?#].*)?$/);
  return (match ? match[1] : s).replace(/[^A-Za-z0-9]/g, '');
}

export function getCard(code) {
  return rowToCard(db.prepare(`${SELECT} WHERE k.code = ?`).get(parseCode(code)));
}

export function listCards({ eventId, batchId, status } = {}) {
  const where = [];
  const args = [];
  if (eventId) {
    where.push('k.event_id = ?');
    args.push(eventId);
  }
  if (batchId) {
    where.push('k.batch_id = ?');
    args.push(batchId);
  }
  if (status === 'blank') where.push('k.certificate_id IS NULL AND k.voided_at IS NULL');
  if (status === 'issued') where.push('k.certificate_id IS NOT NULL');
  if (status === 'void') where.push('k.voided_at IS NOT NULL');
  const sql = `${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY k.event_id, k.serial LIMIT 5000`;
  return db.prepare(sql).all(...args).map(rowToCard);
}

export function listBatches(eventId) {
  return db
    .prepare(
      `SELECT batch_id, batch_note, MIN(created_at) AS created_at, MIN(serial) AS first, MAX(serial) AS last, COUNT(*) AS total,
              SUM(certificate_id IS NOT NULL) AS issued, SUM(voided_at IS NOT NULL) AS voided, SUM(nfc_written_at IS NOT NULL) AS nfc
       FROM cards WHERE event_id = ? GROUP BY batch_id, batch_note ORDER BY first DESC`
    )
    .all(eventId)
    .map((r) => ({
      batchId: r.batch_id,
      note: r.batch_note,
      createdAt: r.created_at,
      first: r.first,
      last: r.last,
      total: r.total,
      issued: r.issued,
      voided: r.voided,
      nfcWritten: r.nfc,
    }));
}

export function cardStats(eventId) {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS total, SUM(certificate_id IS NOT NULL) AS issued, SUM(voided_at IS NOT NULL) AS voided FROM cards WHERE event_id = ?`
    )
    .get(eventId);
  return { total: r.total, issued: r.issued || 0, voided: r.voided || 0, blank: r.total - (r.issued || 0) - (r.voided || 0) };
}

/** Creates a batch of blank cards for an event, numbered after the event's last card. */
export function createBatch(eventId, { count, note } = {}, actor) {
  if (!getEvent(eventId)) throw httpError(404, 'Event not found.');
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > MAX_BATCH) throw httpError(400, `Make between 1 and ${MAX_BATCH} cards at a time.`);
  const batchId = 'bat_' + crypto.randomBytes(5).toString('hex');
  const now = new Date().toISOString();
  const insert = db.prepare(
    'INSERT INTO cards (code, event_id, serial, batch_id, batch_note, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  db.exec('BEGIN IMMEDIATE');
  try {
    const { last } = db.prepare('SELECT COALESCE(MAX(serial), 0) AS last FROM cards WHERE event_id = ?').get(eventId);
    for (let i = 1; i <= n; i++) insert.run(newCode(), eventId, last + i, batchId, String(note || '').trim().slice(0, 80) || null, now, actor || null);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return listBatches(eventId).find((b) => b.batchId === batchId);
}

/** Checks a card can take a new certificate for this event; returns its code. */
export function claimableCard(input, eventId) {
  const code = parseCode(input);
  const card = getCard(code);
  if (!card) throw httpError(400, `No card with code ${code || '(empty)'}.`);
  if (card.eventId !== eventId) throw httpError(400, `Card ${card.label} belongs to a different event.`);
  if (card.status === 'void') throw httpError(400, `Card ${card.label} was voided.`);
  if (card.status === 'issued') throw httpError(409, `Card ${card.label} is already issued to ${card.recipientName || 'someone'}.`);
  return card;
}

/** Links a card to its certificate. Fails if another issue took the card first. */
export function assignCard(code, certificateId, actor) {
  const r = db
    .prepare('UPDATE cards SET certificate_id = ?, assigned_at = ?, assigned_by = ? WHERE code = ? AND certificate_id IS NULL AND voided_at IS NULL')
    .run(certificateId, new Date().toISOString(), actor || null, code);
  if (r.changes !== 1) throw httpError(409, 'That card was just used by someone else. Pick another card.');
}

export function voidCard(code) {
  const card = getCard(code);
  if (!card) throw httpError(404, 'Card not found.');
  if (card.status === 'issued') throw httpError(400, 'Issued cards cannot be voided. Revoke the certificate instead.');
  db.prepare('UPDATE cards SET voided_at = COALESCE(voided_at, ?) WHERE code = ?').run(new Date().toISOString(), card.code);
  return getCard(card.code);
}

export function recordCardNfc(code, uid) {
  const card = getCard(code);
  if (!card) throw httpError(404, 'Card not found.');
  db.prepare('UPDATE cards SET nfc_uid = ?, nfc_written_at = ? WHERE code = ?').run(String(uid || '').trim().slice(0, 64) || null, new Date().toISOString(), card.code);
  return getCard(card.code);
}

/** The next blank card of an event, lowest serial first. */
export function nextBlankCard(eventId) {
  return rowToCard(
    db.prepare(`${SELECT} WHERE k.event_id = ? AND k.certificate_id IS NULL AND k.voided_at IS NULL ORDER BY k.serial LIMIT 1`).get(eventId)
  );
}
