import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The page imports the repo's CSVs (../*.csv) at build time, so every number on it is computed, never typed.
export default defineConfig({
  base: '/Indoor-Positioning-Algorithms/',
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
});
