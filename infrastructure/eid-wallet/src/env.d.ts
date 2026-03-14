/// <reference types="@sveltejs/kit" />

declare namespace App {}

declare module "$env/static/public" {
    export const PUBLIC_REGISTRY_URL: string;
    export const PUBLIC_PROVISIONER_URL: string;
    export const PUBLIC_EID_WALLET_TOKEN: string;
    export const PUBLIC_PROVISIONER_SHARED_SECRET: string;
    export const PUBLIC_PICTIQUE_BASE_URL: string;
    export const PUBLIC_BLABSY_BASE_URL: string;
}
