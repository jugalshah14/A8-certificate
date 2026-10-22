import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Listen on the LAN too, so a phone on the same Wi-Fi can open certificate links.
    host: true,
    // Allow HTTPS tunnel addresses (needed for Web NFC, camera and Google sign-in on a phone).
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok-free.dev'],
    proxy: {
      '/api': backend,
      '/media': backend,
    },
  },
});
