import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '.vite/build/main/workers',
    emptyOutDir: false,
    lib: {
      entry: 'src/main/workers/clustering.worker.ts',
      fileName: () => 'clustering.worker.js',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron', 'better-sqlite3', 'sqlite-vec', 'worker_threads'],
    },
  },
});
