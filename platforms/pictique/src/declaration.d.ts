declare module 'svelte-qrcode' {
	import { SvelteComponentTyped } from 'svelte';
	export default class QRCode extends SvelteComponentTyped<{ value: string; size?: number }> {}
}
