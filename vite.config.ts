import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['mupdf']
  },
  define: {
    // Help with PDF.js worker loading
    global: 'globalThis',
  },
  assetsInclude: ['**/*.worker.js', '**/*.worker.min.js']
});
