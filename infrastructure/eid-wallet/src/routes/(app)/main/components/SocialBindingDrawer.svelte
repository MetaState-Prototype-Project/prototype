<script lang="ts">
import type { GlobalState } from "$lib/global";
import { m } from "$lib/i18n";
import { BottomSheet, ButtonAction } from "$lib/ui";
import {
    type BindingDocParsed,
    type PendingSocialRequest,
    acceptSocialBinding,
    declineSocialBinding,
    fetchNameFromVault,
    findPendingSocialRequest,
    resolveVaultUri,
} from "$lib/utils";
import { onDestroy, untrack } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import QrCode from "svelte-qrcode";

interface ISocialBindingDrawerProps {
    isOpen: boolean;
    globalState: GlobalState | undefined;
    onbound?: () => void;
    /**
     * When set at open time, the drawer shows the consent prompt for this
     * request instead of the invite QR. Read once, when isOpen flips to true.
     */
    request?: PendingSocialRequest | null;
    /** The request was closed unanswered and is still pending. */
    ondismiss?: (docId: string) => void;
}

let {
    isOpen = $bindable(false),
    globalState,
    onbound,
    request = null,
    ondismiss,
}: ISocialBindingDrawerProps = $props();

type Phase =
    | "qr"
    | "awaiting-consent"
    | "counter-signing"
    | "success"
    | "error";

let phase = $state<Phase>("qr");
let qrValue = $state<string | null>(null);
let errorMessage = $state<string | null>(null);
let pendingDocId = $state<string | null>(null);
let pendingDocParsed = $state<BindingDocParsed | null>(null);
let signerEname = $state<string | null>(null);
let signerName = $state<string | null>(null);
// Opened on an incoming request rather than on the invite QR, so there is no
// QR to fall back to once the request is answered.
let openedFromRequest = $state(false);

let pollInterval: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
    if (pollInterval !== null) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

function startPolling() {
    stopPolling();
    pollInterval = setInterval(() => {
        void poll();
    }, 3000);
}

async function poll() {
    if (!globalState) return;
    if (phase !== "qr") return;
    try {
        const vault = await globalState.vaultController.vault;
        if (!vault?.ename || !vault?.uri) return;
        const callerEname = vault.ename.startsWith("@")
            ? vault.ename
            : `@${vault.ename}`;
        const gqlUrl = new URL("/graphql", vault.uri).toString();

        const pending = await findPendingSocialRequest(gqlUrl, callerEname);
        if (!pending) return;

        stopPolling();
        signerEname = pending.signerEname;
        pendingDocId = pending.docId;
        pendingDocParsed = pending.parsed;
        phase = "awaiting-consent";
        await resolveSignerName(pending.signerEname);
    } catch (err) {
        console.error("[SocialBindingDrawer] poll error:", err);
    }
}

async function resolveSignerName(signer: string) {
    try {
        const signerVaultUri = await resolveVaultUri(signer);
        signerName = await fetchNameFromVault(signerVaultUri, signer, signer);
    } catch {
        signerName = signer;
    }
}

async function confirm() {
    const gs = globalState;
    if (!gs || !pendingDocId || !pendingDocParsed) return;
    phase = "counter-signing";
    errorMessage = null;

    try {
        const vault = await gs.vaultController.vault;
        if (!vault?.ename || !vault?.uri) {
            throw new Error(m.social_drawer_no_vault());
        }
        const callerEname = vault.ename.startsWith("@")
            ? vault.ename
            : `@${vault.ename}`;
        const gqlUrl = new URL("/graphql", vault.uri).toString();

        await acceptSocialBinding(
            gqlUrl,
            callerEname,
            pendingDocId,
            pendingDocParsed,
            (payload) => gs.keyService.sign(payload),
        );

        phase = "success";
        onbound?.();
    } catch (err) {
        console.error("[SocialBindingDrawer] counter-sign error:", err);
        errorMessage =
            err instanceof Error
                ? err.message
                : m.social_drawer_error_generic();
        phase = "error";
    }
}

async function decline() {
    const docId = pendingDocId;
    const declinedDoc = pendingDocParsed;
    pendingDocId = null;
    pendingDocParsed = null;
    signerEname = null;
    signerName = null;

    if (docId && globalState) {
        try {
            const vault = await globalState.vaultController.vault;
            if (vault?.ename && vault?.uri) {
                const callerEname = vault.ename.startsWith("@")
                    ? vault.ename
                    : `@${vault.ename}`;
                const gqlUrl = new URL("/graphql", vault.uri).toString();
                await declineSocialBinding(
                    gqlUrl,
                    callerEname,
                    docId,
                    declinedDoc,
                );

                // The declined request was counted as a (pending) binding on
                // the home screen; now that it's gone, tell the parent to
                // re-fetch so the count drops immediately (e.g. 10 → 9)
                // instead of staying stale until the next manual refresh.
                onbound?.();
            }
        } catch (err) {
            console.error(
                "[SocialBindingDrawer] failed to delete declined doc:",
                err,
            );
        }
    }

    if (openedFromRequest) {
        isOpen = false;
        return;
    }
    phase = "qr";
    startPolling();
}

function close() {
    isOpen = false;
}

function retryFromError() {
    errorMessage = null;
    if (pendingDocId && pendingDocParsed) {
        phase = "awaiting-consent";
        return;
    }
    phase = "qr";
    startPolling();
}

// Drive the drawer lifecycle from isOpen. `request` is read inside untrack so
// the parent clearing it can't restart the drawer mid-flow.
$effect(() => {
    const open = isOpen;
    untrack(() => {
        if (open) {
            void initFromVault();
            return;
        }
        stopPolling();
        // Closing on a request leaves it pending rather than declining it;
        // tell the parent so its poll doesn't prompt for the same one again.
        if (phase === "awaiting-consent" && pendingDocId) {
            ondismiss?.(pendingDocId);
        }
        reset();
    });
});

