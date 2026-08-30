<script lang="ts">
    import ChainTrace from "./ChainTrace.svelte";
    import type { ChainResult } from "@metastate-foundation/auth/platform";

    let {
        deployments,
        domains,
    }: {
        deployments: Array<{ ename: string; name: string; environment: string; keyHeld: boolean }>;
        domains: Array<{ domain: string; label: string }>;
    } = $props();

    let deploymentEname = $state("");
    let domain = $state("");
    let operation = $state<"read" | "write">("read");

    // Keep the selection valid as the lists change underneath it. Holding a
    // stale eName would send the request against something no longer listed.
    $effect(() => {
        if (!deployments.some((entry) => entry.ename === deploymentEname)) {
            deploymentEname = deployments[0]?.ename ?? "";
        }
    });
    $effect(() => {
        if (!domains.some((entry) => entry.domain === domain)) {
            domain = domains[0]?.domain ?? "";
        }
    });

    let busy = $state(false);
    let chain = $state<ChainResult | null>(null);
    let decision = $state<{ allowed: boolean; reason: string; code: string } | null>(null);
    let stage = $state<string | null>(null);
    let missing = $state<string[]>([]);

    async function send() {
        busy = true;
        try {
            const res = await fetch("/api/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deploymentEname, domain, operation }),
            });
            const body = await res.json();
            chain = body.chain ?? null;
            decision = body.decision ?? null;
            stage = body.stage ?? null;
            missing = body.missing ?? [];
        } finally {
            busy = false;
        }
    }

    let held = $derived(deployments.find((d) => d.ename === deploymentEname)?.keyHeld ?? false);
</script>

<div class="space-y-4 rounded-2xl bg-canvas p-4">
    <p class="text-xs font-semibold tracking-wide text-faint uppercase">Try a request</p>

    <div class="grid gap-3 sm:grid-cols-3">
        <label class="space-y-1">
            <span class="text-xs text-muted">From</span>
            <select class="field" bind:value={deploymentEname}>
                {#each deployments as deployment (deployment.ename)}
                    <option value={deployment.ename}>
                        {deployment.name} · {deployment.environment}
                    </option>
                {/each}
            </select>
        </label>
        <label class="space-y-1">
            <span class="text-xs text-muted">Wants to</span>
            <select class="field" bind:value={operation}>
                <option value="read">read</option>
                <option value="write">write to</option>
            </select>
        </label>
        <label class="space-y-1">
            <span class="text-xs text-muted">Your</span>
            <select class="field" bind:value={domain}>
                {#each domains as entry (entry.domain)}
                    <option value={entry.domain}>{entry.label}</option>
                {/each}
            </select>
        </label>
    </div>

    {#if !held}
        <p class="text-xs text-caution">
            This deployment has no key here, so it cannot prove who it is and the
            request will stop at the handshake. Enter its key above first.
        </p>
    {/if}

    <button class="btn btn-primary" disabled={busy || !deploymentEname} onclick={send}>
        {busy ? "Sending…" : "Send it"}
    </button>

    {#if stage === "evidence"}
        <p class="rounded-2xl bg-caution-wash px-4 py-3 text-sm text-caution">
            Cannot be checked — {missing.join("; ")}.
        </p>
    {:else if decision}
        <p
            class="rounded-2xl px-4 py-3 text-sm"
            class:bg-positive-wash={decision.allowed}
            class:text-positive={decision.allowed}
            class:bg-negative-wash={!decision.allowed}
            class:text-negative={!decision.allowed}
        >
            {decision.reason}
        </p>
    {:else if stage === "handshake" && chain}
        <p class="rounded-2xl bg-negative-wash px-4 py-3 text-sm text-negative">
            Refused before any permission was consulted — it could not prove what it is.
            {chain.links.find((link) => !link.ok)?.detail}
        </p>
    {/if}

    {#if chain}
        <details>
            <summary class="cursor-pointer text-xs text-muted select-none hover:text-ink">
                What it proved
            </summary>
            <div class="mt-3">
                <ChainTrace {chain} />
            </div>
        </details>
    {/if}
</div>
