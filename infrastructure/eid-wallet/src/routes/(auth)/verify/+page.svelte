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
import { ButtonAction } from "$lib/ui";
import { capitalize } from "$lib/utils";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import axios from "axios";
import { getContext, onDestroy, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import { v4 as uuidv4 } from "uuid";
import DocumentType from "./steps/document-type.svelte";
import Passport from "./steps/passport.svelte";
import Selfie from "./steps/selfie.svelte";
import {
    DocBack,
    DocFront,
    Selfie as SelfiePic,
    reason,
    status,
    verifStep,
    verificaitonId,
} from "./store";

type Document = {
    country: { value: string };
    firstIssue: Date;
    licenseNumber: string;
    number: {
        confidenceCategory: string;
        value: string;
        sources: string[];
    };
    placeOfIssue: string;
    processNumber: string;
    residencePermitType: string;
    type: { value: string };
    validFrom: {
        confidenceCategory: string;
        value: string;
        sources: string[];
    };
    validUntil: {
        confidenceCategory: string;
        value: string;
        sources: string[];
    };
};

type Person = {
    address: {
        confidenceCategory: string;
        value: string;
        components: Record<string, unknown>;
        sources: string[];
    };
    dateOfBirth: {
        confidenceCategory: string;
        value: string;
        sources: string[];
    };
    employer: string;
    extraNames: string;
    firstName: {
        confidenceCategory: string;
        value: string;
        sources: string[];
    };
    foreignerStatus: string;
    gender: {
        confidenceCategory: string;
        value: string;
        sources: string[];
    };
    idNumber: {
        confidenceCategory: string;
        value: string;
        sources: string[];
    };
    lastName: {
        confidenceCategory: string;
        value: string;
        sources: string[];
    };
    nationality: {
        confidenceCategory: string;
        value: string;
        sources: string[];
    };
    occupation: string;
    placeOfBirth: string;
};

let globalState: GlobalState | undefined = $state(undefined);
let showVeriffModal = $state(false);
let person: Person;
let document: Document;
let loading = $state(false);
let keyManager: KeyManager | null = $state(null);
let websocketData: { w3id?: string } | null = $state(null); // Store websocket data for duplicate case
let hardwareKeySupported = $state(false);
let hardwareKeyCheckComplete = $state(false);
const KEY_ID = "default";

async function handleVerification() {
    try {
        // Ensure keys are initialized before starting verification
        if (!keyManager) {
            try {
                await initializeKeyManager();
                await ensureKeyForVerification();
            } catch (keyError) {
                console.error("Failed to initialize keys:", keyError);
                // If key initialization fails, go back to onboarding
                await goto("/onboarding");
                return;
            }
        }

        const { data } = await axios.post(
            new URL("/verification", PUBLIC_PROVISIONER_URL).toString(),
        );
        verificaitonId.set(data.id);
        showVeriffModal = true;
        watchEventStream(data.id);
    } catch (error) {
        console.error("Failed to start verification:", error);
        // If verification fails due to key issues or any initialization error, go back to onboarding
        const errorMessage =
            error instanceof Error
                ? error.message.toLowerCase()
                : String(error).toLowerCase();
        if (
            errorMessage.includes("key") ||
            errorMessage.includes("initialize") ||
            errorMessage.includes("manager")
        ) {
            await goto("/onboarding");
        }
    }
}
let eventSource: EventSource | null = $state(null);
function watchEventStream(id: string) {
    const sseUrl = new URL(
        `/verification/sessions/${id}`,
        PUBLIC_PROVISIONER_URL,
    ).toString();
    eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
        console.log("Successfully connected.");
    };

    eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data as string);
        if (!data.status) console.log(data);
        console.log("STATUS", data);
        status.set(data.status);
        reason.set(data.reason);
        person = data.person;
        document = data.document;
        websocketData = data; // Store the full websocket data
        if (data.status === "resubmission_requested") {
            DocFront.set(null);
            DocBack.set(null);
            SelfiePic.set(null);
        }
        verifStep.set(3);
    };
    eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        eventSource?.close();
    };
}

function closeEventStream() {
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }
}

function getKeyContext(): KeyServiceContext {
    return "verification";
}

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

// Initialize key manager for verification context
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

async function ensureKeyForVerification() {
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
    if (!globalState) throw new Error("Global state is not defined");
    if (!keyManager) {
        await initializeKeyManager();
    }

    try {
        const context = getKeyContext();
        const res = await globalState.keyService.getPublicKey(KEY_ID, context);
        console.log("Public key retrieved:", res);
        return res;
    } catch (e) {
        console.error("Public key retrieval failed:", e);
        throw e;
    }
}

