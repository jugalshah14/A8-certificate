import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backend = 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Listen on the LAN too, so a phone on the same Wi-Fi can open certificate links.
    host: true,
    proxy: {
      '/api': backend,
      '/media': backend,
    },
  },
});
