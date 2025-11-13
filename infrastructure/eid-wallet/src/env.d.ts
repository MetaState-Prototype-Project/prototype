/// <reference types="@sveltejs/kit" />

declare namespace App {}

declare module "$env/static/public" {
    export const PUBLIC_REGISTRY_URL: string;
    export const PUBLIC_PROVISIONER_URL: string;
}
