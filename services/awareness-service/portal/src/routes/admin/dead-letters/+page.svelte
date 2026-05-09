<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { get } from "svelte/store";
    import { api } from "$lib/api";
    import { sessionToken } from "$lib/session";

    interface DeadLetter {
        id: string;
        packetId: string;
        targetUrl: string;
        totalAttempts: number;
        lastError: string | null;
        lastResponseStatus: number | null;
        resolved: boolean;
        createdAt: string;
    }

    let deadLetters = $state<DeadLetter[]>([]);
    let error = $state<string | null>(null);
    let loading = $state(true);
    let notAdmin = $state(false);

    const token = () => get(sessionToken);

    async function load() {
        loading = true;
        error = null;
        try {
            const result = await api<{ deadLetters: DeadLetter[] }>(
                "/api/admin/dead-letters",
                { token: token() },
            );
            deadLetters = result.deadLetters;
        } catch (e) {
            const msg = e instanceof Error ? e.message : "failed to load";
            if (msg.includes("admin")) notAdmin = true;
            else error = msg;
        } finally {
            loading = false;
        }
    }

    async function replay(id: string) {
        try {
            await api(`/api/admin/dead-letters/${id}/replay`, {
                method: "POST",
                token: token(),
            });
            await load();
        } catch (e) {
            error = e instanceof Error ? e.message : "replay failed";
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
    <h1 class="text-2xl font-bold text-gray-900">Dead-lettered deliveries</h1>
    <p class="mt-2 text-sm text-gray-600">
        Deliveries that exhausted every retry attempt. Replay re-queues them.
    </p>

    {#if notAdmin}
        <p class="mt-6 rounded bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Your eName is not in the admin allowlist.
        </p>
    {:else if error}
        <p class="mt-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
    {:else if loading}
        <p class="mt-4 text-gray-500">Loading…</p>
    {:else}
        <ul class="mt-6 space-y-3">
            {#each deadLetters as dl (dl.id)}
                <li class="rounded-lg border border-gray-200 bg-white p-4 text-sm">
                    <div class="flex items-start justify-between">
                        <div>
                            <p class="font-mono text-gray-700">{dl.targetUrl}</p>
                            <p class="text-gray-500">
                                packet {dl.packetId} · {dl.totalAttempts} attempts ·
                                status {dl.lastResponseStatus ?? "n/a"}
                            </p>
                            {#if dl.lastError}
                                <p class="mt-1 text-red-600">{dl.lastError}</p>
                            {/if}
                        </div>
                        {#if dl.resolved}
                            <span class="text-green-600">resolved</span>
                        {:else}
                            <button
                                class="rounded bg-indigo-600 px-3 py-1.5 text-white"
                                onclick={() => replay(dl.id)}
                            >
                                Replay
                            </button>
                        {/if}
                    </div>
                </li>
            {:else}
                <li class="text-gray-400">No dead letters.</li>
            {/each}
        </ul>
    {/if}
</section>
