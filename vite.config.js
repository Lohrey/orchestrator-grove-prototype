import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: './',
  plugins: [svelte()],
  build: {
    outDir: 'ui-overlays',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: 'src/ui/main.js',
      name: 'OrchestratorGroveUiOverlay',
      formats: ['es'],
      fileName: () => 'ui-overlays.js'
    },
    rollupOptions: {
      output: {
        assetFileNames: assetInfo => assetInfo.name === 'style.css' ? 'ui-overlays.css' : '[name][extname]'
      }
    }
  }
});
