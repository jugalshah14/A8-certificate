import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(config.dbFile);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    config      TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id              TEXT PRIMARY KEY,
    event_id        TEXT NOT NULL REFERENCES events(id),
    role_key        TEXT NOT NULL,
    recipient_name  TEXT NOT NULL,
    payload         TEXT NOT NULL,
    fingerprint     TEXT NOT NULL,
    coupon_code     TEXT,
    issued_at       TEXT NOT NULL,
    chain_status    TEXT NOT NULL DEFAULT 'pending',
    chain_error     TEXT,
    chain_id        INTEGER,
    contract        TEXT,
    tx_hash         TEXT,
    block_number    INTEGER,
    nfc_uid         TEXT,
    nfc_written_at  TEXT,
    revoked_at      TEXT
  );

  CREATE INDEX IF NOT EXISTS certificates_event ON certificates(event_id, issued_at);

  CREATE TABLE IF NOT EXISTS users (
    id             TEXT PRIMARY KEY,
    email          TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL DEFAULT '',
    role           TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
    active         INTEGER NOT NULL DEFAULT 1,
    google_sub     TEXT UNIQUE,
    picture        TEXT,
    added_by       TEXT,
    created_at     TEXT NOT NULL,
    last_login_at  TEXT
  );
`);

// Pre-printed cards: blank QR/NFC cards made for an event before anyone is
// issued a certificate. A card's code becomes the certificate id when assigned.
db.exec(`
  CREATE TABLE IF NOT EXISTS cards (
    code            TEXT PRIMARY KEY,
    event_id        TEXT NOT NULL REFERENCES events(id),
    serial          INTEGER NOT NULL,
    batch_id        TEXT NOT NULL,
    batch_note      TEXT,
    created_at      TEXT NOT NULL,
    created_by      TEXT,
    certificate_id  TEXT UNIQUE,
    assigned_at     TEXT,
    assigned_by     TEXT,
    nfc_uid         TEXT,
    nfc_written_at  TEXT,
    voided_at       TEXT,
    UNIQUE (event_id, serial)
  );
  CREATE INDEX IF NOT EXISTS cards_event ON cards(event_id, serial);
`);

// Columns added after the first release.
const certificateColumns = db.prepare('PRAGMA table_info(certificates)').all().map((c) => c.name);
if (!certificateColumns.includes('issued_by')) db.exec('ALTER TABLE certificates ADD COLUMN issued_by TEXT');

export const json = {
  parse: (s) => (s == null ? null : JSON.parse(s)),
  stringify: (v) => JSON.stringify(v),
};
