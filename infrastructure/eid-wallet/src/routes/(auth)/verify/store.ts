import { writable } from "svelte/store";

export const verifStep = writable(0);
export const permissionGranted = writable<boolean>(false);
export const DocFront = writable<string>();
export const Selfie = writable<string>();
