<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { get } from "svelte/store";
    import { api } from "$lib/api";
    import { sessionToken } from "$lib/session";

    let name = $state("");
    let websiteUrl = $state("");
    let description = $state("");
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
                body: { name, websiteUrl, description },
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
    <h1 class="text-2xl font-bold text-white">Apply for access</h1>
    <p class="mt-2 text-sm text-gray-400">
        Tell us your platform name, website and what it does. A whitelisted
        admin will review the request before you can poll packets or register
        webhooks.
    </p>

    {#if existingStatus}
        <p class="mt-4 rounded bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
            You already have an application — current status:
            <strong>{existingStatus}</strong>. Submitting again updates it.
        </p>
    {/if}
    {#if error}
        <p class="mt-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
    {/if}

    <div class="mt-6 space-y-4">
        <label class="block">
            <span class="text-sm font-medium text-gray-300">Platform name</span>
            <input
                bind:value={name}
                class="mt-1 w-full rounded border border-white/10 bg-[#1b1f29] px-3 py-2 text-gray-100 placeholder-gray-500"
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-300">Website URL</span>
            <input
                bind:value={websiteUrl}
                placeholder="https://my-platform.example"
                class="mt-1 w-full rounded border border-white/10 bg-[#1b1f29] px-3 py-2 text-gray-100 placeholder-gray-500"
            />
        </label>
        <label class="block">
            <span class="text-sm font-medium text-gray-300">Description</span>
            <textarea
                bind:value={description}
                rows="4"
                placeholder="What your platform does and why it needs awareness access."
                class="mt-1 w-full rounded border border-white/10 bg-[#1b1f29] px-3 py-2 text-gray-100 placeholder-gray-500"
            ></textarea>
        </label>
        <button
            class="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            disabled={submitting}
            onclick={submit}
        >
            {submitting ? "Submitting…" : "Submit application"}
        </button>
    </div>
</section>
