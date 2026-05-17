declare module "svelte-qrcode" {
    import type { Component } from "svelte";

    export declare const QrCode: Component<{
        value: string;
        size?: number;
    }>;

    export default QrCode;
}
