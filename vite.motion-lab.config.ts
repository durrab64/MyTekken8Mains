import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Motion Lab only. Kept separate from vite.config.ts so the production build
 * input and the production bundle are untouched by R2.3.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-motion-lab',
    sourcemap: true,
    rollupOptions: {
      input: 'motion-lab/index.html',
    },
  },
});