let handleContinue: () => Promise<void> = $state(async () => {});

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    // handle verification logic + sec user data in the store

    // Check hardware key support first
    await checkHardwareKeySupport();

    // If hardware is not available, redirect back to onboarding
    if (!hardwareKeySupported) {
        console.log("Hardware not available, redirecting to onboarding");
        await goto("/onboarding");
        return;
    }

    // Initialize key manager and check if default key pair exists
    try {
        await initializeKeyManager();
        await ensureKeyForVerification();
    } catch (error) {
        console.error("Failed to initialize keys for verification:", error);
        // If key initialization fails, redirect back to onboarding
        await goto("/onboarding");
        return;
    }

    handleContinue = async () => {
        if ($status !== "approved" && $status !== "duplicate")
            return verifStep.set(0);
        if (!globalState) throw new Error("Global state is not defined");

        loading = true;
        globalState.userController.user = {
            name: capitalize(
                `${person.firstName.value} ${person.lastName.value ?? ""}`,
            ),
            "Date of Birth": new Date(person.dateOfBirth.value).toDateString(),
            "ID submitted":
                document.type.value === "passport"
                    ? `Passport - ${document.country.value}`
                    : document.type.value === "drivers_license"
                      ? `Driving License - ${document.country.value}`
                      : `ID Card - ${document.country.value}`,
            "Document Number": document.number.value,
        };
        globalState.userController.document = {
            "Valid From": new Date(document.validFrom.value).toDateString(),
            "Valid Until": new Date(document.validUntil.value).toDateString(),
            "Verified On": new Date().toDateString(),
        };
        globalState.userController.isFake = false;

        if ($status === "duplicate") {
            // For duplicate case, skip provision and resolve the existing eVault URI
            // The w3id should be provided in the websocket data
            const existingW3id = websocketData?.w3id; // This should come from the websocket data
            if (!existingW3id) {
                throw new Error("No w3id provided for duplicate eVault");
            }

            // Resolve the eVault URI from the registry
            const response = await axios.get(
                new URL(
                    `resolve?w3id=${existingW3id}`,
                    PUBLIC_REGISTRY_URL,
                ).toString(),
            );
            // Skip profile creation for duplicates by setting status directly
            globalState.vaultController.profileCreationStatus = "success";
            // For duplicates, just set the vault without triggering profile creation
            // since the eVault already exists with a profile
            globalState.vaultController.vault = {
                uri: response.data.uri,
                ename: existingW3id,
            };
        } else {
            // Normal flow for approved status
            const {
                data: { token: registryEntropy },
            } = await axios.get(
                new URL("/entropy", PUBLIC_REGISTRY_URL).toString(),
            );
            const { data } = await axios.post(
                new URL("/provision", PUBLIC_PROVISIONER_URL).toString(),
                {
                    registryEntropy,
                    namespace: uuidv4(),
                    verificationId: $verificaitonId,
                    publicKey: await getApplicationPublicKey(),
                },
            );
            if (data.success === true) {
                // Set vault in controller - this will trigger profile creation with retry logic
                globalState.vaultController.vault = {
                    uri: data.uri,
                    ename: data.w3id,
                };
            }
        }

        setTimeout(() => {
            goto("/register");
        }, 10_000);
    };
});

onDestroy(() => {
    closeEventStream();
});
</script>

<main
    class="pt-[3svh] px-[5vw] pb-[4.5svh] flex flex-col items-center h-[100svh]"
>
    <section class="flex flex-col items-center">
        <Hero title="Verify your account">
            {#snippet subtitle()}
                Get any ID ready. You’ll be directed to present your ID and take
                a quick selfie.
            {/snippet}
        </Hero>
        <img
            class="mx-auto mt-10 w-[70vw]"
            src="images/Passport.svg"
            alt="passport"
        />
    </section>

    <div class="grow"></div>

    <div class="w-full">
        {#if !hardwareKeyCheckComplete}
            <div class="w-full flex justify-center py-4">
                <div
                    class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"
                ></div>
            </div>
        {:else if !hardwareKeySupported}
            <div class="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
                <h3 class="text-red-800 font-semibold mb-2">
                    Hardware Security Not Available
                </h3>
                <p class="text-red-700 text-sm">
                    Your device doesn't support hardware-backed security keys
                    required for verification.
                </p>
            </div>
        {:else}
            <ButtonAction class="w-full" callback={handleVerification}>
                I'm ready
            </ButtonAction>
        {/if}
    </div>

    {#if showVeriffModal}
        <div
            role="dialog"
            aria-modal="true"
            class="fixed inset-0 z-50 bg-white flex flex-col h-full"
        >
            <div class="grow overflow-y-auto px-[5vw] pt-[8svh]">
                {#if $verifStep === 0}
                    <DocumentType />
                {:else if $verifStep === 1}
                    <Passport />
                {:else if $verifStep === 2}
                    <Selfie />
                {:else if loading}
                    <div
                        class="my-20 flex flex-col items-center justify-center gap-6"
                    >
                        <Shadow size={40} color="rgb(142, 82, 255);" />
                        <h3>Generating your eName</h3>
                    </div>
                {:else}
                    <div class="flex flex-col gap-6">
                        {#if $status === "approved"}
                            <h3>Verification Success</h3>
                            <p>You can now continue to create your eName</p>
                        {:else if $status === "duplicate"}
                            <h3>Old eVault Found</h3>
                            <p>
                                We found an existing eVault associated with your
                                identity.
                            </p>
                        {:else}
                            <h3>Verification Failed</h3>
                            <p>{$reason}</p>
                        {/if}
                    </div>
                {/if}
            </div>

            <div class="flex-none px-[5vw] pb-[8svh] pt-4">
                {#if !loading}
                    <div class="flex w-full items-stretch gap-3">
                        <ButtonAction
                            variant="soft"
                            class="flex-1"
                            callback={() => {
                                if ($verifStep > 0 && $verifStep <= 2) {
                                    verifStep.set($verifStep - 1);
                                } else if ($verifStep > 2) {
                                    goto("/onboarding");
                                } else {
                                    closeEventStream();
                                    showVeriffModal = false;
                                }
                            }}
                        >
                            Back
                        </ButtonAction>

                        {#if $verifStep > 2 && $status !== "declined"}
                            <ButtonAction
                                class="flex-1"
                                callback={handleContinue}
                                color="primary"
                            >
                                {$status === "approved"
                                    ? "Continue"
                                    : $status === "duplicate"
                                      ? "Claim Vault"
                                      : "Retry"}
                            </ButtonAction>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</main>
