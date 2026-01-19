<script lang="ts">
import { goto } from "$app/navigation";
import AppNav from "$lib/fragments/AppNav/AppNav.svelte";
import type { GlobalState } from "$lib/global";
import { getContext, onDestroy, onMount } from "svelte";
import type { SVGAttributes } from "svelte/elements";
import { get } from "svelte/store";

import AuthDrawer from "./components/AuthDrawer.svelte";
import LoggedInDrawer from "./components/LoggedInDrawer.svelte";
import RevealDrawer from "./components/RevealDrawer.svelte";
import SigningDrawer from "./components/SigningDrawer.svelte";
import { createScanLogic } from "./scanLogic";

const globalState = getContext<() => GlobalState>("globalState")();
const { stores, actions } = createScanLogic({ globalState, goto });

const {
    platform,
    hostname,
    codeScannedDrawerOpen,
    loggedInDrawerOpen,
    signingDrawerOpen,
    scannedData,
    loading,
    redirect,
    signingData,
    isSigningRequest,
    showSigningSuccess,
    isBlindVotingRequest,
    selectedBlindVoteOption,
    blindVoteError,
    isSubmittingBlindVote,
    isRevealRequest,
    revealPollId,
    revealError,
    isRevealingVote,
    revealSuccess,
    revealedVoteData,
    authError,
    signingError,
    authLoading,
    cameraPermissionDenied,
} = stores;

const {
    startScan,
    cancelScan,
    handleAuth,
    handleBlindVote,
    handleRevealVote,
    handleSuccessOkay,
    setCodeScannedDrawerOpen,
    setLoggedInDrawerOpen,
    setSigningDrawerOpen,
    setRevealRequestOpen,
    handleBlindVoteSelection,
    handleSignVote,
    initialize,
    retryPermission,
} = actions;

const pathProps: SVGAttributes<SVGPathElement> = {
    stroke: "white",
    "stroke-width": 7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
};

let cleanup: (() => void) | null = null;

onMount(() => {
    let disposed = false;
    initialize()
        .then((result) => {
            if (disposed) {
                result?.();
            } else {
                cleanup = result;
            }
        })
        .catch((error) => {
            console.error("Failed to initialize scan logic:", error);
        });

    return () => {
        disposed = true;
        cleanup?.();
        cancelScan();
    };
});

$effect(() => {
    console.log(
        "🔍 DEBUG: selectedBlindVoteOption changed to:",
        $selectedBlindVoteOption,
    );
});

async function handleAuthDrawerDecline() {
    // Cancel button always navigates to main
    setCodeScannedDrawerOpen(false);
    await goto("/main");
}

function handleAuthDrawerOpenChange(value: boolean) {
    setCodeScannedDrawerOpen(value);
}

function handleLoggedInDrawerConfirm() {
    setLoggedInDrawerOpen(false);
    goto("/main").then(() => {
        startScan();
    });
}

function handleLoggedInDrawerOpenChange(value: boolean) {
    setLoggedInDrawerOpen(value);
}

async function handleSigningDrawerDecline() {
    // Cancel button always navigates to main
    setSigningDrawerOpen(false);
    await goto("/main");
}

function handleSigningDrawerOpenChange(value: boolean) {
    setSigningDrawerOpen(value);
    if (!value && !get(showSigningSuccess)) {
        startScan();
    }
}

function handleBlindVoteOptionChange(index: number) {
    handleBlindVoteSelection(index);
}

function handleRevealDrawerCancel() {
    setRevealRequestOpen(false);
    window.history.back();
}

function handleRevealDrawerOpenChange(value: boolean) {
    setRevealRequestOpen(value);
}
</script>

<AppNav title="Scan QR Code" titleClasses="text-white" iconColor="white" />

<div
    class="flex flex-col justify-center items-center min-h-[calc(100vh-200px)] pb-20"
>
    {#if $cameraPermissionDenied}
        <div class="flex flex-col items-center text-center px-6">
            <svg
                class="mx-auto mb-6"
                width="80"
                height="80"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                    stroke="white"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
                <path
                    d="M3 3l18 18"
                    stroke="white"
                    stroke-width="1.5"
                    stroke-linecap="round"
                />
            </svg>

            <h4 class="text-white font-semibold text-xl mb-3">
                Camera Access Required
            </h4>

            <p class="text-white/70 text-sm mb-6 max-w-xs">
                To scan QR codes, please grant camera permission. You can enable it in your device settings or tap the button below to try again.
            </p>

            <button
                onclick={retryPermission}
                class="bg-white text-black font-semibold py-3 px-8 rounded-full hover:bg-white/90 transition-colors"
            >
                Grant Camera Access
            </button>
        </div>
    {:else}
        <svg
            class="mx-auto"
            width="204"
            height="215"
            viewBox="0 0 204 215"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M46 4H15C8.92487 4 4 8.92487 4 15V46" {...pathProps} />
            <path d="M158 4H189C195.075 4 200 8.92487 200 15V46" {...pathProps} />
            <path d="M46 211H15C8.92487 211 4 206.075 4 200V169" {...pathProps} />
            <path
                d="M158 211H189C195.075 211 200 206.075 200 200V169"
                {...pathProps}
            />
        </svg>

        <h4 class="text-white font-semibold text-center mt-20">
            Point the camera at the code
        </h4>
    {/if}
</div>

<AuthDrawer
    isOpen={$codeScannedDrawerOpen}
    platform={$platform}
    hostname={$hostname}
    scannedContent={$scannedData?.content}
    isSigningRequest={$isSigningRequest}
    authError={$authError}
    authLoading={$authLoading}
    onConfirm={handleAuth}
    onDecline={handleAuthDrawerDecline}
    onOpenChange={handleAuthDrawerOpenChange}
/>

<LoggedInDrawer
    isOpen={$loggedInDrawerOpen}
    platform={$platform}
    redirect={$redirect}
    onConfirm={handleLoggedInDrawerConfirm}
    onOpenChange={handleLoggedInDrawerOpenChange}
/>

<SigningDrawer
    isOpen={$signingDrawerOpen}
    showSigningSuccess={$showSigningSuccess}
    isBlindVotingRequest={$isBlindVotingRequest}
    signingData={$signingData}
    blindVoteError={$blindVoteError}
    selectedBlindVoteOption={$selectedBlindVoteOption}
    isSubmittingBlindVote={$isSubmittingBlindVote}
    loading={$loading}
    signingError={$signingError}
    onDecline={handleSigningDrawerDecline}
    onSign={handleSignVote}
    onBlindVoteOptionChange={handleBlindVoteOptionChange}
    onSubmitBlindVote={handleBlindVote}
    onSuccessOkay={handleSuccessOkay}
    onOpenChange={handleSigningDrawerOpenChange}
/>

<RevealDrawer
    isOpen={$isRevealRequest}
    revealSuccess={$revealSuccess}
    revealedVoteData={$revealedVoteData}
    revealPollId={$revealPollId}
    revealError={$revealError}
    isRevealingVote={$isRevealingVote}
    onCancel={handleRevealDrawerCancel}
    onReveal={handleRevealVote}
    onOpenChange={handleRevealDrawerOpenChange}
/>

<style>
    :global(body:has(.loggedin-drawer)) {
        background-color: white !important;
    }
</style>
