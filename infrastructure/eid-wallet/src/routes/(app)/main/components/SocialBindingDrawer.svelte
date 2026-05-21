<script lang="ts">
import type { GlobalState } from "$lib/global";
import { BottomSheet, ButtonAction } from "$lib/ui";
import {
    type BindingDocParsed,
    addCounterpartySignature,
    deleteSocialBindingDoc,
    fetchNameFromVault,
    fetchUnsignedSocialDocs,
    getCanonicalBindingDocString,
    resolveVaultUri,
} from "$lib/utils";
import { onDestroy } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import QrCode from "svelte-qrcode";

interface ISocialBindingDrawerProps {
    isOpen: boolean;
    globalState: GlobalState | undefined;
    onbound?: () => void;
}

let {
    isOpen = $bindable(false),
    globalState,
    onbound,
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

        const unsigned = await fetchUnsignedSocialDocs(gqlUrl, callerEname);
        if (unsigned.length === 0) return;

        const doc = unsigned[0];
        const parsed = doc.node.parsed;
        if (!parsed) return;
        const signer = parsed.signatures[0]?.signer ?? null;
        if (!signer) return;

        stopPolling();
        signerEname = signer;
        pendingDocId = doc.node.id;
        pendingDocParsed = parsed;

        try {
            const signerVaultUri = await resolveVaultUri(signer);
            signerName = await fetchNameFromVault(signerVaultUri, signer, signer);
        } catch {
            signerName = signer;
        }
        phase = "awaiting-consent";
    } catch (err) {
        console.error("[SocialBindingDrawer] poll error:", err);
    }
}

async function confirm() {
    if (!globalState || !pendingDocId || !pendingDocParsed) return;
    phase = "counter-signing";
    errorMessage = null;

    try {
        const vault = await globalState.vaultController.vault;
        if (!vault?.ename || !vault?.uri) {
            throw new Error("No active vault found.");
        }
        const callerEname = vault.ename.startsWith("@")
            ? vault.ename
            : `@${vault.ename}`;
        const gqlUrl = new URL("/graphql", vault.uri).toString();

        const canonical = getCanonicalBindingDocString({
            subject: pendingDocParsed.subject,
            type: pendingDocParsed.type,
            data: pendingDocParsed.data,
        });
        const sig = await globalState.walletSdkAdapter.signPayload(
            "default",
            "signing",
            canonical,
        );
        await addCounterpartySignature(
            gqlUrl,
            callerEname,
            callerEname,
            pendingDocId,
            sig,
        );

        phase = "success";
        onbound?.();
    } catch (err) {
        console.error("[SocialBindingDrawer] counter-sign error:", err);
        errorMessage =
            err instanceof Error ? err.message : "Something went wrong.";
        phase = "error";
    }
}

async function decline() {
    const docId = pendingDocId;
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
                await deleteSocialBindingDoc(gqlUrl, callerEname, docId);
            }
        } catch (err) {
            console.error(
                "[SocialBindingDrawer] failed to delete declined doc:",
                err,
            );
        }
    }

    phase = "qr";
    startPolling();
}

function close() {
    isOpen = false;
}

function retryFromError() {
    errorMessage = null;
    phase = "qr";
    startPolling();
}

// Drive the drawer lifecycle from isOpen.
$effect(() => {
    if (isOpen) {
        void initFromVault();
    } else {
        stopPolling();
        reset();
    }
});

async function initFromVault() {
    if (!globalState) return;
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
}

onDestroy(stopPolling);
</script>

<BottomSheet bind:isOpen style="max-height: 95svh;">
    {#if phase === "qr"}
        <div class="flex items-start justify-between gap-3">
            <h3 class="text-2xl font-bold text-black-900 leading-tight">
                Your QR-Code
            </h3>
            <button
                type="button"
                onclick={close}
                aria-label="Close"
                class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center text-black-700 active:opacity-70 shrink-0"
            >
                <span aria-hidden="true" class="text-xl leading-none">×</span>
            </button>
        </div>
        <p class="text-black-500 leading-snug">
            Show this code to the person you want to bind with. They scan it
            from their wallet to confirm the connection.
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
            Close
        </ButtonAction>
    {:else if phase === "awaiting-consent"}
        <div class="flex items-start justify-between gap-3">
            <h3 class="text-2xl font-bold text-black-900 leading-tight">
                Social Connection Request
            </h3>
            <button
                type="button"
                onclick={decline}
                aria-label="Close"
                class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center text-black-700 active:opacity-70 shrink-0"
            >
                <span aria-hidden="true" class="text-xl leading-none">×</span>
            </button>
        </div>
        <p class="text-black-500 leading-snug">
            <strong class="text-black-900 font-semibold"
                >{signerName ?? signerEname ?? "Someone"}</strong
            >
            wants to establish a social connection with you. Accept to confirm the
            binding.
        </p>
        <div class="flex gap-3 mt-2">
            <ButtonAction variant="soft" class="flex-1" callback={decline}>
                Decline
            </ButtonAction>
            <ButtonAction variant="solid" class="flex-1" callback={confirm}>
                Accept
            </ButtonAction>
        </div>
    {:else if phase === "counter-signing"}
        <div class="flex flex-col items-center justify-center gap-4 py-10">
            <Shadow size={36} color="rgb(142, 82, 255)" />
            <p class="text-black-700 text-center">
                Completing mutual binding…
            </p>
        </div>
    {:else if phase === "success"}
        <div class="flex items-start justify-between gap-3">
            <h3 class="text-2xl font-bold text-black-900 leading-tight">
                Binding Complete!
            </h3>
            <button
                type="button"
                onclick={close}
                aria-label="Close"
                class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center text-black-700 active:opacity-70 shrink-0"
            >
                <span aria-hidden="true" class="text-xl leading-none">×</span>
            </button>
        </div>
        <p class="text-black-500 leading-snug">
            {signerName ?? "Your contact"} has signed your identity binding.
            Both eVaults now hold a mutually-signed social connection document.
        </p>
        <ButtonAction
            variant="solid"
            class="w-full uppercase tracking-wide"
            callback={close}
        >
            Done
        </ButtonAction>
    {:else if phase === "error"}
        <div class="flex items-start justify-between gap-3">
            <h3 class="text-2xl font-bold text-black-900 leading-tight">
                Something went wrong
            </h3>
            <button
                type="button"
                onclick={close}
                aria-label="Close"
                class="w-9 h-9 rounded-full bg-black-50 flex items-center justify-center text-black-700 active:opacity-70 shrink-0"
            >
                <span aria-hidden="true" class="text-xl leading-none">×</span>
            </button>
        </div>
        <p class="text-danger leading-snug">
            {errorMessage ?? "Failed to complete the binding."}
        </p>
        <div class="flex gap-3 mt-2">
            <ButtonAction variant="soft" class="flex-1" callback={close}>
                Close
            </ButtonAction>
            <ButtonAction variant="solid" class="flex-1" callback={retryFromError}>
                Try again
            </ButtonAction>
        </div>
    {/if}
</BottomSheet>
