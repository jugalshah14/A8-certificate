import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { api } from './routes.js';
import { seedIfEmpty } from './seed.js';
import { getChain } from './chain.js';
import { bootstrapAdmin } from './users.js';

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', api);
// Media files are named by their hash, so they never change and can be cached forever.
app.use('/media', express.static(config.uploadsDir, { immutable: true, maxAge: '365d' }));

// In production the backend also serves the built frontend, so the NFC/QR
// links, the admin and the API share one origin.
if (fs.existsSync(config.frontendDist)) {
  app.use(express.static(config.frontendDist, { index: false }));
  app.get(/^(?!\/api\/|\/media\/).*/, (req, res) => res.sendFile(path.join(config.frontendDist, 'index.html')));
}

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong.' : err.message, problems: err.problems });
});

seedIfEmpty();
const firstAdmin = bootstrapAdmin(config.bootstrapAdminEmail);
if (firstAdmin) console.log(`Added first admin ${firstAdmin.email}`);

app.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
  getChain()
    .then((c) => console.log(`Blockchain: ${c.name} (chain ${c.chainId}), registry ${c.address}`))
    .catch((err) => console.warn(`Blockchain not reachable yet (${err.shortMessage || err.message}). Certificates will stay pending until it is.`));
});
