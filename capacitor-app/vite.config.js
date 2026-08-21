import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Use relative asset URLs so the built app works from Capacitor's bundled
  // web directory instead of assuming it is hosted at a domain root.
  base: './',
  build: { outDir: 'dist', emptyOutDir: true }
});
