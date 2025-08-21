import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    plugins: [
        tailwindcss(), 
        sveltekit(),
        nodePolyfills({
            // Polyfill all Node.js core modules
            include: ['buffer', 'crypto', 'stream', 'util'],
            // Polyfill globals
            globals: {
                Buffer: true,
                global: true,
                process: true,
            },
            // Override specific polyfills
            overrides: {
                // Use proper Buffer polyfill
                buffer: 'buffer',
            },
        }),
    ],

    // Environment variables
    define: {
        'process.env.NEXT_PUBLIC_EVOTING_BASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_EVOTING_BASE_URL || 'http://localhost:3001'),
        'process.env.NEXT_PUBLIC_EID_WALLET_URL': JSON.stringify(process.env.NEXT_PUBLIC_EID_WALLET_URL || 'w3ds://'),
    },

    // Handle workspace dependencies
    optimizeDeps: {
        include: ['blindvote']
    },

    // Handle Node.js modules in browser environment
    resolve: {
        alias: {
            'noble-secp256k1': 'noble-secp256k1'
        }
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
        host: host || false,
        hmr: host
            ? {
                  protocol: "ws",
                  host,
                  port: 1421,
              }
            : undefined,
        watch: {
            // 3. tell vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
        },
    },
}));
