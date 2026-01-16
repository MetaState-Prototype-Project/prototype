<script lang="ts">
import { onMount } from "svelte";
import type { HTMLAttributes } from "svelte/elements";

interface IToast extends HTMLAttributes<HTMLElement> {
    message: string;
    duration?: number;
    onClose?: () => void;
}

const { message, duration = 3000, onClose, ...restProps }: IToast = $props();

let isVisible = $state(true);

onMount(() => {
    const timer = setTimeout(() => {
        isVisible = false;
        setTimeout(() => {
            onClose?.();
        }, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
});
</script>

{#if isVisible}
    <div
        {...restProps}
        class="fixed bottom-[30px] left-1/2 -translate-x-1/2 z-50 w-[90%] bg-black-900/95 text-white px-6 py-3 rounded-lg shadow-lg transition-opacity duration-300 {isVisible
            ? 'opacity-100'
            : 'opacity-0'}"
        role="alert"
    >
        <div class="flex items-center gap-2">
            <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                />
            </svg>
            <span class="font-medium">{message}</span>
        </div>
    </div>
{/if}
