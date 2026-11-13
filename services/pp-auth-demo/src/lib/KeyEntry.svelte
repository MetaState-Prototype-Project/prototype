<script lang="ts">
    /**
     * Supplying a deployment's private key.
     *
     * Shown before anything is tried rather than after a failure: possession is
     * the one link a reader cannot establish by looking, so whether the key is
     * here decides what a check can even mean.
     */
    let {
        deployment,
        onchange,
    }: {
        deployment: { ename: string; name: string; environment: string; keyHeld: boolean };
        onchange: () => Promise<void>;
    } = $props();

    let value = $state("");
    let open = $state(false);
    let busy = $state(false);
    let error = $state<string | null>(null);

    async function save(privateKey: string) {
        busy = true;
        error = null;
        try {
            const res = await fetch("/api/key", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deploymentEname: deployment.ename, privateKey }),
            });
            if (!res.ok) {
                error = "That key was not accepted.";
                return;
            }
            value = "";
            open = false;
            await onchange();
        } finally {
            busy = false;
        }
    }
</script>

<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3">
    <div class="min-w-0">
        <p class="text-sm font-semibold text-ink">
            {deployment.name}
            <span class="ml-2 font-normal text-muted">{deployment.environment}</span>
        </p>
        <p class="text-xs text-muted">
            {deployment.keyHeld
                ? "Key supplied — this deployment can answer a challenge."
                : "No key — its identity cannot be proved from here."}
        </p>
    </div>
    <div class="flex items-center gap-2">
        {#if deployment.keyHeld}
            <span class="pill bg-positive-wash text-positive">Can prove itself</span>
            <button class="btn btn-quiet" disabled={busy} onclick={() => save("")}>
                Forget it
            </button>
        {:else}
            <button class="btn btn-quiet" onclick={() => (open = !open)}>
                {open ? "Cancel" : "Enter its key"}
            </button>
        {/if}
    </div>

    {#if open && !deployment.keyHeld}
        <div class="w-full space-y-2">
            <textarea
                class="field mono-block"
                rows="3"
                bind:value
                placeholder="PKCS#8 private key, base64"
            ></textarea>
            <div class="flex items-center gap-3">
                <button
                    class="btn btn-primary"
                    disabled={busy || !value.trim()}
                    onclick={() => save(value)}
                >
                    {busy ? "Saving…" : "Use this key"}
                </button>
                <p class="text-xs text-muted">
                    Held in memory for this process only. Never written down, never logged.
                </p>
            </div>
            {#if error}
                <p class="text-xs text-negative">{error}</p>
            {/if}
        </div>
    {/if}
</div>
