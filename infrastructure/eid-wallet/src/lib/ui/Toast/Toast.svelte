<script lang="ts">
    import { toastStore } from "./toast";
    import { cn } from "$lib/utils";
    import { Cancel01Icon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";

    let toasts = $state<
        Array<{
            id: string;
            message: string;
            type?: "success" | "error" | "info";
            duration?: number;
        }>
    >([]);

    $effect(() => {
        const unsubscribe = toastStore.subscribe((value) => {
            toasts = value;
        });
        return unsubscribe;
    });

    function removeToast(id: string) {
        toastStore.remove(id);
    }

    const getToastClasses = (type?: string) => {
        switch (type) {
            case "success":
                return "bg-green-50 border-green-200 text-green-800";
            case "error":
                return "bg-red-50 border-red-200 text-red-800";
            case "info":
            default:
                return "bg-blue-50 border-blue-200 text-blue-800";
        }
    };
</script>

<div
    class="fixed left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none w-full max-w-md px-4"
    style="top: calc(env(safe-area-inset-top) + 44px);"
>
    {#each toasts as toast (toast.id)}
        <div
            class={cn(
                "pointer-events-auto flex items-center justify-between gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-top-2 fade-in",
                getToastClasses(toast.type),
            )}
            role="alert"
        >
            <p class="text-sm font-medium flex-1">{toast.message}</p>
            <button
                onclick={() => removeToast(toast.id)}
                class="flex-shrink-0 hover:opacity-70 transition-opacity"
                aria-label="Close toast"
            >
                <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={20}
                    strokeWidth={2}
                    className="text-current"
                />
            </button>
        </div>
    {/each}
</div>

<style>
    @keyframes slide-in-from-top-2 {
        from {
            transform: translateY(-100%);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }

    @keyframes fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    .animate-in {
        animation:
            slide-in-from-top-2 0.3s ease-out,
            fade-in 0.3s ease-out;
    }
</style>
