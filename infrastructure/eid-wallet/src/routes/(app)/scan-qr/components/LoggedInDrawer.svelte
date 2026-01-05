<script lang="ts">
    import * as Button from "$lib/ui/Button";
    import { QrCodeIcon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";

    export let platform: string | null | undefined;
    export let redirect: string | null | undefined;
    export let onConfirm: () => void;
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

    <h4 class="text-xl font-bold">You're logged in!</h4>
    <p class="text-black-700">
        You're now connected to <strong>{platform ?? "the platform"}</strong>
    </p>

    <div class="flex flex-col gap-3 mt-4 w-full">
        {#if redirect && platform}
            <div class="text-center mb-2">
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
