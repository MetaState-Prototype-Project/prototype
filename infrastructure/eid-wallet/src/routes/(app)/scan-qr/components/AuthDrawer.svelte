<script lang="ts">
    import * as Button from "$lib/ui/Button";
    import { QrCodeIcon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";

    export let platform: string | null | undefined;
    export let hostname: string | null | undefined;
    export let scannedContent: string | undefined;
    export let isSigningRequest: boolean;
    export let authError: string | null | undefined;
    export let authLoading: boolean | undefined;
    export let onConfirm: () => void;
    export let onDecline: () => void;
</script>

<div
    class="flex flex-col gap-4 items-start justify-center w-full max-w-md mx-auto p-6 bg-white"
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

    <h4 class="text-xl font-bold">Code scanned!</h4>
    <p class="text-black-700">You're trying to access the following site</p>

    <div class="bg-gray rounded-2xl w-full p-4 mt-4">
        <h4 class="text-base text-black-700 font-semibold">Platform Name</h4>
        <p class="text-black-700 font-normal capitalize">
            {platform ?? "Unable to get name"}
        </p>
    </div>

    <div class="bg-gray rounded-2xl w-full p-4">
        <h4 class="text-base text-black-700 font-semibold">Website URL</h4>
        <p class="text-black-700 font-normal break-all">
            {hostname ?? scannedContent}
        </p>
    </div>

    {#if authError}
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mt-4 w-full">
            <div class="flex items-center">
                <div class="flex-shrink-0">
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
                    <h3 class="text-sm font-medium text-red-800">Error</h3>
                    <div class="mt-2 text-sm text-red-700">{authError}</div>
                </div>
            </div>
        </div>
    {/if}

    <div class="flex justify-center gap-3 items-center mt-4 w-full">
        {#if authError}
            <Button.Action variant="solid" class="w-full" callback={onDecline}>
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
                class="w-full"
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
        <div class="text-center mt-3">
            <p class="text-sm text-gray-600">
                After confirmation, you may return to {platform} and continue there
            </p>
        </div>
    {/if}
</div>
