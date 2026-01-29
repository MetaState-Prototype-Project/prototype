<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { PUBLIC_FILE_MANAGER_BASE_URL } from "$env/static/public";
    import {
        fetchFileAccess,
        fetchFolderAccess,
        grantFileAccess,
        grantFolderAccess,
    } from "$lib/stores/access";
    import { currentUser, isAuthenticated } from "$lib/stores/auth";
    import {
        deleteFile,
        fetchFiles,
        files,
        moveFile,
        updateFile,
        uploadFile,
    } from "$lib/stores/files";
    import {
        createFolder,
        deleteFolder,
        fetchFolderTree,
        fetchFolders,
        folderTree,
        folders,
        moveFolder,
    } from "$lib/stores/folders";
    import { toast } from "$lib/stores/toast";
    import { apiClient } from "$lib/utils/axios";
    import JSZip from "jszip";
    import { onMount } from "svelte";
    import { get } from "svelte/store";

    const API_BASE_URL =
        PUBLIC_FILE_MANAGER_BASE_URL || "http://localhost:3005";

    // Action to position dropdown using fixed positioning to avoid clipping
    function dropdownPosition(node: HTMLElement) {
        const updatePosition = () => {
            // Get the button element directly from parent
            const container = node.parentElement;
            if (!container) return;
            const button = container.querySelector(
                "button[data-dropdown-button]",
            ) as HTMLElement;
            if (!button) return;

            // Get button's viewport position using getBoundingClientRect
            const buttonRect = button.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - buttonRect.bottom;
            const spaceAbove = buttonRect.top;

            // Measure dropdown
            const dropdownWidth = 192; // w-48 in tailwind
            const dropdownHeight = node.offsetHeight || 120;

            // IMPORTANT: Use fixed positioning to escape table clipping
            node.style.position = "fixed";
            node.style.zIndex = "9999";

            // Align right edge of dropdown with right edge of button
            node.style.left = `${buttonRect.right - dropdownWidth}px`;
            node.style.right = "auto";

            // Position vertically based on available space
            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                // Position above button
                node.style.bottom = `${viewportHeight - buttonRect.top + 4}px`;
                node.style.top = "auto";
            } else {
                // Position below button
                node.style.top = `${buttonRect.bottom + 4}px`;
                node.style.bottom = "auto";
            }
        };

        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            updatePosition();
        });

        // Update on scroll and resize
        const handleUpdate = () => updatePosition();
        window.addEventListener("scroll", handleUpdate, true);
        window.addEventListener("resize", handleUpdate);

        return {
            update: updatePosition,
            destroy: () => {
                window.removeEventListener("scroll", handleUpdate, true);
                window.removeEventListener("resize", handleUpdate);
            },
        };
    }

    let currentView = $state<"my-files" | "shared">("my-files");
    let currentFolderId = $state<string | null>(null);
    let isLoading = $state(false);
    let showUploadModal = $state(false);
    let showFolderModal = $state(false);
    let showMoveModal = $state(false);
    let showDeleteModal = $state(false);
    let showShareModal = $state(false);
    let showRenameModal = $state(false);
    let itemToShare = $state<{
        type: "file" | "folder";
        id: string;
        name: string;
    } | null>(null);
    let itemToRename = $state<{
        type: "file" | "folder";
        id: string;
        name: string;
        displayName?: string;
    } | null>(null);
    let newName = $state("");
    let selectedFiles = $state<globalThis.File[]>([]);
    let itemToMove = $state<any>(null);
    let itemToDelete = $state<{
        type: "file" | "folder";
        id: string;
        name: string;
    } | null>(null);
    let openDropdownId = $state<string | null>(null);
    let shareSearchQuery = $state("");
    let shareSearchResults = $state<any[]>([]);
    let shareSelectedUsers = $state<any[]>([]);
    let moveModalFolderId = $state<string | null>(null);
    let moveModalBreadcrumbs = $state<
        Array<{ id: string | null; name: string }>
    >([{ id: null, name: "My Files" }]);
    let moveModalFolders = $state<any[]>([]);
    let folderName = $state("");
    let dragOver = $state(false);
    let uploadModalDragOver = $state(false);
    let previewFile = $state<any>(null);
    let previewUrl = $state<string | null>(null);
    let downloadUrl = $state<string | null>(null);

    // Multi-file selection for download
    const DOWNLOAD_BATCH_SIZE = 3; // Number of concurrent downloads
    let selectedFileIds = $state<Set<string>>(new Set());

    // Download modal state
    let showDownloadModal = $state(false);
    let downloadProgress = $state<{
        currentFile: string;
        currentFileIndex: number;
        totalFiles: number;
        fileProgress: number; // 0-100 for current file
        overallProgress: number; // 0-100 for all files
        status: "preparing" | "downloading" | "zipping" | "complete" | "error";
        errorMessage?: string;
        downloadedFiles: Array<{
            name: string;
            size: number;
            status: "done" | "downloading" | "pending";
        }>;
    }>({
        currentFile: "",
        currentFileIndex: 0,
        totalFiles: 0,
        fileProgress: 0,
        overallProgress: 0,
        status: "preparing",
        downloadedFiles: [],
    });
    let breadcrumbs = $state<Array<{ id: string | null; name: string }>>([
        { id: null, name: "My Files" },
    ]);
    let uploadProgress = $state<Record<string, number>>({});
    let fileUploadStatus = $state<
        Record<string, "pending" | "uploading" | "success" | "error">
    >({});
    let isUploading = $state(false);

    // Subscribe to stores at top level to make them reactive
    let user = $state(get(currentUser));
    let filesList = $state(get(files));
    let foldersList = $state(get(folders));

    currentUser.subscribe((u) => {
        user = u;
    });
    files.subscribe((f) => {
        filesList = f;
    });
    folders.subscribe((f) => {
        foldersList = f;
    });

    onMount(() => {
        isAuthenticated.subscribe((auth) => {
            if (!auth) {
                goto("/auth");
            }
        });

        // Load data asynchronously
        (async () => {
            // Check for query params to handle navigation from notifications
            const searchParams = new URLSearchParams(window.location.search);
            const viewParam = searchParams.get("view");
            const folderIdParam = searchParams.get("folderId");

            // First, switch view if specified
            if (viewParam === "shared") {
                currentView = "shared";
            }

            // Then navigate to folder if specified
            if (folderIdParam) {
                currentFolderId = folderIdParam;
            }

            await fetchFolderTree();
            await loadFiles();
            await updateBreadcrumbs();
        })();

        // Close dropdown when clicking outside
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement;
            if (
                !target.closest(".dropdown-container") &&
                !target.closest('button[title="Actions"]')
            ) {
                openDropdownId = null;
            }
        }
        document.addEventListener("click", handleClickOutside);
        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    });

    async function loadFiles() {
        isLoading = true;
        try {
            // Always pass folderId explicitly - null for root, or the actual folderId
            // This ensures root view only shows items with folderId/parentFolderId = null
            const folderId = currentFolderId === null ? null : currentFolderId;
            await Promise.all([fetchFiles(folderId), fetchFolders(folderId)]);
        } catch (error) {
            console.error("Failed to load files:", error);
            toast.error("Failed to load files");
        } finally {
            isLoading = false;
        }
    }

    async function handleFileUpload(filesToUpload: globalThis.File[]) {
        if (filesToUpload.length === 0) return;

        // Client-side validation
        const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
        const validFiles: globalThis.File[] = [];

        for (const file of filesToUpload) {
            if (file.size > MAX_FILE_SIZE) {
                toast.error(
                    `File "${file.name}" exceeds 1GB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`,
                );
            } else {
                validFiles.push(file);
            }
        }

        if (validFiles.length === 0) return;

        isUploading = true;
        uploadProgress = {};
        fileUploadStatus = {};

        // Initialize status for all files
        validFiles.forEach((file) => {
            fileUploadStatus[file.name] = "pending";
            uploadProgress[file.name] = 0;
        });

        let successCount = 0;
        let errorCount = 0;
        let quotaExceeded = false;

        // Upload files sequentially
        for (const file of validFiles) {
            if (quotaExceeded) {
                fileUploadStatus[file.name] = "error";
                errorCount++;
                continue;
            }

            try {
                fileUploadStatus[file.name] = "uploading";

                const formData = new FormData();
                formData.append("file", file);
                if (currentFolderId !== undefined) {
                    formData.append("folderId", currentFolderId || "null");
                }

                const response = await apiClient.post("/api/files", formData, {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            uploadProgress[file.name] = Math.round(
                                (progressEvent.loaded / progressEvent.total) *
                                    100,
                            );
                        }
                    },
                });

                fileUploadStatus[file.name] = "success";
                uploadProgress[file.name] = 100;
                successCount++;
            } catch (error: any) {
                console.error(`Upload failed for ${file.name}:`, error);
                fileUploadStatus[file.name] = "error";
                errorCount++;

                if (error.response?.status === 413) {
                    const errorData = error.response.data;
                    if (errorData.error?.includes("Storage quota")) {
                        quotaExceeded = true;
                        toast.error(
                            `Storage quota exceeded. Stopping uploads. You have ${(errorData.available / 1024 / 1024).toFixed(2)}MB available.`,
                        );
                    } else {
                        toast.error(
                            `File "${file.name}" size exceeds 1GB limit`,
                        );
                    }
                } else {
                    toast.error(`Failed to upload "${file.name}"`);
                }
            }
        }

        // Show summary toast
        if (successCount > 0) {
            if (successCount === validFiles.length) {
                toast.success(
                    `Successfully uploaded ${successCount} ${successCount === 1 ? "file" : "files"}`,
                );
            } else {
                toast.success(
                    `Uploaded ${successCount} of ${validFiles.length} files`,
                );
            }
        }

        // Refresh files and folder tree after upload
        if (successCount > 0) {
            await Promise.all([loadFiles(), fetchFolderTree()]);
        }

        // Reset state after a short delay to show final status
        setTimeout(() => {
            if (
                successCount === validFiles.length ||
                errorCount === validFiles.length
            ) {
                showUploadModal = false;
                selectedFiles = [];
                uploadProgress = {};
                fileUploadStatus = {};
            }
        }, 2000);

        isUploading = false;
    }

    async function handleCreateFolder() {
        if (!folderName.trim()) {
            toast.error("Folder name is required");
            return;
        }

        try {
            isLoading = true;
            await createFolder(folderName.trim(), currentFolderId);
            toast.success("Folder created successfully");
            showFolderModal = false;
            folderName = "";
            await loadFiles();
        } catch (error) {
            console.error("Failed to create folder:", error);
            toast.error("Failed to create folder");
        } finally {
            isLoading = false;
        }
    }

    function openDeleteModal(item: any, type: "file" | "folder") {
        itemToDelete = {
            type,
            id: item.id,
            name: item.displayName || item.name,
        };
        showDeleteModal = true;
    }

    async function handleDelete() {
        if (!itemToDelete) return;

        const itemType = itemToDelete.type;
        const itemName = itemToDelete.name;

        try {
            isLoading = true;
            if (itemType === "file") {
                await deleteFile(itemToDelete.id);
                toast.success("File deleted successfully");
            } else {
                await deleteFolder(itemToDelete.id);
                toast.success("Folder deleted successfully");
            }
            showDeleteModal = false;
            itemToDelete = null;
            await loadFiles();
            await fetchFolderTree();
        } catch (error) {
            console.error("Failed to delete:", error);
            toast.error(
                `Failed to delete ${itemType === "file" ? "file" : "folder"}`,
            );
        } finally {
            isLoading = false;
        }
    }

    async function handleMove(
        item: any,
        type: "file" | "folder",
        folderId: string | null,
    ) {
        try {
            isLoading = true;
            if (type === "file") {
                await moveFile(item.id, folderId);
                toast.success("File moved successfully");
            } else {
                await moveFolder(item.id, folderId);
                toast.success("Folder moved successfully");
            }
            showMoveModal = false;
            itemToMove = null;
            moveModalFolderId = null;
            moveModalBreadcrumbs = [{ id: null, name: "My Files" }];
            await loadFiles();
        } catch (error) {
            console.error("Failed to move:", error);
            toast.error(`Failed to move ${type}`);
        } finally {
            isLoading = false;
        }
    }

    function openRenameModal(item: any, type: "file" | "folder") {
        itemToRename = {
            type,
            id: item.id,
            name: item.name,
            displayName: item.displayName || item.name,
        };
        newName = item.displayName || item.name;
        showRenameModal = true;
        openDropdownId = null;
    }

    async function handleRename() {
        if (!itemToRename || !newName.trim()) {
            toast.error("Please enter a name");
            return;
        }

        const itemType = itemToRename.type;
        try {
            isLoading = true;
            if (itemToRename.type === "file") {
                await updateFile(itemToRename.id, newName.trim());
                toast.success("File renamed successfully");
            } else {
                // For folders, we'll need to add updateFolder to the store
                await apiClient.patch(`/api/folders/${itemToRename.id}`, {
                    name: newName.trim(),
                });
                toast.success("Folder renamed successfully");
            }
            showRenameModal = false;
            itemToRename = null;
            newName = "";
            await loadFiles();
            await fetchFolderTree();
        } catch (error) {
            console.error("Failed to rename:", error);
            toast.error(`Failed to rename ${itemType}`);
        } finally {
            isLoading = false;
        }
    }

    async function openMoveModal(item: any, type: "file" | "folder") {
        itemToMove = { ...item, _type: type };
        moveModalFolderId = null;
        moveModalBreadcrumbs = [{ id: null, name: "My Files" }];
        showMoveModal = true;
        await loadMoveModalFolders(null);
    }

    async function loadMoveModalFolders(folderId: string | null) {
        try {
            const params: any = {};
            if (folderId === null || folderId === undefined) {
                params.parentFolderId = "null";
            } else {
                params.parentFolderId = folderId;
            }
            const response = await apiClient.get("/api/folders", { params });
            moveModalFolders = response.data || [];
        } catch (error) {
            console.error("Failed to load folders for move modal:", error);
            moveModalFolders = [];
        }
    }

    async function navigateMoveModal(folderId: string | null) {
        moveModalFolderId = folderId;
        await loadMoveModalFolders(folderId);
        await updateMoveModalBreadcrumbs(folderId);
    }

    async function updateMoveModalBreadcrumbs(folderId: string | null) {
        if (!folderId) {
            moveModalBreadcrumbs = [{ id: null, name: "My Files" }];
            return;
        }

        const buildPath = async (
            fId: string | null,
            path: Array<{ id: string | null; name: string }> = [],
        ): Promise<Array<{ id: string | null; name: string }>> => {
            if (!fId) {
                return [{ id: null, name: "My Files" }, ...path];
            }

            try {
                const response = await apiClient.get(`/api/folders/${fId}`);
                const folder = response.data;
                const newPath = [{ id: folder.id, name: folder.name }, ...path];
                if (folder.parentFolderId) {
                    return buildPath(folder.parentFolderId, newPath);
                }
                return [{ id: null, name: "My Files" }, ...newPath];
            } catch (error) {
                console.error("Failed to fetch folder for breadcrumb:", error);
                return [{ id: null, name: "My Files" }, ...path];
            }
        };

        moveModalBreadcrumbs = await buildPath(folderId);
    }

    function openShareModal(item: any, type: "file" | "folder") {
        itemToShare = {
            type,
            id: item.id,
            name: item.displayName || item.name,
        };
        shareSearchQuery = "";
        shareSearchResults = [];
        shareSelectedUsers = [];
        showShareModal = true;
        openDropdownId = null;
    }

    async function searchUsersForShare() {
        if (shareSearchQuery.length < 2) {
            shareSearchResults = [];
            return;
        }

        try {
            // Search both users and groups
            const [usersResponse, groupsResponse] = await Promise.all([
                apiClient.get("/api/users/search", {
                    params: { query: shareSearchQuery },
                }),
                apiClient.get("/api/groups/search", {
                    params: { query: shareSearchQuery },
                }),
            ]);

            // Mark users with type 'user' and groups with type 'group'
            const users = (usersResponse.data || []).map((u: any) => ({
                ...u,
                type: "user",
            }));
            const groups = (groupsResponse.data || []).map((g: any) => ({
                ...g,
                type: "group",
                memberCount:
                    (g.members?.length || 0) +
                    (g.participants?.length || 0) +
                    (g.admins?.length || 0),
            }));

            shareSearchResults = [...users, ...groups];
        } catch (error) {
            console.error("Search failed:", error);
            shareSearchResults = [];
        }
    }

    async function handleGrantShare() {
        if (!itemToShare || shareSelectedUsers.length === 0) {
            toast.error("Please select at least one user or group");
            return;
        }

        try {
            isLoading = true;
            let shareCount = 0;

            for (const item of shareSelectedUsers) {
                if (item.type === "group") {
                    // Share with all members of the group
                    const groupMembers = [
                        ...(item.members || []),
                        ...(item.participants || []),
                        ...(item.admins || []),
                    ];

                    // Remove duplicates by id
                    const uniqueMembers = Array.from(
                        new Map(groupMembers.map((m) => [m.id, m])).values(),
                    );

                    for (const member of uniqueMembers) {
                        if (itemToShare.type === "file") {
                            await grantFileAccess(itemToShare.id, member.id);
                        } else {
                            await grantFolderAccess(itemToShare.id, member.id);
                        }
                        shareCount++;
                    }
                } else {
                    // Share with individual user
                    if (itemToShare.type === "file") {
                        await grantFileAccess(itemToShare.id, item.id);
                    } else {
                        await grantFolderAccess(itemToShare.id, item.id);
                    }
                    shareCount++;
                }
            }

            toast.success(
                `${itemToShare.type === "file" ? "File" : "Folder"} shared with ${shareCount} ${shareCount === 1 ? "person" : "people"}`,
            );
            showShareModal = false;
            itemToShare = null;
            shareSelectedUsers = [];
            shareSearchQuery = "";
            shareSearchResults = [];
        } catch (error) {
            console.error("Failed to share:", error);
            toast.error(`Failed to share ${itemToShare?.type || "item"}`);
        } finally {
            isLoading = false;
        }
    }

    function handleFileSelect(event: Event) {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            selectedFiles = Array.from(target.files);
        }
    }

    function handleUploadModalDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        uploadModalDragOver = true;
    }

    function handleUploadModalDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        uploadModalDragOver = false;
    }

    async function handleUploadModalDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        uploadModalDragOver = false;

        if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
            selectedFiles = Array.from(event.dataTransfer.files);
        }
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
        dragOver = true;
    }

    function handleDragLeave() {
        dragOver = false;
    }

    async function handleDrop(event: DragEvent) {
        event.preventDefault();
        dragOver = false;

        if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
            const files = Array.from(event.dataTransfer.files);
            await handleFileUpload(files);
        }
    }

    async function navigateToFolder(folderId: string | null) {
        currentFolderId = folderId;
        clearSelection(); // Clear selection when navigating
        await loadFiles();
        await updateBreadcrumbs();
    }

    async function switchView(view: "my-files" | "shared") {
        if (currentView === view) return; // Don't reload if already on this view
        currentView = view;
        currentFolderId = null; // Reset to root when switching views
        clearSelection(); // Clear selection when switching views
        await loadFiles(); // Reload files when switching views
        await updateBreadcrumbs(); // Update breadcrumbs with correct root name
    }

    async function updateBreadcrumbs() {
        const rootName =
            currentView === "shared" ? "Shared with me" : "My Files";

        if (!currentFolderId) {
            breadcrumbs = [{ id: null, name: rootName }];
            return;
        }

        // Build breadcrumb path by fetching folder details
        const buildPath = async (
            folderId: string | null,
            path: Array<{ id: string | null; name: string }> = [],
            visited: Set<string> = new Set(),
        ): Promise<Array<{ id: string | null; name: string }>> => {
            if (!folderId) {
                return [{ id: null, name: rootName }, ...path];
            }

            // Prevent infinite loops
            if (visited.has(folderId)) {
                return [{ id: null, name: rootName }, ...path];
            }
            visited.add(folderId);

            try {
                // Fetch folder details
                const response = await apiClient.get(
                    `/api/folders/${folderId}`,
                );
                const folder = response.data;

                if (!folder) {
                    return [{ id: null, name: rootName }, ...path];
                }

                const newPath = [{ id: folder.id, name: folder.name }, ...path];
                // Use parentFolderId (not parentId) as that's what the API returns
                if (folder.parentFolderId) {
                    return buildPath(folder.parentFolderId, newPath, visited);
                }
                return [{ id: null, name: rootName }, ...newPath];
            } catch (error) {
                console.error("Failed to fetch folder for breadcrumb:", error);
                return [{ id: null, name: rootName }, ...path];
            }
        };

        breadcrumbs = await buildPath(currentFolderId);
    }

    async function handlePreviewFile(file: any, event: Event) {
        event.stopPropagation();
        if (file.canPreview) {
            previewFile = file;
            // Add auth token as query parameter for img/iframe tags
            const token = localStorage.getItem("file_manager_auth_token");
            previewUrl = `${API_BASE_URL}/api/files/${file.id}/preview?token=${token || ""}`;
            downloadUrl = `${API_BASE_URL}/api/files/${file.id}/download?token=${token || ""}`;
            return;
        }
        // If not previewable, go to detail page
        goto(`/files/${file.id}`);
    }

    function closePreview() {
        previewFile = null;
        previewUrl = null;
        downloadUrl = null;
    }

    function getFileIcon(mimeType: string): string {
        if (mimeType.startsWith("image/")) return "🖼️";
        if (mimeType === "application/pdf") return "📄";
        if (mimeType.includes("text")) return "📝";
        if (mimeType.includes("video")) return "🎥";
        if (mimeType.includes("audio")) return "🎵";
        return "📎";
    }

    function truncateFileName(name: string, maxLength = 32): string {
        if (name.length <= maxLength) return name;
        return name.substring(0, maxLength) + "...";
    }

    function formatFileSize(bytes: number): string {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) +
            " " +
            sizes[i]
        );
    }

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    // Filter files and folders based on current view
    const filteredFiles = $derived.by(() => {
        const filesArray = Array.isArray(filesList) ? filesList : [];
        if (!filesArray.length) {
            return [];
        }
        if (!user?.id) {
            // If user not loaded yet, return all files (will be filtered once user loads)
            return filesArray;
        }
        if (currentView === "my-files") {
            // Only show files owned by current user
            return filesArray.filter((f) => f.ownerId === user.id);
        }
        // Only show files shared with current user (not owned by them)
        return filesArray.filter((f) => f.ownerId !== user.id);
    });

    const filteredFolders = $derived.by(() => {
        const foldersArray = Array.isArray(foldersList) ? foldersList : [];
        if (!foldersArray.length) {
            return [];
        }
        if (!user?.id) {
            // If user not loaded yet, return all folders (will be filtered once user loads)
            return currentView === "my-files" ? foldersArray : [];
        }
        if (currentView === "my-files") {
            // Only show folders owned by current user
            return foldersArray.filter((f) => f.ownerId === user.id);
        }
        // Show folders shared with current user (not owned by them)
        return foldersArray.filter((f) => f.ownerId !== user.id);
    });

    // Combine folders and files, with folders first
    const allItems = $derived.by(() => {
        const foldersList = Array.isArray(filteredFolders)
            ? filteredFolders
            : [];
        const filesList = Array.isArray(filteredFiles) ? filteredFiles : [];

        return [
            ...foldersList.map((f) => ({ ...f, type: "folder" as const })),
            ...filesList.map((f) => ({ ...f, type: "file" as const })),
        ].sort((a, b) => {
            // Folders first, then by date
            if (a.type !== b.type) {
                return a.type === "folder" ? -1 : 1;
            }
            return (
                new Date(b.updatedAt || b.createdAt).getTime() -
                new Date(a.updatedAt || a.createdAt).getTime()
            );
        });
    });

    // Multi-file selection derived states
    const selectableFiles = $derived(
        allItems.filter((item) => item.type === "file"),
    );
    const allFilesSelected = $derived(
        selectableFiles.length > 0 &&
            selectableFiles.every((f) => selectedFileIds.has(f.id)),
    );

    function toggleFileSelection(fileId: string, event: Event) {
        event.stopPropagation();
        const newSet = new Set(selectedFileIds);
        if (newSet.has(fileId)) {
            newSet.delete(fileId);
        } else {
            newSet.add(fileId);
        }
        selectedFileIds = newSet;
    }

    function toggleSelectAll(event: Event) {
        event.stopPropagation();
        if (allFilesSelected) {
            // Deselect all
            selectedFileIds = new Set();
        } else {
            // Select all files
            const newSet = new Set<string>();
            for (const file of selectableFiles) {
                newSet.add(file.id);
            }
            selectedFileIds = newSet;
        }
    }

    function clearSelection() {
        selectedFileIds = new Set();
    }

    function resetDownloadProgress() {
        downloadProgress = {
            currentFile: "",
            currentFileIndex: 0,
            totalFiles: 0,
            fileProgress: 0,
            overallProgress: 0,
            status: "preparing",
            downloadedFiles: [],
        };
    }

    async function downloadSelectedFiles() {
        if (selectedFileIds.size === 0) return;

        const token = localStorage.getItem("file_manager_auth_token");
        const filesToDownload = selectableFiles.filter((f) =>
            selectedFileIds.has(f.id),
        );

        // If only one file, download directly without zipping
        if (filesToDownload.length === 1) {
            const file = filesToDownload[0];
            const url = `${API_BASE_URL}/api/files/${file.id}/download?token=${token || ""}`;
            const link = document.createElement("a");
            link.href = url;
            link.download = file.displayName || file.name;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Download started");
            clearSelection();
            return;
        }

        // Show download modal for multiple files
        showDownloadModal = true;
        resetDownloadProgress();

        downloadProgress = {
            ...downloadProgress,
            totalFiles: filesToDownload.length,
            status: "preparing",
            downloadedFiles: filesToDownload.map((f) => ({
                name: f.displayName || f.name,
                size: f.size,
                status: "pending" as const,
            })),
        };

        try {
            const zip = new JSZip();
            const downloadedBlobs: Array<{ name: string; blob: Blob }> = [];

            // Download files in batches
            for (
                let i = 0;
                i < filesToDownload.length;
                i += DOWNLOAD_BATCH_SIZE
            ) {
                const batch = filesToDownload.slice(i, i + DOWNLOAD_BATCH_SIZE);

                // Mark batch files as downloading
                downloadProgress = {
                    ...downloadProgress,
                    status: "downloading",
                    downloadedFiles: downloadProgress.downloadedFiles.map(
                        (f, idx) => ({
                            ...f,
                            status:
                                idx >= i && idx < i + batch.length
                                    ? ("downloading" as const)
                                    : f.status,
                        }),
                    ),
                };

                // Download batch in parallel
                const batchPromises = batch.map(async (file, batchIdx) => {
                    const globalIdx = i + batchIdx;
                    const url = `${API_BASE_URL}/api/files/${file.id}/download?token=${token || ""}`;

                    try {
                        const response = await fetch(url);
                        if (!response.ok) {
                            throw new Error(`Failed to download ${file.name}`);
                        }

                        const blob = await response.blob();

                        // Update progress for this file
                        downloadProgress = {
                            ...downloadProgress,
                            currentFile: file.displayName || file.name,
                            currentFileIndex: globalIdx + 1,
                            overallProgress: Math.round(
                                ((globalIdx + 1) / filesToDownload.length) * 80,
                            ), // 80% for downloads, 20% for zipping
                            downloadedFiles:
                                downloadProgress.downloadedFiles.map(
                                    (f, idx) =>
                                        idx === globalIdx
                                            ? { ...f, status: "done" as const }
                                            : f,
                                ),
                        };

                        return { name: file.displayName || file.name, blob };
                    } catch (error) {
                        console.error(`Error downloading ${file.name}:`, error);
                        throw error;
                    }
                });

                const results = await Promise.all(batchPromises);
                downloadedBlobs.push(...results);
            }

            // Zipping phase
            downloadProgress = {
                ...downloadProgress,
                status: "zipping",
                currentFile: "Creating zip file...",
                overallProgress: 85,
            };

            // Add all files to zip
            for (const { name, blob } of downloadedBlobs) {
                zip.file(name, blob);
            }

            downloadProgress = {
                ...downloadProgress,
                overallProgress: 95,
            };

            // Generate zip file
            const zipBlob = await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: { level: 1 },
            });

            downloadProgress = {
                ...downloadProgress,
                status: "complete",
                overallProgress: 100,
                currentFile: "Download ready!",
            };

            // Trigger download of the zip file
            const zipUrl = URL.createObjectURL(zipBlob);
            const link = document.createElement("a");
            link.href = zipUrl;
            const timestamp = new Date().toISOString().slice(0, 10);
            link.download = `files-${timestamp}.zip`;
            link.style.display = "none";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(zipUrl);

            // Close modal after a short delay
            setTimeout(() => {
                showDownloadModal = false;
                resetDownloadProgress();
                clearSelection();
            }, 1500);

            toast.success(`Downloaded ${filesToDownload.length} files as zip`);
        } catch (error) {
            console.error("Download error:", error);
            downloadProgress = {
                ...downloadProgress,
                status: "error",
                errorMessage:
                    error instanceof Error
                        ? error.message
                        : "Failed to download files",
            };
        }
    }

    function cancelDownload() {
        showDownloadModal = false;
        resetDownloadProgress();
    }
