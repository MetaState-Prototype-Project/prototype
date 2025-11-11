import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    glob: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    globals: true, // Enable global test APIs (describe, test, expect, etc.)
    testTimeout: 600000, // 10 minutes for load tests
    hookTimeout: 300000, // 5 minutes for hooks (beforeAll, afterAll)
    // Run tests sequentially to avoid overwhelming the system
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single fork
      },
    },
    // Better reporting for long-running tests
    logHeapUsage: false,
    silent: false,
    reporters: ['verbose', 'dot'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

