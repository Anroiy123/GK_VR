import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    host: true,
    https: false,
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
