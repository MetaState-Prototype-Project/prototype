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
}

let drawerElem: HTMLDivElement;
let pane: CupertinoPane;

let {
    isPaneOpen = $bindable(),
    children = undefined,
    handleSwipe,
    dismissible = true,
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

// Initialize pane
$effect(() => {
    if (!drawerElem) return;
    
    pane = new CupertinoPane(drawerElem, {
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

    return () => {
        if (pane) {
            pane.destroy();
        }
    };
});

// Handle open/close state separately
$effect(() => {
    if (!pane || !drawerElem) return;

    if (isPaneOpen) {
        pane.present({ animate: true });
    } else {
        // Don't destroy, just hide - this keeps the pane available
        if (pane.pane) {
            pane.hide();
        }
    }
});
</script>

<div
    {...restProps}
    use:swipe
    bind:this={drawerElem}
    class={cn(restProps.class)}
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
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch;
        width: 95% !important;
        max-height: 600px !important;
        min-height: 250px !important;
        height: auto !important;
        bottom: 30px !important;
        border-radius: 32px !important;
        padding-block-start: 50px !important;
        padding-block-end: 20px !important;
    }

    :global(.move) {
        display: none !important;
        margin-block: 6px !important;
    }
</style>
