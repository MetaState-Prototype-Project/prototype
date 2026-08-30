<script lang="ts">
    import {
        ACCESS_LEVELS,
        computeLevel,
        type DimensionAnswer,
        type Framework,
        type IdentityLevel,
    } from "$lib/levels";

    interface DerivedAnswer {
        id: string;
        option: number;
        evidence: string;
    }

    let {
        framework,
        derivedAnswers = [],
        minimumIal,
        answers = $bindable([]),
    }: {
        framework: Framework;
        derivedAnswers?: DerivedAnswer[];
        minimumIal: IdentityLevel;
        answers?: DimensionAnswer[];
    } = $props();

    const derivedById = $derived(new Map(derivedAnswers.map((d) => [d.id, d])));

    // Reviewer rows start unanswered on purpose: an unanswered dimension is not
    // evidence, so the computed level stays null until the reviewer has worked
    // through the matrix.
    let chosen = $state<Record<string, number>>({});
    let seeded = $state<string | null>(null);
    $effect(() => {
        const key = framework.frameworkVersion + derivedAnswers.map((d) => d.id).join();
        if (seeded !== key) {
            seeded = key;
            chosen = {};
        }
    });

    let allAnswers = $derived([
        ...derivedAnswers.map((d) => ({ id: d.id, option: d.option })),
        ...Object.entries(chosen).map(([id, option]) => ({ id, option })),
    ]);
    $effect(() => {
        answers = allAnswers;
    });

    let result = $derived(computeLevel(framework, allAnswers, minimumIal));
    let levelOf = $derived(new Map(result.perDimension.map((d) => [d.id, d.level])));

    let reviewerRows = $derived(
        framework.dimensions.filter((d) => d.source === "reviewer"),
    );
    let derivedRows = $derived(
        framework.dimensions.filter((d) => d.source === "derived"),
    );
    let answeredCount = $derived(
        reviewerRows.filter((d) => chosen[d.id] !== undefined).length,
    );
    let limitingLabel = $derived(
        result.limiting === "identity"
            ? "Identity assurance of the responsible actors"
            : (framework.dimensions.find((d) => d.id === result.limiting)?.label ??
              null),
    );

    /** "L3" from an option level, or a dash when it blocks certification. */
    function levelLabel(level: number | undefined): string {
        if (level === undefined) return "—";
        if (level < 0) return "blocks";
        return ACCESS_LEVELS[level] ?? "—";
    }
</script>

<section class="card p-6">
    <h2 class="text-sm font-semibold text-ink">Assessment</h2>
    <p class="mt-1 text-xs text-muted">
        The level is the weakest of these dimensions — a strong result in one
        does not make up for a weakness in another. Framework v{framework.frameworkVersion}.
    </p>

    <!-- The running answer, kept in view while working down the matrix. -->
    <div
        class="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border px-5 py-4
            {result.level
            ? 'border-brand/20 bg-brand-wash'
            : 'border-caution/30 bg-caution-wash'}"
    >
        <div>
            <p class="text-xs text-muted">Supported level</p>
            <p class="mt-0.5 text-2xl font-semibold {result.level ? 'text-brand' : 'text-caution'}">
                {result.level ?? "None yet"}
            </p>
        </div>
        <div class="min-w-0 flex-1">
            {#if answeredCount < reviewerRows.length}
                <p class="text-sm text-body">
                    {reviewerRows.length - answeredCount} of {reviewerRows.length}
                    judgements still to make.
                </p>
                <p class="mt-0.5 text-xs text-muted">
                    An unanswered dimension counts as no evidence.
                </p>
            {:else if limitingLabel}
                <p class="text-sm text-body">
                    Held at {result.level ?? "no level"} by
                    <strong class="font-semibold text-ink">{limitingLabel}</strong>.
                </p>
                <p class="mt-0.5 text-xs text-muted">
                    Raising that one row is what raises the level.
                </p>
            {/if}
        </div>
    </div>

    <!-- What the app worked out, so the reviewer is not asked to re-check it. -->
    <h3 class="mt-7 text-xs font-semibold tracking-wide text-faint uppercase">
        Established from evidence
    </h3>
    <ul class="mt-3 space-y-2">
        {#each derivedRows as dimension (dimension.id)}
            {@const answer = derivedById.get(dimension.id)}
            <li class="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl bg-canvas px-4 py-3">
                <span class="text-sm font-medium text-ink">{dimension.label}</span>
                <span class="pill bg-surface text-muted">{levelLabel(levelOf.get(dimension.id))}</span>
                <span class="w-full text-xs text-muted">
                    {dimension.options[answer?.option ?? 0]?.label}
                    {#if answer} — {answer.evidence}{/if}
                </span>
            </li>
        {/each}
    </ul>

    <!-- The judgements only a reviewer can make. -->
    <h3 class="mt-7 text-xs font-semibold tracking-wide text-faint uppercase">
        Your assessment
    </h3>
    <div class="mt-3 space-y-5">
        {#each reviewerRows as dimension (dimension.id)}
            <fieldset class="rounded-2xl border border-line px-4 py-4">
                <legend class="flex items-center gap-2 px-1 text-sm font-medium text-ink">
                    {dimension.label}
                    {#if chosen[dimension.id] !== undefined}
                        <span class="pill bg-brand-wash text-brand">
                            {levelLabel(levelOf.get(dimension.id))}
                        </span>
                    {/if}
                </legend>

                {#if dimension.unverified}
                    <p class="mt-1 text-xs text-caution">
                        Nothing in the ecosystem can verify this yet — recorded as
                        your assertion.
                    </p>
                {/if}

                <div class="mt-3 space-y-1.5">
                    {#each dimension.options as option, index (option.label)}
                        <label
                            class="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors
                                {chosen[dimension.id] === index
                                ? 'bg-brand-wash text-ink'
                                : 'text-muted hover:bg-canvas'}"
                        >
                            <input
                                type="radio"
                                name={`dimension:${dimension.id}`}
                                value={index}
                                checked={chosen[dimension.id] === index}
                                onchange={() => (chosen = { ...chosen, [dimension.id]: index })}
                                class="mt-0.5"
                            />
                            <span class="flex-1">{option.label}</span>
                            <span class="text-xs text-faint">{levelLabel(option.level)}</span>
                        </label>
                    {/each}
                </div>
            </fieldset>
        {/each}
    </div>
</section>
