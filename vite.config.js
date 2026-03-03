import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // 1. Disable sourcemaps so students can't see your App.jsx structure
    sourcemap: false,
    // 2. Use Terser for professional minification
    minify: 'terser',
    terserOptions: {
      compress: {
        // 3. Automatically remove all console.logs and debuggers in production
        drop_console: true,
        drop_debugger: true,
      },
      mangle: {
        // 4. Scramble variable names to single letters
        toplevel: true,
      },
      format: {
        // 5. Remove all comments/licenses to keep code clean and hidden
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        // 6. Give files random hash names so the structure is unpredictable
        entryFileNames: 'assets/[hash].js',
        chunkFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]',
      },
    },
  },
});