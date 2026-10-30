import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The Excel parser is dynamically imported only when a file is uploaded.
    // Its 500 KB bundle is intentional and is not part of the initial page load.
    chunkSizeWarningLimit: 600,
  },
});
