<script lang="ts">
import * as Button from "$lib/ui/Button";
import { QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

export let isOpen: boolean;
export let platform: string | null | undefined;
export let redirect: string | null | undefined;
export let onConfirm: () => void;
export let onOpenChange: (value: boolean) => void;

let internalOpen = isOpen;
let lastReportedOpen = internalOpen;

// Preserve your original sync functionality
$: if (isOpen !== internalOpen) {
    internalOpen = isOpen;
}

$: if (internalOpen !== lastReportedOpen) {
    lastReportedOpen = internalOpen;
    onOpenChange?.(internalOpen);
}
</script>

{#if internalOpen}
    <div
        class="loggedin-drawer fixed inset-0 z-50 flex flex-col items-start justify-center gap-4 bg-white p-4"
    >
        <div
            class="flex justify-center mb-4 relative items-center overflow-hidden bg-gray rounded-xl p-4 h-[72px] w-[72px]"
        >
            <div
                class="bg-white h-[16px] w-[200px] -rotate-45 absolute top-1"
            ></div>
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

        <h4>You're logged in!</h4>
        <p class="text-black-700">You're now connected to {platform}</p>

        <div class="flex flex-col gap-3 mt-4">
            {#if redirect && platform}
                <div class="text-center mt-3">
                    <p class="text-sm text-gray-600">
                        You may return to {platform} and continue there
                    </p>
                </div>
            {/if}

            <Button.Action variant="soft" class="w-full" callback={onConfirm}>
                Ok
            </Button.Action>
        </div>
    </div>
{/if}
