<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { get } from "svelte/store";
    import { api } from "$lib/api";
    import { sessionToken } from "$lib/session";

    let name = $state("");
    let contactEmail = $state("");
    let webhookBaseUrl = $state("");
    let justification = $state("");
    let requestedOntologies = $state("");
    let error = $state<string | null>(null);
    let submitting = $state(false);
    let existingStatus = $state<string | null>(null);

    onMount(async () => {
        const token = get(sessionToken);
        if (!token) {
            goto("/");
            return;
        }
        try {
            const me = await api<{ application: { status: string } | null }>(
                "/api/applications/me",
                { token },
            );
            existingStatus = me.application?.status ?? null;
        } catch {
            // first-time applicant — no application yet
        }
    });

    async function submit() {
        error = null;
        submitting = true;
        try {
            await api("/api/applications", {
                method: "POST",
                token: get(sessionToken),
                body: {
                    name,
                    contactEmail,
                    webhookBaseUrl,
                    justification,
                    requestedOntologies: requestedOntologies
                        .split(",")
                        .map((o) => o.trim())
                        .filter(Boolean),
                },
            });
            goto("/dashboard");
        } catch (e) {
            error = e instanceof Error ? e.message : "submission failed";
        } finally {
            submitting = false;
        }
    }
</script>

<section class="mx-auto max-w-xl">
    <h1 class="text-2xl font-bold text-gray-900">Apply for access</h1>
    <p class="mt-2 text-sm text-gray-600">
        Submit your platform details. A whitelisted admin will review the
        request before you can poll packets or register webhooks.
    </p>

    {#if existingStatus}
        <p class="mt-4 rounded bg-amber-50 px-4 py-2 text-sm text-amber-700">
            You already have an application — current status:
            <strong>{existingStatus}</strong>. Submitting again updates it.
        </p>
    {/if}
    {#if error}
        <p class="mt-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
    {/if}

    <div class="mt-6 space-y-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-700">Platform name</span>
            <input
                bind:value={name}
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700">Contact email</span>
            <input
                bind:value={contactEmail}
                type="email"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700">
                Webhook base URL
            </span>
            <input
                bind:value={webhookBaseUrl}
                placeholder="https://my-platform.example"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700">
                Ontologies needed (comma-separated, optional)
            </span>
            <input
                bind:value={requestedOntologies}
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-700">Justification</span>
            <textarea
                bind:value={justification}
                rows="4"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            ></textarea>
        </label>
        <button
            class="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={submitting}
            onclick={submit}
        >
            {submitting ? "Submitting…" : "Submit application"}
        </button>
    </div>
</section>
