<script lang="ts">
    import ChainTrace from "./ChainTrace.svelte";
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
    let privateKey = $state("");
    let showKey = $state(false);

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

    async function saveKey() {
        busy = true;
        try {
            await fetch("/api/key", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deploymentEname: deployment.ename, privateKey }),
            });
            privateKey = "";
            showKey = false;
            await onchange();
            await check();
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
        <div class="flex items-center gap-2">
            {#if deployment.keyHeld}
                <span class="pill bg-positive-wash text-positive">Key supplied</span>
            {/if}
            <button class="btn btn-quiet" disabled={busy} onclick={check}>
                {busy ? "Checking…" : "Check it"}
            </button>
        </div>
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
            <div class="mt-3 rounded-2xl bg-canvas p-4">
                <p class="text-sm text-body">
                    Everything that can be checked by reading has been checked. The one
                    thing left is whether whoever is calling actually holds this
                    deployment's key — and only the deployment can show that.
                </p>
                {#if showKey}
                    <textarea
                        class="field mono-block mt-3"
                        rows="3"
                        bind:value={privateKey}
                        placeholder="PKCS#8 private key, base64"
                    ></textarea>
                    <div class="mt-2 flex gap-2">
                        <button class="btn btn-primary" disabled={busy || !privateKey.trim()} onclick={saveKey}>
                            Prove it
                        </button>
                        <button class="btn btn-quiet" onclick={() => (showKey = false)}>Cancel</button>
                    </div>
                    <p class="mt-2 text-xs text-muted">
                        Kept in memory for this process only. Never written down, never logged.
                    </p>
                {:else}
                    <button class="btn btn-quiet mt-3" onclick={() => (showKey = true)}>
                        I hold this deployment's key
                    </button>
                {/if}
            </div>
        {/if}
    {/if}
</div>
