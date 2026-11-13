/**
 * svelte-qrcode ships no type declarations — its package exports only the
 * `svelte` condition pointing at raw component source. Declare the props we
 * use so `svelte-check` can see the component.
 */
declare module "svelte-qrcode" {
    import type { Component } from "svelte";

    const QrCode: Component<{
        value?: string;
        size?: string | number;
        color?: string;
        background?: string;
        padding?: number;
        errorCorrection?: "L" | "M" | "Q" | "H";
        className?: string;
    }>;

    export default QrCode;
}
