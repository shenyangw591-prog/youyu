import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const project = fileURLToPath(new URL('..', import.meta.url));
export default defineConfig({
  root: path.join(project, 'mobile'),
  publicDir: path.join(project, 'mobile/public'),
  plugins: [react()],
  resolve: { alias: { '@': project } },
  css: { postcss: project },
  server: { host: '127.0.0.1', port: 5180, strictPort: true, fs: { allow: [project] } },
  build: { outDir: path.join(project, 'mobile-dist'), emptyOutDir: true, target: 'chrome111' },
});
