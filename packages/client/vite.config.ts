import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'mods-dev-scan',
      configureServer(server) {
        server.middlewares.use('/mods/list', (_req, res) => {
          const dir = path.resolve(__dirname, 'public/mods');
          try {
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(files));
          } catch {
            res.setHeader('Content-Type', 'application/json');
            res.end('[]');
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, '../engine/src'),
    },
  },
  server: { port: 3000 },
});
