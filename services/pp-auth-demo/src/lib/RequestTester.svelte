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
    let records = $state<Array<{ id: string; kind: string; summary: string }> | null>(null);
    let wrote = $state<{ id: string; kind: string } | null>(null);
    let note = $state<string | null>(null);
    let text = $state("");

    async function send() {
        busy = true;
        try {
            const res = await fetch("/api/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deploymentEname, domain, operation, text }),
            });
            const body = await res.json();
            chain = body.chain ?? null;
            decision = body.decision ?? null;
            stage = body.stage ?? null;
            missing = body.missing ?? [];
            records = body.records ?? null;
            wrote = body.wrote ?? null;
            note = body.note ?? null;
            if (body.wrote) text = "";
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

    {#if operation === "write"}
        <label class="block space-y-1">
            <span class="text-xs text-muted">What it wants to write</span>
            <input class="field" bind:value={text} placeholder="Something to store" />
        </label>
    {/if}

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

    {#if decision?.allowed}
        <div class="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <p class="text-xs font-semibold tracking-wide text-faint uppercase">
                {wrote ? "Written, and read back from your eVault" : "Pulled from your eVault"}
            </p>
            {#if wrote}
                <p class="text-xs text-positive">
                    Stored a new {wrote.kind} record.
                </p>
            {/if}
            {#if note}
                <p class="text-xs text-caution">{note}</p>
            {/if}
            {#if records && records.length > 0}
                <ul class="space-y-2">
                    {#each records as record (record.id)}
                        <li class="rounded-xl bg-canvas p-3">
                            <p class="text-xs text-faint">{record.kind}</p>
                            <p class="mt-1 text-sm text-body">{record.summary}</p>
                        </li>
                    {/each}
                </ul>
            {:else if records}
                <p class="text-sm text-muted">
                    The read was permitted and went through — your eVault holds nothing
                    of this kind.
                </p>
            {/if}
        </div>
    {:else if decision}
        <p class="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
            Nothing was fetched. The eVault was never asked.
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
