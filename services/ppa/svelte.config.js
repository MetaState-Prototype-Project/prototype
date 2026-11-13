import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const config = {
    preprocess: vitePreprocess(),
    kit: {
        adapter: adapter(),
        // Every service in this monorepo reads the repo-root .env.
        env: {
            dir: "../../",
        },
    },
};

export default config;
