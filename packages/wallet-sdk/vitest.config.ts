import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		glob: ["**/*.{test,spec}.{ts,tsx}"],
		environment: "node",
	},
});
