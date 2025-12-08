import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Load .env from the root of the monorepo (parent directory)
	envDir: resolve(__dirname, '../..'),
	// PUBLIC_ prefix is for client-side env vars, server-side vars (like LOKI_*) are loaded automatically
	envPrefix: 'PUBLIC_',
	optimizeDeps: {
		exclude: ['lowdb', 'steno']
	},
	build: {
		rollupOptions: {
			external: ['lowdb', 'lowdb/node', 'steno']
		}
	}
});
