import { defineConfig } from "vite";

const pages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: pages ? "/ragi/" : "/",
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 700,
  },
});
