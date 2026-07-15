import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Dedicated, isolated test config — intentionally does NOT load the app's
// Svelte/Tauri/Tailwind plugins. Unit tests here run in a plain Node
// environment and stub the few runtime-only imports (see `$env` alias below;
// heavier deps are mocked per-spec with `vi.mock`).
export default defineConfig({
    resolve: {
        alias: {
            "$env/static/public": fileURLToPath(
                new URL("./src/test/env-static-public.ts", import.meta.url),
            ),
        },
    },
    test: {
        environment: "node",
        include: ["src/**/*.spec.ts"],
    },
});
