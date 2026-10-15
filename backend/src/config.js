import 'dotenv/config';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.resolve(root, process.env.DATA_DIR || 'data');

export const config = {
  root,
  port: Number(process.env.PORT) || 5000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Base URL written to NFC chips and QR codes. Must be reachable from a phone,
  // so set it to your LAN address or public tunnel URL for a real demo.
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),

  // Fallback sign-in that acts as an admin. Empty turns it off (use Google only).
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin',
  authSecret: process.env.AUTH_SECRET || 'dev-only-secret-change-me',

  // Google sign-in. Create an OAuth client (Web application) in Google Cloud.
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  // Added as the first admin when the team is empty.
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL || '',

  dataDir,
  dbFile: path.join(dataDir, 'a8.sqlite'),
  uploadsDir: path.join(dataDir, 'uploads'),
  chainStateFile: path.join(dataDir, 'chain.json'),

  chain: {
    rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
    privateKey: process.env.PRIVATE_KEY || '',
    contractAddress: process.env.CONTRACT_ADDRESS || '',
    name: process.env.CHAIN_NAME || '',
    explorerUrl: (process.env.EXPLORER_URL || '').replace(/\/+$/, ''),
  },

  frontendDist: path.resolve(root, '../frontend/dist'),
};

if (process.env.NODE_ENV === 'production') {
  if (config.adminPassword === 'admin' || config.authSecret === 'dev-only-secret-change-me') {
    throw new Error('Set AUTH_SECRET, and change or empty ADMIN_PASSWORD, in production.');
  }
}
