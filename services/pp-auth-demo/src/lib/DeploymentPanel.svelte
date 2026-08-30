<script lang="ts">
    import ChainTrace from "./ChainTrace.svelte";
    import type { ChainResult, AuthorizationDecision } from "@metastate-foundation/auth/platform";

    interface Deployment {
        id: string;
        blurb: string;
        name: string;
        platformName: string;
        platformEname: string;
        version: string;
        releaseTag: string;
        deployerEname: string;
        publicKey: string;
        certifiedDomains: string[];
        repository: string;
        reputation: number | null;
        tampered: string | null;
    }

    let {
        deployment,
        domains,
        accent,
        onchange,
    }: {
        deployment: Deployment;
        domains: readonly { id: string; label: string }[];
        accent: string;
        onchange: () => Promise<void>;
    } = $props();

    let chain = $state<ChainResult | null>(null);
    let decision = $state<AuthorizationDecision | null>(null);
    let busy = $state(false);
    let text = $state("");
    let publicKeyEdit = $state("");
    let lastDomain = $state<string | null>(null);

    async function call(path: string, body: unknown) {
        busy = true;
        try {
            const response = await fetch(path, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            return await response.json();
        } finally {
            busy = false;
        }
    }

    async function handshake() {
        decision = null;
        lastDomain = null;
        const result = await call("/api/handshake", { deploymentId: deployment.id });
        chain = result.chain ?? null;
    }

    async function reach(domain: string) {
        lastDomain = domain;
        const result = await call("/api/access", {
            deploymentId: deployment.id,
            domain,
            kind: "Note",
            text,
        });
        chain = result.chain ?? null;
        decision = result.decision ?? null;
        if (result.decision?.allowed) text = "";
        await onchange();
    }

    async function tamper(edit: string, value = "") {
        await call("/api/tamper", { deploymentId: deployment.id, edit, value });
        chain = null;
        decision = null;
        await onchange();
    }
</script>

<section class="card flex flex-col gap-5 p-6">
    <header class="flex items-start justify-between gap-4">
        <div class="min-w-0">
            <p class="eyebrow" style="color: {accent}">{deployment.name}</p>
            <h2 class="text-xl font-semibold text-ink">{deployment.platformName}</h2>
            <p class="mt-1 text-sm text-muted">{deployment.blurb}</p>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-2">
            {#each deployment.certifiedDomains as domain (domain)}
                <span class="pill bg-brand-wash text-brand">{domain}</span>
            {/each}
        </div>
    </header>

    {#if deployment.tampered}
        <p class="rounded-2xl bg-caution-wash px-4 py-3 text-sm text-caution">
            Evidence altered: {deployment.tampered}. Try reaching something and see
            which step notices.
        </p>
    {/if}

    <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt class="text-faint">Release</dt>
        <dd class="text-body">{deployment.releaseTag}</dd>
        <dt class="text-faint">Put here by</dt>
        <dd class="mono-block">{deployment.deployerEname}</dd>
        <dt class="text-faint">Reputation</dt>
        <dd class="text-body">
            {deployment.reputation === null ? "not scored" : deployment.reputation}
        </dd>
    </dl>

    <div class="space-y-3">
        <p class="text-xs font-semibold tracking-wide text-faint uppercase">
            Write something into the vault
        </p>
        <input
            class="field"
            bind:value={text}
            placeholder="Leave blank to just read"
        />
        <div class="flex flex-wrap gap-2">
            {#each domains as domain (domain.id)}
                <button
                    class="btn btn-quiet"
                    disabled={busy}
                    onclick={() => reach(domain.id)}
                >
                    {domain.label}
                </button>
            {/each}
        </div>
    </div>

    {#if decision}
        <p
            class="rounded-2xl px-4 py-3 text-sm"
            class:bg-positive-wash={decision.allowed}
            class:text-positive={decision.allowed}
            class:bg-negative-wash={!decision.allowed}
            class:text-negative={!decision.allowed}
        >
            {decision.reason}
        </p>
    {:else if chain && !chain.ok && lastDomain}
        <p class="rounded-2xl bg-negative-wash px-4 py-3 text-sm text-negative">
            {chain.links.find((link) => !link.ok)?.detail}
        </p>
    {/if}

    <div class="space-y-3">
        <div class="flex items-center justify-between">
            <p class="text-xs font-semibold tracking-wide text-faint uppercase">
                What it proved
            </p>
            <button class="btn btn-quiet" disabled={busy} onclick={handshake}>
                Check again
            </button>
        </div>
        {#if chain}
            <ChainTrace {chain} />
        {:else}
            <p class="text-sm text-muted">
                Nothing checked yet. Reach for something above, or check now.
            </p>
        {/if}
    </div>

    <details class="rounded-2xl border border-line px-4 py-3">
        <summary class="cursor-pointer text-sm font-semibold text-ink">
            Try to cheat
        </summary>
        <div class="mt-4 space-y-4">
            <div class="space-y-2">
                <label class="text-xs text-muted" for="key-{deployment.id}">
                    Claim a different key. Paste one, or leave it blank for a made-up one.
                </label>
                <textarea
                    id="key-{deployment.id}"
                    class="field mono-block"
                    rows="2"
                    bind:value={publicKeyEdit}
                    placeholder={deployment.publicKey}
                ></textarea>
                <button
                    class="btn btn-quiet"
                    disabled={busy}
                    onclick={() =>
                        tamper(
                            "publicKey",
                            publicKeyEdit.trim() || "z2yQdcRZ9nH5rTjKQ8sVpN3wBxLmFgYtCvUaEoPiSdXhZ",
                        )}
                >
                    Use this key
                </button>
            </div>
            <div class="flex flex-wrap gap-2">
                <button class="btn btn-quiet" disabled={busy} onclick={() => tamper("environment")}>
                    Widen its own authority
                </button>
                <button class="btn btn-quiet" disabled={busy} onclick={() => tamper("versionDocument")}>
                    Take the other one's release papers
                </button>
                <button class="btn btn-quiet" disabled={busy} onclick={() => tamper("versionEname")}>
                    Point at another release
                </button>
                <button class="btn btn-quiet" disabled={busy} onclick={() => tamper("certificate")}>
                    Take the other one's certificate
                </button>
                <button class="btn btn-primary" disabled={busy} onclick={() => tamper("restore")}>
                    Put it back
                </button>
            </div>
        </div>
    </details>
</section>
