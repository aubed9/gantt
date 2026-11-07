import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { reticle } from '@reticlehq/vite-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  plugins: [reticle()],
  server: {
    port: 3122,
    host: '127.0.0.1'
  }
});
