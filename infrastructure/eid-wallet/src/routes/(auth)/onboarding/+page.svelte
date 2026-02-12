<script lang="ts">
import { goto } from "$app/navigation";
import {
    PUBLIC_PROVISIONER_URL,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";
import { Hero } from "$lib/fragments";
import { GlobalState } from "$lib/global";
import { ButtonAction } from "$lib/ui";
import { getContext, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import { v4 as uuidv4 } from "uuid";
import { provision } from "wallet-sdk";

// ========================================
// DEMO MODE - Set to true to test without backend
// ========================================
const DEMO_MODE = true; // Toggle this for testing

// Component state
let loading = $state(false);
let creatingIdentity = $state(false);
let error: string | null = $state(null);
let statusMessage: string | null = $state(null);
let hardwareKeySupported = $state(false);
let hardwareKeyCheckComplete = $state(false);

const KEY_ID = "default";

let globalState: GlobalState;

// Identity creation result
let ename: string = $state("");
let vaultUri: string = $state("");

// Check if hardware key is supported on this device
async function checkHardwareKeySupport() {
    try {
        if (!globalState) throw new Error("Global state is not defined");
        hardwareKeySupported =
            await globalState.keyService.isHardwareAvailable();
        console.log(
            `Hardware key ${hardwareKeySupported ? "is" : "is NOT"} supported on this device`,
        );
    } catch (error) {
        hardwareKeySupported = false;
        console.log("Hardware key is NOT supported on this device:", error);
    } finally {
        hardwareKeyCheckComplete = true;
    }
}

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
});

/**
 * Entry point - user clicks "Get Started"
 * Creates baseline identity then navigates to KYC page
 */
async function handleGetStarted() {
    // Prevent double-tap
    if (loading) return;

    loading = true;
    console.log("=== Onboarding: Get Started ===");
    error = null;

    try {
        console.log("Starting baseline identity creation...");
        // Create baseline identity first
        await createBaselineIdentity();

        console.log("Identity created, navigating to /kyc...");
        // Navigate to KYC page
        await goto("/kyc");
    } catch (err) {
        console.error("Failed to create identity:", err);
        // Preserve specific error messages (e.g., hardware key requirements)
        if (
            err instanceof Error &&
            err.message.includes("Hardware security keys")
        ) {
            error = err.message;
        } else {
            error = "Failed to create identity. Please try again.";
        }
        setTimeout(() => {
            error = null;
        }, 5000);
    } finally {
        loading = false;
    }
}

/**
 * Core identity creation flow
 * Always executed regardless of KYC choice
 *
 * Creates:
 * 1. Keypair (hardware on real device, software for testing)
 * 2. eVault instance
 * 3. ePassport (Remote CA signed certificate binding eName to publicKey)
 * 4. Self-asserted profile binding (self-signed)
 * 5. Passphrase hash binding (created during PIN setup in /register)
 */
