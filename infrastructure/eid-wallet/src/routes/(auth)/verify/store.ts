import { writable } from "svelte/store";

export const verifStep = writable(0);
export const permissionGranted = writable<boolean>(false);
export const DocFront = writable<string | null>();
export const DocBack = writable<string | null>();
export const Selfie = writable<string | null>();
export const verificaitonId = writable<string | null>();
export const status = writable<string>();
export const reason = writable<string>();
export const documentType = writable<
    "passport" | "id" | "permit" | "dl" | null
>(null);
