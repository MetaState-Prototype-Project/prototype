import { onMount } from "svelte";
import { goto } from "$app/navigation";
import { isAuthenticated } from "$lib/stores/auth";
import {
    files,
    fetchFiles,
    uploadFile,
    FileSizeError,
} from "$lib/stores/files";
import { apiClient } from "$lib/utils/axios";
import { inviteSignees } from "$lib/stores/invitations";

let currentStep = $state(1);
let selectedFile = $state<any>(null);
let uploadedFile = $state<File | null>(null);
let searchQuery = $state("");
let searchResults = $state<any[]>([]);
let selectedUsers = $state<any[]>([]);
let isLoading = $state(false);
let isSubmitting = $state(false);
let dragOver = $state(false);
let currentUserId = $state<string | null>(null);
let displayName = $state("");
let description = $state("");
// All files available to select for a new container (includes File Manager–only uploads)
let selectableFiles = $state<any[]>([]);

onMount(async () => {
    isAuthenticated.subscribe((auth) => {
        if (!auth) {
            goto("/auth");
        }
    });

    // Get current user ID from API
    try {
        const response = await apiClient.get("/api/users");
        currentUserId = response.data.id;
    } catch (err) {
        console.error("Failed to get current user:", err);
    }

    // Load all files for picker (list=all) so user can select any file, including those not yet used as containers
    try {
        const res = await apiClient.get("/api/files", {
            params: { list: "all" },
        });
        selectableFiles = res.data ?? [];
    } catch (err) {
        console.error("Failed to load selectable files:", err);
    }
});

async function handleFileUpload(file: File) {
    try {
        isLoading = true;
        // Set default display name to file name if not set
        const nameToUse = displayName.trim() || file.name;
        const result = await uploadFile(
            file,
            nameToUse,
            description.trim() || undefined,
        );
        uploadedFile = file;
        selectedFile = result;
        // Update displayName if it was empty
        if (!displayName.trim()) {
            displayName = file.name;
        }
    } catch (err) {
        console.error("Upload failed:", err);
        if (err instanceof FileSizeError) {
            alert(err.message);
        } else {
            alert("Failed to upload file. Please try again.");
        }
        throw err;
    } finally {
        isLoading = false;
    }
}

function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        // Don't upload immediately - just store the file
        uploadedFile = target.files[0];
        selectedFile = null;
        // Reset display name and description for new upload
        displayName = target.files[0].name;
        description = "";
    }
}

function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragOver = true;
}

function handleDragLeave() {
    dragOver = false;
}

function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
        // Don't upload immediately - just store the file
        uploadedFile = event.dataTransfer.files[0];
        selectedFile = null;
        // Reset display name and description for new upload
        displayName = event.dataTransfer.files[0].name;
        description = "";
    }
}

async function searchUsers() {
    if (searchQuery.length < 2) {
        searchResults = [];
        return;
    }

    try {
        isLoading = true;
        const response = await apiClient.get("/api/users/search", {
            params: { query: searchQuery, limit: 10 },
        });
        searchResults = response.data;
    } catch (err) {
        console.error("Search failed:", err);
        searchResults = [];
    } finally {
        isLoading = false;
    }
}

function addUser(user: any) {
    // Don't allow user to invite themselves
    if (currentUserId && user.id === currentUserId) {
        alert(
            "You cannot invite yourself. You are automatically added as a signee.",
        );
        return;
    }

    if (!selectedUsers.find((u) => u.id === user.id)) {
        selectedUsers = [...selectedUsers, user];
    }
    searchQuery = "";
    searchResults = [];
}

function removeUser(userId: string) {
    selectedUsers = selectedUsers.filter((u) => u.id !== userId);
}

async function handleSubmit() {
    if (!selectedFile) {
        alert("Please select a file");
        return;
    }

    try {
        isSubmitting = true;
        const userIds = selectedUsers.map((u) => u.id);

        // Backend will automatically add owner as signee
        await inviteSignees(selectedFile.id, userIds);

        goto(`/files/${selectedFile.id}`);
    } catch (err) {
        console.error("Failed to create invitations:", err);
        alert("Failed to send invitations");
    } finally {
        isSubmitting = false;
    }
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
        Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
}

function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType === "application/pdf") return "📄";
    if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
        return "📊";
    return "📎";
}
