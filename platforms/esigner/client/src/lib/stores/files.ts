import { writable } from "svelte/store";
import { apiClient } from "$lib/utils/axios";
import type { Writable } from "svelte/store";

export interface Signature {
    id: string;
    userId: string;
    user?: {
        id: string;
        name: string;
        ename: string;
        avatarUrl?: string;
    };
    createdAt: string;
}

export interface Document {
    id: string;
    name: string;
    displayName?: string;
    description?: string;
    mimeType: string;
    size: number;
    md5Hash: string;
    ownerId: string;
    owner?: {
        id: string;
        name: string;
        ename: string;
    };
    createdAt: string;
    updatedAt: string;
    status: "draft" | "pending" | "partially_signed" | "fully_signed";
    totalSignees: number;
    signedCount: number;
    pendingCount: number;
    declinedCount: number;
    signatures: Signature[];
}

// Keep File for backward compatibility (used in upload)
export type File = globalThis.File;

export const documents: Writable<Document[]> = writable([]);
export const isLoading = writable(false);
export const error = writable<string | null>(null);

// Keep files alias for backward compatibility
export const files = documents;

export const fetchDocuments = async () => {
    try {
        isLoading.set(true);
        error.set(null);
        const response = await apiClient.get("/api/files");
        documents.set(response.data);
    } catch (err) {
        error.set(
            err instanceof Error ? err.message : "Failed to fetch documents",
        );
        throw err;
    } finally {
        isLoading.set(false);
    }
};

// Keep fetchFiles alias for backward compatibility
export const fetchFiles = fetchDocuments;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB limit

export class FileSizeError extends Error {
    constructor(
        public fileSize: number,
        public maxSize: number = MAX_FILE_SIZE,
    ) {
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
        super(
            `File size (${fileSizeMB} MB) exceeds the maximum limit of ${maxSizeMB} MB`,
        );
        this.name = "FileSizeError";
    }
}

export const uploadFile = async (
    file: File,
    displayName?: string,
    description?: string,
) => {
    // Client-side file size validation
    if (file.size > MAX_FILE_SIZE) {
        const err = new FileSizeError(file.size, MAX_FILE_SIZE);
        error.set(err.message);
        throw err;
    }

    try {
        isLoading.set(true);
        error.set(null);
        const formData = new FormData();
        formData.append("file", file);
        if (displayName) {
            formData.append("displayName", displayName);
        }
        if (description) {
            formData.append("description", description);
        }
        const response = await apiClient.post("/api/files", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        await fetchDocuments();
        return response.data;
    } catch (err: unknown) {
        // Handle HTTP 413 Payload Too Large
        if (err && typeof err === "object" && "response" in err) {
            const axiosError = err as {
                response?: {
                    status?: number;
                    data?: {
                        error?: string;
                        maxSize?: number;
                        fileSize?: number;
                    };
                };
            };
            if (axiosError.response?.status === 413) {
                const data = axiosError.response.data;
                const fileSizeErr = new FileSizeError(
                    data?.fileSize || file.size,
                    data?.maxSize || MAX_FILE_SIZE,
                );
                error.set(fileSizeErr.message);
                throw fileSizeErr;
            }
        }
        error.set(err instanceof Error ? err.message : "Failed to upload file");
        throw err;
    } finally {
        isLoading.set(false);
    }
};

export const deleteDocument = async (documentId: string) => {
    try {
        isLoading.set(true);
        error.set(null);
        await apiClient.delete(`/api/files/${documentId}`);
        await fetchDocuments();
    } catch (err) {
        error.set(
            err instanceof Error ? err.message : "Failed to delete document",
        );
        throw err;
    } finally {
        isLoading.set(false);
    }
};

// Keep deleteFile alias for backward compatibility
export const deleteFile = deleteDocument;
