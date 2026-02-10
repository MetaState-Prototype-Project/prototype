import path from "node:path";
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "wallet-sdk": path.resolve(__dirname, "../../packages/wallet-sdk/src/index.ts"),
    },
  },
  server: {
    port: 5174,
    open: true,
  },
});
