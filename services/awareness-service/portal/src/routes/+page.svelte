<script lang="ts">
    import { onDestroy } from "svelte";
    import { goto } from "$app/navigation";
    import QrCode from "svelte-qrcode";
    import { api } from "$lib/api";
    import { sessionToken } from "$lib/session";

    let uri = $state<string | null>(null);
    let session = $state<string | null>(null);
    let error = $state<string | null>(null);
    let polling = $state(false);
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    async function startLogin() {
        error = null;
        try {
            const offer = await api<{ uri: string; session: string }>(
                "/api/auth/offer",
                { method: "POST" },
            );
            uri = offer.uri;
            session = offer.session;
            polling = true;
            pollTimer = setInterval(pollSession, 2500);
        } catch (e) {
            error = e instanceof Error ? e.message : "failed to start login";
        }
    }

    async function pollSession() {
        if (!session) return;
        try {
            const result = await api<
                { status: "pending" } | { status: "authenticated"; token: string }
            >(`/api/auth/session/${session}`);
            if (result.status === "authenticated") {
                clearInterval(pollTimer);
                sessionToken.set(result.token);
                goto("/dashboard");
            }
        } catch {
            // keep polling; transient errors are expected
        }
    }

    onDestroy(() => clearInterval(pollTimer));
</script>

<section class="mx-auto max-w-xl text-center">
    <h1 class="text-3xl font-bold text-white">Awareness as a Service</h1>
    <p class="mt-3 text-gray-400">
        Query MetaEnvelope awareness packets and register webhook subscriptions
        scoped by ontology and eVault. Sign in with your W3DS identity to apply
        for access.
    </p>

    {#if error}
        <p class="mt-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
    {/if}

    {#if !uri}
        <button
            class="mt-8 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500"
            onclick={startLogin}
        >
            Sign in with W3DS
        </button>
    {:else}
        <div class="mt-8 flex flex-col items-center gap-4">
            <p class="text-sm text-gray-400">
                Scan with your eID wallet to sign in.
            </p>
            <!-- QR keeps a white plate for scanner contrast -->
            <div class="rounded-lg bg-white p-4 shadow-lg">
                <QrCode value={uri} size={220} />
            </div>
            {#if polling}
                <p class="text-sm text-gray-500">Waiting for signature…</p>
            {/if}
        </div>
    {/if}
</section>
