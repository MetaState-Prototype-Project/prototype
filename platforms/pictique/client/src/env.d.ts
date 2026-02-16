/// <reference types="@sveltejs/kit" />

declare namespace App {}

declare module '$env/static/public' {
	export const PUBLIC_PICTIQUE_BASE_URL: string;
	export const PUBLIC_REGISTRY_URL: string;
	export const PUBLIC_APP_STORE_EID_WALLET: string;
	export const PUBLIC_PLAY_STORE_EID_WALLET: string;
}
