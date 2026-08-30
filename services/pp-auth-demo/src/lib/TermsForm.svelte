<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import QRCode from "svelte-qrcode";
    import type { AccessPolicyStatement } from "@metastate-foundation/auth/platform";

    let {
        policy,
        domains,
        reputationEngine,
    }: {
        policy: AccessPolicyStatement;
        domains: Array<{ id: string; label: string }>;
        reputationEngine: string;
    } = $props();

    const LEVELS = [
        { id: "L0", note: "Anything the association has looked at" },
        { id: "L1", note: "Basic checks passed" },
        { id: "L2", note: "The people behind it are identified" },
        { id: "L3", note: "The code has been read by a reviewer" },
        { id: "L4", note: "Reviewed in depth, with a track record" },
        { id: "L5", note: "The highest assurance the association issues" },
    ];

    // An editable draft, not a view of the policy: it seeds from what is in
    // force and then diverges as the owner types. The parent keys this
    // component on the policy nonce, so newly signed terms remount and reseed
    // rather than leaving stale values in the form.
    /* svelte-ignore state_referenced_locally */
    let minimumLevel = $state(policy.minimumLevel);
    /* svelte-ignore state_referenced_locally */
    let denied = $state(new Set(policy.deniedDomains));

    let uri = $state<string | null>(null);
    let error = $state<string | null>(null);
    let done = $state(false);
    let busy = $state(false);
    let timer: ReturnType<typeof setInterval> | null = null;

    function toggle(id: string) {
        const next = new Set(denied);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        denied = next;
        done = false;
    }

    function stop() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    async function sign() {
        busy = true;
        error = null;
        done = false;
        stop();
        try {
            const res = await fetch("/api/terms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    minimumLevel,
                    deniedDomains: [...denied],
                }),
            });
            const body = await res.json();
            if (!res.ok) {
                error = body.error ?? "Could not prepare those terms";
                return;
            }
            uri = body.uri;

            timer = setInterval(async () => {
                const poll = await fetch("/api/terms/status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ payload: body.payload, statement: body.statement }),
                });
                const status = await poll.json();
                if (status.status === "published") {
                    stop();
                    uri = null;
                    done = true;
                    await invalidateAll();
                } else if (status.status === "unknown" || status.error) {
                    stop();
                    uri = null;
                    error = status.error ?? "That request expired. Try again.";
                }
            }, 1500);
        } finally {
            busy = false;
        }
    }

    $effect(() => () => stop());
</script>

<section class="card space-y-6 p-6">
    <div class="space-y-3">
        <p class="text-xs font-semibold tracking-wide text-faint uppercase">
            The least you will accept
        </p>
        <div class="grid gap-2 sm:grid-cols-2">
            {#each LEVELS as level (level.id)}
                <label
                    class="flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm"
                    class:border-brand={minimumLevel === level.id}
                    class:bg-brand-wash={minimumLevel === level.id}
                    class:border-line={minimumLevel !== level.id}
                >
                    <input
                        type="radio"
                        class="mt-1"
                        value={level.id}
                        bind:group={minimumLevel}
                        onchange={() => (done = false)}
                    />
                    <span>
                        <span class="font-semibold text-ink">{level.id}</span>
                        <span class="block text-xs text-muted">{level.note}</span>
                    </span>
                </label>
            {/each}
        </div>
    </div>

    <div class="space-y-2">
        <p class="text-xs font-semibold tracking-wide text-faint uppercase">
            Whose reputation scores you trust
        </p>
        <p class="text-sm text-body">{reputationEngine}</p>
        <p class="text-xs text-muted">
            The only reputation service on the network today, so there is nothing to
            choose. It is named in what you sign, so the record says which service you
            accepted scores from.
        </p>
    </div>

    {#if domains.length > 0}
        <div class="space-y-3">
            <p class="text-xs font-semibold tracking-wide text-faint uppercase">
                Things nobody gets, whatever their certificate says
            </p>
            <div class="flex flex-wrap gap-2">
                {#each domains as domain (domain.id)}
                    <button
                        class="pill"
                        class:bg-negative-wash={denied.has(domain.id)}
                        class:text-negative={denied.has(domain.id)}
                        class:bg-canvas={!denied.has(domain.id)}
                        class:text-muted={!denied.has(domain.id)}
                        onclick={() => toggle(domain.id)}
                    >
                        {domain.label}
                    </button>
                {/each}
            </div>
        </div>
    {/if}

    <div class="flex flex-wrap items-center gap-3">
        <button class="btn btn-primary" disabled={busy} onclick={sign}>
            {busy ? "Preparing…" : "Sign these terms"}
        </button>
        {#if done}
            <span class="text-sm text-positive">Signed and published to your eVault.</span>
        {/if}
        {#if error}
            <span class="text-sm text-negative">{error}</span>
        {/if}
    </div>

    {#if uri}
        <div class="rounded-2xl border border-line p-5 text-center">
            <p class="text-sm text-body">Approve these terms in your wallet.</p>
            <div class="mt-4 flex justify-center rounded-2xl bg-white p-4">
                <QRCode value={uri} size={220} />
            </div>
        </div>
    {/if}
</section>
