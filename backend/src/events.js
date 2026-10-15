import crypto from 'node:crypto';
import { db, json } from './db.js';

/**
 * An event describes everything that changes from one event to the next:
 * who can receive a certificate (roles), what the issue form asks (fields),
 * how the page looks (theme, images) and who appears on it (sponsors,
 * partners, officials).
 */

export const TIERS = ['gold', 'silver', 'bronze', 'rose'];
export const FIELD_TYPES = ['text', 'textarea', 'select', 'date', 'number'];
// Where a field's value appears on the certificate page.
export const FIELD_DISPLAYS = ['fact', 'moment', 'hidden'];
export const HEADING_FONTS = ['Oswald', 'Noto Sans'];

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

class ValidationError extends Error {
  constructor(problems) {
    super(problems.join(' '));
    this.status = 400;
    this.problems = problems;
  }
}

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const url = (v) => {
  const s = str(v, 2000);
  return /^(https?:\/\/|\/media\/|#)/.test(s) ? s : '';
};
const color = (v, fallback) => (COLOR_RE.test(str(v)) ? str(v).toLowerCase() : fallback);
const list = (v) => (Array.isArray(v) ? v : []);

export function normalizeEvent(input = {}) {
  const problems = [];
  const theme = input.theme || {};
  const images = input.images || {};

  const event = {
    name: str(input.name, 120),
    city: str(input.city, 80),
    round: str(input.round, 80),
    date: str(input.date, 40),
    venue: str(input.venue, 120),
    theme: {
      primary: color(theme.primary, '#1a2a5e'),
      primaryDeep: color(theme.primaryDeep, '#101a3d'),
      accent: color(theme.accent, '#f26a21'),
      accentSoft: color(theme.accentSoft, '#fdba74'),
      ink: color(theme.ink, '#1b2033'),
      surface: color(theme.surface, '#fff1e3'),
      surfaceSoft: color(theme.surfaceSoft, '#fff8f1'),
      headingFont: HEADING_FONTS.includes(theme.headingFont) ? theme.headingFont : 'Noto Sans',
    },
    images: { emblem: url(images.emblem), hero: url(images.hero), footer: url(images.footer) },

    roles: list(input.roles).map((r) => ({
      key: str(r.key, 40).toLowerCase(),
      label: str(r.label, 40),
      tier: TIERS.includes(r.tier) ? r.tier : 'rose',
      tagline: str(r.tagline, 120),
      kind: str(r.kind, 80),
      summary: str(r.summary, 200),
      resultLabel: str(r.resultLabel, 30) || 'Role',
      detailsTitle: str(r.detailsTitle, 60) || 'Certificate & Event Details',
      momentTitle: str(r.momentTitle, 60) || 'Their Moment',
      fields: list(r.fields).map((f) => str(f, 40)).filter(Boolean),
    })),

    fields: list(input.fields).map((f) => ({
      key: str(f.key, 40).toLowerCase(),
      label: str(f.label, 60),
      type: FIELD_TYPES.includes(f.type) ? f.type : 'text',
      display: FIELD_DISPLAYS.includes(f.display) ? f.display : 'fact',
      required: Boolean(f.required),
      options: f.type === 'select' ? list(f.options).map((o) => str(o, 80)).filter(Boolean) : [],
      placeholder: str(f.placeholder, 120),
    })),

    authSponsor: input.authSponsor?.name
      ? {
          name: str(input.authSponsor.name, 80),
          logo: url(input.authSponsor.logo),
          url: url(input.authSponsor.url),
          offer: str(input.authSponsor.offer, 40),
          terms: str(input.authSponsor.terms, 120),
          validTill: str(input.authSponsor.validTill, 40),
          code: str(input.authSponsor.code, 40),
          cta: str(input.authSponsor.cta, 40),
          banner: url(input.authSponsor.banner),
        }
      : null,

    sponsors: list(input.sponsors)
      .map((s) => ({ tag: str(s.tag, 40), name: str(s.name, 80), logo: url(s.logo), text: str(s.text, 300), url: url(s.url), cta: str(s.cta, 40) }))
      .filter((s) => s.name),

    partners: list(input.partners)
      .map((p) => ({ label: str(p.label, 40), name: str(p.name, 80), logo: url(p.logo) }))
      .filter((p) => p.name),

    officials: {
      title: str(input.officials?.title, 60) || 'Officials',
      people: list(input.officials?.people)
        .map((p) => ({ name: str(p.name, 80), title: str(p.title, 160), photo: url(p.photo) }))
        .filter((p) => p.name),
    },
  };

  if (!event.name) problems.push('Event name is required.');
  if (!event.roles.length) problems.push('Add at least one role.');

  const fieldKeys = new Set();
  event.fields.forEach((f, i) => {
    if (!KEY_RE.test(f.key)) problems.push(`Field ${i + 1}: key must be lowercase letters, digits, - or _ (no spaces).`);
    if (fieldKeys.has(f.key)) problems.push(`Field key "${f.key}" is used twice.`);
    fieldKeys.add(f.key);
    if (!f.label) problems.push(`Field ${i + 1}: label is required.`);
    if (f.type === 'select' && !f.options.length) problems.push(`Field "${f.label}": add at least one option.`);
  });

  const roleKeys = new Set();
  event.roles.forEach((r, i) => {
    if (!KEY_RE.test(r.key)) problems.push(`Role ${i + 1}: key must be lowercase letters, digits, - or _ (no spaces).`);
    if (roleKeys.has(r.key)) problems.push(`Role key "${r.key}" is used twice.`);
    roleKeys.add(r.key);
    if (!r.label) problems.push(`Role ${i + 1}: label is required.`);
    // An empty list means the role uses every field.
    r.fields = r.fields.filter((k) => fieldKeys.has(k));
  });

  if (problems.length) throw new ValidationError(problems);
  return event;
}

/** The fields the issue form shows for a role. */
export function fieldsForRole(event, role) {
  return role.fields.length ? event.fields.filter((f) => role.fields.includes(f.key)) : event.fields;
}

function rowToEvent(row) {
  if (!row) return null;
  return { id: row.id, ...json.parse(row.config), createdAt: row.created_at, updatedAt: row.updated_at };
}

export function listEvents() {
  const rows = db
    .prepare(
      `SELECT e.*, (SELECT COUNT(*) FROM certificates c WHERE c.event_id = e.id) AS certificate_count
       FROM events e ORDER BY e.created_at DESC`
    )
    .all();
  return rows.map((row) => ({ ...rowToEvent(row), certificateCount: row.certificate_count }));
}

export function getEvent(id) {
  return rowToEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(id));
}

export function createEvent(input) {
  const event = normalizeEvent(input);
  const id = 'evt_' + crypto.randomBytes(6).toString('hex');
  const now = new Date().toISOString();
  db.prepare('INSERT INTO events (id, config, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, json.stringify(event), now, now);
  return getEvent(id);
}

export function updateEvent(id, input) {
  if (!getEvent(id)) return null;
  const event = normalizeEvent(input);
  db.prepare('UPDATE events SET config = ?, updated_at = ? WHERE id = ?').run(json.stringify(event), new Date().toISOString(), id);
  return getEvent(id);
}
