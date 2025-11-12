<script lang="ts">
import { Drawer } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

export let isOpen: boolean;
export let platform: string | null | undefined;
export let hostname: string | null | undefined;
export let scannedContent: string | undefined;
export let isSigningRequest: boolean;
export let onConfirm: () => void;
export let onDecline: () => void;
export let onOpenChange: (value: boolean) => void;

let internalOpen = isOpen;
let lastReportedOpen = internalOpen;

$: if (isOpen !== internalOpen) {
    internalOpen = isOpen;
}

$: if (internalOpen !== lastReportedOpen) {
    lastReportedOpen = internalOpen;
    onOpenChange?.(internalOpen);
}
</script>

<Drawer
    title="Scan QR Code"
    bind:isPaneOpen={internalOpen}
    class="flex flex-col gap-4 items-center justify-center"
>
    <div
        class="flex justify-center mb-4 relative items-center overflow-hidden bg-gray rounded-xl p-4 h-[72px] w-[72px]"
    >
        <div class="bg-white h-[16px] w-[200px] -rotate-45 absolute top-1"></div>
        <div
            class="bg-white h-[16px] w-[200px] -rotate-45 absolute bottom-1"
        ></div>
        <HugeiconsIcon
            size={40}
            className="z-10"
            icon={QrCodeIcon}
            strokeWidth={1.5}
            color="var(--color-primary)"
        />
    </div>

    <h4>Code scanned!</h4>
    <p class="text-black-700">You're trying to access the following site</p>

    <div class="bg-gray rounded-2xl w-full p-4 mt-4">
        <h4 class="text-base text-black-700">Platform Name</h4>
        <p class="text-black-700 font-normal capitalize">
            {platform ?? "Unable to get name"}
        </p>
    </div>

    <div class="bg-gray rounded-2xl w-full p-4">
        <h4 class="text-base text-black-700">Website URL</h4>
        <p class="text-black-700 font-normal">
            {hostname ?? scannedContent}
        </p>
    </div>
    <div class="flex justify-center gap-3 items-center mt-4">
        <Button.Action
            variant="danger-soft"
            class="w-full"
            callback={onDecline}
        >
            Decline
        </Button.Action>
        <Button.Action variant="solid" class="w-full" callback={onConfirm}>
            Confirm
        </Button.Action>
    </div>

    {#if isSigningRequest === false}
        <div class="text-center mt-3">
            <p class="text-sm text-gray-600">
                After confirmation, you may return to {platform} and continue
                there
            </p>
        </div>
    {/if}
</Drawer>

