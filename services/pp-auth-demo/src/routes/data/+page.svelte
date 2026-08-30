<script lang="ts">
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    function labelFor(id: string): string {
        return data.groups.find((group) => group.id === id)?.label ?? id;
    }
</script>

<div class="space-y-6">
    <section class="card p-6">
        <p class="eyebrow">Your data</p>
        <h2 class="mt-1 text-xl font-semibold text-ink">What is in your eVault</h2>
        <p class="mt-2 max-w-3xl text-sm text-muted">
            Your own records, grouped the way the ontology groups them. That grouping is
            what a certificate is written against, so it is also what decides which
            platform can see which of these.
        </p>
    </section>

    {#if data.platforms.length > 0 && data.groups.length > 0}
        <section class="card overflow-hidden p-0">
            <div class="p-6 pb-4">
                <h3 class="text-lg font-semibold text-ink">Who could reach what</h3>
                <p class="mt-1 text-sm text-muted">
                    Each certified platform against each kind of data you hold, decided
                    by its certificate and your terms.
                </p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full min-w-[36rem] text-sm">
                    <thead>
                        <tr class="border-y border-line bg-canvas text-left">
                            <th class="px-6 py-3 font-semibold text-ink">Platform</th>
                            {#each data.groups as group (group.id)}
                                <th class="px-4 py-3 font-semibold text-ink">{group.label}</th>
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each data.platforms as platform (platform.ename)}
                            <tr class="border-b border-line align-top">
                                <td class="px-6 py-4">
                                    <p class="font-semibold text-ink">{platform.name}</p>
                                    <p class="text-xs text-muted">
                                        {platform.level} · {platform.version}
                                    </p>
                                </td>
                                {#each platform.decisions as decision (decision.domain)}
                                    <td class="px-4 py-4">
                                        {#if decision.allowed}
                                            <span class="pill bg-positive-wash text-positive">
                                                Allowed
                                            </span>
                                        {:else}
                                            <span
                                                class="pill bg-negative-wash text-negative"
                                                title={decision.reason}
                                            >
                                                Refused
                                            </span>
                                        {/if}
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            <div class="space-y-2 border-t border-line bg-canvas px-6 py-4">
                {#each data.platforms as platform (platform.ename)}
                    {#each platform.decisions.filter((d) => !d.allowed) as decision (decision.domain)}
                        <p class="text-xs text-muted">
                            <span class="font-semibold text-body">{platform.name}</span>
                            · {labelFor(decision.domain)} — {decision.reason}
                        </p>
                    {/each}
                {/each}
            </div>
        </section>
    {/if}

    {#if data.groups.length === 0}
        <section class="card p-6">
            <p class="text-sm text-body">
                Nothing readable was found in your eVault. That may mean it is empty, or
                that it is not reachable from here right now.
            </p>
        </section>
    {/if}

    {#each data.groups as group (group.id)}
        <section class="card space-y-4 p-6">
            <header>
                <h3 class="text-lg font-semibold text-ink">{group.label}</h3>
                {#if group.description}
                    <p class="mt-1 text-sm text-muted">{group.description}</p>
                {/if}
            </header>
            <ul class="space-y-2">
                {#each group.records as record (record.id)}
                    <li class="rounded-2xl border border-line p-3">
                        <p class="text-xs text-faint">{record.kind}</p>
                        <p class="mt-1 text-sm text-body">{record.summary}</p>
                    </li>
                {/each}
            </ul>
        </section>
    {/each}
</div>
