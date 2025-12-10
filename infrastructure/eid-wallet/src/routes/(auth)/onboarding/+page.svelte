<script lang="ts">
import { goto } from "$app/navigation";
import {
    PUBLIC_PROVISIONER_URL,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";
import type { KeyManager } from "$lib/crypto";
import { Hero } from "$lib/fragments";
import { GlobalState } from "$lib/global";
import type { KeyServiceContext } from "$lib/global";
import { ButtonAction, Drawer } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { capitalize } from "$lib/utils";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import * as falso from "@ngneat/falso";
import axios from "axios";
import { getContext, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import { v4 as uuidv4 } from "uuid";

let isPaneOpen = $state(false);
let preVerified = $state(false);
let loading = $state(false);
let verificationId = $state("");
let demoName = $state("");
let verificationSuccess = $state(false);
let keyManager: KeyManager | null = $state(null);
let showHardwareError = $state(false);
let checkingHardware = $state(false);
const KEY_ID = "default";

const handleGetStarted = async () => {
    isPaneOpen = true;
    preVerified = false;
    checkingHardware = true;
    showHardwareError = false;
    error = null;

    try {
        if (!globalState) {
            globalState = getContext<() => GlobalState>("globalState")();
        }

        // Actually try to generate a test hardware key
        const testKeyId = `hardware-test-${Date.now()}`;
        console.log(
            "Testing hardware key generation with test key:",
            testKeyId,
        );

        try {
            const { manager, created } = await globalState.keyService.ensureKey(
                testKeyId,
                "onboarding",
            );
            console.log(
                "Test key result - Manager type:",
                manager.getType(),
                "Created:",
                created,
            );

            // Check if we got hardware manager and it actually created a key
            if (manager.getType() !== "hardware") {
                throw new Error("Got software fallback instead of hardware");
            }

            // Hardware works! Clean up test key and proceed
            console.log("Hardware keys are working");
            checkingHardware = false;
        } catch (keyError) {
            console.error("Hardware key test failed:", keyError);
            showHardwareError = true;
            checkingHardware = false;
        }
    } catch (err) {
        console.error("Error checking hardware:", err);
        showHardwareError = true;
        checkingHardware = false;
    }
};

const handlePreVerified = () => {
    isPaneOpen = true;
    preVerified = true;
};

function generatePassportNumber() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomLetters = () =>
        letters.charAt(Math.floor(Math.random() * letters.length)) +
        letters.charAt(Math.floor(Math.random() * letters.length));
    const randomDigits = () =>
        String(Math.floor(1000000 + Math.random() * 9000000)); // 7 digits

    return randomLetters() + randomDigits();
}

function getKeyContext(): KeyServiceContext {
    return preVerified ? "pre-verification" : "onboarding";
}

async function initializeKeyManager() {
    try {
        if (!globalState) throw new Error("Global state is not defined");
        const context = getKeyContext();
        keyManager = await globalState.keyService.getManager(KEY_ID, context);
        console.log(`Key manager initialized: ${keyManager.getType()}`);
        return keyManager;
    } catch (error) {
        console.error("Failed to initialize key manager:", error);
        throw error;
    }
}

async function ensureKeyForContext() {
    try {
        if (!globalState) throw new Error("Global state is not defined");
        const context = getKeyContext();
        const { manager, created } = await globalState.keyService.ensureKey(
            KEY_ID,
            context,
        );
        keyManager = manager;
        console.log(
            "Key generation result:",
            created ? "key-generated" : "key-exists",
        );
        return { manager, created };
    } catch (error) {
        console.error("Failed to ensure key:", error);
        throw error;
    }
}

async function getApplicationPublicKey() {
    try {
        if (!globalState) throw new Error("Global state is not defined");
        if (!keyManager) {
            await initializeKeyManager();
        }
        const context = getKeyContext();
        const publicKey = await globalState.keyService.getPublicKey(
            KEY_ID,
            context,
        );
        console.log("Public key retrieved:", publicKey);
        return publicKey;
    } catch (error) {
        console.error("Public key retrieval failed:", error);
        throw error;
    }
}

const handleNext = async () => {
    // Initialize keys for onboarding context before going to verify
    try {
        loading = true;
        if (!globalState) {
            globalState = getContext<() => GlobalState>("globalState")();
        }
        await initializeKeyManager();
        await ensureKeyForContext();
        loading = false;
        goto("/verify");
    } catch (err) {
        console.error("Failed to initialize keys for onboarding:", err);
        error = "Failed to initialize security keys. Please try again.";
        loading = false;
        setTimeout(() => {
            error = null;
        }, 5000);
    }
};

let globalState: GlobalState;
let handleContinue: () => Promise<void> | void = $state(() => {});
let handleFinalSubmit: () => Promise<void> | void = $state(() => {});
let ename: string;
let uri: string;

let error: string | null = $state(null);

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    // handle verification logic + sec user data in the store

    // Don't initialize key manager here - wait until user chooses their path

    handleContinue = async () => {
        // Require both verification code and name
        if (!verificationId || !demoName || verificationId.length === 0 || demoName.length === 0) {
            return;
        }

        loading = true;
        error = null;

        try {
            // Initialize key manager for pre-verification context
            await initializeKeyManager();
            await ensureKeyForContext();

            const entropyRes = await axios.get(
                new URL("/entropy", PUBLIC_REGISTRY_URL).toString(),
            );
            const registryEntropy = entropyRes.data.token;
            console.log("Registry entropy:", registryEntropy);

            const provisionRes = await axios.post(
                new URL("/provision", PUBLIC_PROVISIONER_URL).toString(),
                {
                    registryEntropy,
                    namespace: uuidv4(),
                    verificationId,
                    publicKey: await getApplicationPublicKey(),
                },
            );
            console.log("Provision response:", provisionRes.data);

            if (!provisionRes.data?.success) {
                throw new Error("Invalid verification code");
            }

            verificationSuccess = true;
            uri = provisionRes.data.uri;
            ename = provisionRes.data.w3id;
        } catch (err) {
            console.error("Pre-verification failed:", err);

            preVerified = false;
            verificationId = "";
            demoName = "";
            error = "Wrong pre-verification code";

            setTimeout(() => {
                error = null;
            }, 6000);
        } finally {
            loading = false;
        }
    };

    // New function to handle final submission with demo name
    handleFinalSubmit = async () => {
        loading = true;

        const tenYearsLater = new Date();
        tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
        globalState.userController.user = {
            name:
                demoName ||
                capitalize(`${falso.randFirstName()} ${falso.randLastName()}`),
            "Date of Birth": new Date().toDateString(),
            "ID submitted": `Passport - ${falso.randCountryCode()}`,
            "Passport Number": generatePassportNumber(),
        };
        globalState.userController.isFake = true;
        globalState.userController.document = {
            "Valid From": new Date(Date.now()).toDateString(),
            "Valid Until": tenYearsLater.toDateString(),
            "Verified On": new Date().toDateString(),
        };

        // Set vault in controller - this will trigger profile creation with retry logic
        globalState.vaultController.vault = {
            uri,
            ename,
        };

        setTimeout(() => {
            goto("/register");
        }, 10_000);
    };
});
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
    <section>
        <p class="text-center small text-black-500">
            By continuing you agree to our <br />
            <a href="/" class="text-primary underline underline-offset-4"
                >Terms & Conditions
            </a>
            and
            <a href="/" class="text-primary underline underline-offset-4"
                >Privacy Policy.</a
            >
        </p>
        <div class="flex justify-center whitespace-nowrap mt-1">
            <ButtonAction
                class="w-full"
                callback={handleGetStarted}
                disabled={checkingHardware}
            >
                {checkingHardware ? "Checking device..." : "Get Started"}
            </ButtonAction>
        </div>

        <p class="mt-2 text-center">
            Already have a pre-verification code? <button
                onclick={handlePreVerified}
                class="text-primary-500">Click Here</button
            >
        </p>
    </section>
