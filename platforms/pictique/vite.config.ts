import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [tailwindcss(), sveltekit()],
    server: {
        allowedHosts: [
            'pictique.w3ds-prototype.merul.org',
            'pictique.staging.metastate.foundation',
            'pictique.w3ds.metastate.foundation'
        ]
    }
});
