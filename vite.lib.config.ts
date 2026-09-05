import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()], publicDir: false,
  build: {
    lib: { entry: 'src/index.ts', name: 'TablyDesktop', formats: ['es', 'cjs'], fileName: (format) => format === 'es' ? 'index.js' : 'index.cjs', cssFileName: 'style' },
    rollupOptions: { external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'], output: { banner: '"use client";' } }
  }
});
