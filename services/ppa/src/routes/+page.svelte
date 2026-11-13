<script lang="ts">
    import PlatformMark from "$lib/PlatformMark.svelte";
    import StatusPill from "$lib/StatusPill.svelte";

    let { data } = $props();

    let pending = $derived(data.submissions.filter((s) => !s.decision).length);
</script>

<header class="flex flex-wrap items-end justify-between gap-4">
    <div>
        <p class="eyebrow">Review queue</p>
        <h1 class="mt-2 text-3xl font-semibold text-ink">Submissions</h1>
        <p class="mt-2 max-w-xl text-sm text-muted">
            Platforms applying to join the network. Review each one, then
            decide what level of access it should have.
        </p>
    </div>

    {#if data.submissions.length > 0}
        <div class="card flex items-center gap-6 px-6 py-4">
            <div>
                <p class="text-2xl font-semibold text-ink">{pending}</p>
                <p class="text-xs text-muted">Awaiting review</p>
            </div>
            <div class="h-8 w-px bg-line"></div>
            <div>
                <p class="text-2xl font-semibold text-ink">{data.submissions.length}</p>
                <p class="text-xs text-muted">In submission</p>
            </div>
        </div>
    {/if}
</header>

{#if !data.connected}
    <div class="card mt-8 px-6 py-16 text-center">
        <div class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-caution-wash">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                    d="M12 8v5m0 3.5v.01M10.3 4.2 2.9 17.1A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.9L13.7 4.2a2 2 0 0 0-3.4 0Z"
                    stroke="var(--color-caution)"
                    stroke-width="1.7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        </div>
        <p class="mt-4 font-semibold text-ink">Not connected to the platform directory</p>
        <p class="mx-auto mt-1.5 max-w-md text-sm text-muted">
            Submissions can't be listed until this deployment is connected, so
            this page is empty for a reason other than there being no
            applications. Whoever runs this deployment needs to finish setting
            it up.
        </p>
    </div>
{:else if data.loadError}
    <div class="card mt-8 border-negative/20 bg-negative-wash p-6">
        <p class="text-sm font-semibold text-negative">Couldn't load submissions</p>
        <p class="mt-1 text-sm text-negative/80">{data.loadError}</p>
    </div>
{:else if data.submissions.length === 0}
    <div class="card mt-8 px-6 py-16 text-center">
        <div
            class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-wash"
        >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                    d="M4 7h16M4 12h16M4 17h9"
                    stroke="var(--color-brand)"
                    stroke-width="1.8"
                    stroke-linecap="round"
                />
            </svg>
        </div>
        <p class="mt-4 font-semibold text-ink">Nothing to review</p>
        <p class="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            New applications appear here as platforms apply to join the network.
        </p>
    </div>
{:else}
    <ul class="mt-8 space-y-3">
        {#each data.submissions as submission (submission.ename)}
            <li>
                <a
                    href="/submissions/{encodeURIComponent(submission.ename)}"
                    class="card group flex items-center gap-4 px-5 py-4 transition-shadow hover:shadow-lift"
                >
                    <PlatformMark logoUrl={submission.logoUrl} name={submission.displayName} />

                    <div class="min-w-0 flex-1">
                        <p class="truncate font-semibold text-ink">
                            {submission.displayName}
                        </p>
                        <p class="mt-0.5 truncate text-sm text-muted">
                            {submission.category}
                            {#if submission.version}
                                <span class="text-line">·</span> v{submission.version}
                            {/if}
                            <span class="text-line">·</span>
                            {submission.authorEnames.length}
                            author{submission.authorEnames.length === 1 ? "" : "s"}
                        </p>
                    </div>

                    <StatusPill
                        decision={submission.decision?.decision ?? null}
                        level={submission.decision?.level ?? null}
                    />

                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        class="shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
                    >
                        <path
                            d="m9 6 6 6-6 6"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </a>
            </li>
        {/each}
    </ul>
{/if}
