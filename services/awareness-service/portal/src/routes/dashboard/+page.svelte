<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { get } from "svelte/store";
    import { api, API_BASE } from "$lib/api";
    import { fetchSchemas, type OntologySchema } from "$lib/ontology";
    import { sessionToken } from "$lib/session";

    /** Link straight to the interactive API reference, derived from API_BASE. */
    const apiDocsUrl = `${API_BASE}/docs`;

    interface Consumer {
        id: string;
        ename: string;
        status: string;
        webhookBaseUrl: string | null;
    }
    interface Subscription {
        id: string;
        targetUrl: string;
        ontologyFilter: string[];
        evaultFilter: string[];
        active: boolean;
    }
    interface Delivery {
        id: string;
        packetId: string;
        status: string;
        attempts: number;
        lastError: string | null;
    }

    let consumer = $state<Consumer | null>(null);
    let applicationStatus = $state<string | null>(null);
    let subscriptions = $state<Subscription[]>([]);
    let deliveries = $state<Delivery[]>([]);
    let apiKeys = $state<{ id: string; keyPrefix: string; revoked: boolean }[]>([]);
    let newKey = $state<string | null>(null);
    let error = $state<string | null>(null);
    let loading = $state(true);

    // new subscription form
    let subTarget = $state("");
    let schemas = $state<OntologySchema[]>([]);
    let selectedOntologies = $state<string[]>([]);
    let ontologyPick = $state("");
    let evaultTags = $state<string[]>([]);
    let evaultInput = $state("");

    const token = () => get(sessionToken);

    function ontologyTitle(id: string): string {
        return schemas.find((s) => s.id === id)?.title ?? id;
    }

    function addOntology() {
        if (ontologyPick && !selectedOntologies.includes(ontologyPick)) {
            selectedOntologies = [...selectedOntologies, ontologyPick];
        }
        ontologyPick = "";
    }

    function removeOntology(id: string) {
        selectedOntologies = selectedOntologies.filter((o) => o !== id);
    }

    function addEvaultTag() {
        const tag = evaultInput.trim();
        if (tag && !evaultTags.includes(tag)) {
            evaultTags = [...evaultTags, tag];
        }
        evaultInput = "";
    }

    function removeEvaultTag(tag: string) {
        evaultTags = evaultTags.filter((t) => t !== tag);
    }

    async function loadApproved() {
        const [subs, dels, keys] = await Promise.all([
            api<{ subscriptions: Subscription[] }>("/api/subscriptions", {
                token: token(),
            }),
            api<{ deliveries: Delivery[] }>("/api/me/deliveries", {
                token: token(),
            }),
            api<{ apiKeys: typeof apiKeys }>("/api/me/api-keys", {
                token: token(),
            }),
        ]);
        subscriptions = subs.subscriptions;
        deliveries = dels.deliveries;
        apiKeys = keys.apiKeys;
    }

    async function load() {
        loading = true;
        error = null;
        try {
            const me = await api<{
                consumer: Consumer | null;
                application: { status: string } | null;
            }>("/api/applications/me", { token: token() });
            consumer = me.consumer;
            applicationStatus = me.application?.status ?? null;
            if (consumer?.status === "approved") {
                await loadApproved();
            }
        } catch (e) {
            error = e instanceof Error ? e.message : "failed to load";
        } finally {
            loading = false;
        }
    }

    async function issueKey() {
        try {
            const result = await api<{ apiKey: string }>("/api/me/api-keys", {
                method: "POST",
                token: token(),
            });
            newKey = result.apiKey;
            await loadApproved();
        } catch (e) {
            error = e instanceof Error ? e.message : "failed to issue key";
        }
    }

    async function revokeKey(id: string) {
        await api(`/api/me/api-keys/${id}`, { method: "DELETE", token: token() });
        await loadApproved();
    }

    async function createSubscription() {
        error = null;
        try {
            await api("/api/subscriptions", {
                method: "POST",
                token: token(),
                body: {
                    targetUrl: subTarget || undefined,
                    ontologyFilter: selectedOntologies,
                    evaultFilter: evaultTags,
                },
            });
            subTarget = "";
            selectedOntologies = [];
            evaultTags = [];
            await loadApproved();
        } catch (e) {
            error = e instanceof Error ? e.message : "failed to create subscription";
        }
    }

    async function deleteSubscription(id: string) {
        await api(`/api/subscriptions/${id}`, {
            method: "DELETE",
            token: token(),
        });
        await loadApproved();
    }

    onMount(() => {
        if (!token()) {
            goto("/");
            return;
        }
        void load();
        // Best-effort: the form still works if the ontology service is down.
        fetchSchemas()
            .then((s) => (schemas = s))
            .catch(() => (schemas = []));
    });
