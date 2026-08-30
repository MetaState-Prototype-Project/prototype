<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import DeploymentPanel from "$lib/DeploymentPanel.svelte";
    import OwnerTerms from "$lib/OwnerTerms.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const ACCENTS = ["#8869ff", "#0f9d68"];

    async function refresh() {
        await invalidateAll();
    }

    async function reset() {
        await fetch("/api/reset", { method: "POST" });
        await refresh();
    }
</script>

<div class="space-y-8">
    <section class="card p-8">
        <p class="eyebrow">The demonstration</p>
        <h2 class="mt-1 text-2xl font-semibold text-ink">
            Two platforms want your data. Only one of them should get each thing.
        </h2>
        <p class="mt-3 max-w-3xl text-sm text-body">
            Chatterbox is a social platform. Ledgerly handles money. Both are
            running, both are certified, and both will now try to reach everything
            in your vault — your posts, your messages, your accounts, your health
            records. Watch what each one is actually allowed to touch, and why.
        </p>
        <p class="mt-3 max-w-3xl text-sm text-muted">
            Nothing here is enforced by a list of platform names. Each one proves,
            from scratch on every attempt, which release it is running and what
            that release was certified for. A social platform has no way to say
            the word “finance”: it is not in its certificate, and nothing it can
            present will put it there.
        </p>
        <button class="btn btn-quiet mt-5" onclick={reset}>Start over</button>
    </section>

    <div class="grid gap-6 lg:grid-cols-2">
        {#each data.deployments as deployment, index (deployment.id)}
            <DeploymentPanel
                {deployment}
                domains={data.domains}
                accent={ACCENTS[index % ACCENTS.length]}
                onchange={refresh}
            />
        {/each}
    </div>

    {#key data.policy.nonce}
        <OwnerTerms
            policy={data.policy}
            signature={data.policySignature}
            domains={data.domains}
            reputationEngine={data.reputationEngine}
            onchange={refresh}
        />
    {/key}

    <div class="grid gap-6 lg:grid-cols-2">
        <section class="card space-y-4 p-6">
            <header>
                <p class="eyebrow">Your vault</p>
                <h2 class="text-xl font-semibold text-ink">What is in there</h2>
            </header>
            <ul class="space-y-3">
                {#each data.records as record (record.id)}
                    <li class="rounded-2xl border border-line p-3">
                        <div class="flex items-center justify-between gap-3">
                            <span class="pill bg-canvas text-muted">{record.domain}</span>
                            <span class="text-xs text-faint">
                                {record.writtenBy === data.owner ? "you" : record.writtenBy}
                            </span>
                        </div>
                        <p class="mt-2 text-sm text-body">{record.body}</p>
                    </li>
                {/each}
            </ul>
        </section>

        <section class="card space-y-4 p-6">
            <header>
                <p class="eyebrow">What happened</p>
                <h2 class="text-xl font-semibold text-ink">Every attempt, kept</h2>
            </header>
            {#if data.attempts.length === 0}
                <p class="text-sm text-muted">
                    Nothing has tried to reach your data yet.
                </p>
            {:else}
                <ul class="space-y-2">
                    {#each data.attempts as attempt (attempt.id)}
                        <li class="flex gap-3 rounded-2xl border border-line p-3">
                            <span
                                class="mt-0.5 size-2 shrink-0 rounded-full"
                                class:bg-positive={attempt.allowed}
                                class:bg-negative={!attempt.allowed}
                            ></span>
                            <div class="min-w-0">
                                <p class="text-sm text-body">{attempt.reason}</p>
                                <p class="mt-0.5 text-xs text-faint">
                                    {new Date(attempt.at).toLocaleTimeString()}
                                </p>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        </section>
    </div>

    <section class="card p-6">
        <p class="eyebrow">Honesty note</p>
        <p class="mt-2 max-w-3xl text-sm text-muted">
            The signatures on this page are real and are checked by the same code
            that checks a live deployment. What is simulated is who holds the
            keys: the wallet, the registry and the association are stood in for by
            keys generated in this process, so the demonstration runs on its own.
            A chain that verifies here proves the mechanism works — not that any
            particular platform is trustworthy.
        </p>
    </section>
</div>
