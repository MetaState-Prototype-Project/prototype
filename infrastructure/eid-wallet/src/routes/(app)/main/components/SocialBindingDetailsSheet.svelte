<script lang="ts">
import type { GlobalState } from "$lib/global";
import { m } from "$lib/i18n";
import { getLocale } from "$lib/paraglide/runtime";
import { BottomSheet, ButtonAction } from "$lib/ui";
import {
    CANCEL_NOT_PENDING,
    ENAME_NOT_FOUND,
    type SocialBindingSummary,
    acceptSocialBinding,
    cancelSentSocialBinding,
    declineSocialBinding,
} from "$lib/utils";
import type { SocialBindingDisplay } from "./SocialBindingAccordion.svelte";

interface ISocialBindingDetailsSheetProps {
    isOpen: boolean;
    /** The contact whose bindings to show. Null when the sheet is closed. */
    contact: SocialBindingDisplay | null;
    globalState?: GlobalState | undefined;
    onfulllist?: () => void;
    /** Fired after an accept, decline or cancel so the parent can re-fetch. */
    onchanged?: () => void;
    onOpenChange?: (open: boolean) => void;
}

let {
    isOpen = $bindable(),
    contact,
    globalState,
    onfulllist,
    onchanged,
    onOpenChange,
}: ISocialBindingDetailsSheetProps = $props();

/** docId of the binding whose action is in flight, if any. */
let busyDocId = $state<string | null>(null);
let actionError = $state<string | null>(null);
/** Whose sheet the error belongs to, so it can't leak onto the next contact. */
let errorFor = $state<string | null>(null);

const visibleError = $derived(
    actionError !== null && errorFor === (contact?.counterpartyEname ?? null)
        ? actionError
        : null,
);

function roleLabel(role: "sent" | "received" | "both"): string {
    if (role === "both") return m.social_role_sent_received();
    if (role === "sent") return m.social_role_sent();
    return m.social_role_received();
}

