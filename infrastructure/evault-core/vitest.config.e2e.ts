import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        glob: ['**/*.{test,spec}.{ts,tsx}'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        environment: 'node',
        setupFiles: ['./src/test-utils/test-setup.ts'],
        testTimeout: 120000, // 120 seconds for testcontainers
        hookTimeout: 120000, // 120 seconds for hooks (beforeAll, afterAll)
        // Run E2E tests sequentially to avoid resource conflicts and native module crashes
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true, // Run all E2E tests in a single fork to avoid native module loading conflicts
            },
        },
        // Reduce log verbosity
        logHeapUsage: false,
        silent: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/',
                'dist/',
                '**/*.d.ts',
                '**/migrations/**',
            ],
        },
    },
});

