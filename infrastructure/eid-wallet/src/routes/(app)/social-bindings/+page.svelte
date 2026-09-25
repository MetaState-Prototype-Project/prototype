<script lang="ts">
import { AppNav } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { m } from "$lib/i18n";
import { ChevronIcon } from "$lib/ui/icons";
import {
    type SocialBindingSummary,
    fetchNameFromVault,
    fetchReconciledSocialBindings,
    resolveVaultUri,
} from "$lib/utils";
import { getContext, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import type { SocialBindingDisplay } from "../main/components/SocialBindingAccordion.svelte";
import SocialBindingDetailsSheet from "../main/components/SocialBindingDetailsSheet.svelte";

const getGlobalState = getContext<() => GlobalState | undefined>("globalState");

let globalState: GlobalState | undefined = $state(undefined);
let contacts = $state<SocialBindingDisplay[]>([]);
let loaded = $state(false);

let detailsContact = $state<SocialBindingDisplay | null>(null);
let detailsOpen = $state(false);

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
    await load(gs);
}

async function load(gs: GlobalState) {
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

        const summaries = await fetchReconciledSocialBindings(
            gqlUrl,
            callerEname,
        );

        // Group by counterparty so each person shows once with a combined
        // role label, matching the home-screen accordion.
        const byContact = new Map<string, SocialBindingSummary[]>();
        for (const s of summaries) {
            const list = byContact.get(s.counterpartyEname);
            if (list) list.push(s);
            else byContact.set(s.counterpartyEname, [s]);
        }

        const rows = await Promise.all(
            Array.from(byContact.values()).map(
                async (group): Promise<SocialBindingDisplay> => {
                    const counterpartyEname = group[0].counterpartyEname;
                    const hasSent = group.some((b) => b.role === "sent");
                    const hasReceived = group.some(
                        (b) => b.role === "received",
                    );
                    const role: SocialBindingDisplay["role"] =
                        hasSent && hasReceived
                            ? "both"
                            : hasSent
                              ? "sent"
                              : "received";
                    const pending = !group.some((b) => b.mutuallySigned);

                    let name = counterpartyEname;
                    try {
                        const uri = await resolveVaultUri(counterpartyEname);
                        name = await fetchNameFromVault(
                            uri,
                            counterpartyEname,
                            counterpartyEname,
                        );
                    } catch {
                        // fallback to eName
                    }
                    return {
                        counterpartyEname,
                        counterpartyName: name,
                        role,
                        pending,
                        bindings: group,
                    };
                },
            ),
        );
        contacts = rows;
    } catch (err) {
        console.warn("[social-bindings] failed to load:", err);
    } finally {
        loaded = true;
    }
}

/**
 * Re-read after an accept, decline or cancel, then re-point the open sheet at
 * the refreshed contact so it shows the new state instead of what was on screen
 * when the action started. A contact whose last binding just went away closes
 * the sheet with it.
 */
async function refreshAfterAction() {
    if (!globalState) return;
    const openFor = detailsContact?.counterpartyEname;
    await load(globalState);
    // load() resolves a name per contact, so it can run for seconds. If the user
    // switched contact meanwhile, leave their selection alone.
    if (!openFor || detailsContact?.counterpartyEname !== openFor) return;
    const updated = contacts.find((c) => c.counterpartyEname === openFor);
    if (updated) {
        detailsContact = updated;
    } else {
        detailsContact = null;
        detailsOpen = false;
    }
}

function roleLabel(role: SocialBindingDisplay["role"]): string {
    if (role === "both") return m.social_role_sent_received();
    if (role === "sent") return m.social_role_sent();
    return m.social_role_received();
}

function openDetails(contact: SocialBindingDisplay) {
    detailsContact = contact;
    detailsOpen = true;
}

const subtitle = $derived(
    loaded
        ? m.social_binding_contact_count({ count: contacts.length })
        : undefined,
);
</script>

<AppNav title={m.social_bindings_page_title()} subtitle={subtitle} />

{#if !loaded}
    <div class="flex flex-col items-center justify-center mt-20 gap-3">
        <Shadow size={32} color="rgb(142, 82, 255)" />
        <p class="text-black-500">{m.common_loading()}</p>
    </div>
{:else if contacts.length === 0}
    <div class="flex flex-col items-center justify-center mt-20">
        <p class="text-lg text-black-700">{m.social_bindings_empty_title()}</p>
        <p class="text-black-500 mt-1">
            {m.social_bindings_empty_body()}
        </p>
    </div>
{:else}
    <div class="flex flex-col">
        {#each contacts as contact (contact.counterpartyEname)}
            <button
                type="button"
                onclick={() => openDetails(contact)}
                class="w-full flex items-center gap-3 py-3 text-left active:opacity-70"
            >
                <div class="flex-1 min-w-0">
                    <p
                        class="font-semibold text-black-900 leading-tight truncate"
                    >
                        {contact.counterpartyName}
                    </p>
                    <p class="text-black-500 leading-tight">
                        {roleLabel(contact.role)}
                        {#if contact.pending}
                            <span class="text-amber-600"
                                >{m.social_details_awaiting_suffix()}</span
                            >
                        {/if}
                    </p>
                </div>
                <ChevronIcon
                    size={13}
                    class="rotate-180 text-black-500 shrink-0"
                />
            </button>
        {/each}
    </div>
{/if}

<SocialBindingDetailsSheet
    bind:isOpen={detailsOpen}
    contact={detailsContact}
    {globalState}
    onchanged={refreshAfterAction}
/>
