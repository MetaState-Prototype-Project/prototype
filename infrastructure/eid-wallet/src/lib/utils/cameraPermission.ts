import {
    type PermissionState,
    checkPermissions,
    openAppSettings,
    requestPermissions,
} from "@tauri-apps/plugin-barcode-scanner";
import { writable, type Writable } from "svelte/store";

export interface CameraPermissionState {
    status: PermissionState | null;
    isDenied: boolean;
    isGranted: boolean;
    isChecking: boolean;
}

export interface CameraPermissionResult {
    permissionState: Writable<CameraPermissionState>;
    checkAndRequestPermission: () => Promise<boolean>;
    retryPermission: () => Promise<boolean>;
    openSettings: () => Promise<void>;
}

/**
 * Creates a camera permission manager that handles checking, requesting,
 * and managing camera permissions using Tauri's barcode-scanner plugin.
 * 
 * This can be used in both the scan page and onboarding flows where camera
 * access is required.
 */
export function createCameraPermissionManager(): CameraPermissionResult {
    const permissionState = writable<CameraPermissionState>({
        status: null,
        isDenied: false,
        isGranted: false,
        isChecking: false,
    });

    /**
     * Check current permission status and request if needed.
     * Returns true if permission is granted, false otherwise.
     */
    async function checkAndRequestPermission(): Promise<boolean> {
        permissionState.update((state) => ({
            ...state,
            isChecking: true,
            isDenied: false,
        }));

        let permissions: PermissionState | null = null;

        try {
            permissions = await checkPermissions();
        } catch {
            permissions = null;
        }

        // If permission is prompt or denied, request it
        if (permissions === "prompt" || permissions === "denied") {
            try {
                permissions = await requestPermissions();
            } catch {
                permissions = null;
            }
        }

        const isGranted = permissions === "granted";
        const isDenied = !isGranted;

        permissionState.set({
            status: permissions,
            isDenied,
            isGranted,
            isChecking: false,
        });

        if (isDenied) {
            console.warn("Camera permission denied or unavailable");
        }

        return isGranted;
    }

    /**
     * Retry permission request. If permission was previously denied (not just prompt),
     * this will open app settings since the OS won't show the dialog again.
     */
    async function retryPermission(): Promise<boolean> {
        let permissions: PermissionState | null = null;

        try {
            permissions = await checkPermissions();
        } catch {
            permissions = null;
        }

        // If permission is denied (not just prompt), open app settings
        // because the OS won't show the permission dialog again
        if (permissions === "denied") {
            await openAppSettings();
            return false;
        }

        // Otherwise, attempt to request permissions again
        return checkAndRequestPermission();
    }

    /**
     * Open the app's settings page in system settings.
     */
    async function openSettings(): Promise<void> {
        await openAppSettings();
    }

    return {
        permissionState,
        checkAndRequestPermission,
        retryPermission,
        openSettings,
    };
}
