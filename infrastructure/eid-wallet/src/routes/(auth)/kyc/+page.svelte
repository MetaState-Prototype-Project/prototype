<script lang="ts">
import { goto } from "$app/navigation";
import { GlobalState } from "$lib/global";
import { AssuranceLevel } from "$lib/global/controllers/user";
import { ButtonAction } from "$lib/ui";
import {
    InformationCircleIcon,
    SecurityCheckIcon,
    Tick01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { getContext } from "svelte";

let loading = $state(false);
let globalState: GlobalState;

// Get globalState from context
globalState = getContext<() => GlobalState>("globalState")();

/**
 * User confirms KYC verification
 * Proceeds to Veriff flow
 */
async function handleKycConfirm() {
    console.log("=== KYC: User confirmed verification ===");
    loading = true;

    try {
        // Navigate to Veriff flow
        await goto("/verify");
    } catch (err) {
        console.error("Failed to navigate to verification:", err);
        loading = false;
    }
}

/**
 * User skips KYC verification
 * Sets assurance level to UNVERIFIED and continues
 */
async function handleKycSkip() {
    console.log("=== KYC: User skipped verification ===");
    loading = true;

    try {
        // Set assurance level to UNVERIFIED
        globalState.userController.assuranceLevel = AssuranceLevel.UNVERIFIED;

        // Get vault info for audit
        const vaultInfo = await globalState.vaultController.vault;

        // Emit audit event
        globalState.vaultController.emitAuditEvent("KYC_SKIPPED", {
            ename: vaultInfo?.ename,
            assuranceLevel: AssuranceLevel.UNVERIFIED,
        });

        // Navigate to PIN setup
        await goto("/register");
    } catch (err) {
        console.error("Failed to skip KYC:", err);
        loading = false;
    }
}
</script>

<main
    class="h-full pt-[4svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
>
    <!-- Header -->
    <div class="text-center mb-6">
        <div
            class="mx-auto w-16 h-16 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4"
        >
            <HugeiconsIcon
                icon={SecurityCheckIcon}
                color="white"
                size={32}
                strokeWidth={2}
            />
        </div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">
            Verify Your Identity
        </h2>
        <p class="text-gray-600 text-sm">
            Complete identity verification to unlock all features
        </p>
    </div>

    <!-- Benefits -->
    <div class="space-y-4 mb-6">
        {@render Benefit(
            "Full Platform Access",
            "Authenticate with all platforms and services",
        )}
        {@render Benefit(
            "Enhanced Security",
            "Additional recovery options if you lose your device",
        )}
        {@render Benefit(
            "Verified Badge",
            "Stand out with a verified identity badge",
        )}
    </div>

    <!-- Info box -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div class="flex items-start gap-3">
            <HugeiconsIcon
                icon={InformationCircleIcon}
                color="blue"
                size={36}
            />
            <div class="text-xs text-blue-900">
                <p class="font-medium mb-1">Quick & Secure Process</p>
                <p>
                    Takes 2-3 minutes. You'll need a valid government ID and to
                    take a selfie.
                </p>
            </div>
        </div>
    </div>

    <!-- Skip warning -->
    <div class="mt-4 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-500">
            You can verify your identity later from Settings
        </p>
    </div>

    <!-- Action buttons -->
    <div class="space-y-3">
        <ButtonAction
            callback={handleKycConfirm}
            disabled={loading}
            class="w-full"
        >
            {#if loading}
                Starting Verification...
            {:else}
                Continue with Verification
            {/if}
        </ButtonAction>

        <button
            onclick={handleKycSkip}
            disabled={loading}
            type="button"
            class="w-full py-3 px-4 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50 cursor-pointer"
        >
            Skip for now
        </button>
    </div>
</main>

{#snippet Benefit(firstLine: string, secondLine: string)}
    <div class="flex items-start gap-3">
        <div
            class="mt-1 shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center"
        >
            <HugeiconsIcon icon={Tick01Icon} color="green" size={16} />
        </div>
        <div>
            <p class="text-sm font-medium text-gray-900">
                {firstLine}
            </p>
            <p class="text-xs text-gray-600">
                {secondLine}
            </p>
        </div>
    </div>
{/snippet}