async function createBaselineIdentity() {
    creatingIdentity = true;

    try {
        console.log("=== Baseline Identity Creation Started ===");

        if (!globalState) {
            throw new Error(
                "GlobalState not initialized. Please wait a moment and try again.",
            );
        }

        if (DEMO_MODE) {
            console.log("🎭 DEMO MODE: Creating mock identity");
            statusMessage = "🎭 Demo: Generating mock identity...";

            // Enable demo mode on vault controller to skip network operations
            globalState.vaultController.demoMode = true;

            // Simulate some delay to show it's working
            await new Promise((resolve) => setTimeout(resolve, 800));

            // Generate mock data
            ename = `@demo-${uuidv4().substring(0, 8)}`;
            vaultUri = `http://localhost:4000/evault/${ename}`;
            const mockPublicKey = `demo-pubkey-${ename}`;

            statusMessage = `🎭 Demo: Created ${ename}`;
            console.log("🎭 DEMO: Mock eVault provisioned:", {
                ename,
                uri: vaultUri,
            });

            // Store vault info in controller
            globalState.vaultController.vault = {
                uri: vaultUri,
                ename,
            };

            globalState.vaultController.emitAuditEvent("KEYPAIR_GENERATED", {
                keyType: "demo-software",
            });

            globalState.vaultController.emitAuditEvent("EVAULT_PROVISIONED", {
                ename,
            });

            // Step 4: Request ePassport from Remote CA (stub)
            statusMessage = "🎭 Demo: Requesting ePassport...";
            await globalState.vaultController.requestEPassport(
                ename,
                mockPublicKey,
            );

            // Step 5: Create self-asserted profile binding (stub)
            statusMessage = "🎭 Demo: Creating profile binding...";
            await globalState.vaultController.createBindingDocument(
                "SELF_ASSERTED_PROFILE",
                { ename, source: "onboarding", selfAsserted: true },
                "demo-self-signed-signature",
            );

            await new Promise((resolve) => setTimeout(resolve, 500));
            statusMessage = null;

            console.log("=== Baseline Identity Creation Complete (DEMO) ===");
            return;
        }

        // Check hardware key support before proceeding with real onboarding
        await checkHardwareKeySupport();

        if (!hardwareKeySupported) {
            throw new Error(
                "Hardware security keys are required for onboarding. Your device doesn't support hardware-backed security keys.",
            );
        }

        console.log("=== Step 1: Generate Keypair ===");

        // Generate keypair via wallet-sdk adapter
        await globalState.walletSdkAdapter.ensureKey(KEY_ID, "onboarding");

        console.log("=== Steps 2-4: Provision eVault ===");

        // Provision eVault (handles entropy, provisioning, and key binding)
        const result = await provision(globalState.walletSdkAdapter, {
            registryUrl: PUBLIC_REGISTRY_URL,
            provisionerUrl: PUBLIC_PROVISIONER_URL,
            namespace: uuidv4(),
            verificationId: "",
            keyId: KEY_ID,
            context: "onboarding",
            isPreVerification: true,
        });

        console.log("Provision response:", result);

        ename = result.w3id;
        vaultUri = result.uri;

        // Store vault info in controller
        globalState.vaultController.vault = {
            uri: vaultUri,
            ename,
        };

        // Emit audit event for eVault creation
        globalState.vaultController.emitAuditEvent("EVAULT_PROVISIONED", {
            ename,
        });

        console.log("=== Step 5: Create Self-Asserted Profile Binding ===");

        // Create self-asserted profile binding document (stub)
        await globalState.vaultController.createBindingDocument(
            "SELF_ASSERTED_PROFILE",
            { ename, source: "onboarding", selfAsserted: true },
            "self-signed",
        );

        // Note: Passphrase hash binding will be created during PIN setup in /register

        console.log("=== Baseline Identity Creation Complete ===");
    } catch (err) {
        console.error("Baseline identity creation failed:", err);
        throw err;
    } finally {
        creatingIdentity = false;
    }
}
</script>

<main
    class="h-full pt-[4svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between"
>
    <article class="flex justify-center mb-4">
        <img
            class="w-[88vw] h-[39svh]"
            src="/images/Onboarding.svg"
            alt="Infographic card"
        />
    </article>

    <section>
        <Hero class="mb-4" titleClasses="text-[42px]/[1.1] font-medium">
            {#snippet subtitle()}
                Your Digital Self consists of three core elements: <br />
                <strong>– eName</strong> – your digital identifier, a number
                <br />
                <strong>– ePassport</strong> – your cryptographic keys, enabling
                your agency and control
                <br />
                <strong>– eVault</strong> – the secure repository of all your
                personal data. You will decide who can access it, and how. You
                are going to get them now.
                <br />
            {/snippet}
            Your Digital Self<br />
            <h4>in Web 3.0 Data Space</h4>
        </Hero>
    </section>

    {#if error}
        <div class="bg-red-500 text-white rounded-md p-3 mb-4 text-center">
            {error}
        </div>
    {:else if statusMessage}
        <p class="text-sm text-blue-600 dark:text-blue-400 font-mono">
            {statusMessage}
        </p>
    {/if}
    {#if creatingIdentity}
        <div class="flex flex-col items-center justify-center py-8 gap-4">
            <Shadow size={40} color="rgb(142, 82, 255)" />
            <p class="text-center text-gray-700 dark:text-gray-300">
                Creating your Digital Identity...
            </p>
            {#if DEMO_MODE}
                <p class="text-xs text-blue-600 dark:text-blue-400">
                    🎭 Demo Mode Active
                </p>
            {/if}
        </div>
    {:else}
        <section>
            <p class="text-center small text-black-500">
                By continuing you agree to our <br />
                <a
                    href="https://metastate.foundation/"
                    rel="noopener noreferrer"
                    class="text-primary underline underline-offset-4"
                    target="_blank"
                    >Terms & Conditions
                </a>
                and
                <a
                    href="https://metastate.foundation/"
                    rel="noopener noreferrer"
                    target="_blank"
                    class="text-primary underline underline-offset-4"
                    >Privacy Policy.</a
                >
            </p>
            {#if DEMO_MODE}
                <div
                    class="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg p-2 mb-2 text-center"
                >
                    <p class="text-xs text-blue-800 dark:text-blue-200">
                        🎭 Demo Mode - No backend required
                    </p>
                </div>
            {/if}
            <div class="flex justify-center whitespace-nowrap mt-1">
                <ButtonAction
                    class="w-full"
                    callback={handleGetStarted}
                    disabled={loading}
                >
                    Get Started
                </ButtonAction>
            </div>
        </section>
    {/if}
</main>
