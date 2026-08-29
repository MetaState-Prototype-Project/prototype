<script lang="ts">
    import type { Domain } from "$lib/types";

    let {
        ids = [],
        domains = [],
        empty = "—",
    }: { ids?: string[]; domains?: Domain[]; empty?: string } = $props();

    // Show the published label where we have it; fall back to the raw id so an
    // unknown domain is still visible rather than silently dropped.
    let shown = $derived(
        ids.map((id) => domains.find((d) => d.id === id)?.label ?? id),
    );
</script>

{#if shown.length === 0}
    <span class="text-sm text-muted">{empty}</span>
{:else}
    <span class="flex flex-wrap gap-1.5">
        {#each shown as label (label)}
            <span class="pill bg-brand-wash text-brand">{label}</span>
        {/each}
    </span>
{/if}
