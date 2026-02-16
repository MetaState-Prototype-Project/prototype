import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		allowedHosts: [
			'esigner.w3ds-prototype.merul.org',
			'esigner.staging.metastate.foundation',
			'esigner.w3ds.metastate.foundation'
		]
	}
});


