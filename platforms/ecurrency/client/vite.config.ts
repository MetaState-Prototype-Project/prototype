import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const envDir = path.resolve(import.meta.dirname, "../../../");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 9888,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  envDir: envDir,
});

