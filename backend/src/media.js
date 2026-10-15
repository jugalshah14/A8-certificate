import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from './config.js';

fs.mkdirSync(config.uploadsDir, { recursive: true });

const TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/gif': '.gif',
};

export const MEDIA_PREFIX = '/media/';

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Stores a file under its own SHA-256 hash. The file name is the hash, so a
 * certificate that records the name also records the exact image bytes.
 */
export function saveMedia(buffer, mimeType) {
  const ext = TYPES[mimeType];
  if (!ext) throw Object.assign(new Error(`Unsupported file type: ${mimeType}`), { status: 400 });
  const hash = sha256(buffer);
  const name = hash + ext;
  const file = path.join(config.uploadsDir, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buffer);
  return { url: MEDIA_PREFIX + name, sha256: hash };
}

export function saveMediaFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = Object.keys(TYPES).find((t) => TYPES[t] === ext) || (ext === '.jpeg' ? 'image/jpeg' : null);
  return saveMedia(fs.readFileSync(filePath), mime);
}

/** Recomputes the hash of a stored media file; null if it is missing. */
export function hashOfMedia(url) {
  if (!url || !url.startsWith(MEDIA_PREFIX)) return null;
  const file = path.join(config.uploadsDir, path.basename(url));
  if (!fs.existsSync(file)) return null;
  return sha256(fs.readFileSync(file));
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
  fileFilter: (req, file, cb) => {
    if (TYPES[file.mimetype]) cb(null, true);
    else cb(Object.assign(new Error(`Unsupported file type: ${file.mimetype}`), { status: 400 }));
  },
});