async function initFromVault() {
    if (!globalState) return;

    const incoming = request;
    if (incoming) {
        openedFromRequest = true;
        pendingDocId = incoming.docId;
        pendingDocParsed = incoming.parsed;
        signerEname = incoming.signerEname;
        phase = "awaiting-consent";
        await resolveSignerName(incoming.signerEname);
        return;
    }

    const vault = await globalState.vaultController.vault;
    if (!vault?.ename) return;
    const ename = vault.ename.startsWith("@") ? vault.ename : `@${vault.ename}`;
    qrValue = `w3ds://social_binding?ename=${encodeURIComponent(ename)}`;
    phase = "qr";
    startPolling();
}

function reset() {
    phase = "qr";
    qrValue = null;
    errorMessage = null;
    pendingDocId = null;
    pendingDocParsed = null;
    signerEname = null;
    signerName = null;
    openedFromRequest = false;
}

onDestroy(stopPolling);
</script>

<BottomSheet bind:isOpen style="max-height: 95svh;">
    {#if phase === "qr"}
        <div class="flex items-start justify-between gap-3">
            <h3 class="text-2xl font-bold text-black-900 leading-tight">
                {m.social_drawer_qr_title()}
            </h3>
            <button
                type="button"
                onclick={close}
                aria-label={m.common_close()}
                class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center text-black-700 active:opacity-70 shrink-0"
            >
                <span aria-hidden="true" class="text-xl leading-none">×</span>
            </button>
        </div>
        <p class="text-black-500 leading-snug">
            {m.social_drawer_qr_body()}
        </p>
        <div
            class="bg-white rounded-2xl p-6 flex items-center justify-center shadow-card aspect-square w-full"
        >
            {#if qrValue}
                <QrCode size={280} value={qrValue} />
            {:else}
                <Shadow size={36} color="rgb(142, 82, 255)" />
            {/if}
        </div>
        <ButtonAction
            variant="solid"
            class="w-full uppercase tracking-wide"
            callback={close}
        >
            {m.common_close()}
        </ButtonAction>
    {:else if phase === "awaiting-consent"}
        <div class="flex items-start justify-between gap-3">
            <h3 class="text-2xl font-bold text-black-900 leading-tight">
                {m.social_drawer_request_title()}
            </h3>
            <button
                type="button"
                onclick={close}
                aria-label={m.common_close()}
                class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center text-black-700 active:opacity-70 shrink-0"
            >
                <span aria-hidden="true" class="text-xl leading-none">×</span>
            </button>
        </div>
        <p class="text-black-500 leading-snug">
            <strong class="text-black-900 font-semibold"
                >{signerName ?? signerEname ?? m.social_drawer_someone()}</strong
            >
            {m.social_drawer_request_body()}
        </p>

        {#if typeof pendingDocParsed?.data?.relation_description === "string" && pendingDocParsed.data.relation_description.trim().length > 0}
            <div
                class="bg-card-alternative rounded-2xl px-4 py-3 mt-1"
            >
                <p class="text-xs uppercase tracking-wide text-black-500 mb-1">
                    {m.social_drawer_they_said()}
                </p>
                <p class="text-black-900 leading-snug">
                    {pendingDocParsed.data.relation_description}
                </p>
            </div>
        {/if}

        <div class="flex gap-3 mt-2">
            <ButtonAction variant="soft" class="flex-1" callback={decline}>
                {m.common_decline()}
            </ButtonAction>
            <ButtonAction variant="solid" class="flex-1" callback={confirm}>
                {m.common_accept()}
            </ButtonAction>
        </div>
    {:else if phase === "counter-signing"}
        <div class="flex flex-col items-center justify-center gap-4 py-10">
            <Shadow size={36} color="rgb(142, 82, 255)" />
            <p class="text-black-700 text-center">
                {m.social_drawer_counter_signing()}
            </p>
        </div>
    {:else if phase === "success"}
        <div class="flex items-start justify-between gap-3">
            <h3 class="text-2xl font-bold text-black-900 leading-tight">
                {m.social_drawer_success_title()}
            </h3>
            <button
                type="button"
                onclick={close}
                aria-label={m.common_close()}
                class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center text-black-700 active:opacity-70 shrink-0"
            >
                <span aria-hidden="true" class="text-xl leading-none">×</span>
            </button>
        </div>
        <p class="text-black-500 leading-snug">
            {m.social_drawer_success_body({
                name: signerName ?? m.social_drawer_your_contact(),
            })}
        </p>
        <ButtonAction
            variant="solid"
            class="w-full uppercase tracking-wide"
            callback={close}
        >
            {m.common_done()}
        </ButtonAction>
    {:else if phase === "error"}
        <div class="flex items-start justify-between gap-3">
            <h3 class="text-2xl font-bold text-black-900 leading-tight">
                {m.social_drawer_error_title()}
            </h3>
            <button
                type="button"
                onclick={close}
                aria-label={m.common_close()}
                class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center text-black-700 active:opacity-70 shrink-0"
            >
                <span aria-hidden="true" class="text-xl leading-none">×</span>
            </button>
        </div>
        <p class="text-danger leading-snug">
            {errorMessage ?? m.social_drawer_error_fallback()}
        </p>
        <div class="flex gap-3 mt-2">
            <ButtonAction variant="soft" class="flex-1" callback={close}>
                {m.common_close()}
            </ButtonAction>
            <ButtonAction variant="solid" class="flex-1" callback={retryFromError}>
                {m.common_retry()}
            </ButtonAction>
        </div>
    {/if}
</BottomSheet>
