import { writable } from "svelte/store";
import { apiClient } from "$lib/utils/axios";
import type { Writable } from "svelte/store";

export interface Signature {
    id: string;
    userId: string;
    md5Hash: string;
    message: string;
    signature: string;
    publicKey: string;
    createdAt: string;
    user?: {
        id: string;
        name: string;
        ename: string;
        avatarUrl?: string;
    } | null;
}

export const signatures: Writable<Signature[]> = writable([]);
export const isLoading = writable(false);
export const error = writable<string | null>(null);

export const fetchFileSignatures = async (fileId: string) => {
    try {
        isLoading.set(true);
        error.set(null);
        const response = await apiClient.get(`/api/files/${fileId}/signatures`);
        signatures.set(response.data);
    } catch (err) {
        error.set(
            err instanceof Error ? err.message : "Failed to fetch signatures",
        );
        throw err;
    } finally {
        isLoading.set(false);
    }
};
