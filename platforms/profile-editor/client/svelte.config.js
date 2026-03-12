import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		env: {
			dir: '../../../'
		},
		prerender: {
			handleHttpError: (details) => {
				// Ignore 404 for favicon - linked from app.html but may be missing
				if (details.path?.includes('favicon') || details.message?.includes('favicon')) {
					return 'ignore';
				}
				return 'fail';
			}
		}
	}
};

export default config;