</script>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Tabs and Action Buttons -->
    <div
        class="mb-6 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
    >
        <nav class="flex gap-2 sm:gap-4">
            <button
                onclick={() => switchView("my-files")}
                class="px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap {currentView ===
                'my-files'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}"
            >
                My Files
            </button>
            <button
                onclick={() => switchView("shared")}
                class="px-3 sm:px-4 py-2 font-medium text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap {currentView ===
                'shared'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}"
            >
                Shared with me
            </button>
        </nav>
        <div class="flex items-center gap-2 w-full sm:w-auto">
            {#if selectedFileIds.size > 0}
                <button
                    onclick={downloadSelectedFiles}
                    class="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                    <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                    </svg>
                    <span class="hidden xs:inline"
                        >Download ({selectedFileIds.size})</span
                    >
                    <span class="xs:hidden">{selectedFileIds.size}</span>
                </button>
                <button
                    onclick={clearSelection}
                    class="px-2 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Clear selection"
                >
                    <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            {/if}
            {#if currentView === "my-files"}
                <button
                    onclick={() => (showFolderModal = true)}
                    class="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                    <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    <span class="hidden xs:inline">New Folder</span>
                    <span class="xs:hidden">Folder</span>
                </button>
                <button
                    onclick={() => (showUploadModal = true)}
                    class="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                    <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    Upload
                </button>
            {/if}
        </div>
    </div>

    <!-- Breadcrumbs (only show when not at root) -->
    {#if breadcrumbs.length > 1 || (breadcrumbs.length === 1 && breadcrumbs[0].id !== null)}
        <div class="mb-6">
            <nav class="flex items-center gap-2 text-sm flex-wrap">
                {#each breadcrumbs as crumb, index}
                    {#if index > 0}
                        <svg
                            class="w-4 h-4 text-gray-400 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    {/if}
                    <button
                        onclick={() => navigateToFolder(crumb.id)}
                        class="text-gray-600 hover:text-gray-900 {index ===
                        breadcrumbs.length - 1
                            ? 'font-semibold text-gray-900'
                            : ''}"
                        title={crumb.name}
                    >
                        {truncateFileName(crumb.name)}
                    </button>
                {/each}
            </nav>
        </div>
    {/if}

    <!-- Selection info bar -->
    {#if selectedFileIds.size > 0}
        <div
            class="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between"
        >
            <div class="flex items-center gap-2">
                <span class="text-sm text-blue-700">
                    {selectedFileIds.size}
                    {selectedFileIds.size === 1 ? "file" : "files"} selected
                </span>
            </div>
            <div class="flex items-center gap-2">
                <button
                    onclick={clearSelection}
                    class="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                    Clear selection
                </button>
            </div>
        </div>
    {/if}

    <div
        class="bg-white rounded-lg border border-gray-200 shadow-sm {dragOver
            ? 'border-blue-500 bg-blue-50'
            : ''} relative overflow-visible"
        style="min-height: 400px;"
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
    >
        {#if isLoading}
            <div class="text-center py-12">
                <div
                    class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"
                ></div>
                <p class="text-gray-600">Loading...</p>
            </div>
        {:else if allItems.length === 0}
            <div class="text-center py-12">
                {#if currentView === "my-files"}
                    <p class="text-gray-500 mb-4">No files or folders yet</p>
                    <p class="text-sm text-gray-400">
                        Drag and drop files here or click Upload
                    </p>
                {:else}
                    <p class="text-gray-500 mb-4">No files shared with you</p>
                    <p class="text-sm text-gray-400">
                        Files that others share with you will appear here
                    </p>
                {/if}
            </div>
        {:else}
            <div class="overflow-x-auto" style="overflow-y: visible;">
                <table class="w-full" style="position: relative;">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th
                                class="px-2 sm:px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-8 sm:w-10"
                            >
                                <input
                                    type="checkbox"
                                    checked={allFilesSelected &&
                                        selectableFiles.length > 0}
                                    disabled={selectableFiles.length === 0}
                                    onclick={toggleSelectAll}
                                    class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    title={allFilesSelected
                                        ? "Deselect all"
                                        : "Select all files"}
                                />
                            </th>
                            <th
                                class="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2"
                            >
                                Name
                            </th>
                            <th
                                class="hidden sm:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Size
                            </th>
                            <th
                                class="hidden sm:table-cell px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                Modified
                            </th>
                            <th
                                class="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-20"
                            >
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody
                        class="bg-white divide-y divide-gray-200"
                        style="position: relative;"
                    >
                        {#each allItems as item}
                            <tr
                                class="hover:bg-gray-50 transition-colors cursor-pointer {item.type ===
                                'folder'
                                    ? ''
                                    : ''} {item.type === 'file' &&
                                selectedFileIds.has(item.id)
                                    ? 'bg-blue-50'
                                    : ''}"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    if (item.type === "folder") {
                                        navigateToFolder(item.id);
                                    } else {
                                        handlePreviewFile(item, e);
                                    }
                                }}
                            >
                                <!-- Checkbox column -->
                                <td
                                    class="px-2 sm:px-3 py-4 whitespace-nowrap text-center w-8 sm:w-10"
                                >
                                    {#if item.type === "file"}
                                        <input
                                            type="checkbox"
                                            checked={selectedFileIds.has(
                                                item.id,
                                            )}
                                            onclick={(e) =>
                                                toggleFileSelection(item.id, e)}
                                            class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                            title="Select for download"
                                        />
                                    {/if}
                                </td>
                                <td
                                    class="px-4 sm:px-6 py-4 whitespace-nowrap w-full sm:w-auto"
                                >
                                    <div class="flex items-center gap-3">
                                        <span class="text-2xl flex-shrink-0">
                                            {item.type === "folder"
                                                ? "📁"
                                                : getFileIcon(
                                                      item.type === "file"
                                                          ? item.mimeType
                                                          : "",
                                                  )}
                                        </span>
                                        <div
                                            class="flex-1 min-w-0"
                                            style="max-width: 90%;"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <div
                                                    class="text-sm font-medium text-gray-900"
                                                    title={item.displayName ||
                                                        item.name}
                                                >
                                                    {truncateFileName(
                                                        item.displayName ||
                                                            item.name,
                                                    )}
                                                </div>
                                                {#if currentView === "shared" && item.owner}
                                                    <span
                                                        class="hidden sm:inline text-xs text-gray-500"
                                                        >by {item.owner.name ||
                                                            item.owner
                                                                .ename}</span
                                                    >
                                                {/if}
                                            </div>
                                            {#if item.type === "file" && item.description}
                                                <div
                                                    class="hidden sm:block text-xs text-gray-500 truncate"
                                                >
                                                    {item.description}
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                </td>
                                <td
                                    class="hidden sm:table-cell px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                >
                                    {item.type === "folder"
                                        ? "—"
                                        : formatFileSize(
                                              item.type === "file"
                                                  ? item.size
                                                  : 0,
                                          )}
                                </td>
                                <td
                                    class="hidden sm:table-cell px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                >
                                    {formatDate(
                                        item.updatedAt || item.createdAt,
                                    )}
                                </td>
                                <td
                                    class="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                                    style="position: relative; overflow: visible;"
                                >
                                    <div
                                        class="relative flex items-center justify-end dropdown-container"
                                        style="position: relative; overflow: visible;"
                                    >
                                        <button
                                            onclick={(e) => {
                                                e.stopPropagation();
                                                openDropdownId =
                                                    openDropdownId === item.id
                                                        ? null
                                                        : item.id;
                                            }}
                                            class="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100 transition-colors"
                                            title="Actions"
                                            data-dropdown-button={item.id}
                                        >
                                            <svg
                                                class="w-5 h-5"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                                                />
                                            </svg>
                                        </button>
                                        {#if openDropdownId === item.id}
                                            <div
                                                class="fixed z-[9999] w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
                                                use:dropdownPosition
                                            >
                                                <div class="py-1">
                                                    {#if currentView === "my-files" && item.ownerId === user?.id}
                                                        <button
                                                            onclick={(e) => {
                                                                e.stopPropagation();
                                                                openDropdownId =
                                                                    null;
                                                                openRenameModal(
                                                                    item,
                                                                    item.type,
                                                                );
                                                            }}
                                                            class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                                        >
                                                            <svg
                                                                class="w-4 h-4"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    stroke-linecap="round"
                                                                    stroke-linejoin="round"
                                                                    stroke-width="2"
                                                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                                />
                                                            </svg>
                                                            Rename
                                                        </button>
                                                        <button
                                                            onclick={(e) => {
                                                                e.stopPropagation();
                                                                openDropdownId =
                                                                    null;
                                                                openMoveModal(
                                                                    item,
                                                                    item.type,
                                                                );
                                                            }}
                                                            class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                                        >
                                                            <svg
                                                                class="w-4 h-4"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    stroke-linecap="round"
                                                                    stroke-linejoin="round"
                                                                    stroke-width="2"
                                                                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                                                />
                                                            </svg>
                                                            Move
                                                        </button>
                                                        <button
                                                            onclick={(e) => {
                                                                e.stopPropagation();
                                                                openDropdownId =
                                                                    null;
                                                                openShareModal(
                                                                    item,
                                                                    item.type,
                                                                );
                                                            }}
                                                            class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                                        >
                                                            <svg
                                                                class="w-4 h-4"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    stroke-linecap="round"
                                                                    stroke-linejoin="round"
                                                                    stroke-width="2"
                                                                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                                                                />
                                                            </svg>
                                                            Share
                                                        </button>
                                                        <button
                                                            onclick={(e) => {
                                                                e.stopPropagation();
                                                                openDropdownId =
                                                                    null;
                                                                openDeleteModal(
                                                                    item,
                                                                    item.type,
                                                                );
                                                            }}
                                                            class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                        >
                                                            <svg
                                                                class="w-4 h-4"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    stroke-linecap="round"
                                                                    stroke-linejoin="round"
                                                                    stroke-width="2"
                                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                                />
                                                            </svg>
                                                            Delete
                                                        </button>
                                                    {:else}
                                                        <button
                                                            onclick={(e) => {
                                                                e.stopPropagation();
                                                                openDropdownId =
                                                                    null;
                                                                if (
                                                                    item.type ===
                                                                    "file"
                                                                ) {
                                                                    goto(
                                                                        `/files/${item.id}`,
                                                                    );
                                                                } else {
                                                                    navigateToFolder(
                                                                        item.id,
                                                                    );
                                                                }
                                                            }}
                                                            class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                                        >
                                                            <svg
                                                                class="w-4 h-4"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path
                                                                    stroke-linecap="round"
                                                                    stroke-linejoin="round"
                                                                    stroke-width="2"
                                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                                />
                                                                <path
                                                                    stroke-linecap="round"
                                                                    stroke-linejoin="round"
                                                                    stroke-width="2"
                                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                                />
                                                            </svg>
                                                            View Details
                                                        </button>
                                                    {/if}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
</div>

<!-- Upload Modal -->
{#if showUploadModal}
    <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
        <div
            class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col"
        >
            <h3 class="text-xl font-bold mb-4">Upload Files</h3>

            <!-- Drag and Drop Area -->
            <div
                class="border-2 border-dashed rounded-lg p-8 text-center transition-colors {uploadModalDragOver
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-gray-50'}"
                ondragover={handleUploadModalDragOver}
                ondragleave={handleUploadModalDragLeave}
                ondrop={handleUploadModalDrop}
            >
                {#if selectedFiles.length > 0}
                    <label
                        class="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer transition-colors mb-4"
                    >
                        <span>Add More Files</span>
                        <input
                            type="file"
                            multiple
                            onchange={handleFileSelect}
                            class="hidden"
                        />
                    </label>
                {:else}
                    <svg
                        class="w-16 h-16 mx-auto text-gray-400 mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                    </svg>
                    <p class="text-gray-600 mb-2 font-medium">
                        Drag and drop your files here
                    </p>
                    <p class="text-sm text-gray-500 mb-4">or</p>
                    <label
                        class="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                    >
                        <span>Browse Files</span>
                        <input
                            type="file"
                            multiple
                            onchange={handleFileSelect}
                            class="hidden"
                        />
                    </label>
                {/if}
            </div>

            <!-- File List -->
            {#if selectedFiles.length > 0}
                <div
                    class="mt-4 flex-1 overflow-y-auto max-h-64 border border-gray-200 rounded-lg p-4"
                >
                    <div class="space-y-2">
                        {#each selectedFiles as file, index}
                            {@const fileName = file.name}
                            {@const status =
                                fileUploadStatus[fileName] || "pending"}
                            {@const progress = uploadProgress[fileName] || 0}
                            <div
                                class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                            >
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2">
                                        <p
                                            class="text-sm font-medium text-gray-900 truncate"
                                            title={file.name}
                                        >
                                            {file.name}
                                        </p>
                                        {#if status === "success"}
                                            <svg
                                                class="w-5 h-5 text-green-500 flex-shrink-0"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="2"
                                                    d="M5 13l4 4L19 7"
                                                />
                                            </svg>
                                        {:else if status === "error"}
                                            <svg
                                                class="w-5 h-5 text-red-500 flex-shrink-0"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                    stroke-width="2"
                                                    d="M6 18L18 6M6 6l12 12"
                                                />
                                            </svg>
                                        {/if}
                                    </div>
                                    <p class="text-xs text-gray-500 mt-1">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                    {#if status === "uploading"}
                                        <div class="mt-2">
                                            <div
                                                class="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden"
                                            >
                                                <div
                                                    class="h-1.5 bg-blue-600 rounded-full transition-all duration-300"
                                                    style="width: {progress}%"
                                                ></div>
                                            </div>
                                            <p
                                                class="text-xs text-gray-600 mt-1"
                                            >
                                                {progress}%
                                            </p>
                                        </div>
                                    {:else if status === "error"}
                                        <p class="text-xs text-red-600 mt-1">
                                            Upload failed
                                        </p>
                                    {/if}
                                </div>
                                {#if !isUploading && status !== "uploading"}
                                    <button
                                        onclick={() => {
                                            selectedFiles =
                                                selectedFiles.filter(
                                                    (_, i) => i !== index,
                                                );
                                            delete uploadProgress[fileName];
                                            delete fileUploadStatus[fileName];
                                        }}
                                        class="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                                        title="Remove file"
                                    >
                                        <svg
                                            class="w-5 h-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                stroke-width="2"
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </button>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <div class="flex gap-2 justify-end mt-6">
                <button
                    onclick={() => {
                        showUploadModal = false;
                        selectedFiles = [];
                        uploadModalDragOver = false;
                        uploadProgress = {};
                        fileUploadStatus = {};
                    }}
                    disabled={isUploading}
                    class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Cancel
                </button>
                <button
                    onclick={() =>
                        selectedFiles.length > 0 &&
                        handleFileUpload(selectedFiles)}
                    disabled={selectedFiles.length === 0 || isUploading}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isUploading
                        ? "Uploading..."
                        : `Upload ${selectedFiles.length} ${selectedFiles.length === 1 ? "File" : "Files"}`}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Folder Modal -->
{#if showFolderModal}
    <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 class="text-xl font-bold mb-4">Create Folder</h3>
            <input
                type="text"
                bind:value={folderName}
                placeholder="Folder name"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
                onkeydown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
            <div class="flex gap-2 justify-end">
                <button
                    onclick={() => {
                        showFolderModal = false;
                        folderName = "";
                    }}
                    class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                    Cancel
                </button>
                <button
                    onclick={handleCreateFolder}
                    disabled={isLoading}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    Create
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Move Modal -->
{#if showMoveModal && itemToMove}
    <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
        <div
            class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
        >
            <h3 class="text-xl font-bold mb-4">
                Move {itemToMove._type === "file" ? "File" : "Folder"}
            </h3>
            <p class="text-sm text-gray-600 mb-4">
                Moving: <strong
                    >{itemToMove.displayName || itemToMove.name}</strong
                >
            </p>

            <!-- Breadcrumbs -->
            <div class="mb-4 pb-4 border-b border-gray-200">
                <nav class="flex items-center gap-2 text-sm">
                    {#each moveModalBreadcrumbs as crumb, index}
                        {#if index > 0}
                            <svg
                                class="w-4 h-4 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                        {/if}
                        <button
                            onclick={() => navigateMoveModal(crumb.id)}
                            class="text-gray-600 hover:text-gray-900 {index ===
                            moveModalBreadcrumbs.length - 1
                                ? 'font-semibold text-gray-900'
                                : ''}"
                        >
                            {crumb.name}
                        </button>
                    {/each}
                </nav>
            </div>

            <!-- Folder List -->
            <div
                class="flex-1 overflow-y-auto mb-4 border border-gray-200 rounded-lg"
            >
                {#if moveModalFolders.length === 0}
                    <div class="p-8 text-center text-gray-500">
                        <p>No folders in this location</p>
                    </div>
                {:else}
                    <div class="divide-y divide-gray-200">
                        {#each moveModalFolders.filter((f) => itemToMove?._type !== "folder" || f.id !== itemToMove?.id) as folder}
                            <button
                                onclick={() => navigateMoveModal(folder.id)}
                                class="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                            >
                                <span class="text-2xl">📁</span>
                                <span class="font-medium text-gray-900"
                                    >{folder.name}</span
                                >
                                <svg
                                    class="w-5 h-5 text-gray-400 ml-auto"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Current Location Info -->
            <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p class="text-sm text-gray-700">
                    <span class="font-medium">Current location:</span>
                    {moveModalBreadcrumbs[moveModalBreadcrumbs.length - 1].name}
                </p>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 justify-end">
                <button
                    onclick={() => {
                        showMoveModal = false;
                        itemToMove = null;
                        moveModalFolderId = null;
                        moveModalBreadcrumbs = [{ id: null, name: "My Files" }];
                    }}
                    class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                    Cancel
                </button>
                <button
                    onclick={() =>
                        handleMove(
                            itemToMove,
                            itemToMove._type,
                            moveModalFolderId,
                        )}
                    disabled={isLoading}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    Move Here
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && itemToDelete}
    <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 class="text-xl font-bold mb-4">
                Delete {itemToDelete.type === "file" ? "File" : "Folder"}
            </h3>
            <p class="text-gray-700 mb-2">
                Are you sure you want to delete <strong
                    >{itemToDelete.name}</strong
                >?
            </p>
            {#if itemToDelete.type === "folder"}
                <p class="text-sm text-red-600 mb-4">
                    ⚠️ This will delete the folder and all its contents
                    permanently.
                </p>
            {:else}
                <p class="text-sm text-red-600 mb-4">
                    ⚠️ This action cannot be undone.
                </p>
            {/if}
            <div class="flex gap-2 justify-end">
                <button
                    onclick={() => {
                        showDeleteModal = false;
                        itemToDelete = null;
                    }}
                    class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                    Cancel
                </button>
                <button
                    onclick={handleDelete}
                    class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                    Delete
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Share Modal -->
{#if showShareModal && itemToShare}
    <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onclick={() => {
            showShareModal = false;
            itemToShare = null;
            shareSelectedUsers = [];
            shareSearchQuery = "";
            shareSearchResults = [];
        }}
    >
        <div
            class="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto"
            onclick={(e) => e.stopPropagation()}
        >
            <h3 class="text-xl font-bold mb-4">
                Share {itemToShare.type === "file" ? "File" : "Folder"}
            </h3>
            <p class="text-sm text-gray-600 mb-4">
                Sharing: <strong>{itemToShare.name}</strong>
            </p>
            <input
                type="text"
                bind:value={shareSearchQuery}
                oninput={searchUsersForShare}
                placeholder="Search users or groups..."
                class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            />
            {#if shareSearchResults.length > 0}
                <div class="mb-4 max-h-60 overflow-y-auto">
                    {#each shareSearchResults as item}
                        <div
                            class="p-3 border border-gray-200 rounded mb-2 cursor-pointer hover:bg-gray-50 {shareSelectedUsers.find(
                                (u) => u.id === item.id,
                            )
                                ? 'bg-blue-50 border-blue-300'
                                : ''}"
                            onclick={() => {
                                if (
                                    shareSelectedUsers.find(
                                        (u) => u.id === item.id,
                                    )
                                ) {
                                    shareSelectedUsers =
                                        shareSelectedUsers.filter(
                                            (u) => u.id !== item.id,
                                        );
                                } else {
                                    shareSelectedUsers = [
                                        ...shareSelectedUsers,
                                        item,
                                    ];
                                }
                            }}
                        >
                            <div class="flex items-center gap-2">
                                {#if item.type === "group"}
                                    <svg
                                        class="w-5 h-5 text-blue-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                        />
                                    </svg>
                                    <div class="flex-1">
                                        <div class="font-medium text-gray-900">
                                            {item.name}
                                        </div>
                                        <div class="text-xs text-gray-500">
                                            {item.memberCount}
                                            {item.memberCount === 1
                                                ? "member"
                                                : "members"}
                                        </div>
                                    </div>
                                {:else}
                                    <svg
                                        class="w-5 h-5 text-gray-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        />
                                    </svg>
                                    <div class="flex-1">
                                        <div class="font-medium text-gray-900">
                                            {item.name || item.ename}
                                        </div>
                                        {#if item.name && item.ename}
                                            <div class="text-xs text-gray-500">
                                                @{item.ename.replace(/^@+/, "")}
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
            <div class="flex gap-2 justify-end">
                <button
                    onclick={() => {
                        showShareModal = false;
                        itemToShare = null;
                        shareSelectedUsers = [];
                        shareSearchQuery = "";
                        shareSearchResults = [];
                    }}
                    class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                    Cancel
                </button>
                <button
                    onclick={handleGrantShare}
                    disabled={isLoading || shareSelectedUsers.length === 0}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Share
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Rename Modal -->
{#if showRenameModal && itemToRename}
    <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
        <div class="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 class="text-xl font-bold mb-4">
                Rename {itemToRename.type === "file" ? "File" : "Folder"}
            </h3>
            <input
                type="text"
                bind:value={newName}
                placeholder="Enter new name"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
                onkeydown={(e) => {
                    if (e.key === "Enter" && newName.trim()) {
                        handleRename();
                    }
                }}
            />
            <div class="flex gap-2 justify-end">
                <button
                    onclick={() => {
                        showRenameModal = false;
                        itemToRename = null;
                        newName = "";
                    }}
                    class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                    Cancel
                </button>
                <button
                    onclick={handleRename}
                    disabled={!newName.trim() || isLoading}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? "Renaming..." : "Rename"}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Preview Modal -->
{#if previewFile && previewUrl}
    <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onclick={closePreview}
    >
        <div
            class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto"
            onclick={(e) => e.stopPropagation()}
        >
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold">
                    {previewFile.displayName || previewFile.name}
                </h3>
                <button
                    onclick={closePreview}
                    class="text-gray-500 hover:text-gray-700"
                >
                    <svg
                        class="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
            {#if previewFile.mimeType.startsWith("image/")}
                <img
                    src={previewUrl}
                    alt={previewFile.name}
                    class="max-w-full h-auto rounded-lg"
                />
            {:else if previewFile.mimeType === "application/pdf"}
                <iframe
                    src={previewUrl}
                    class="w-full h-[600px] rounded-lg border border-gray-200"
                ></iframe>
            {/if}
            <div class="mt-4 flex gap-2 justify-end">
                <a
                    href={downloadUrl}
                    download={previewFile.name}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Download
                </a>
                <button
                    onclick={() => goto(`/files/${previewFile.id}`)}
                    class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    View Details
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Download Progress Modal -->
{#if showDownloadModal}
    <div
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onclick={(e) => {
            if (
                e.target === e.currentTarget &&
                downloadProgress.status !== "downloading" &&
                downloadProgress.status !== "zipping"
            ) {
                cancelDownload();
            }
        }}
    >
        <div
            class="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Header -->
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">
                    {#if downloadProgress.status === "preparing"}
                        Preparing Download...
                    {:else if downloadProgress.status === "downloading"}
                        Downloading Files
                    {:else if downloadProgress.status === "zipping"}
                        Creating Zip File
                    {:else if downloadProgress.status === "complete"}
                        Download Complete!
                    {:else if downloadProgress.status === "error"}
                        Download Failed
                    {/if}
                </h3>
                {#if downloadProgress.status !== "downloading" && downloadProgress.status !== "zipping"}
                    <button
                        onclick={cancelDownload}
                        class="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg
                            class="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                {/if}
            </div>

            <!-- Status message -->
            <div class="mb-4">
                {#if downloadProgress.status === "error"}
                    <div class="flex items-center gap-2 text-red-600">
                        <svg
                            class="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        <span class="text-sm"
                            >{downloadProgress.errorMessage}</span
                        >
                    </div>
                {:else if downloadProgress.status === "complete"}
                    <div class="flex items-center gap-2 text-green-600">
                        <svg
                            class="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                        <span class="text-sm"
                            >Your zip file is ready and downloading!</span
                        >
                    </div>
                {:else}
                    <p class="text-sm text-gray-600">
                        {#if downloadProgress.status === "downloading"}
                            Downloading file {downloadProgress.currentFileIndex} of
                            {downloadProgress.totalFiles}
                        {:else if downloadProgress.status === "zipping"}
                            Compressing {downloadProgress.totalFiles} files into a
                            zip...
                        {:else}
                            Please wait while we prepare your download...
                        {/if}
                    </p>
                    {#if downloadProgress.currentFile && downloadProgress.status === "downloading"}
                        <p
                            class="text-xs text-gray-500 mt-1 truncate"
                            title={downloadProgress.currentFile}
                        >
                            Current: {downloadProgress.currentFile}
                        </p>
                    {/if}
                {/if}
            </div>

            <!-- Overall Progress Bar -->
            <div class="mb-4">
                <div class="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Overall Progress</span>
                    <span>{downloadProgress.overallProgress}%</span>
                </div>
                <div
                    class="w-full bg-gray-200 rounded-full h-3 overflow-hidden"
                >
                    <div
                        class="h-full rounded-full transition-all duration-300 ease-out {downloadProgress.status ===
                        'error'
                            ? 'bg-red-500'
                            : downloadProgress.status === 'complete'
                              ? 'bg-green-500'
                              : 'bg-blue-600'}"
                        style="width: {downloadProgress.overallProgress}%"
                    ></div>
                </div>
            </div>

            <!-- File List -->
            {#if downloadProgress.downloadedFiles.length > 0}
                <div
                    class="border border-gray-200 rounded-lg max-h-48 overflow-y-auto"
                >
                    <div class="divide-y divide-gray-100">
                        {#each downloadProgress.downloadedFiles as file, idx}
                            <div
                                class="flex items-center gap-3 px-3 py-2 text-sm {file.status ===
                                'downloading'
                                    ? 'bg-blue-50'
                                    : ''}"
                            >
                                <!-- Status Icon -->
                                <div class="flex-shrink-0">
                                    {#if file.status === "done"}
                                        <svg
                                            class="w-4 h-4 text-green-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                                stroke-width="2"
                                                d="M5 13l4 4L19 7"
                                            />
                                        </svg>
                                    {:else if file.status === "downloading"}
                                        <div
                                            class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
                                        ></div>
                                    {:else}
                                        <div
                                            class="w-4 h-4 border-2 border-gray-300 rounded-full"
                                        ></div>
                                    {/if}
                                </div>
                                <!-- File Name -->
                                <span
                                    class="flex-1 truncate text-gray-700"
                                    title={file.name}
                                >
                                    {file.name}
                                </span>
                                <!-- File Size -->
                                <span
                                    class="flex-shrink-0 text-xs text-gray-400"
                                >
                                    {formatFileSize(file.size)}
                                </span>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- Warning Message -->
            {#if downloadProgress.status === "downloading" || downloadProgress.status === "zipping"}
                <div
                    class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg"
                >
                    <div class="flex items-start gap-2">
                        <svg
                            class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                        <p class="text-xs text-amber-700">
                            Please don't close this window or navigate away
                            while the download is in progress.
                        </p>
                    </div>
                </div>
            {/if}

            <!-- Action Buttons -->
            <div class="mt-4 flex justify-end gap-2">
                {#if downloadProgress.status === "error"}
                    <button
                        onclick={cancelDownload}
                        class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onclick={downloadSelectedFiles}
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Retry
                    </button>
                {:else if downloadProgress.status === "complete"}
                    <button
                        onclick={cancelDownload}
                        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Done
                    </button>
                {/if}
            </div>
        </div>
    </div>
{/if}
