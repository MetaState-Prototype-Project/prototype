import { writable } from "svelte/store";
import { apiClient } from "$lib/utils/axios";

export const files = writable<any[]>([]);
export const isLoading = writable(false);

export interface File {
    id: string;
    name: string;
    displayName: string | null;
    description: string | null;
    mimeType: string;
    size: number;
    md5Hash: string;
    ownerId: string;
    folderId: string | null;
    createdAt: string;
    updatedAt: string;
    canPreview: boolean;
}

export const fetchFiles = async (folderId?: string | null) => {
    try {
        isLoading.set(true);
        // Always pass folderId - use 'null' string for root, or the actual folderId
        const params: any = {};
        if (folderId === null || folderId === undefined) {
            params.folderId = "null";
        } else {
            params.folderId = folderId;
        }
        const response = await apiClient.get("/api/files", { params });
        files.set(response.data || []);
    } catch (error) {
        console.error("Failed to fetch files:", error);
        files.set([]);
    } finally {
        isLoading.set(false);
    }
};

export const uploadFile = async (
    file: globalThis.File,
    folderId?: string | null,
    displayName?: string,
    description?: string,
): Promise<File> => {
    const formData = new FormData();
    formData.append("file", file);
    if (folderId !== undefined) {
        formData.append("folderId", folderId || "null");
    }
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

    const newFile = response.data;
    files.update((files) => [newFile, ...files]);
    return newFile;
};

export const deleteFile = async (fileId: string): Promise<void> => {
    await apiClient.delete(`/api/files/${fileId}`);
    files.update((files) => files.filter((f) => f.id !== fileId));
};

export const updateFile = async (
    fileId: string,
    displayName?: string,
    description?: string,
    folderId?: string | null,
): Promise<File> => {
    const response = await apiClient.patch(`/api/files/${fileId}`, {
        displayName,
        description,
        folderId: folderId !== undefined ? folderId || "null" : undefined,
    });

    const updatedFile = response.data;
    files.update((files) =>
        files.map((f) => (f.id === fileId ? updatedFile : f)),
    );
    return updatedFile;
};

export const moveFile = async (
    fileId: string,
    folderId: string | null,
): Promise<void> => {
    const response = await apiClient.post(`/api/files/${fileId}/move`, {
        folderId: folderId || "null",
    });
    const updatedFile = response.data;
    // Update the file in the store with the new folderId
    files.update((files) =>
        files.map((f) =>
            f.id === fileId ? { ...f, folderId: updatedFile.folderId } : f,
        ),
    );
};
