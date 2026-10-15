import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { config } from './config.js';
import { getUser } from './users.js';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

// Signing in with ADMIN_PASSWORD acts as this built-in admin. It is a fallback
// so the team can never be locked out; turn it off by leaving ADMIN_PASSWORD empty.
export const PASSWORD_ADMIN = Object.freeze({ id: 'password-admin', email: '', name: 'Admin (password)', role: 'admin', active: true, builtIn: true });

function sign(value) {
  return crypto.createHmac('sha256', config.authSecret).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function checkPassword(password) {
  if (!config.adminPassword) return false;
  return typeof password === 'string' && safeEqual(sign(password), sign(config.adminPassword));
}

export function createToken(userId) {
  const body = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readToken(token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature || !safeEqual(signature, sign(body))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

let googleClient = null;

/** Verifies a Google ID token from Google Identity Services and returns the account. */
export async function verifyGoogleCredential(credential) {
  if (!config.googleClientId) throw Object.assign(new Error('Google sign-in is not set up. Set GOOGLE_CLIENT_ID.'), { status: 400 });
  googleClient ||= new OAuth2Client(config.googleClientId);
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: String(credential || ''), audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw Object.assign(new Error('Google sign-in failed. Try again.'), { status: 401 });
  }
  if (!payload?.email || !payload.email_verified) throw Object.assign(new Error('Your Google email is not verified.'), { status: 401 });
  return { sub: payload.sub, email: payload.email, name: payload.name, picture: payload.picture };
}

/** Loads the signed-in user on every request, so role changes and removals apply at once. */
export function requireUser(req, res, next) {
  const header = req.get('authorization') || '';
  const data = readToken(header.startsWith('Bearer ') ? header.slice(7) : '');
  const user = !data ? null : data.uid === PASSWORD_ADMIN.id ? (config.adminPassword ? PASSWORD_ADMIN : null) : getUser(data.uid);
  if (!user || !user.active) return res.status(401).json({ error: 'Sign in again.' });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Only admins can do this.' });
  next();
}
