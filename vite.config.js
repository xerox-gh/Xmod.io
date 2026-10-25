import { defineConfig } from 'vite';
export default defineConfig({
  root: 'client',
  optimizeDeps: {
    include: [
      'three',
      'cannon-es',
      'three/addons/loaders/GLTFLoader.js',
      'three/addons/objects/Reflector.js',
      'three/addons/geometries/DecalGeometry.js',
    ],
  },
  build: { outDir: '../dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: {
    proxy: { '/api': 'http://127.0.0.1:3001', '/ws': { target: 'ws://127.0.0.1:3001', ws: true } },
    fs: { allow: ['..'] },
  },
});
