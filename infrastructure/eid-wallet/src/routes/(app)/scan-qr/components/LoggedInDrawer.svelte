<script lang="ts">
import { BottomSheet, PlatformAppCard } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { untrack } from "svelte";

interface ILoggedInDrawerProps {
    isOpen: boolean;
    platform: string | null | undefined;
    hostname: string | null | undefined;
    redirect: string | null | undefined;
    onConfirm: () => void;
    onOpenChange: (value: boolean) => void;
}

const {
    isOpen,
    platform,
    hostname,
    redirect,
    onConfirm,
    onOpenChange,
}: ILoggedInDrawerProps = $props();

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="loggedin-title"
        class="loggedin-drawer gap-5"
    >
        <div class="flex h-full w-full flex-col">
            <div
                class="min-h-0 flex flex-1 flex-col items-center pt-8 gap-8"
            >
                <div class="flex flex-col items-center gap-2 px-4">
                    <h4
                        id="loggedin-title"
                        class="text-2xl font-bold text-black-900 text-center leading-tight"
                    >
                        You're logged in!
                    </h4>
                    <p class="text-sm leading-relaxed text-black-500 text-center">
                        You're now connected to {platform ?? "the platform"}
                    </p>
                </div>

                <PlatformAppCard
                    {hostname}
                    platformName={platform ?? hostname}
                />

                {#if redirect && platform}
                    <p class="text-sm text-black-500 text-center px-4">
                        You may return to <strong>{platform}</strong> and continue
                        there
                    </p>
                {/if}
            </div>

            <div class="shrink-0 flex w-full flex-col gap-3 pb-2 pt-6">
                <Button.Action
                    variant="soft"
                    class="w-full"
                    callback={onConfirm}
                >
                    Ok
                </Button.Action>
            </div>
        </div>
    </BottomSheet>
{/if}
