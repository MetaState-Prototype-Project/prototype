<script lang="ts">
import { cn } from "$lib/utils";
import { CupertinoPane } from "cupertino-pane";
import type { Snippet } from "svelte";
import { useSwipe } from "svelte-gestures";
import type { SwipeCustomEvent } from "svelte-gestures";
import type { HTMLAttributes } from "svelte/elements";

interface IDrawerProps extends HTMLAttributes<HTMLDivElement> {
    isPaneOpen?: boolean;
    children?: Snippet;
    handleSwipe?: (isOpen: boolean | undefined) => void;
    dismissible?: boolean;
    fullScreen?: boolean;
}

let drawerElem: HTMLDivElement;
let pane: CupertinoPane;

let {
    isPaneOpen = $bindable(),
    children = undefined,
    handleSwipe,
    dismissible = true,
    fullScreen = false,
    ...restProps
}: IDrawerProps = $props();

const handleDrawerSwipe = (event: SwipeCustomEvent) => {
    if (event.detail.direction === ("down" as string)) {
        handleSwipe?.(isPaneOpen);
    }
};

const swipeResult = useSwipe(
    handleDrawerSwipe,
    () => ({
        timeframe: 300,
        minSwipeDistance: 60,
    }),
    undefined,
    true,
);
// biome-ignore lint/suspicious/noExplicitAny: svelte-gestures type definitions are incomplete
const swipe = swipeResult.swipe as any;

// Disabled click outside behavior to prevent white screen issues
// const handleClickOutside = () => {
//     pane?.destroy({ animate: true });
//     isPaneOpen = false;
// };

// Initialize pane only once when element is available
$effect(() => {
    if (!drawerElem) return;
    pane = new CupertinoPane(drawerElem, {
        fitHeight: true,
        backdrop: true,
        backdropOpacity: dismissible ? 0.5 : 0.8,
        backdropBlur: true,
        bottomClose: dismissible,
        buttonDestroy: false,
        showDraggable: dismissible,
        upperThanTop: true,
        events: {
            onBackdropTap: () => {
                pane?.destroy();
                isPaneOpen = false;
            },
        },
        breaks: {
            bottom: { enabled: true, height: 250 },
        },
        initialBreak: "bottom",
    });

    // Add class to pane element based on fullScreen prop
    // Use setTimeout to ensure pane element is created
    setTimeout(() => {
        const paneElement = document.querySelector(".pane") as HTMLElement;
        if (paneElement) {
            if (fullScreen) {
                paneElement.classList.add("drawer-fullscreen");
                paneElement.classList.remove("drawer-normal");
            } else {
                paneElement.classList.add("drawer-normal");
                paneElement.classList.remove("drawer-fullscreen");
            }
        }
    }, 0);

    return () => pane?.destroy();
});

// Handle open/close state separately
$effect(() => {
    if (!pane) return;

    // Update fullscreen class when prop changes
    const paneElement = document.querySelector(".pane") as HTMLElement;
    if (paneElement) {
        if (fullScreen) {
            paneElement.classList.add("drawer-fullscreen");
            paneElement.classList.remove("drawer-normal");
        } else {
            paneElement.classList.add("drawer-normal");
            paneElement.classList.remove("drawer-fullscreen");
        }
    }

    if (isPaneOpen) {
        pane.present({ animate: true });
        // Update class after presenting
        setTimeout(() => {
            const paneEl = document.querySelector(".pane") as HTMLElement;
            if (paneEl) {
                if (fullScreen) {
                    paneEl.classList.add("drawer-fullscreen");
                    paneEl.classList.remove("drawer-normal");
                } else {
                    paneEl.classList.add("drawer-normal");
                    paneEl.classList.remove("drawer-fullscreen");
                }
            }
        }, 0);
    } else {
        pane.destroy({ animate: true });
    }
});
</script>

<div
    {...restProps}
    use:swipe
    bind:this={drawerElem}
    class={cn(restProps.class, fullScreen ? "drawer-fullscreen" : "drawer-normal")}
>
    <div class="px-6">
        {@render children?.()}
    </div>
</div>

<style>
    :global(.pane) {
        position: fixed !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background-color: var(--color-white) !important;
        overflow-y: auto !important; /* vertical scroll if needed */
        overflow-x: hidden !important; /* prevent sideways scroll */
        -webkit-overflow-scrolling: touch; /* smooth scrolling on iOS */
    }

    :global(.pane.drawer-normal),
    :global(.pane:not(.drawer-fullscreen)) {
        width: 95% !important;
        max-height: 600px !important;
        min-height: 250px !important;
        height: auto !important;
        bottom: 30px !important;
        border-radius: 32px !important;
        padding-block-start: 50px !important;
        padding-block-end: 20px !important;
    }

    :global(.pane.drawer-fullscreen) {
        width: 100% !important;
        max-height: 100vh !important;
        min-height: 100vh !important;
        height: 100vh !important;
        bottom: 0 !important;
        border-radius: 0 !important;
        padding-block-start: 0 !important;
        padding-block-end: 0 !important;
    }

    :global(.move) {
        display: none !important;
        margin-block: 6px !important;
    }
</style>
