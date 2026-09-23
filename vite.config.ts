import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  // Keep bundled fonts on the same origin, as required by production font-src.
  build: { assetsInlineLimit: 0 },
  server: { port: 5178, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8787' } },
});
