<script lang="ts">
    import DomainChips from "$lib/DomainChips.svelte";
    import StatusPill from "$lib/StatusPill.svelte";

    let { data } = $props();

    let copied = $state<string | null>(null);

    async function copy(value: string, id: string) {
        await navigator.clipboard.writeText(value);
        copied = id;
        setTimeout(() => (copied = null), 1500);
    }
</script>

<header>
    <p class="eyebrow">Public record</p>
    <h1 class="mt-2 text-3xl font-semibold text-ink">Decisions</h1>
    <p class="mt-2 max-w-xl text-sm text-muted">
        Every decision the association has issued, newest first. Each one is
        signed, so anyone can confirm where it came from.
    </p>
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
        <p class="mt-4 font-semibold text-ink">Record store not set up</p>
        <p class="mx-auto mt-1.5 max-w-md text-sm text-muted">
            The association has nowhere to publish decisions yet, so none can be
            listed or issued. Whoever runs this deployment needs to finish
            setting it up.
        </p>
    </div>
{:else if data.loadError}
    <div class="card mt-8 border-negative/20 bg-negative-wash p-6">
        <p class="text-sm font-semibold text-negative">Couldn't load decisions</p>
        <p class="mt-1 text-sm text-negative/80">{data.loadError}</p>
    </div>
{:else if data.accreditations.length === 0}
    <div class="card mt-8 px-6 py-16 text-center">
        <div class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-wash">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                    d="M12 3.5 4.5 6.5v5c0 4.2 3 7.6 7.5 9 4.5-1.4 7.5-4.8 7.5-9v-5L12 3.5Z"
                    stroke="var(--color-brand)"
                    stroke-width="1.6"
                    stroke-linejoin="round"
                />
            </svg>
        </div>
        <p class="mt-4 font-semibold text-ink">No decisions yet</p>
        <p class="mx-auto mt-1.5 max-w-sm text-sm text-muted">
            Decisions you issue appear here.
        </p>
    </div>
{:else}
    <ul class="mt-8 space-y-3">
        {#each data.accreditations as record (record.accreditationId)}
            <li class="card p-6">
                <div class="flex flex-wrap items-start gap-3">
                    <StatusPill decision={record.decision} level={record.level} />
                    <div class="min-w-0 flex-1">
                        <p class="font-semibold text-ink">
                            {record.platformName || record.platformEName}
                            {#if record.platformVersion}
                                <span class="font-normal text-muted">v{record.platformVersion}</span>
                            {/if}
                        </p>
                        <p class="mono-block truncate">{record.platformEName}</p>
                    </div>
                    <p class="text-xs text-faint">{record.createdAt.slice(0, 10)}</p>
                </div>

                {#if record.domains?.length}
                    <div class="mt-4">
                        <p class="text-xs text-faint">Areas of access</p>
                        <div class="mt-1.5">
                            <DomainChips ids={record.domains} domains={data.domains} />
                        </div>
                    </div>
                {/if}

                <p class="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-body">
                    {record.statement}
                </p>

                <div
                    class="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
                >
                    <p class="text-xs text-faint">
                        Reviewed by
                        <span class="font-medium text-muted">{record.reviewedByEName}</span>
                    </p>
                    <button
                        type="button"
                        class="btn btn-quiet !px-4 !py-2"
                        onclick={() => copy(record.jws, record.accreditationId)}
                    >
                        {copied === record.accreditationId ? "Copied" : "Copy record"}
                    </button>
                </div>
            </li>
        {/each}
    </ul>
{/if}
