import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		allowedHosts: [
			'file-manager.w3ds-prototype.merul.org',
			'file-manager.staging.metastate.foundation',
			'file-manager.w3ds.metastate.foundation'
		]
	}
});

