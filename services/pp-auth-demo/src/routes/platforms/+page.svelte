<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import DeploymentRow from "$lib/DeploymentRow.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    async function refresh() {
        await invalidateAll();
    }
</script>

<div class="space-y-6">
    <section class="card p-6">
        <p class="eyebrow">Platforms</p>
        <h2 class="mt-1 text-xl font-semibold text-ink">
            Every platform running on the network
        </h2>
        <p class="mt-2 max-w-3xl text-sm text-muted">
            Read live from the network — the platforms, their releases, the deployments
            actually running them, and the decisions the association has issued. Check
            any deployment and it proves what it is, from scratch, against records
            anyone can read.
        </p>
    </section>

    {#if !data.configured}
        <section class="card p-6">
            <p class="text-sm text-body">
                This app has no key for the awareness network, so it cannot see what is
                out there. Set <code class="mono-block">PPA_AWARENESS_API_KEY</code> and reload.
            </p>
        </section>
    {:else if data.error}
        <section class="card p-6">
            <p class="text-sm text-negative">Could not read the network: {data.error}</p>
        </section>
    {:else if data.platforms.length === 0}
        <section class="card p-6">
            <p class="text-sm text-body">
                Nothing has been deployed or certified yet. This page fills in on its own
                once a platform ships a release and the association decides on it.
            </p>
        </section>
    {/if}

    {#each data.platforms as platform (platform.ename)}
        <section class="card space-y-4 p-6">
            <header class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                    <h3 class="text-lg font-semibold text-ink">{platform.name}</h3>
                    {#if platform.description}
                        <p class="mt-1 max-w-2xl text-sm text-muted">{platform.description}</p>
                    {/if}
                    <p class="mono-block mt-2">{platform.ename}</p>
                </div>
                {#if platform.deployments[0]?.certified?.decision === "granted"}
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="pill bg-brand text-white">
                            {platform.deployments[0].certified?.level}
                        </span>
                        {#each platform.deployments[0].certified?.domains ?? [] as domain (domain)}
                            <span class="pill bg-brand-wash text-brand">{domain}</span>
                        {/each}
                    </div>
                {/if}
            </header>

            {#if platform.deployments.length === 0}
                <p class="text-sm text-muted">
                    Certified, but nothing is deployed from it yet.
                </p>
            {:else}
                <div class="space-y-3">
                    {#each platform.deployments as deployment (deployment.ename)}
                        <DeploymentRow {deployment} onchange={refresh} />
                    {/each}
                </div>
            {/if}
        </section>
    {/each}
</div>
