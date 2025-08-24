<script lang="ts">
    import { cn } from "$lib/utils";
    import { CupertinoPane } from "cupertino-pane";
    import type { Snippet } from "svelte";
    import { swipe } from "svelte-gestures";
    import type { HTMLAttributes } from "svelte/elements";

    interface IDrawerProps extends HTMLAttributes<HTMLDivElement> {
        isPaneOpen?: boolean;
        children?: Snippet;
        handleSwipe?: (isOpen: boolean | undefined) => void;
    }

    let drawerElem: HTMLDivElement;
    let pane: CupertinoPane;

    let {
        isPaneOpen = $bindable(),
        children = undefined,
        handleSwipe,
        ...restProps
    }: IDrawerProps = $props();

    // Disabled click outside behavior to prevent white screen issues
    // const handleClickOutside = () => {
    //     pane?.destroy({ animate: true });
    //     isPaneOpen = false;
    // };

    $effect(() => {
        if (!drawerElem) return;
        pane = new CupertinoPane(drawerElem, {
            fitHeight: true,
            backdrop: true,
            backdropOpacity: 0.5,
            backdropBlur: true,
            bottomClose: true,
            buttonDestroy: false,
            showDraggable: true,
            upperThanTop: true,
            breaks: {
                bottom: { enabled: true, height: 250 },
            },
            initialBreak: "bottom",
        });

        if (isPaneOpen) {
            pane.present({ animate: true });
        } else {
            pane.destroy({ animate: true });
        }

        return () => pane.destroy();
    });
</script>

<div
    {...restProps}
    use:swipe={() => ({
        timeframe: 300,
        minSwipeDistance: 60,
    })}
    onswipe={() => handleSwipe?.(isPaneOpen)}
    bind:this={drawerElem}
    class={cn(restProps.class)}
>
    <div class="px-6">
        {@render children?.()}
    </div>
</div>

<style>
    :global(.pane) {
        width: 95% !important;
        max-height: 600px !important;
        min-height: 250px !important;
        height: auto !important;
        position: fixed !important;
        bottom: 30px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        border-radius: 32px !important;
        padding-block-start: 50px !important;
        padding-block-end: 20px !important;
        background-color: var(--color-white) !important;
        overflow-y: auto !important; /* vertical scroll if needed */
        overflow-x: hidden !important; /* prevent sideways scroll */
        -webkit-overflow-scrolling: touch; /* smooth scrolling on iOS */
    }

    :global(.move) {
        display: none !important;
        margin-block: 6px !important;
    }
</style>
