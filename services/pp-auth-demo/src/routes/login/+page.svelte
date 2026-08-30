<script lang="ts">
    import { goto } from "$app/navigation";
    import QRCode from "svelte-qrcode";

    let uri = $state<string | null>(null);
    let error = $state<string | null>(null);
    let timer: ReturnType<typeof setInterval> | null = null;

    async function start() {
        error = null;
        uri = null;
        if (timer) clearInterval(timer);

        const res = await fetch("/api/auth/offer", { method: "POST" });
        const offer = await res.json();
        uri = offer.uri;

        timer = setInterval(async () => {
            const poll = await fetch(`/api/auth/session/${encodeURIComponent(offer.session)}`);
            if (poll.status === 410) {
                if (timer) clearInterval(timer);
                error = "That code expired. Start again.";
                uri = null;
                return;
            }
            const body = await poll.json();
            if (body.status === "authenticated") {
                if (timer) clearInterval(timer);
                await goto("/platforms", { invalidateAll: true });
            }
        }, 1500);
    }

    $effect(() => {
        start();
        return () => {
            if (timer) clearInterval(timer);
        };
    });
</script>

<div class="mx-auto max-w-md">
    <section class="card space-y-6 p-8 text-center">
        <div>
            <p class="eyebrow">Sign in</p>
            <h2 class="mt-1 text-xl font-semibold text-ink">Scan with your wallet</h2>
            <p class="mt-2 text-sm text-muted">
                This reads your own eVault, so it needs to know it is you.
            </p>
        </div>

        {#if uri}
            <div class="flex justify-center rounded-2xl bg-white p-4">
                <QRCode value={uri} size={240} />
            </div>
        {:else if error}
            <p class="rounded-2xl bg-negative-wash px-4 py-3 text-sm text-negative">{error}</p>
            <button class="btn btn-primary" onclick={start}>Try again</button>
        {:else}
            <p class="text-sm text-muted">Preparing a code…</p>
        {/if}
    </section>
</div>
