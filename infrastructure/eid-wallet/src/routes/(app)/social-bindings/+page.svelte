<script lang="ts">
import { AppNav } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { ChevronIcon } from "$lib/ui/icons";
import {
    type SocialBindingSummary,
    fetchNameFromVault,
    fetchSocialBindings,
    resolveVaultUri,
} from "$lib/utils";
import { getContext, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";

interface BindingRow {
    docId: string;
    counterpartyEname: string;
    counterpartyName: string;
    completedAt: string;
}

const getGlobalState = getContext<() => GlobalState | undefined>("globalState");

let globalState: GlobalState | undefined = $state(undefined);
let bindings = $state<BindingRow[]>([]);
let loaded = $state(false);

onMount(() => {
    void init();
});

async function init() {
    let gs = getGlobalState();
    let retries = 0;
    while (!gs && retries < 50) {
        await new Promise((r) => setTimeout(r, 100));
        gs = getGlobalState();
        retries++;
    }
    if (!gs) {
        loaded = true;
        return;
    }
    globalState = gs;

    try {
        const vault = await gs.vaultController.vault;
        if (!vault?.uri || !vault?.ename) {
            loaded = true;
            return;
        }
        const callerEname = vault.ename.startsWith("@")
            ? vault.ename
            : `@${vault.ename}`;
        const gqlUrl = new URL("/graphql", vault.uri).toString();

        const summaries = await fetchSocialBindings(gqlUrl, callerEname);
        const rows = await Promise.all(
            summaries.map(async (s): Promise<BindingRow> => {
                let name = s.counterpartyEname;
                try {
                    const uri = await resolveVaultUri(s.counterpartyEname);
                    name = await fetchNameFromVault(
                        uri,
                        s.counterpartyEname,
                        s.counterpartyEname,
                    );
                } catch {
                    // fallback to eName
                }
                return {
                    docId: s.docId,
                    counterpartyEname: s.counterpartyEname,
                    counterpartyName: name,
                    completedAt: s.completedAt,
                };
            }),
        );
        bindings = rows;
    } catch (err) {
        console.warn("[social-bindings] failed to load:", err);
    } finally {
        loaded = true;
    }
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 30) return `${diffDays} days ago`;
    return date.toLocaleDateString();
}

const subtitle = $derived(
    loaded
        ? `${bindings.length} ${bindings.length === 1 ? "contact" : "contacts"}`
        : undefined,
);
</script>

<AppNav title="Social bindings" subtitle={subtitle} />

{#if !loaded}
    <div class="flex flex-col items-center justify-center mt-20 gap-3">
        <Shadow size={32} color="rgb(142, 82, 255)" />
        <p class="text-black-500">Loading…</p>
    </div>
{:else if bindings.length === 0}
    <div class="flex flex-col items-center justify-center mt-20">
        <p class="text-lg text-black-700">No social bindings yet</p>
        <p class="text-black-500 mt-1">
            Invite a contact from your eName card.
        </p>
    </div>
{:else}
    <div class="flex flex-col">
        {#each bindings as binding (binding.docId)}
            <div
                class="w-full flex items-center gap-3 py-3 text-left"
            >
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-black-900 leading-tight truncate">
                        {binding.counterpartyName}
                    </p>
                    <p class="text-black-500 leading-tight">
                        {formatTime(binding.completedAt)}
                    </p>
                </div>
                <ChevronIcon
                    size={13}
                    class="rotate-180 text-black-500 shrink-0"
                />
            </div>
        {/each}
    </div>
{/if}