function formatTimestamp(iso: string): string {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        return d.toLocaleString(getLocale(), {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

function close() {
    actionError = null;
    errorFor = null;
    isOpen = false;
    onOpenChange?.(false);
}

interface CallerContext {
    gqlUrl: string;
    ename: string;
    sign: (payload: string) => Promise<string>;
}

/** Own-vault endpoint, eName and signer — what every action below needs. */
async function callerContext(): Promise<CallerContext> {
    const gs = globalState;
    if (!gs) throw new Error(m.social_details_not_ready());
    const vault = await gs.vaultController.vault;
    if (!vault?.ename || !vault?.uri) {
        throw new Error(m.social_drawer_no_vault());
    }
    return {
        gqlUrl: new URL("/graphql", vault.uri).toString(),
        ename: vault.ename.startsWith("@") ? vault.ename : `@${vault.ename}`,
        sign: (payload) => gs.keyService.sign(payload),
    };
}

/**
 * socialBinding.ts carries no i18n so it stays testable without the app's module
 * aliases; its user-facing refusals arrive as codes and are worded here.
 */
function messageFor(err: Error): string {
    if (err.message === CANCEL_NOT_PENDING)
        return m.social_cancel_not_pending();
    if (err.message === ENAME_NOT_FOUND) return m.social_ename_not_found();
    return err.message;
}

async function runAction(
    binding: SocialBindingSummary,
    action: (ctx: CallerContext) => Promise<void>,
): Promise<void> {
    if (busyDocId) return;
    busyDocId = binding.docId;
    actionError = null;
    errorFor = contact?.counterpartyEname ?? null;
    try {
        await action(await callerContext());
    } catch (err) {
        console.error("[SocialBindingDetailsSheet] action failed:", err);
        actionError =
            err instanceof Error
                ? messageFor(err)
                : m.social_drawer_error_generic();
    } finally {
        busyDocId = null;
    }
    // Re-read either way: a failure usually means the binding moved on without
    // us, and the list is what shows where it actually landed.
    onchanged?.();
}

function accept(binding: SocialBindingSummary) {
    return runAction(binding, ({ gqlUrl, ename, sign }) =>
        acceptSocialBinding(gqlUrl, ename, binding.docId, binding.parsed, sign),
    );
}

function decline(binding: SocialBindingSummary) {
    return runAction(binding, ({ gqlUrl, ename }) =>
        declineSocialBinding(gqlUrl, ename, binding.docId, binding.parsed),
    );
}

function cancel(binding: SocialBindingSummary) {
    return runAction(binding, ({ gqlUrl, ename }) =>
        cancelSentSocialBinding(
            gqlUrl,
            ename,
            binding.docId,
            binding.counterpartyEname,
            binding.relationDescription,
        ),
    );
}
</script>

<BottomSheet bind:isOpen {onOpenChange}>
    {#if contact}
        <header class="flex flex-col gap-1 text-center">
            <h2 class="text-2xl font-bold text-black-900">
                {contact.counterpartyName}
            </h2>
            <p class="text-sm text-black-500 break-all">
                {contact.counterpartyEname}
            </p>
        </header>

        <div class="flex justify-center">
            <span
                class="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold {contact.pending
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-success-200 text-black-900'}"
            >
                {contact.pending
                    ? m.social_details_awaiting()
                    : roleLabel(contact.role)}
            </span>
        </div>

        {#if visibleError}
            <p class="text-sm text-danger text-center">{visibleError}</p>
        {/if}

        <div class="flex flex-col gap-2">
            {#each contact.bindings as binding (binding.docId)}
                {@const needsMyConfirmation =
                    binding.role === "received" && !binding.mutuallySigned}
                {@const awaitingThem =
                    binding.role === "sent" && !binding.mutuallySigned}
                <!-- The badge above already names the role. Repeat it per entry
                     only when it differs between entries, or when it prefixes
                     an awaiting note. -->
                {@const showRole =
                    contact.role === "both" || !binding.mutuallySigned}
                <div
                    class="flex flex-col gap-3 rounded-2xl bg-card-alternative px-4 py-3"
                >
                    <div class="flex-1 min-w-0">
                        {#if showRole}
                            <p class="font-semibold text-black-900 text-sm">
                                {binding.role === "sent"
                                    ? m.social_role_sent()
                                    : m.social_role_received()}
                                {#if needsMyConfirmation}
                                    <span class="font-normal text-amber-600"
                                        >{m.social_details_awaiting_you_suffix()}</span
                                    >
                                {:else if awaitingThem}
                                    <span class="font-normal text-amber-600"
                                        >{m.social_details_awaiting_suffix()}</span
                                    >
                                {/if}
                            </p>
                        {/if}
                        {#if binding.relationDescription}
                            <p
                                class="text-sm text-black-700 mt-0.5 leading-snug"
                            >
                                {binding.relationDescription}
                            </p>
                        {/if}
                        {#if binding.completedAt}
                            <p class="text-xs text-black-500 mt-1">
                                {formatTimestamp(binding.completedAt)}
                            </p>
                        {/if}
                    </div>

                    {#if needsMyConfirmation}
                        <div class="flex gap-2">
                            <ButtonAction
                                variant="soft"
                                size="sm"
                                class="flex-1"
                                disabled={busyDocId !== null}
                                isLoading={busyDocId === binding.docId}
                                callback={() => decline(binding)}
                            >
                                {m.common_decline()}
                            </ButtonAction>
                            <ButtonAction
                                size="sm"
                                class="flex-1"
                                disabled={busyDocId !== null}
                                isLoading={busyDocId === binding.docId}
                                callback={() => accept(binding)}
                            >
                                {m.common_accept()}
                            </ButtonAction>
                        </div>
                    {:else if awaitingThem}
                        <ButtonAction
                            variant="danger-soft"
                            size="sm"
                            class="w-full"
                            disabled={busyDocId !== null}
                            isLoading={busyDocId === binding.docId}
                            callback={() => cancel(binding)}
                        >
                            {m.social_details_cancel_invite()}
                        </ButtonAction>
                    {/if}
                </div>
            {/each}
        </div>

        <div class="flex flex-col gap-2 pt-2">
            {#if onfulllist}
                <ButtonAction
                    class="w-full uppercase tracking-wide"
                    callback={() => {
                        close();
                        onfulllist();
                    }}
                >
                    {m.social_details_view_full_list()}
                </ButtonAction>
            {/if}
            <ButtonAction
                variant="soft"
                class="w-full uppercase tracking-wide"
                callback={close}
            >
                {m.common_close()}
            </ButtonAction>
        </div>
    {/if}
</BottomSheet>
