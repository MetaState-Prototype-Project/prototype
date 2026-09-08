import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
	// TypeORM entities rely on `emitDecoratorMetadata`, which esbuild — the
	// default vitest transform — does not emit. Without it every relation column
	// fails with ColumnTypeUndefinedError, so the acceptance tests cannot load
	// the real entities. swc emits the metadata.
	plugins: [swc.vite({ module: { type: "es6" } })],
	test: {
		// A container start plus schema sync is well past the default timeout.
		testTimeout: 60_000,
		hookTimeout: 180_000,
		// The acceptance suite shares one Postgres container and one module-level
		// data source, so its files must not run in parallel.
		fileParallelism: false,
	},
});
