<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import KeyEntry from "$lib/KeyEntry.svelte";
    import RequestTester from "$lib/RequestTester.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    async function refresh() {
        await invalidateAll();
    }
</script>

<div class="space-y-6">
    <section class="card p-6">
        <p class="eyebrow">Permissions</p>
        <h2 class="mt-1 text-xl font-semibold text-ink">What each platform may do</h2>
        <p class="mt-2 max-w-3xl text-sm text-muted">
            Being certified for a kind of data is not permission to do anything with
            it. Reading your posts is not the same as writing to them. Ask for
            something on this platform's behalf and see what happens — and what comes
            back out of your eVault when it is allowed.
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
                <div class="flex flex-wrap items-center gap-2">
                    {#each platform.certifiedDomains as domain (domain)}
                        <span class="pill bg-brand-wash text-brand">{domain}</span>
                    {/each}
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

                <RequestTester
                    platformEname={platform.ename}
                    deployments={platform.deployments}
                    grants={platform.grants}
                    onchange={refresh}
                />
            {:else}
                <p class="text-sm text-muted">
                    Nothing is deployed from this platform, so there is nothing to ask on
                    its behalf.
                </p>
            {/if}
        </section>
    {/each}
</div>
