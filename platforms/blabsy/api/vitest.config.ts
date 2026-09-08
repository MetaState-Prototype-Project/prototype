import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // The acceptance suite needs a Firestore emulator, which takes a while
        // to come up and must outlive individual test files.
        globalSetup: ["./firestore-emulator.setup.ts"],
        testTimeout: 60_000,
        hookTimeout: 240_000,
        fileParallelism: false,
    },
});
