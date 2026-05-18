<script lang="ts">
import { PUBLIC_EID_WALLET_TOKEN } from "$env/static/public";
import type { GlobalState } from "$lib/global";
import {
    getUnreadCount,
    subscribe as subscribeNotifications,
} from "$lib/stores/notifications";
import { Toast } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { getContext, onDestroy, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import AppsMarketplace from "./components/AppsMarketplace.svelte";
import BindingDocuments from "./components/BindingDocuments.svelte";
import ENameCard from "./components/ENameCard.svelte";
import EVaultCard from "./components/EVaultCard.svelte";
import Greeting from "./components/Greeting.svelte";
import ScanFAB from "./components/ScanFAB.svelte";

let userData: Record<string, unknown> | undefined = $state(undefined);
let greeting: string | undefined = $state(undefined);
let ename: string | undefined = $state(undefined);
let profileCreationStatus: "idle" | "loading" | "success" | "failed" =
    $state("idle");
let skipProfileSetupGate = $state(false);
const RECOVERY_SKIP_PROFILE_SETUP_KEY = "recoverySkipProfileSetup";

// Binding-doc flags — kept around for the verified-state chip + future
// re-integration of the ePassport block in legacy/.
let hasOnlySelfDocs = $state(false);
let missingProvisionerDocs = $state(false);
let bindingDocsLoaded = $state(false);

let notificationCount = $state(0);
let unsubNotifications: (() => void) | undefined;
let statusInterval: ReturnType<typeof setInterval> | undefined =
    $state(undefined);
let showToast = $state(false);
let toastMessage = $state("");

function handleToast(message: string) {
    toastMessage = message;
    showToast = true;
}

function handleToastClose() {
    showToast = false;
}

async function retryProfileCreation() {
    try {
        await globalState.vaultController.retryProfileCreation();
    } catch (error) {
        console.error("Retry failed:", error);
    }
}

const globalState = getContext<() => GlobalState>("globalState")();

async function loadBindingDocuments(): Promise<void> {
    const vault = await globalState.vaultController.vault;
    if (!vault?.uri || !vault?.ename) {
        bindingDocsLoaded = true;
        return;
    }

    const enameHeader = vault.ename.startsWith("@")
        ? vault.ename
        : `@${vault.ename}`;
    const gqlUrl = new URL("/graphql", vault.uri).toString();

    try {
        const res = await fetch(gqlUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-ENAME": enameHeader,
                ...(PUBLIC_EID_WALLET_TOKEN
                    ? { Authorization: `Bearer ${PUBLIC_EID_WALLET_TOKEN}` }
                    : {}),
            },
            body: JSON.stringify({
                query: `query {
                    bindingDocuments(first: 50) {
                        edges { node { parsed } }
                    }
                }`,
            }),
        });

        const json = await res.json();
        const edges: { node: { parsed: { type: string } | null } }[] =
            json?.data?.bindingDocuments?.edges ?? [];

        const isFake = await globalState.userController.isFake;
        const types = edges.map((e) => e.node.parsed?.type ?? "");

        hasOnlySelfDocs =
            !!isFake &&
            (edges.length === 0 || types.every((t) => t === "self"));

        missingProvisionerDocs =
            !isFake &&
            !types.includes("id_document") &&
            !types.includes("photograph");
    } catch (err) {
        console.warn("[main] Failed to load binding documents:", err);
    } finally {
        bindingDocsLoaded = true;
    }
}

onMount(() => {
    notificationCount = getUnreadCount();
    unsubNotifications = subscribeNotifications(() => {
        notificationCount = getUnreadCount();
    });

    const shouldSkipProfileSetupGate =
        localStorage.getItem(RECOVERY_SKIP_PROFILE_SETUP_KEY) === "true";
    if (shouldSkipProfileSetupGate) {
        skipProfileSetupGate = true;
        localStorage.removeItem(RECOVERY_SKIP_PROFILE_SETUP_KEY);
    }

    (async () => {
        const userInfo = await globalState.userController.user;
        const isFake = await globalState.userController.isFake;
        userData = { ...userInfo, isFake };
        const vaultData = await globalState.vaultController.vault;
        ename = vaultData?.ename;
        await loadBindingDocuments();
    })();

    profileCreationStatus = globalState.vaultController.profileCreationStatus;

    const checkStatus = () => {
        profileCreationStatus =
            globalState.vaultController.profileCreationStatus;
    };
    statusInterval = setInterval(checkStatus, 1000);

    const currentHour = new Date().getHours();
    greeting =
        currentHour > 17
            ? "Good Evening"
            : currentHour > 12
              ? "Good Afternoon"
              : "Good Morning";
});

onDestroy(() => {
    if (statusInterval) {
        clearInterval(statusInterval);
    }
    unsubNotifications?.();
});
</script>

{#if profileCreationStatus === "loading" && !skipProfileSetupGate}
    <div class="flex flex-col items-center justify-center min-h-screen gap-6">
        <Shadow size={40} color="rgb(142, 82, 255);" />
        <h3 class="text-xl font-semibold">Setting up your eVault profile</h3>
        <p class="text-black-700 text-center max-w-md">
            We're creating your profile in the eVault. This may take a few
            moments...
        </p>
    </div>
{:else if profileCreationStatus === "failed"}
    <div
        class="flex flex-col items-center justify-center min-h-screen gap-6 px-4"
    >
        <div class="text-center">
            <h3 class="text-xl font-semibold text-danger mb-2">
                Profile Setup Failed
            </h3>
            <p class="text-black-700 text-center max-w-md mb-6">
                We couldn't set up your eVault profile. This might be due to a
                network issue or temporary service unavailability.
            </p>
            <Button.Action
                variant="solid"
                callback={retryProfileCreation}
                class="w-full max-w-xs"
            >
                Try Again
            </Button.Action>
        </div>
    </div>
{:else}
    <div
        class="px-5"
        style="padding-top: max(12px, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom));"
    >
        <Greeting
            greeting={greeting ?? "Hi"}
            name={(userData?.name as string) ?? ""}
            {notificationCount}
        />

        <main class="mt-6 flex flex-col gap-3 pb-32">
            <ENameCard {ename} ontoast={handleToast} />
            <BindingDocuments />
            <EVaultCard available="80 Gb" />
            <AppsMarketplace />
        </main>
    </div>

    <ScanFAB />
{/if}

{#if showToast}
    <Toast message={toastMessage} onClose={handleToastClose} />
{/if}
