import crypto from 'node:crypto';
import { db, json } from './db.js';
import { getEvent, fieldsForRole } from './events.js';
import { saveMedia, hashOfMedia } from './media.js';
import { fingerprintOf, chainIdOf } from './fingerprint.js';
import { issueOnChain, readOnChain, revokeOnChain, explorerTxUrl } from './chain.js';

// No 0/O or 1/l/I, so ids stay readable when printed on a card.
const ID_ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

function newId(length = 10) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('');
}

const httpError = (status, message) => Object.assign(new Error(message), { status });

function cleanValue(field, raw) {
  const value = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
  if (!value) {
    if (field.required) throw httpError(400, `${field.label} is required.`);
    return '';
  }
  const max = field.type === 'textarea' ? 2000 : 200;
  if (value.length > max) throw httpError(400, `${field.label} is too long (max ${max} characters).`);
  if (field.type === 'select' && !field.options.includes(value)) throw httpError(400, `${field.label}: pick one of the options.`);
  if (field.type === 'number' && !Number.isFinite(Number(value))) throw httpError(400, `${field.label} must be a number.`);
  if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw httpError(400, `${field.label} must be a date.`);
  return value;
}

function rowToCertificate(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    roleKey: row.role_key,
    recipientName: row.recipient_name,
    payload: json.parse(row.payload),
    fingerprint: row.fingerprint,
    couponCode: row.coupon_code,
    issuedAt: row.issued_at,
    chain: {
      status: row.chain_status,
      error: row.chain_error,
      chainId: row.chain_id,
      contract: row.contract,
      txHash: row.tx_hash,
      txUrl: explorerTxUrl(row.tx_hash),
      blockNumber: row.block_number,
    },
    nfc: { uid: row.nfc_uid, writtenAt: row.nfc_written_at },
    revokedAt: row.revoked_at,
    issuedBy: row.issued_by,
  };
}

export function getCertificate(id) {
  return rowToCertificate(db.prepare('SELECT * FROM certificates WHERE id = ?').get(id));
}

export function listCertificates({ eventId, q } = {}) {
  const where = [];
  const args = [];
  if (eventId) {
    where.push('event_id = ?');
    args.push(eventId);
  }
  if (q) {
    where.push('(recipient_name LIKE ? OR id = ?)');
    args.push(`%${q}%`, q);
  }
  const sql = `SELECT * FROM certificates ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY issued_at DESC LIMIT 500`;
  return db.prepare(sql).all(...args).map(rowToCertificate);
}

/**
 * Issues a certificate: validates the form against the event's own field
 * definitions, freezes a payload, stores it, then records its fingerprint
 * on-chain. If the chain is unreachable the certificate stays "pending" and
 * can be anchored later.
 */
export async function issueCertificate({ eventId, roleKey, recipientName, values = {}, couponCode }, files = {}, actor = null) {
  const event = getEvent(eventId);
  if (!event) throw httpError(404, 'Event not found.');
  const role = event.roles.find((r) => r.key === roleKey);
  if (!role) throw httpError(400, 'Pick a role for this event.');

  const name = String(recipientName || '').trim().replace(/\s+/g, ' ');
  if (!name) throw httpError(400, 'Recipient name is required.');
  if (name.length > 80) throw httpError(400, 'Recipient name is too long (max 80 characters).');

  const fields = fieldsForRole(event, role).map((f) => ({
    key: f.key,
    label: f.label,
    display: f.display,
    value: cleanValue(f, values[f.key]),
  }));

  const media = {};
  for (const key of ['photo', 'cardFront', 'cardBack']) {
    const file = files[key]?.[0];
    media[key] = file ? saveMedia(file.buffer, file.mimetype) : null;
  }

  const id = newId();
  const issuedAt = new Date().toISOString();
  const payload = {
    v: 1,
    id,
    issuedAt,
    issuer: 'Authentic8',
    event: { id: event.id, name: event.name, round: event.round, date: event.date, venue: event.venue, city: event.city },
    role: { key: role.key, label: role.label, tier: role.tier },
    recipient: { name },
    fields: fields.filter((f) => f.value !== ''),
    media,
  };
  const fingerprint = fingerprintOf(payload);
  const coupon = String(couponCode || '').trim().slice(0, 40) || event.authSponsor?.code || null;

  db.prepare(
    `INSERT INTO certificates (id, event_id, role_key, recipient_name, payload, fingerprint, coupon_code, issued_at, issued_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, event.id, role.key, name, json.stringify(payload), fingerprint, coupon, issuedAt, actor ? actor.email || actor.name : null);

  return anchorCertificate(id);
}

export async function anchorCertificate(id) {
  const cert = getCertificate(id);
  if (!cert) throw httpError(404, 'Certificate not found.');
  if (cert.chain.status === 'anchored') return cert;
  try {
    const r = await issueOnChain(chainIdOf(id), cert.fingerprint);
    db.prepare(
      `UPDATE certificates SET chain_status = 'anchored', chain_error = NULL, chain_id = ?, contract = ?, tx_hash = ?, block_number = ? WHERE id = ?`
    ).run(r.chainId, r.contract, r.txHash, r.blockNumber, id);
  } catch (err) {
    const message = err.shortMessage || err.message || 'Blockchain unavailable';
    db.prepare(`UPDATE certificates SET chain_status = 'pending', chain_error = ? WHERE id = ?`).run(message.slice(0, 300), id);
  }
  return getCertificate(id);
}

export async function revokeCertificate(id) {
  const cert = getCertificate(id);
  if (!cert) throw httpError(404, 'Certificate not found.');
  if (cert.revokedAt) return cert;
  if (cert.chain.status === 'anchored') await revokeOnChain(chainIdOf(id));
  db.prepare('UPDATE certificates SET revoked_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  return getCertificate(id);
}

export function recordNfcWrite(id, uid) {
  const cert = getCertificate(id);
  if (!cert) throw httpError(404, 'Certificate not found.');
  const clean = String(uid || '').trim().slice(0, 64) || null;
  db.prepare('UPDATE certificates SET nfc_uid = ?, nfc_written_at = ? WHERE id = ?').run(clean, new Date().toISOString(), id);
  return getCertificate(id);
}

/**
 * Checks a certificate against the blockchain. The chain is the source of
 * truth: the stored payload is re-hashed (including the image bytes) and
 * compared with the fingerprint recorded on-chain at issue time.
 */
export async function verifyCertificate(cert) {
  const mediaOk = Object.values(cert.payload.media || {}).every((m) => !m || hashOfMedia(m.url) === m.sha256);
  const recomputed = fingerprintOf(cert.payload);
  const base = { fingerprint: recomputed, mediaOk, txHash: cert.chain.txHash, txUrl: cert.chain.txUrl, blockNumber: cert.chain.blockNumber };

  if (cert.chain.status !== 'anchored') return { ...base, status: 'pending' };

  let onChain;
  try {
    onChain = await readOnChain(chainIdOf(cert.id));
  } catch {
    return { ...base, status: 'unavailable' };
  }
  const result = { ...base, chainId: onChain.chainId, chainName: onChain.chainName, contract: onChain.contract, anchoredAt: onChain.issuedAt };

  if (!onChain.issuedAt) return { ...result, status: 'not_found' };
  if (onChain.fingerprint !== recomputed || !mediaOk) return { ...result, status: 'mismatch' };
  if (onChain.revokedAt) return { ...result, status: 'revoked', revokedAt: onChain.revokedAt };
  return { ...result, status: 'verified' };
}
