import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
        },
    },
    root: path.resolve(__dirname, "client"),
    build: {
        outDir: path.resolve(import.meta.dirname, "dist"),
        emptyOutDir: true,
    },
    server: {
        fs: {
            strict: true,
            deny: ["**/.*"],
        },
    },
});
