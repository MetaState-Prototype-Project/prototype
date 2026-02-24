<script lang="ts">
import * as Button from "$lib/ui/Button";
import { UserGroup02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

export let isOpen: boolean;
export let requesterEname: string | null;
export let requesterName: string | null;
export let loading: boolean;
export let error: string | null;
export let success: boolean;
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

$: displayName = requesterName ?? requesterEname ?? "Unknown";
</script>

{#if internalOpen}
    <div
        class="fixed inset-0 z-50 bg-white p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="social-binding-title"
    >
        <div class="flex flex-col justify-between min-h-full w-full max-w-md mx-auto">
            <div class="flex flex-col items-start pt-2">
                <div
                    class="flex justify-center mb-4 relative items-center overflow-hidden {success
                        ? 'bg-green-100'
                        : 'bg-gray-50'} rounded-xl p-4 h-[72px] w-[72px]"
                >
                    <div
                        class="{success
                            ? 'bg-green-500'
                            : 'bg-white'} h-4 w-[200px] -rotate-45 absolute top-1"
                    ></div>
                    <div
                        class="{success
                            ? 'bg-green-500'
                            : 'bg-white'} h-4 w-[200px] -rotate-45 absolute bottom-1"
                    ></div>
                    <HugeiconsIcon
                        size={40}
                        className="z-10"
                        icon={UserGroup02Icon}
                        strokeWidth={1.5}
                        color={success
                            ? "var(--color-success)"
                            : "var(--color-primary)"}
                    />
                </div>

                <h4
                    id="social-binding-title"
                    class="text-xl font-bold {success ? 'text-green-800' : ''}"
                >
                    {success ? "Binding Signed!" : "Social Identity Binding"}
                </h4>

                <p class="text-gray-700 mt-1">
                    {#if success}
                        You've signed the social identity binding for <strong>{displayName}</strong>.
                        They will counter-sign to complete the mutual binding.
                    {:else}
                        Please review the identity below before proceeding.
                    {/if}
                </p>

                {#if !success}
                    <div
                        class="w-full mt-6 border border-gray-100 rounded-2xl overflow-hidden bg-gray-50"
                    >
                        <table class="w-full border-collapse">
                            <tbody class="divide-y divide-gray-200">
                                <tr>
                                    <td class="py-3 px-4">
                                        <div
                                            class="text-xs font-semibold text-gray-500 uppercase tracking-wider block"
                                        >
                                            Name
                                        </div>
                                        <div
                                            class="text-sm text-gray-700 font-medium mt-1 block"
                                        >
                                            {displayName}
                                        </div>
                                    </td>
                                </tr>
                                {#if requesterEname}
                                    <tr>
                                        <td class="py-3 px-4">
                                            <div
                                                class="text-xs font-semibold text-gray-500 uppercase tracking-wider block"
                                            >
                                                eID
                                            </div>
                                            <div
                                                class="text-sm text-gray-700 font-medium break-all mt-1 block"
                                            >
                                                {requesterEname}
                                            </div>
                                        </td>
                                    </tr>
                                {/if}
                            </tbody>
                        </table>
                    </div>

                    {#if error}
                        <div
                            class="bg-red-50 border border-red-200 rounded-lg p-4 mt-4 w-full text-sm text-red-700"
                        >
                            {error}
                        </div>
                    {/if}
                {/if}
            </div>

            <div class="flex flex-col gap-3 pb-2 w-full pt-8">
                {#if success}
                    <Button.Action
                        variant="solid"
                        class="w-full"
                        callback={onDecline}>Okay</Button.Action
                    >
                {:else}
                    <div class="flex justify-center gap-3 items-center w-full">
                        {#if error}
                            <Button.Action
                                variant="solid"
                                class="w-full"
                                callback={onDecline}>Okay</Button.Action
                            >
                        {:else}
                            <Button.Action
                                variant="danger-soft"
                                class="w-full"
                                callback={onDecline}>Decline</Button.Action
                            >
                            <Button.Action
                                variant="solid"
                                class="w-full whitespace-nowrap"
                                callback={onConfirm}
                                disabled={loading}
                            >
                                {loading ? "Signing…" : "Sign Binding"}
                            </Button.Action>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}
