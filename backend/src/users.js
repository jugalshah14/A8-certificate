import crypto from 'node:crypto';
import { db } from './db.js';

export const ROLES = ['admin', 'employee'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const httpError = (status, message) => Object.assign(new Error(message), { status });

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: Boolean(row.active),
    picture: row.picture,
    addedBy: row.added_by,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export function listUsers() {
  return db.prepare("SELECT * FROM users ORDER BY role = 'admin' DESC, name, email").all().map(rowToUser);
}

export function getUser(id) {
  return rowToUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function getUserByEmail(email) {
  return rowToUser(db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email)));
}

function countActiveAdmins() {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n;
}

export function addUser({ email, name, role }, addedBy) {
  const clean = normalizeEmail(email);
  if (!EMAIL_RE.test(clean)) throw httpError(400, 'Enter a valid email address.');
  if (!ROLES.includes(role)) throw httpError(400, 'Role must be admin or employee.');
  if (getUserByEmail(clean)) throw httpError(409, `${clean} is already on the team.`);
  const id = 'usr_' + crypto.randomBytes(6).toString('hex');
  db.prepare('INSERT INTO users (id, email, name, role, added_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    clean,
    String(name || '').trim().slice(0, 80),
    role,
    addedBy || null,
    new Date().toISOString()
  );
  return getUser(id);
}

/** Changes a user's name, role or active flag; never leaves the team without an active admin. */
export function updateUser(id, patch, actor) {
  const user = getUser(id);
  if (!user) throw httpError(404, 'User not found.');
  const role = patch.role ?? user.role;
  const active = patch.active ?? user.active;
  if (!ROLES.includes(role)) throw httpError(400, 'Role must be admin or employee.');
  if (actor?.id === id && (role !== 'admin' || !active)) throw httpError(400, 'You cannot remove your own admin access.');
  if (user.role === 'admin' && user.active && (role !== 'admin' || !active) && countActiveAdmins() <= 1) {
    throw httpError(400, 'Keep at least one active admin.');
  }
  const name = patch.name === undefined ? user.name : String(patch.name).trim().slice(0, 80);
  db.prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?').run(name, role, active ? 1 : 0, id);
  return getUser(id);
}

export function removeUser(id, actor) {
  const user = getUser(id);
  if (!user) throw httpError(404, 'User not found.');
  if (actor?.id === id) throw httpError(400, 'You cannot remove yourself.');
  if (user.role === 'admin' && user.active && countActiveAdmins() <= 1) throw httpError(400, 'Keep at least one active admin.');
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

/**
 * Signs in a Google account. Only people already added to the team can sign
 * in; the Google account id is pinned on first sign-in.
 */
export function signInWithGoogle({ sub, email, name, picture }) {
  const user = getUserByEmail(email);
  if (!user) throw httpError(403, `${email} is not on the team. Ask an admin to add you.`);
  if (!user.active) throw httpError(403, 'Your access has been turned off. Ask an admin.');
  const row = db.prepare('SELECT google_sub FROM users WHERE id = ?').get(user.id);
  if (row.google_sub && row.google_sub !== sub) throw httpError(403, 'This email is linked to a different Google account.');
  db.prepare('UPDATE users SET google_sub = ?, name = COALESCE(NULLIF(name, \'\'), ?), picture = ?, last_login_at = ? WHERE id = ?').run(
    sub,
    name || '',
    picture || null,
    new Date().toISOString(),
    user.id
  );
  return getUser(user.id);
}

/** Adds the first admin from BOOTSTRAP_ADMIN_EMAIL when the team is empty. */
export function bootstrapAdmin(email) {
  const clean = normalizeEmail(email);
  if (!clean || db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return null;
  return addUser({ email: clean, name: '', role: 'admin' }, 'bootstrap');
}
