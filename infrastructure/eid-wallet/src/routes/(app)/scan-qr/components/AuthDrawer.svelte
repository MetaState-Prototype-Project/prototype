<script lang="ts">
import { BottomSheet } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

export let isOpen: boolean;
export let platform: string | null | undefined;
export let hostname: string | null | undefined;
export let scannedContent: string | undefined;
export let isSigningRequest: boolean;
export let authError: string | null | undefined;
export let authLoading: boolean | undefined;
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

{#if internalOpen}
    <BottomSheet
        isOpen={internalOpen}
        dismissible={false}
        fullScreen={true}
        class="gap-5"
    >
        <div class="flex h-full w-full flex-col">
            <div class="min-h-0 flex flex-1 flex-col items-start overflow-y-auto pt-2">
                <div
                    class="flex justify-center mb-4 relative items-center overflow-hidden bg-gray rounded-xl p-4 h-[72px] w-[72px]"
                >
                    <div
                        class="bg-white h-4 w-[200px] -rotate-45 absolute top-1"
                    ></div>
                    <div
                        class="bg-white h-4 w-[200px] -rotate-45 absolute bottom-1"
                    ></div>
                    <HugeiconsIcon
                        size={40}
                        className="z-10"
                        icon={QrCodeIcon}
                        strokeWidth={1.5}
                        color="var(--color-primary)"
                    />
                </div>

                <h4 class="text-lg font-bold">Code scanned!</h4>
                <p class="mt-1 text-sm leading-relaxed text-black-700">
                    Please review the connection details below.
                </p>

                <div
                    class="w-full mt-6 border border-gray-100 rounded-2xl overflow-hidden bg-gray-50"
                >
                    <table class="w-full border-collapse">
                        <tbody class="divide-y divide-gray-200">
                            <tr>
                                <td class="align-top py-4 px-4">
                                    <div
                                        class="text-xs font-semibold text-black-500 uppercase tracking-wider block"
                                    >
                                        Platform Name
                                    </div>
                                    <div
                                        class="text-sm text-black-700 font-medium capitalize mt-1 block"
                                    >
                                        {platform ?? "Unable to get name"}
                                    </div>
                                </td>
                            </tr>

                            <tr>
                                <td class="align-top py-4 px-4">
                                    <div
                                        class="text-xs font-semibold text-black-500 uppercase tracking-wider block"
                                    >
                                        Website URL
                                    </div>
                                    <div
                                        class="text-sm text-black-700 font-medium break-all mt-1 block"
                                    >
                                        {hostname ?? scannedContent}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {#if authError}
                    <div
                        class="bg-red-50 border border-red-200 rounded-lg p-4 w-full mt-4"
                    >
                        <div class="flex items-center">
                            <div class="shrink-0">
                                <svg
                                    class="h-5 w-5 text-red-400"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div class="ml-3">
                                <h3 class="text-sm font-medium text-red-800">
                                    Error
                                </h3>
                                <div class="mt-1 text-sm text-red-700">
                                    {authError}
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>

            <div class="shrink-0 flex w-full flex-col gap-3 pb-2 pt-6">
                <div
                    class="flex flex-col justify-center gap-3 items-center w-full"
                >
                    {#if authError}
                        <Button.Action
                            variant="solid"
                            class="w-full"
                            callback={onDecline}
                        >
                            Okay
                        </Button.Action>
                    {:else}
                        <Button.Action
                            variant="danger-soft"
                            class="w-full"
                            callback={onDecline}
                            disabled={authLoading}
                        >
                            Decline
                        </Button.Action>
                        <Button.Action
                            variant="solid"
                            class="w-full whitespace-nowrap"
                            callback={onConfirm}
                            disabled={authLoading}
                        >
                            {#if authLoading}
                                Authenticating...
                            {:else}
                                Confirm
                            {/if}
                        </Button.Action>
                    {/if}
                </div>

                {#if isSigningRequest === false}
                    <div class="text-center mt-1">
                        <p class="text-sm text-black-500">
                            After confirmation, you may return to <strong
                                >{platform}</strong
                            > and continue there
                        </p>
                    </div>
                {/if}
            </div>
        </div>
    </BottomSheet>
{/if}
