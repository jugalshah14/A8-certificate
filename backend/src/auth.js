import crypto from 'node:crypto';
import { config } from './config.js';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function sign(value) {
  return crypto.createHmac('sha256', config.authSecret).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function checkPassword(password) {
  return typeof password === 'string' && safeEqual(sign(password), sign(config.adminPassword));
}

export function createToken() {
  const expires = String(Date.now() + TOKEN_TTL_MS);
  return `${expires}.${sign(expires)}`;
}

function verifyToken(token) {
  const [expires, signature] = String(token || '').split('.');
  if (!expires || !signature || !safeEqual(signature, sign(expires))) return false;
  return Number(expires) > Date.now();
}

export function requireAdmin(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!verifyToken(token)) return res.status(401).json({ error: 'Sign in again.' });
  next();
}
