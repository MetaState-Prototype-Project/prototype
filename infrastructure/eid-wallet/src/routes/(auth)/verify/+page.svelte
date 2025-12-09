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
import Drawer from "$lib/ui/Drawer/Drawer.svelte";
import { capitalize } from "$lib/utils";
import axios from "axios";
import { getContext, onMount, setContext } from "svelte";
import { Shadow } from "svelte-loading-spinners";
import { v4 as uuidv4 } from "uuid";
import DocumentType from "./steps/document-type.svelte";
import {
    DocBack,
    DocFront,
    Selfie as SelfiePic,
    reason,
    status,
    verifStep,
    verificaitonId,
    verificationPerson,
    verificationDocument,
    verificationWebsocketData,
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

function watchEventStream(id: string) {
    const sseUrl = new URL(
        `/verification/sessions/${id}`,
        PUBLIC_PROVISIONER_URL,
    ).toString();
    const eventSource = new EventSource(sseUrl);

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
        // Also store in writable stores for selfie page
        verificationPerson.set(data.person);
        verificationDocument.set(data.document);
        verificationWebsocketData.set(data);
        if (data.status === "resubmission_requested") {
            DocFront.set(null);
            DocBack.set(null);
            SelfiePic.set(null);
        }
        verifStep.set(3);
        // Data is now available in stores for selfie page to use
        // Don't navigate - stay on selfie page which will show results
    };
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

    // Provide showVeriffModal context to child components
    setContext("showVeriffModal", {
        get value() {
            return showVeriffModal;
        },
        set value(v: boolean) {
            showVeriffModal = v;
        },
    });

    // Provide verification data context for selfie page
    setContext("verifyData", {
        get person() {
            return person;
        },
        get document() {
            return document;
        },
        get websocketData() {
            return websocketData;
        },
    });

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
</script>

<main
    class="pt-[3svh] px-[5vw] pb-[4.5svh] flex flex-col justify-between items-center"
>
    <section>
        <Hero title="Verify your account">
            {#snippet subtitle()}
                Get any ID ready. You’ll be directed to present your ID and take
                a quick selfie.
            {/snippet}
        </Hero>
        <img class="mx-auto mt-20" src="images/Passport.svg" alt="passport" />
    </section>
    {#if !hardwareKeyCheckComplete}
        <div class="w-full mt-10 flex justify-center">
            <div
                class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"
            ></div>
        </div>
    {:else if !hardwareKeySupported}
        <div
            class="w-full mt-10 p-4 bg-red-50 border border-red-200 rounded-lg"
        >
            <h3 class="text-red-800 font-semibold mb-2">
                Hardware Security Not Available
            </h3>
            <p class="text-red-700 text-sm">
                Your device doesn't support hardware-backed security keys
                required for identity verification. Please use a device with
                hardware security support or try the pre-verification option.
            </p>
        </div>
    {:else}
        <ButtonAction class="w-full mt-10" callback={handleVerification}
            >I'm ready</ButtonAction
        >
    {/if}
    <Drawer bind:isPaneOpen={showVeriffModal}>
        <div>
            {#if $verifStep === 0}
                <DocumentType />
            {/if}
        </div>
    </Drawer>
</main>
