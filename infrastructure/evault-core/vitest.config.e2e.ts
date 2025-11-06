import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        glob: ['**/*.{test,spec}.{ts,tsx}'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        environment: 'node',
        setupFiles: ['./src/test-utils/test-setup.ts'],
        testTimeout: 120000, // 120 seconds for testcontainers
        hookTimeout: 120000, // 120 seconds for hooks (beforeAll, afterAll)
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

