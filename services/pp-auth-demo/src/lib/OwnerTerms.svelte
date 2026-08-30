<script lang="ts">
    import type { AccessPolicyStatement } from "@metastate-foundation/auth/platform";

    let {
        policy,
        signature,
        domains,
        reputationEngine,
        onchange,
    }: {
        policy: AccessPolicyStatement;
        signature: { payload: string; signature: string; signer: string };
        domains: readonly { id: string; label: string }[];
        reputationEngine: string;
        onchange: () => Promise<void>;
    } = $props();

    const LEVELS = [
        { id: "L0", note: "Anything the association has looked at" },
        { id: "L1", note: "Basic checks passed" },
        { id: "L2", note: "The people behind it are identified" },
        { id: "L3", note: "The code has been read by a reviewer" },
        { id: "L4", note: "Reviewed in depth, with a track record" },
        { id: "L5", note: "The highest assurance the association issues" },
    ];

    // These are an editable draft, not a view of the policy: they seed from it
    // and then diverge as the owner types. The parent keys this component on
    // the policy's nonce, so a newly signed or reset policy remounts and
    // reseeds rather than silently leaving stale values in the form.
    /* svelte-ignore state_referenced_locally */
    let minimumLevel = $state(policy.minimumLevel);
    /* svelte-ignore state_referenced_locally */
    let engine = $state(policy.reputationEngine);
    /* svelte-ignore state_referenced_locally */
    let minimumReputation = $state(
        policy.minimumReputation === null ? "" : String(policy.minimumReputation),
    );
    /* svelte-ignore state_referenced_locally */
    let denied = $state(new Set(policy.deniedDomains));
    let busy = $state(false);
    let saved = $state(false);

    function toggle(id: string) {
        const next = new Set(denied);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        denied = next;
        saved = false;
    }

    async function save() {
        busy = true;
        saved = false;
        try {
            await fetch("/api/policy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    minimumLevel,
                    reputationEngine: engine,
                    minimumReputation: minimumReputation === "" ? null : minimumReputation,
                    allowedDomains: null,
                    deniedDomains: [...denied],
                }),
            });
            await onchange();
            saved = true;
        } finally {
            busy = false;
        }
    }
</script>

<section class="card space-y-6 p-6">
    <header>
        <p class="eyebrow">Your terms</p>
        <h2 class="text-xl font-semibold text-ink">What you will deal with</h2>
        <p class="mt-1 text-sm text-muted">
            The association says what a platform was found to be. You decide what
            that is worth. Your answers are signed, so they travel with you and
            anyone can check them — including the platform, before it bothers asking.
        </p>
    </header>

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
                        onchange={() => (saved = false)}
                    />
                    <span>
                        <span class="font-semibold text-ink">{level.id}</span>
                        <span class="block text-xs text-muted">{level.note}</span>
                    </span>
                </label>
            {/each}
        </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-2">
            <label class="text-xs font-semibold tracking-wide text-faint uppercase" for="engine">
                Whose reputation scores you trust
            </label>
            <input
                id="engine"
                class="field"
                bind:value={engine}
                oninput={() => (saved = false)}
                placeholder={reputationEngine}
            />
            <p class="text-xs text-muted">
                Leave blank to ignore reputation entirely.
            </p>
        </div>
        <div class="space-y-2">
            <label class="text-xs font-semibold tracking-wide text-faint uppercase" for="score">
                The score they must reach
            </label>
            <input
                id="score"
                class="field"
                inputmode="numeric"
                bind:value={minimumReputation}
                oninput={() => (saved = false)}
                placeholder="No threshold"
            />
        </div>
    </div>

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

    <div class="flex items-center gap-3">
        <button class="btn btn-primary" disabled={busy} onclick={save}>
            {busy ? "Signing…" : "Sign these terms"}
        </button>
        {#if saved}
            <span class="text-sm text-positive">Signed and in force.</span>
        {/if}
    </div>

    <details class="rounded-2xl border border-line px-4 py-3">
        <summary class="cursor-pointer text-sm font-semibold text-ink">
            The statement you signed
        </summary>
        <pre class="mono-block mt-3 whitespace-pre-wrap">{JSON.stringify(policy, null, 2)}</pre>
        <p class="mono-block mt-3">Signature: {signature.signature}</p>
    </details>
</section>
