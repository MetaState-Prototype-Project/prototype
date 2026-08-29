<script lang="ts">
    let {
        logoUrl = null,
        name,
        size = 44,
    }: { logoUrl?: string | null; name: string; size?: number } = $props();

    /**
     * The initial tile is always rendered, with the logo layered over it. A
     * profile's logoUrl is whatever its author typed and is frequently not an
     * image at all — and an unreachable host leaves the request pending
     * forever without ever firing `error`, so swapping on failure alone left
     * an empty box. Underlaying it means the mark is correct while loading,
     * on failure, and on a URL that simply never answers.
     */
    let failedUrl = $state<string | null>(null);
    let showImage = $derived(Boolean(logoUrl) && failedUrl !== logoUrl);

    let initial = $derived((name?.trim()?.[0] ?? "?").toUpperCase());
</script>

<div
    class="relative shrink-0 overflow-hidden rounded-2xl bg-brand-tint ring-1 ring-brand/20"
    style="width:{size}px;height:{size}px"
>
    <span
        class="absolute inset-0 flex items-center justify-center font-semibold text-brand-strong select-none"
        style="font-size:{Math.round(size / 2.4)}px"
        aria-hidden="true"
    >
        {initial}
    </span>

    {#if showImage}
        <img
            src={logoUrl}
            alt=""
            class="absolute inset-0 h-full w-full object-cover"
            onerror={() => (failedUrl = logoUrl)}
        />
    {/if}
</div>
