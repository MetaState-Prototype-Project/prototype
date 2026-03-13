import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		port: 5180,
		allowedHosts: [
			'profile-editor.w3ds-prototype.merul.org',
			'profile-editor.staging.metastate.foundation',
			'profile-editor.w3ds.metastate.foundation'
		]
	}
});
