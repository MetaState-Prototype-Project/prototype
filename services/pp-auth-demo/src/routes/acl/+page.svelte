<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import KeyEntry from "$lib/KeyEntry.svelte";
    import RequestTester from "$lib/RequestTester.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    let saving = $state<string | null>(null);

    async function refresh() {
        await invalidateAll();
    }

    async function toggle(
        platformEname: string,
        grant: { domain: string; read: boolean; write: boolean },
        which: "read" | "write",
    ) {
        const next = { read: grant.read, write: grant.write, [which]: !grant[which] };
        saving = `${platformEname}:${grant.domain}`;
        try {
            await fetch("/api/grants", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    platformEname,
                    domain: grant.domain,
                    operations: [
                        ...(next.read ? ["read"] : []),
                        ...(next.write ? ["write"] : []),
                    ],
                }),
            });
            await refresh();
        } finally {
            saving = null;
        }
    }
</script>

<div class="space-y-6">
    <section class="card p-6">
        <p class="eyebrow">Permissions</p>
        <h2 class="mt-1 text-xl font-semibold text-ink">What each platform may do</h2>
        <p class="mt-2 max-w-3xl text-sm text-muted">
            Being certified for a kind of data is not permission to do anything with
            it. Reading your posts is not the same as writing to them, and this is
            where that is decided. Each change is kept in your own eVault as a
            permission record, so nothing is lost when you take access away.
        </p>
    </section>

    {#if data.platforms.length === 0}
        <section class="card p-6">
            <p class="text-sm text-body">
                No platform on the network is certified yet, so there is nothing to
                permit. This fills in on its own once the association grants one.
            </p>
        </section>
    {/if}

    {#each data.platforms as platform (platform.ename)}
        <section class="card space-y-5 p-6">
            <header class="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 class="text-lg font-semibold text-ink">{platform.name}</h3>
                    <p class="text-xs text-muted">
                        Certified {platform.level} · {platform.version}
                    </p>
                </div>
            </header>

            {#if platform.deployments.length > 0}
                <div class="space-y-3">
                    <p class="text-xs font-semibold tracking-wide text-faint uppercase">
                        Deployment keys
                    </p>
                    {#each platform.deployments as deployment (deployment.ename)}
                        <KeyEntry {deployment} onchange={refresh} />
                    {/each}
                </div>
            {/if}

            <div class="space-y-3">
                <p class="text-xs font-semibold tracking-wide text-faint uppercase">
                    Permissions
                </p>
                <div class="overflow-x-auto">
                    <table class="w-full min-w-[26rem] text-sm">
                        <thead>
                            <tr class="border-b border-line text-left">
                                <th class="py-2 font-semibold text-ink">Data</th>
                                <th class="py-2 font-semibold text-ink">Read</th>
                                <th class="py-2 font-semibold text-ink">Write</th>
                                <th class="py-2 font-semibold text-ink">State</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each platform.grants as grant (grant.domain)}
                                <tr class="border-b border-line">
                                    <td class="py-3">{grant.label}</td>
                                    <td class="py-3">
                                        <input
                                            type="checkbox"
                                            checked={grant.read}
                                            disabled={saving === `${platform.ename}:${grant.domain}`}
                                            onchange={() => toggle(platform.ename, grant, "read")}
                                        />
                                    </td>
                                    <td class="py-3">
                                        <input
                                            type="checkbox"
                                            checked={grant.write}
                                            disabled={saving === `${platform.ename}:${grant.domain}`}
                                            onchange={() => toggle(platform.ename, grant, "write")}
                                        />
                                    </td>
                                    <td class="py-3 text-xs text-muted">
                                        {#if grant.read || grant.write}
                                            permitted
                                        {:else if grant.revoked}
                                            withdrawn
                                        {:else}
                                            never given
                                        {/if}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
                <p class="text-xs text-muted">
                    Only the data this platform was certified for is listed. Anything
                    else is refused before permissions are even consulted.
                </p>
            </div>

            {#if platform.deployments.length > 0}
                <RequestTester
                    deployments={platform.deployments}
                    domains={platform.grants.map((grant) => ({
                        domain: grant.domain,
                        label: grant.label,
                    }))}
                />
            {/if}
        </section>
    {/each}
</div>
