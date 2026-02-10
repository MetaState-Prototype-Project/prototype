import path from "node:path";
import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      "wallet-sdk": path.resolve(__dirname, "../../packages/wallet-sdk/src/index.ts"),
    },
  },
  server: {
    port: 8080,
    open: true,
  },
});
