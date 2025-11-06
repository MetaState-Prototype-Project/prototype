import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const plugins: any[] = [
  react(),
  runtimeErrorOverlay(),
];

// Conditionally add cartographer plugin if in development and REPL_ID is set
if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
  // Use dynamic import at runtime, but handle it synchronously for type checking
  // This will be resolved at runtime
  plugins.push(
    import("@replit/vite-plugin-cartographer").then((m) => m.cartographer()) as any
  );
}

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
