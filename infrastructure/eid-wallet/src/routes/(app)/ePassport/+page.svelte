<script lang="ts">
import { goto } from "$app/navigation";
import { AppNav, IdentityCard } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import { AssuranceLevel } from "$lib/global/controllers/user";
import { ButtonAction } from "$lib/ui";
import { getContext, onMount } from "svelte";

const globalState = getContext<() => GlobalState>("globalState")();

function shareEPassport() {
    alert("EPassport Code shared!");
}

let userData: Record<string, string | boolean | undefined> | null =
    $state(null);
let docData: Record<string, unknown> = $state({});
let assuranceLevel = $state<AssuranceLevel>(AssuranceLevel.UNVERIFIED);

/**
 * Navigate to KYC verification
 * This allows UNVERIFIED users to upgrade their identity from ePassport page
 */
async function handleVerifyIdentity() {
    console.log("Navigating to KYC verification from ePassport page");
    globalState.vaultController.emitAuditEvent("KYC_UPGRADE_INITIATED", {
        source: "epassport_page",
        timestamp: new Date().toISOString(),
    });
    await goto("/verify");
}

onMount(async () => {
    const userInfo = await globalState.userController.user;
    const isFake = await globalState.userController.isFake;
    docData = (await globalState.userController.document) ?? {};
    userData = { ...userInfo, isFake };
    assuranceLevel =
        (await globalState.userController.assuranceLevel) ??
        AssuranceLevel.UNVERIFIED;
});
</script>

<AppNav title="ePassport" class="mb-8" />

<div>
    {#if userData}
        <IdentityCard variant="ePassport" {userData} class="shadow-lg" />
    {/if}

    <!-- Verify Identity CTA for UNVERIFIED users -->
    {#if assuranceLevel === AssuranceLevel.UNVERIFIED}
        <div
            class="mt-4 p-4 bg-linear-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl"
        >
            <div class="flex items-center gap-3 mb-3">
                <div
                    class="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center"
                >
                    <svg
                        class="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                    </svg>
                </div>
                <div>
                    <p class="font-semibold text-gray-900 dark:text-white">
                        Verify Your Identity
                    </p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                        Complete KYC to unlock all features
                    </p>
                </div>
            </div>
            <ButtonAction callback={handleVerifyIdentity} class="w-full">
                Start Verification
            </ButtonAction>
        </div>
    {/if}

    {#if docData && Object.keys(docData).length > 0}
        <div
            class="p-6 pt-12 bg-gray w-full rounded-2xl -mt-8 flex flex-col gap-2"
        >
            {#each Object.entries(docData) as [fieldName, value]}
                <div class="flex justify-between">
                    <p class="text-black-700 font-normal">{fieldName}</p>
                    <p class="text-black-500 font-medium">{value}</p>
                </div>
            {/each}
        </div>
    {/if}
</div>
