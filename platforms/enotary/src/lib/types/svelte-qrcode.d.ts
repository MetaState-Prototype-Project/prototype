declare module "svelte-qrcode" {
    import type { SvelteComponentTyped } from "svelte";

    export default class QrCode extends SvelteComponentTyped<{
        value: string;
        size?: number;
    }> {}
}
