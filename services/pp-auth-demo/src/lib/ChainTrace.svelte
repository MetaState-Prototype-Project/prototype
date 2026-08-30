<script lang="ts">
    import type { ChainResult } from "@metastate-foundation/auth/platform";

    let { chain }: { chain: ChainResult | null } = $props();
</script>

{#if chain}
    <ol class="space-y-2">
        {#each chain.links as link, index (link.id)}
            <li
                class="flex gap-3 rounded-2xl border p-3"
                class:border-line={link.ok}
                class:bg-surface={link.ok}
                class:border-negative={!link.ok}
                class:bg-negative-wash={!link.ok}
            >
                <span
                    class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    class:bg-positive-wash={link.ok}
                    class:text-positive={link.ok}
                    class:bg-negative={!link.ok}
                    class:text-white={!link.ok}
                >
                    {link.ok ? "✓" : index + 1}
                </span>
                <div class="min-w-0">
                    <p class="text-sm font-semibold text-ink">{link.title}</p>
                    <p class="mt-0.5 text-xs text-muted">
                        {link.ok ? `So we know ${link.proves}.` : link.detail}
                    </p>
                </div>
            </li>
        {/each}
    </ol>
{/if}
