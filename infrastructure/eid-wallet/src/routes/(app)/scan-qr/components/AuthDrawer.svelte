<script lang="ts">
    import { BottomSheet, PlatformAppCard } from "$lib/ui";
    import * as Button from "$lib/ui/Button";
    import { Cancel01Icon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import { untrack } from "svelte";

    interface IAuthDrawerProps {
        isOpen: boolean;
        platform: string | null | undefined;
        hostname: string | null | undefined;
        scannedContent: string | undefined;
        isSigningRequest: boolean;
        authError: string | null | undefined;
        authLoading: boolean | undefined;
        onConfirm: () => void;
        onDecline: () => void;
        onOpenChange: (value: boolean) => void;
    }

    const {
        isOpen,
        platform,
        hostname,
        scannedContent,
        isSigningRequest,
        authError,
        authLoading,
        onConfirm,
        onDecline,
        onOpenChange,
    }: IAuthDrawerProps = $props();

    let internalOpen = $state(untrack(() => isOpen));
    let lastReportedOpen = $state(untrack(() => internalOpen));

    $effect(() => {
        if (isOpen !== internalOpen) internalOpen = isOpen;
    });

    $effect(() => {
        if (internalOpen !== lastReportedOpen) {
            lastReportedOpen = internalOpen;
            onOpenChange?.(internalOpen);
        }
    });
</script>

{#if internalOpen}
    <BottomSheet
        isOpen={internalOpen}
        dismissible={false}
        fullScreen={true}
        class="gap-5"
    >
        <div class="flex h-full w-full flex-col">
            <div class="flex justify-end pt-2">
                <button
                    type="button"
                    onclick={onDecline}
                    disabled={authLoading}
                    aria-label="Close"
                    class="w-9 h-9 rounded-full bg-gray-100 text-black-700 flex items-center justify-center active:opacity-80 disabled:opacity-40"
                >
                    <HugeiconsIcon
                        icon={Cancel01Icon}
                        size={18}
                        strokeWidth={2}
                    />
                </button>
            </div>

            <div
                class="min-h-0 flex flex-1 flex-col items-center justify-center pt-4 gap-8"
            >
                <div class="flex flex-col items-center gap-2 px-4">
                    <h4
                        class="text-2xl font-medium text-black-900 text-center leading-tight"
                    >
                        You have scanned the<br />login QR code
                    </h4>
                    <p
                        class="text-lg leading-tight text-black-700 opacity-50 text-center"
                    >
                        Please review and confirm that you grant access to your
                        data for the following App
                    </p>
                </div>

                <PlatformAppCard
                    {hostname}
                    platformName={platform ?? hostname ?? scannedContent}
                />

                {#if authError}
                    <div
                        class="bg-red-50 border border-red-200 rounded-2xl p-4 w-full"
                    >
                        <p class="text-sm font-medium text-red-800">Error</p>
                        <p class="text-sm text-red-700 mt-1">{authError}</p>
                    </div>
                {/if}
            </div>

            <div class="shrink-0 flex w-full flex-col gap-3 pb-2 pt-6">
                {#if authError}
                    <Button.Action
                        variant="solid"
                        class="w-full"
                        callback={onDecline}
                    >
                        Okay
                    </Button.Action>
                {:else}
                    <div class="flex justify-center gap-3 items-center w-full">
                        <Button.Action
                            variant="soft"
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
                    </div>

                    <!-- {#if isSigningRequest === false}
                        <div class="text-center mt-1">
                            <p class="text-sm text-black-500">
                                After confirmation, you may return to <strong
                                    >{platform}</strong
                                > and continue there
                            </p>
                        </div>
                    {/if} -->
                {/if}
            </div>
        </div>
    </BottomSheet>
{/if}
