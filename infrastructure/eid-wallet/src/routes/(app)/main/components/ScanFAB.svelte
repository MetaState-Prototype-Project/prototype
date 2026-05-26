<script lang="ts">
import { goto } from "$app/navigation";
import { CameraPermissionDialog } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { QRIcon } from "$lib/ui/icons";
import {
    type PermissionState,
    checkPermissions,
    openAppSettings,
    requestPermissions,
} from "@tauri-apps/plugin-barcode-scanner";

interface IScanFABProps {
    href?: string;
    /** When true, position fixed at the viewport bottom (the regular FAB).
     *  When false, render inline — used by the welcome tour where the Scan
     *  button is part of the card flow rather than floating. */
    fixed?: boolean;
}

const { href = "/scan-qr", fixed = true }: IScanFABProps = $props();

let permissionDialogOpen = $state(false);
let busy = $state(false);

async function handleScanClick() {
    if (busy) return;
    busy = true;

    try {
        let permission: PermissionState | null = null;
        try {
            permission = await checkPermissions();
        } catch {
            permission = null;
        }
        if (permission === "prompt" || permission === "denied") {
            try {
                permission = await requestPermissions();
            } catch {
                permission = null;
            }
        }

        if (permission === "granted") {
            await goto(href);
        } else {
            permissionDialogOpen = true;
        }
    } finally {
        // Ensure busy clears even if goto() rejects so the FAB stays tappable.
        busy = false;
    }
}

async function handleOpenSettings() {
    permissionDialogOpen = false;
    try {
        await openAppSettings();
    } catch (err) {
        console.error("Failed to open app settings:", err);
    }
}

function handleGoBack() {
    permissionDialogOpen = false;
}
</script>

<div
    class={fixed
        ? "fixed bottom-12 left-1/2 -translate-x-1/2"
        : "flex justify-center"}
>
    <Button.Action
        variant="solid"
        size="md"
        class="mx-auto text-nowrap flex gap-3 uppercase tracking-wide"
        callback={handleScanClick}
        disabled={busy}
    >
        Scan
        <QRIcon size={24} class="ml-2.5" />
    </Button.Action>
</div>

<CameraPermissionDialog
    isOpen={permissionDialogOpen}
    onOpenSettings={handleOpenSettings}
    onGoBack={handleGoBack}
    title="Camera Access Required"
    description="To scan QR codes, please grant camera permission in your device settings."
/>
