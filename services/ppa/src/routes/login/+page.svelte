<script lang="ts">
    import { onDestroy } from "svelte";
    import { goto } from "$app/navigation";
    import QrCode from "svelte-qrcode";
    import Logo from "$lib/Logo.svelte";

    let uri = $state<string | null>(null);
    let session = $state<string | null>(null);
    let error = $state<string | null>(null);
    let polling = $state(false);
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    async function startLogin() {
        error = null;
        try {
            const res = await fetch("/api/auth/offer", { method: "POST" });
            const offer = await res.json();
            if (!res.ok) throw new Error(offer.error ?? "failed to start login");
            uri = offer.uri;
            session = offer.session;
            polling = true;
            pollTimer = setInterval(poll, 2500);
        } catch (e) {
            error = e instanceof Error ? e.message : "failed to start login";
        }
    }

    async function poll() {
        if (!session) return;
        try {
            const res = await fetch(`/api/auth/session/${session}`);
            const result = await res.json();
            // 403 = signed in but not on the whitelist; 410 = the QR expired.
            // Both are terminal, so stop rather than spinning forever.
            if (res.status === 403 || res.status === 410) {
                clearInterval(pollTimer);
                polling = false;
                uri = null;
                error = result.error ?? "Not authorised";
                return;
            }
            if (result.status === "authenticated") {
                clearInterval(pollTimer);
                await goto("/", { invalidateAll: true });
            }
        } catch {
            // keep polling; transient errors are expected
        }
    }

    onDestroy(() => clearInterval(pollTimer));
</script>

<div class="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
    <!-- Brand panel: sets the tone, carries no interaction. -->
    <section
        class="relative hidden overflow-hidden bg-ink px-14 py-16 lg:flex lg:flex-col"
    >
        <div
            class="pointer-events-none absolute -top-32 -right-24 size-[30rem] rounded-full bg-brand/25 blur-3xl"
        ></div>
        <div
            class="pointer-events-none absolute -bottom-40 -left-20 size-[26rem] rounded-full bg-brand/10 blur-3xl"
        ></div>

        <div class="relative flex items-center gap-3">
            <Logo size={32} />
            <span class="text-sm font-semibold tracking-[0.14em] text-white/70 uppercase">
                Post Platforms Association
            </span>
        </div>

        <div class="relative mt-auto max-w-md">
            <h1 class="text-[2.75rem] leading-[1.1] font-semibold text-white">
                Accreditation for the
                <span class="text-brand-tint">open data space.</span>
            </h1>
            <p class="mt-5 text-[0.9375rem] leading-relaxed text-white/60">
                Review platforms applying to join the network and decide what
                level of access they receive.
            </p>
        </div>

        <dl class="relative mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
            {#each [["L1–L5", "Access levels"], ["Signed", "Every decision"], ["Wallet", "Secure sign-in"]] as [value, label] (label)}
                <div>
                    <dt class="text-lg font-semibold text-white">{value}</dt>
                    <dd class="mt-1 text-xs text-white/45">{label}</dd>
                </div>
            {/each}
        </dl>
    </section>

    <!-- Sign-in panel -->
    <section class="flex items-center justify-center px-6 py-16">
        <div class="w-full max-w-sm">
            <div class="lg:hidden">
                <Logo size={36} />
            </div>

            <p class="eyebrow mt-6 lg:mt-0">Administrator access</p>
            <h2 class="mt-2 text-2xl font-semibold text-ink">Sign in</h2>
            <p class="mt-2 text-sm text-muted">
                {uri
                    ? "Scan the code with your wallet to continue."
                    : "Only approved reviewers can sign in."}
            </p>

            {#if error}
                <p
                    class="mt-6 rounded-2xl bg-negative-wash px-4 py-3 text-sm text-negative"
                    role="alert"
                >
                    {error}
                </p>
            {/if}

            {#if !uri}
                <button class="btn btn-primary mt-8 w-full" onclick={startLogin}>
                    Sign in with your wallet
                </button>
            {:else}
                <div class="card mt-8 flex flex-col items-center gap-5 p-6">
                    <!-- White plate keeps scanner contrast on any background. -->
                    <div class="rounded-2xl bg-white p-3">
                        <QrCode value={uri} size={196} />
                    </div>
                    {#if polling}
                        <p class="flex items-center gap-2 text-sm text-muted">
                            <span
                                class="size-1.5 animate-pulse rounded-full bg-brand"
                            ></span>
                            Waiting for signature…
                        </p>
                    {/if}
                </div>
                <button class="btn btn-quiet mt-4 w-full" onclick={startLogin}>
                    Start over
                </button>
            {/if}
        </div>
    </section>
</div>
