import { Router } from 'express';
import { config } from './config.js';
import { checkPassword, createToken, requireAdmin, requireUser, verifyGoogleCredential, PASSWORD_ADMIN } from './auth.js';
import { listUsers, addUser, updateUser, removeUser, signInWithGoogle, ROLES } from './users.js';
import { listEvents, getEvent, createEvent, updateEvent, TIERS, FIELD_TYPES, FIELD_DISPLAYS, HEADING_FONTS } from './events.js';
import {
  issueCertificate,
  anchorCertificate,
  revokeCertificate,
  recordNfcWrite,
  getCertificate,
  listCertificates,
  verifyCertificate,
} from './certificates.js';
import { saveMedia, upload } from './media.js';
import { getChain } from './chain.js';

export const api = Router();

const notFound = (res, what) => res.status(404).json({ error: `${what} not found.` });

api.get('/health', (req, res) => res.json({ status: 'ok' }));

const session = (user) => ({ token: createToken(user.id), user });

api.get('/auth/options', (req, res) => {
  res.json({ googleClientId: config.googleClientId || null, passwordLogin: Boolean(config.adminPassword) });
});

api.post('/auth/login', (req, res) => {
  if (!checkPassword(req.body?.password)) return res.status(401).json({ error: 'Wrong password.' });
  res.json(session(PASSWORD_ADMIN));
});

api.post('/auth/google', async (req, res) => {
  const account = await verifyGoogleCredential(req.body?.credential);
  res.json(session(signInWithGoogle(account)));
});

// ---------- public ----------

api.get('/public/certificates/:id', async (req, res) => {
  const cert = getCertificate(req.params.id);
  if (!cert) return notFound(res, 'Certificate');
  const event = getEvent(cert.eventId);
  const p = cert.payload;
  // Role wording comes from the event's current config; the facts that were
  // fingerprinted come from the frozen payload.
  const role = event.roles.find((r) => r.key === p.role.key) || { ...p.role, fields: [] };

  res.json({
    certificate: {
      id: cert.id,
      issuedAt: cert.issuedAt,
      recipientName: p.recipient.name,
      role: { ...role, label: p.role.label, tier: p.role.tier },
      // Hidden fields are fingerprinted with the record but never published.
      fields: p.fields.filter((f) => f.display !== 'hidden'),
      media: p.media,
      couponCode: cert.couponCode,
      nfcSealed: Boolean(cert.nfc.writtenAt),
    },
    event: {
      ...p.event,
      theme: event.theme,
      images: event.images,
      authSponsor: event.authSponsor,
      sponsors: event.sponsors,
      partners: event.partners,
      officials: event.officials,
    },
    verification: await verifyCertificate(cert),
  });
});

api.get('/public/config', (req, res) => {
  res.json({ publicBaseUrl: config.publicBaseUrl || null });
});

// ---------- signed in: admins and employees ----------

api.use(requireUser);

api.get('/me', (req, res) => res.json(req.user));

api.get('/meta', async (req, res) => {
  let chain;
  try {
    const c = await getChain();
    chain = { connected: true, chainId: c.chainId, name: c.name, contract: c.address };
  } catch (err) {
    chain = { connected: false, error: err.shortMessage || err.message };
  }
  res.json({
    user: req.user,
    chain,
    publicBaseUrl: config.publicBaseUrl || null,
    tiers: TIERS,
    fieldTypes: FIELD_TYPES,
    fieldDisplays: FIELD_DISPLAYS,
    headingFonts: HEADING_FONTS,
    roles: ROLES,
  });
});

api.get('/events', (req, res) => res.json(listEvents()));

api.get('/events/:id', (req, res) => {
  const event = getEvent(req.params.id);
  event ? res.json(event) : notFound(res, 'Event');
});

api.get('/certificates', (req, res) => {
  res.json(listCertificates({ eventId: req.query.eventId, q: req.query.q }));
});

api.get('/certificates/:id', async (req, res) => {
  const cert = getCertificate(req.params.id);
  if (!cert) return notFound(res, 'Certificate');
  res.json({ ...cert, verification: await verifyCertificate(cert) });
});

const certificateFiles = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'cardFront', maxCount: 1 },
  { name: 'cardBack', maxCount: 1 },
]);

// Multipart: a "data" part with the JSON form, plus optional image parts.
api.post('/certificates', certificateFiles, async (req, res) => {
  let data;
  try {
    data = JSON.parse(req.body?.data || '{}');
  } catch {
    return res.status(400).json({ error: 'Invalid form data.' });
  }
  const cert = await issueCertificate(data, req.files || {}, req.user);
  res.status(201).json(cert);
});

api.post('/certificates/:id/anchor', async (req, res) => res.json(await anchorCertificate(req.params.id)));

api.post('/certificates/:id/nfc', (req, res) => res.json(recordNfcWrite(req.params.id, req.body?.uid)));

// ---------- admins only ----------

api.use(requireAdmin);

api.post('/uploads', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.json(saveMedia(req.file.buffer, req.file.mimetype));
});

api.post('/events', (req, res) => res.status(201).json(createEvent(req.body)));

api.put('/events/:id', (req, res) => {
  const event = updateEvent(req.params.id, req.body);
  event ? res.json(event) : notFound(res, 'Event');
});

api.post('/certificates/:id/revoke', async (req, res) => res.json(await revokeCertificate(req.params.id)));

api.get('/users', (req, res) => res.json(listUsers()));

api.post('/users', (req, res) => res.status(201).json(addUser(req.body || {}, req.user.email || req.user.name)));

api.patch('/users/:id', (req, res) => {
  const { name, role, active } = req.body || {};
  res.json(updateUser(req.params.id, { name, role, active: active === undefined ? undefined : Boolean(active) }, req.user));
});

api.delete('/users/:id', (req, res) => {
  removeUser(req.params.id, req.user);
  res.status(204).end();
});
