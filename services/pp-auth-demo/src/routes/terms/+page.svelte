<script lang="ts">
    import TermsForm from "$lib/TermsForm.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<div class="space-y-6">
    <section class="card p-6">
        <p class="eyebrow">Your terms</p>
        <h2 class="mt-1 text-xl font-semibold text-ink">What you will deal with</h2>
        <p class="mt-2 max-w-3xl text-sm text-muted">
            The association says what a platform was found to be. You decide what that
            is worth. You sign your answers with your wallet and they are kept in your
            own eVault, so they travel with you and anyone can check them — including a
            platform working out whether it is worth asking.
        </p>
        {#if data.policy.signed}
            <p class="mt-3 text-sm text-positive">
                Signed on {new Date(data.policy.issuedAt ?? "").toLocaleString()}.
            </p>
        {:else}
            <p class="mt-3 text-sm text-muted">
                You have not set any terms yet, so the default applies: nothing below
                {data.policy.statement.minimumLevel}.
            </p>
        {/if}
    </section>

    {#key data.policy.statement.nonce}
        <TermsForm
            policy={data.policy.statement}
            domains={data.domains}
            reputationEngine={data.reputationEngine}
        />
    {/key}

    {#if data.policy.signed}
        <section class="card p-6">
            <details>
                <summary class="cursor-pointer text-sm font-semibold text-ink">
                    The statement you signed
                </summary>
                <pre class="mono-block mt-3 whitespace-pre-wrap">{JSON.stringify(
                        data.policy.statement,
                        null,
                        2,
                    )}</pre>
                <p class="mono-block mt-3">Signature: {data.policy.signature}</p>
            </details>
        </section>
    {/if}
</div>
