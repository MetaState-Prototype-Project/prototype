import { writable } from "svelte/store";

export interface PendingRecovery {
    uri: string;
    ename: string;
    user: Record<string, string>;
    document: Record<string, string>;
}

export const pendingRecovery = writable<PendingRecovery | null>(null);
