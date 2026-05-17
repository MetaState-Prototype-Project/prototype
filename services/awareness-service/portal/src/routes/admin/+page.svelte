<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { get } from "svelte/store";
    import { api } from "$lib/api";
    import { sessionToken } from "$lib/session";

    interface Application {
        id: string;
        status: string;
        justification: string | null;
        consumer?: {
            ename: string;
            name: string | null;
            webhookBaseUrl: string | null;
        };
    }

    let applications = $state<Application[]>([]);
    let error = $state<string | null>(null);
    let loading = $state(true);
    let notAdmin = $state(false);

    const token = () => get(sessionToken);

    async function load() {
        loading = true;
        error = null;
        try {
            const result = await api<{ applications: Application[] }>(
                "/api/admin/applications?status=pending",
                { token: token() },
            );
            applications = result.applications;
        } catch (e) {
            const msg = e instanceof Error ? e.message : "failed to load";
            if (msg.includes("admin")) notAdmin = true;
            else error = msg;
        } finally {
            loading = false;
        }
    }

    async function review(id: string, action: "approve" | "reject") {
        try {
            await api(`/api/admin/applications/${id}/${action}`, {
                method: "POST",
                token: token(),
            });
            await load();
        } catch (e) {
            error = e instanceof Error ? e.message : "review failed";
        }
    }

    onMount(() => {
        if (!token()) {
            goto("/");
            return;
        }
        void load();
    });
</script>

<section>
    <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-white">Pending applications</h1>
        <a href="/admin/dead-letters" class="text-sm text-indigo-400 hover:underline">
            Dead letters →
        </a>
    </div>

    {#if notAdmin}
        <p class="mt-6 rounded bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Your eName is not in the admin allowlist.
        </p>
    {:else if error}
        <p class="mt-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
    {:else if loading}
        <p class="mt-4 text-gray-400">Loading…</p>
    {:else}
        <ul class="mt-6 space-y-4">
            {#each applications as app (app.id)}
                <li class="rounded-lg border border-white/10 bg-[#13161d] p-5">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <p class="font-semibold text-white">
                                {app.consumer?.name ?? app.consumer?.ename}
                            </p>
                            <p class="text-sm text-gray-500">{app.consumer?.ename}</p>
                            {#if app.consumer?.webhookBaseUrl}
                                <a
                                    href={app.consumer.webhookBaseUrl}
                                    target="_blank"
                                    rel="noopener"
                                    class="text-sm text-indigo-400 hover:underline"
                                >
                                    {app.consumer.webhookBaseUrl}
                                </a>
                            {/if}
                        </div>
                        <div class="flex gap-2">
                            <button
                                class="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-500"
                                onclick={() => review(app.id, "approve")}
                            >
                                Approve
                            </button>
                            <button
                                class="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500"
                                onclick={() => review(app.id, "reject")}
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                    {#if app.justification}
                        <p class="mt-3 text-sm text-gray-300">{app.justification}</p>
                    {/if}
                </li>
            {:else}
                <li class="text-gray-500">No pending applications.</li>
            {/each}
        </ul>
    {/if}
</section>
