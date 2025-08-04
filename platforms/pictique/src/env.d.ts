/// <reference types="@sveltejs/kit" />

declare namespace App {}

declare module '$env/static/public' {
	export const PUBLIC_PICTIQUE_BASE_URL: string;
}