</script>

<section>
    <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-white">Dashboard</h1>
        <a
            href={apiDocsUrl}
            target="_blank"
            rel="noopener"
            class="rounded border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-sm font-medium text-indigo-300 hover:bg-indigo-500/20"
        >
            API docs ↗
        </a>
    </div>

    {#if error}
        <p class="mt-4 rounded bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
    {/if}

    {#if loading}
        <p class="mt-4 text-gray-400">Loading…</p>
    {:else if !consumer}
        <div class="mt-6 rounded-lg border border-white/10 bg-[#13161d] p-6">
            <p class="text-gray-400">
                You have not applied for access yet.
            </p>
            <a
                href="/apply"
                class="mt-3 inline-block rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
                Apply for access
            </a>
        </div>
    {:else if consumer.status !== "approved"}
        <div class="mt-6 rounded-lg border border-white/10 bg-[#13161d] p-6">
            <p class="text-gray-300">
                Application status:
                <strong class="capitalize text-white">{applicationStatus ?? consumer.status}</strong>
            </p>
            <p class="mt-2 text-sm text-gray-500">
                An admin must approve your application before you can poll
                packets or register webhooks.
            </p>
        </div>
    {:else}
        <!-- API keys -->
        <div class="mt-6 rounded-lg border border-white/10 bg-[#13161d] p-6">
            <div class="flex items-center justify-between">
                <h2 class="font-semibold text-white">API keys</h2>
                <button
                    class="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
                    onclick={issueKey}
                >
                    Issue new key
                </button>
            </div>
            {#if newKey}
                <p class="mt-3 break-all rounded bg-green-500/10 px-3 py-2 text-sm text-green-300">
                    Copy this key now — it is shown only once:
                    <code class="font-mono">{newKey}</code>
                </p>
            {/if}
            <ul class="mt-3 divide-y divide-white/5">
                {#each apiKeys as key (key.id)}
                    <li class="flex items-center justify-between py-2 text-sm">
                        <span class="font-mono text-gray-300">{key.keyPrefix}…</span>
                        {#if key.revoked}
                            <span class="text-gray-500">revoked</span>
                        {:else}
                            <button
                                class="text-red-400 hover:underline"
                                onclick={() => revokeKey(key.id)}
                            >
                                Revoke
                            </button>
                        {/if}
                    </li>
                {:else}
                    <li class="py-2 text-sm text-gray-500">No keys yet.</li>
                {/each}
            </ul>
        </div>

        <!-- Subscriptions -->
        <div class="mt-6 rounded-lg border border-white/10 bg-[#13161d] p-6">
            <h2 class="font-semibold text-white">Webhook subscriptions</h2>

            <div class="mt-3 space-y-3">
                <label class="block">
                    <span class="text-xs font-medium text-gray-400">
                        Target URL (optional — defaults to your webhook base)
                    </span>
                    <input
                        bind:value={subTarget}
                        placeholder="https://my-platform.example/api/webhook"
                        class="mt-1 w-full rounded border border-white/10 bg-[#1b1f29] px-3 py-2 text-sm text-gray-100 placeholder-gray-500"
                    />
                </label>

                <!-- Ontology picker, fed by the ontology service -->
                <div>
                    <span class="text-xs font-medium text-gray-400">
                        Ontologies (none = all)
                    </span>
                    <div class="mt-1 flex gap-2">
                        <select
                            bind:value={ontologyPick}
                            class="flex-1 rounded border border-white/10 bg-[#1b1f29] px-3 py-2 text-sm text-gray-100"
                        >
                            <option value="">Select an ontology…</option>
                            {#each schemas as schema (schema.id)}
                                <option value={schema.id}>
                                    {schema.title} ({schema.id})
                                </option>
                            {/each}
                        </select>
                        <button
                            type="button"
                            class="rounded border border-white/10 bg-[#1b1f29] px-3 py-2 text-sm text-gray-200 hover:bg-[#232838]"
                            onclick={addOntology}
                        >
                            Add
                        </button>
                    </div>
                    {#if schemas.length === 0}
                        <p class="mt-1 text-xs text-gray-500">
                            Ontology catalogue unavailable.
                        </p>
                    {/if}
                    {#if selectedOntologies.length}
                        <div class="mt-2 flex flex-wrap gap-2">
                            {#each selectedOntologies as id (id)}
                                <span
                                    class="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs text-indigo-300"
                                >
                                    {ontologyTitle(id)}
                                    <button
                                        type="button"
                                        class="text-indigo-400 hover:text-indigo-200"
                                        onclick={() => removeOntology(id)}
                                    >
                                        ✕
                                    </button>
                                </span>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- eVault filter as a tag input -->
                <div>
                    <span class="text-xs font-medium text-gray-400">
                        eVaults (none = all)
                    </span>
                    <input
                        bind:value={evaultInput}
                        onkeydown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                addEvaultTag();
                            }
                        }}
                        placeholder="Type an eVault (w3id or public key) and press Enter"
                        class="mt-1 w-full rounded border border-white/10 bg-[#1b1f29] px-3 py-2 text-sm text-gray-100 placeholder-gray-500"
                    />
                    {#if evaultTags.length}
                        <div class="mt-2 flex flex-wrap gap-2">
                            {#each evaultTags as tag (tag)}
                                <span
                                    class="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs text-gray-300"
                                >
                                    {tag}
                                    <button
                                        type="button"
                                        class="text-gray-500 hover:text-gray-200"
                                        onclick={() => removeEvaultTag(tag)}
                                    >
                                        ✕
                                    </button>
                                </span>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>

            <button
                class="mt-3 rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
                onclick={createSubscription}
            >
                Add subscription
            </button>
            <ul class="mt-4 divide-y divide-white/5">
                {#each subscriptions as sub (sub.id)}
                    <li class="py-3 text-sm">
                        <div class="flex items-center justify-between">
                            <span class="font-mono text-gray-300">{sub.targetUrl}</span>
                            <button
                                class="text-red-400 hover:underline"
                                onclick={() => deleteSubscription(sub.id)}
                            >
                                Disable
                            </button>
                        </div>
                        <p class="mt-1 text-gray-500">
                            ontologies: {sub.ontologyFilter.length
                                ? sub.ontologyFilter
                                      .map((o) => ontologyTitle(o))
                                      .join(", ")
                                : "all"} · eVaults: {sub.evaultFilter.length
                                ? sub.evaultFilter.join(", ")
                                : "all"} · {sub.active ? "active" : "inactive"}
                        </p>
                    </li>
                {:else}
                    <li class="py-2 text-sm text-gray-500">No subscriptions.</li>
                {/each}
            </ul>
        </div>

        <!-- Recent deliveries -->
        <div class="mt-6 rounded-lg border border-white/10 bg-[#13161d] p-6">
            <h2 class="font-semibold text-white">Recent deliveries</h2>
            <ul class="mt-3 divide-y divide-white/5">
                {#each deliveries as d (d.id)}
                    <li class="flex items-center justify-between py-2 text-sm">
                        <span class="font-mono text-gray-400">{d.packetId}</span>
                        <span
                            class:text-green-400={d.status === "delivered"}
                            class:text-red-400={d.status === "failed"}
                            class:text-gray-500={d.status !== "delivered" &&
                                d.status !== "failed"}
                        >
                            {d.status} ({d.attempts})
                        </span>
                    </li>
                {:else}
                    <li class="py-2 text-sm text-gray-500">No deliveries yet.</li>
                {/each}
            </ul>
        </div>
    {/if}
</section>
