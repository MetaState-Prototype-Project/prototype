<script lang="ts">
    /**
     * App card for platform-based scan drawers (auth, signing, reveal, logged in).
     * Pulls the platform's icon from its own server so any future Metastate app
     * works without code changes:
     *
     *   1. https://{hostname}/apple-touch-icon.png  (180x180, brand bg baked in)
     *   2. https://{hostname}/favicon.ico          (smaller, plainer)
     *   3. Initial letter on a primary tint        (last resort)
     *
     * Layout: icon and card are stacked flex children — the icon sits on top of
     * the card via `-mb-8` (pulls the card up so the icon's lower half overlaps
     * the card's top). No absolute positioning, so no element extends outside
     * the wrapper's box and nothing gets clipped by an ancestor's overflow.
     */
    interface IPlatformAppCardProps {
        hostname: string | null | undefined;
        platformName: string | null | undefined;
        class?: string;
    }

    const {
        hostname,
        platformName,
        class: classes = "",
    }: IPlatformAppCardProps = $props();

    type Stage = "apple" | "favicon" | "fallback";
    let stage = $state<Stage>("apple");

    const iconUrl = $derived(
        !hostname
            ? null
            : stage === "apple"
              ? `https://${hostname}/apple-touch-icon.png`
              : stage === "favicon"
                ? `https://${hostname}/favicon.ico`
                : null,
    );

    function handleError() {
        if (stage === "apple") stage = "favicon";
        else if (stage === "favicon") stage = "fallback";
    }

    // Some servers return 200 OK with an HTML page or a tiny placeholder
    // for missing `/apple-touch-icon.png`, so `onerror` never fires. Treat
    // suspiciously small loads as failures and advance the cascade.
    function handleLoad(e: Event) {
        const img = e.currentTarget as HTMLImageElement;
        if (img.naturalWidth < 8 || img.naturalHeight < 8) {
            handleError();
        }
    }

    const initial = $derived((platformName?.[0] ?? "?").toUpperCase());
    const displayName = $derived(platformName ?? "Unknown app");
</script>

<div class="flex flex-col items-center w-full {classes}">
    <div
        class="relative z-10 w-16 h-16 rounded-2xl overflow-hidden bg-primary flex items-center justify-center shadow-md -mb-8"
    >
        {#if iconUrl}
            <img
                src={iconUrl}
                alt={`${displayName} icon`}
                onerror={handleError}
                onload={handleLoad}
                class="w-full h-full object-cover"
            />
        {:else}
            <span class="text-2xl font-bold text-white">{initial}</span>
        {/if}
    </div>
    <div
        class="bg-white rounded-3xl shadow-card pt-12 pb-6 mb-12 px-6 flex flex-col items-center gap-2 w-full"
    >
        <h3 class="text-2xl font-bold text-black-900 capitalize text-center">
            {displayName}
        </h3>
        {#if hostname}
            <p class="text-sm text-black-500 break-all text-center">
                {hostname}
            </p>
        {/if}
    </div>
</div>