</main>

<Drawer bind:isPaneOpen>
    <img src="/images/GetStarted.svg" alt="get-started" />
    {#if error}
        <div
            class="bg-[#ff3300] rounded-md mt-4 p-2 w-full text-center text-white"
        >
            {error}
        </div>
    {/if}
    {#if loading}
        <div class="my-20">
            <div
                class="align-center flex w-full flex-col items-center justify-center gap-6"
            >
                <Shadow size={40} color="rgb(142, 82, 255);" />
                <h4>Generating your eName</h4>
            </div>
        </div>
    {:else if preVerified}
        {#if verificationSuccess}
            <h4 class="mt-[2.3svh] mb-[0.5svh]">Verification Successful!</h4>
            <p class="text-black-700">Your demo name: <strong>{demoName}</strong></p>
            <p class="text-black-700 mt-2">You can now continue to create your ePassport.</p>
            <div class="flex justify-center whitespace-nowrap my-[2.3svh]">
                <ButtonAction
                    variant="solid"
                    class="w-full"
                    callback={handleFinalSubmit}>Continue</ButtonAction
                >
            </div>
        {:else}
            <h4 class="mt-[2.3svh] mb-[0.5svh]">
                Welcome to Web 3.0 Data Spaces
            </h4>
            <p class="text-black-700">Enter Verification Code</p>
            <input
                type="text"
                bind:value={verificationId}
                class="border-1 border-gray-200 w-full rounded-md font-medium my-2 p-2"
                placeholder="Enter verification code"
            />
            <p class="text-black-700 mt-4">Enter Demo Name for your ePassport</p>
            <input
                type="text"
                bind:value={demoName}
                class="border-1 border-gray-200 w-full rounded-md font-medium my-2 p-2"
                placeholder="Enter your demo name for ePassport"
            />
            <div class="flex justify-center whitespace-nowrap my-[2.3svh]">
                <ButtonAction
                    variant={verificationId.length === 0 || demoName.length === 0 ? "soft" : "solid"}
                    disabled={verificationId.length === 0 || demoName.length === 0}
                    class="w-full"
                    callback={handleContinue}>Next</ButtonAction
                >
            </div>
        {/if}
    {:else if checkingHardware}
        <div class="my-20">
            <div
                class="align-center flex w-full flex-col items-center justify-center gap-6"
            >
                <Shadow size={40} color="rgb(142, 82, 255);" />
                <h4>Checking device capabilities...</h4>
            </div>
        </div>
    {:else if showHardwareError}
        <h4 class="mt-[2.3svh] mb-[0.5svh] text-red-600">
            Hardware Security Not Available
        </h4>
        <p class="text-black-700 mb-4">
            Your phone doesn't support hardware crypto keys, which is a
            requirement for verified IDs.
        </p>
        <p class="text-black-700 mb-4">
            Please use the pre-verification code option to create a demo account
            instead.
        </p>
        <div class="flex justify-center whitespace-nowrap my-[2.3svh]">
            <ButtonAction
                class="w-full"
                callback={() => {
                    isPaneOpen = false;
                    handlePreVerified();
                }}
            >
                Use Pre-Verification Code
            </ButtonAction>
        </div>
    {:else}
        <h4 class="mt-[2.3svh] mb-[0.5svh]">
            Your Digital Self begins with the Real You
        </h4>
        <p class="text-black-700">
            In the Web 3.0 Data Space, identity is linked to reality. We begin
            by verifying your real-world passport, which serves as the
            foundation for issuing your secure ePassport. At the same time, we
            generate your eName – a unique digital identifier – and create your
            eVault to store and protect your personal data.
        </p>
        <div class="flex justify-center whitespace-nowrap my-[2.3svh]">
            <ButtonAction class="w-full" callback={handleNext}
                >Next</ButtonAction
            >
        </div>
    {/if}
</Drawer>
