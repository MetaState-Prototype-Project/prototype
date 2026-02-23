import { writable } from "svelte/store";
import { apiClient } from "$lib/utils/axios";

export const folders = writable<any[]>([]);
export const folderTree = writable<any[]>([]);
export const isLoading = writable(false);

export interface Folder {
    id: string;
    name: string;
    ownerId: string;
    parentFolderId: string | null;
    createdAt: string;
    updatedAt: string;
}

export const fetchFolders = async (parentFolderId?: string | null) => {
    try {
        isLoading.set(true);
        // Always pass parentFolderId - use 'null' string for root, or the actual parentFolderId
        const params: any = {};
        if (parentFolderId === null || parentFolderId === undefined) {
            params.parentFolderId = "null";
        } else {
            params.parentFolderId = parentFolderId;
        }
        const response = await apiClient.get("/api/folders", { params });
        folders.set(response.data || []);
    } catch (error) {
        console.error("Failed to fetch folders:", error);
        folders.set([]);
    } finally {
        isLoading.set(false);
    }
};

export const fetchFolderTree = async () => {
    try {
        const response = await apiClient.get("/api/folders/tree");
        folderTree.set(response.data || []);
    } catch (error) {
        console.error("Failed to fetch folder tree:", error);
        folderTree.set([]);
    }
};

export const createFolder = async (
    name: string,
    parentFolderId?: string | null,
): Promise<Folder> => {
    const response = await apiClient.post("/api/folders", {
        name,
        parentFolderId: parentFolderId || null,
    });

    const newFolder = response.data;
    folders.update((folders) => [newFolder, ...folders]);
    return newFolder;
};

export const deleteFolder = async (folderId: string): Promise<void> => {
    await apiClient.delete(`/api/folders/${folderId}`);
    folders.update((folders) => folders.filter((f) => f.id !== folderId));
};

export const updateFolder = async (
    folderId: string,
    name?: string,
    parentFolderId?: string | null,
): Promise<Folder> => {
    const response = await apiClient.patch(`/api/folders/${folderId}`, {
        name,
        parentFolderId:
            parentFolderId !== undefined ? parentFolderId || "null" : undefined,
    });

    const updatedFolder = response.data;
    folders.update((folders) =>
        folders.map((f) => (f.id === folderId ? updatedFolder : f)),
    );
    return updatedFolder;
};

export const moveFolder = async (
    folderId: string,
    parentFolderId: string | null,
): Promise<void> => {
    const response = await apiClient.post(`/api/folders/${folderId}/move`, {
        parentFolderId: parentFolderId || "null",
    });
    const updatedFolder = response.data;
    // Update the folder in the store with the new parentFolderId
    folders.update((folders) =>
        folders.map((f) =>
            f.id === folderId
                ? { ...f, parentFolderId: updatedFolder.parentFolderId }
                : f,
        ),
    );
};

export const getFolderContents = async (
    folderId: string,
): Promise<{ files: any[]; folders: any[] }> => {
    const response = await apiClient.get(`/api/folders/${folderId}/contents`);
    return response.data;
};
