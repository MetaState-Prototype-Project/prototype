<script lang="ts">
    import ChainTrace from "./ChainTrace.svelte";
import KeyEntry from "./KeyEntry.svelte";
    import type { ChainResult } from "@metastate-foundation/auth/platform";

    interface Deployment {
        ename: string;
        name: string;
        environment: string;
        version: string;
        releaseTag: string;
        commitSha: string;
        deployerEname: string;
        publicKey: string;
        certified: { level: string | null; domains: string[]; decision: string } | null;
        keyHeld: boolean;
    }

    let {
        deployment,
        onchange,
    }: { deployment: Deployment; onchange: () => Promise<void> } = $props();

    let chain = $state<ChainResult | null>(null);
    let missing = $state<string[]>([]);
    let busy = $state(false);
    let checked = $state(false);

    async function check() {
        busy = true;
        try {
            const res = await fetch("/api/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deploymentEname: deployment.ename }),
            });
            const body = await res.json();
            chain = body.chain;
            missing = body.missing ?? [];
            checked = true;
        } finally {
            busy = false;
        }
    }

</script>

<div class="rounded-2xl border border-line p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
            <p class="text-sm font-semibold text-ink">
                {deployment.name}
                <span class="ml-2 font-normal text-muted">{deployment.environment}</span>
            </p>
            <p class="mt-0.5 text-xs text-muted">
                {deployment.releaseTag} · {deployment.commitSha.slice(0, 12)}
            </p>
        </div>
        <button class="btn btn-quiet" disabled={busy} onclick={check}>
            {busy ? "Checking…" : "Check it"}
        </button>
    </div>

    <div class="mt-3">
        <KeyEntry {deployment} onchange={onchange} />
    </div>

    {#if checked && missing.length > 0}
        <p class="mt-3 rounded-2xl bg-caution-wash px-4 py-3 text-sm text-caution">
            Cannot be checked yet — {missing.join("; ")}.
        </p>
    {/if}

    {#if chain}
        <div class="mt-4">
            <ChainTrace {chain} />
        </div>

        {#if chain.claim}
            <p class="mt-3 rounded-2xl bg-positive-wash px-4 py-3 text-sm text-positive">
                Proved: {chain.claim.platformName} {chain.claim.version}, certified
                {chain.claim.level} for {chain.claim.domains.join(", ") || "no domains"}.
            </p>
        {:else if chain.failedAt === "possession" && !deployment.keyHeld}
            <p class="mt-3 rounded-2xl bg-canvas px-4 py-3 text-sm text-body">
                Everything that can be checked by reading has been checked. The one
                thing left is whether whoever is calling actually holds this
                deployment's key — enter it above and check again.
            </p>
        {/if}
    {/if}
</div>
