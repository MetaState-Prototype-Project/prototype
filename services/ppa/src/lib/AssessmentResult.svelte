<script lang="ts">
    import {
        ACCESS_LEVELS,
        type ComputedLevel,
        type Framework,
        type IdentityLevel,
    } from "$lib/levels";

    let {
        framework,
        result,
        minimumIal,
    }: {
        framework: Framework;
        result: ComputedLevel;
        minimumIal: IdentityLevel;
    } = $props();

    let labels = $derived(
        new Map(framework.dimensions.map((d) => [d.id, d.label])),
    );

    // Ordered weakest first: the bottom of this list is what moves the result.
    let ranked = $derived(
        [...result.perDimension].sort((a, b) => a.level - b.level),
    );

    let limitingLabel = $derived(
        result.limiting === "identity"
            ? "Identity assurance of the responsible actors"
            : (labels.get(result.limiting ?? "") ?? null),
    );

    let identityCapped = $derived(result.limiting === "identity");
</script>

<section class="card p-6">
    <h2 class="text-sm font-semibold text-ink">Calculation</h2>
    <p class="mt-1 text-xs text-muted">
        The level is the geometric mean of every dimension, so a weak row pulls
        the result down sharply while a single middling one does not pin it.
    </p>

    <div
        class="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4 rounded-2xl px-5 py-4 {result.level
            ? 'bg-brand-wash'
            : 'bg-caution-wash'}"
    >
        <div>
            <p class="text-xs text-muted">Geometric mean</p>
            <p class="text-2xl font-semibold text-ink">
                {result.blocked ? "—" : result.score.toFixed(2)}
            </p>
        </div>
        <div class="text-2xl text-faint">→</div>
        <div>
            <p class="text-xs text-muted">Computed level</p>
            <p class="text-2xl font-semibold {result.level ? 'text-brand' : 'text-caution'}">
                {result.level ?? "None"}
            </p>
        </div>
        <div class="min-w-[12rem] flex-1 text-sm">
            {#if result.blocked}
                <p class="text-caution">
                    {limitingLabel
                        ? `${limitingLabel} is unanswered or fails outright.`
                        : "A dimension is unanswered or fails outright."}
                </p>
            {:else if identityCapped}
                <p class="text-body">
                    Capped at {result.level} by the identity floor — the weakest
                    accountable actor is {minimumIal}.
                </p>
            {:else if limitingLabel}
                <p class="text-body">
                    Weakest dimension: <strong class="font-semibold text-ink">{limitingLabel}</strong>.
                </p>
            {/if}
        </div>
    </div>

    <details class="group mt-4">
        <summary class="cursor-pointer text-xs text-muted select-none hover:text-ink">
            Show every dimension
        </summary>
        <ul class="mt-3 space-y-1">
            {#each ranked as dimension (dimension.id)}
                <li class="flex items-center gap-3 text-sm">
                    <span
                        class="w-9 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs font-semibold
                            {dimension.level < 0
                            ? 'bg-negative-wash text-negative'
                            : dimension.level === 0
                              ? 'bg-caution-wash text-caution'
                              : 'bg-canvas text-muted'}"
                    >
                        {dimension.level < 0 ? "—" : ACCESS_LEVELS[dimension.level]}
                    </span>
                    <span class="min-w-0 flex-1 truncate text-muted">
                        {labels.get(dimension.id) ?? dimension.id}
                    </span>
                </li>
            {/each}
        </ul>
    </details>
</section>
