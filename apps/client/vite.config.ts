import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { port: 5188, strictPort: true,
  proxy: { '/game': { target: 'http://127.0.0.1:2567', ws: true,
    rewrite: path => path.replace(/^\/game/, '') } } } });
