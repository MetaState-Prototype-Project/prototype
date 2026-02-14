<script lang="ts">
import { goto } from "$app/navigation";
import {
    PUBLIC_PROVISIONER_URL,
    PUBLIC_REGISTRY_URL,
} from "$env/static/public";
import { Hero } from "$lib/fragments";
import { GlobalState } from "$lib/global";
import { AssuranceLevel } from "$lib/global/controllers/user";
import { ButtonAction } from "$lib/ui";
import { capitalize } from "$lib/utils";
import axios from "axios";
import { getContext, onDestroy, onMount } from "svelte";
import { Shadow } from "svelte-loading-spinners";
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
let isDemoMode = $state(false);
let isPostOnboardingUpgrade = $state(false); // True when user already has a vault
let showVeriffModal = $state(false);
let person: Person;
let document: Document;
let loading = $state(false);
let websocketData: { w3id?: string } | null = $state(null); // Store websocket data for duplicate case
let hardwareKeySupported = $state(false);
let hardwareKeyCheckComplete = $state(false);
const KEY_ID = "default";

async function handleVerification() {
    try {
        // In demo mode, simulate the verification flow
        if (isDemoMode) {
            console.log("🎭 Demo mode: Simulating verification flow");

            // Set step past the document/passport/selfie screens and show
            // the loading spinner BEFORE opening the modal so the user
            // never sees <DocumentType /> flash.
            verifStep.set(3);
            loading = true;
            showVeriffModal = true;

            // Simulate backend verification delay
            await new Promise((resolve) => setTimeout(resolve, 1200));
            status.set("approved");
            reason.set("Demo verification successful");
            loading = false;

            // Create mock person and document data
            person = {
                firstName: {
                    value: "Demo",
                    confidenceCategory: "high",
                    sources: ["demo"],
                },
                lastName: {
                    value: "User",
                    confidenceCategory: "high",
                    sources: ["demo"],
                },
                dateOfBirth: {
                    value: "1990-01-15",
                    confidenceCategory: "high",
                    sources: ["demo"],
                },
                gender: {
                    value: "unknown",
                    confidenceCategory: "high",
                    sources: ["demo"],
                },
                nationality: {
                    value: "XX",
                    confidenceCategory: "high",
                    sources: ["demo"],
                },
                idNumber: {
                    value: "DEMO123456",
                    confidenceCategory: "high",
                    sources: ["demo"],
                },
                address: {
                    value: "Demo Address",
                    confidenceCategory: "high",
                    components: {},
                    sources: ["demo"],
                },
                employer: "",
                extraNames: "",
                foreignerStatus: "",
                occupation: "",
                placeOfBirth: "",
            };

            document = {
                type: { value: "passport" },
                country: { value: "DEMO" },
                number: {
                    value: `DEMO${Date.now().toString().slice(-6)}`,
                    confidenceCategory: "high",
                    sources: ["demo"],
                },
                validFrom: {
                    value: new Date().toISOString(),
                    confidenceCategory: "high",
                    sources: ["demo"],
                },
                validUntil: {
                    value: new Date(
                        Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
                    ).toISOString(),
                    confidenceCategory: "high",
                    sources: ["demo"],
                },
                firstIssue: new Date(),
                licenseNumber: "",
                placeOfIssue: "",
                processNumber: "",
                residencePermitType: "",
            };

            console.log("🎭 Demo mode: Verification simulated as approved");
            return;
        }

        // Real verification flow
        // Ensure keys are initialized before starting verification
        try {
            await globalState?.walletSdkAdapter.ensureKey(KEY_ID, "onboarding");
        } catch (keyError) {
            console.error("Failed to ensure key:", keyError);
            await goto("/onboarding");
            return;
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

let handleContinue: () => Promise<void> = $state(async () => {});

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    // handle verification logic + sec user data in the store

    // Check if we're in demo mode
    isDemoMode = globalState.vaultController.demoMode;
    console.log(
        `Verify page: Demo mode is ${isDemoMode ? "enabled" : "disabled"}`,
    );

    // Detect if this is a post-onboarding upgrade (user already completed onboarding)
    // We check isOnboardingComplete rather than vault existence because
    // during first-time onboarding the vault is created before reaching this page
    isPostOnboardingUpgrade = await globalState.isOnboardingComplete;

    // In demo mode, skip hardware checks entirely
    if (isDemoMode) {
        console.log("Demo mode: Skipping hardware key requirements");
        hardwareKeySupported = true; // Pretend it's supported
        hardwareKeyCheckComplete = true;
    } else {
        // Check hardware key support first
        await checkHardwareKeySupport();

        // If hardware is not available, don't redirect to onboarding
        // (that would recreate identity). Just show the error in the UI.
        if (!hardwareKeySupported) {
            console.log("Hardware not available for verification");
            return;
        }

        // Ensure keys via wallet-sdk adapter
        try {
            await globalState.walletSdkAdapter.ensureKey(KEY_ID, "onboarding");
        } catch (error) {
            console.error("Failed to ensure key for verification:", error);
            return;
        }
    }

    handleContinue = async () => {
        if ($status !== "approved" && $status !== "duplicate")
            return verifStep.set(0);
        if (!globalState) throw new Error("Global state is not defined");

        loading = true;

        try {
            globalState.userController.user = {
                name: capitalize(
                    `${person.firstName.value} ${person.lastName.value ?? ""}`,
                ),
                "Date of Birth": new Date(
                    person.dateOfBirth.value,
                ).toDateString(),
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
                "Valid Until": new Date(
                    document.validUntil.value,
                ).toDateString(),
                "Verified On": new Date().toDateString(),
            };
            globalState.userController.isFake = isDemoMode;

            // In demo mode, skip backend provisioning
            if (isDemoMode) {
                console.log(
                    "🎭 Demo mode: Skipping backend provisioning, using existing demo vault",
                );

                const vaultInfo = await globalState.vaultController.vault;

                if (!vaultInfo) {
                    throw new Error(
                        "No vault found — identity must be created during onboarding first",
                    );
                }

                // Create Physical ID binding document (stub)
                await globalState.vaultController.createBindingDocument(
                    "PHYSICAL_ID",
                    {
                        ename: vaultInfo.ename,
                        verificationId: "demo-verification",
                        documentType: document.type.value,
                        documentCountry: document.country.value,
                    },
                    "demo-ca-signed-signature",
                );

                // Set assurance level to KYC_VERIFIED
                globalState.userController.assuranceLevel =
                    AssuranceLevel.KYC_VERIFIED;

                // Emit audit event
                globalState.vaultController.emitAuditEvent(
                    "ASSURANCE_UPGRADED",
                    {
                        ename: vaultInfo.ename,
                        from: AssuranceLevel.UNVERIFIED,
                        to: AssuranceLevel.KYC_VERIFIED,
                        source: isPostOnboardingUpgrade
                            ? "post-onboarding"
                            : "onboarding",
                    },
                );

                // Navigate - small delay to let store writes settle
                setTimeout(() => {
                    if (isPostOnboardingUpgrade) {
                        goto("/main");
                    } else {
                        goto("/register");
                    }
                }, 500);
                return;
            }

            if ($status === "duplicate") {
                // For duplicate case, skip provision and resolve the existing eVault URI
                const existingW3id = websocketData?.w3id;
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
                globalState.vaultController.profileCreationStatus = "success";
                globalState.vaultController.vault = {
                    uri: response.data.uri,
                    ename: existingW3id,
                };

                // Set assurance level to KYC_VERIFIED for duplicate (already verified)
                globalState.userController.assuranceLevel =
                    AssuranceLevel.KYC_VERIFIED;

                globalState.vaultController.emitAuditEvent(
                    "ASSURANCE_UPGRADED",
                    {
                        ename: existingW3id,
                        from: AssuranceLevel.UNVERIFIED,
                        to: AssuranceLevel.KYC_VERIFIED,
                        source: "duplicate",
                    },
                );
            } else {
                // Approved status - vault already exists from onboarding
                const vaultInfo = await globalState.vaultController.vault;

                if (!vaultInfo) {
                    throw new Error(
                        "No vault found - identity must be created during onboarding first",
                    );
                }

                // Create Physical ID binding document (stub - CA-signed when backend ready)
                await globalState.vaultController.createBindingDocument(
                    "PHYSICAL_ID",
                    {
                        ename: vaultInfo.ename,
                        verificationId: $verificaitonId,
                        documentType: document.type.value,
                        documentCountry: document.country.value,
                    },
                    "ca-signed",
                );

                // Set assurance level to KYC_VERIFIED
                globalState.userController.assuranceLevel =
                    AssuranceLevel.KYC_VERIFIED;

                globalState.vaultController.emitAuditEvent(
                    "ASSURANCE_UPGRADED",
                    {
                        ename: vaultInfo.ename,
                        verificationId: $verificaitonId,
                        from: AssuranceLevel.UNVERIFIED,
                        to: AssuranceLevel.KYC_VERIFIED,
                        source: isPostOnboardingUpgrade
                            ? "post-onboarding"
                            : "onboarding",
                    },
                );
            }

            // Navigate based on context
            if (isPostOnboardingUpgrade) {
                // User already has PIN, go to main
                await goto("/main");
            } else {
                // During onboarding, go to PIN setup — small delay to let store writes settle
                setTimeout(() => {
                    goto("/register");
                }, 500);
            }
        } catch (err) {
            console.error("handleContinue failed:", err);
            loading = false;
        }
    };
});

onDestroy(() => {
    closeEventStream();
});
</script>

<main class="pt-[3svh] px-[5vw] pb-[4.5svh] flex flex-col items-center h-svh">
    <section class="flex flex-col items-center">
        <Hero title="Verify your account">
            {#snippet subtitle()}
                Get any ID ready. You'll be directed to present your ID and take
                a quick selfie.
            {/snippet}
        </Hero>
        <img
            class="mx-auto mt-24 w-[70vw]"
            src="/images/id-card.png"
            alt="passport"
        />
    </section>

    <div class="w-full mt-12">
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
                <p class="text-red-700 text-sm mb-3">
                    Your device doesn't support hardware-backed security keys
                    required for verification.
                </p>
                <ButtonAction
                    variant="soft"
                    class="w-full"
                    callback={async () => {
                        if (globalState) {
                            // Only downgrade to UNVERIFIED if not already KYC_VERIFIED
                            if (
                                (await globalState.userController
                                    .assuranceLevel) !==
                                AssuranceLevel.KYC_VERIFIED
                            ) {
                                globalState.userController.assuranceLevel =
                                    AssuranceLevel.UNVERIFIED;
                            }
                            globalState.vaultController.emitAuditEvent(
                                "KYC_HARDWARE_UNAVAILABLE",
                                {
                                    source: isPostOnboardingUpgrade
                                        ? "post-onboarding"
                                        : "onboarding",
                                },
                            );
                        }

                        if (isPostOnboardingUpgrade) {
                            await goto("/main");
                        } else {
                            await goto("/register");
                        }
                    }}
                >
                    {isPostOnboardingUpgrade
                        ? "Go back"
                        : "Continue without verification"}
                </ButtonAction>
            </div>
        {:else}
            <ButtonAction
                class="w-[80vw] absolute bottom-[8svh] left-1/2 transform -translate-x-1/2"
                callback={handleVerification}
            >
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
                        <h3>Verifying your identity...</h3>
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
                            callback={async () => {
                                if ($verifStep > 0 && $verifStep <= 2) {
                                    verifStep.set($verifStep - 1);
                                } else if ($verifStep > 2) {
                                    // Verification result screen - handle fail/cancel
                                    if (
                                        $status !== "approved" &&
                                        $status !== "duplicate"
                                    ) {
                                        // Failed or cancelled: continue as UNVERIFIED
                                        if (globalState) {
                                            // Only downgrade to UNVERIFIED if not already KYC_VERIFIED
                                            if (
                                                (await globalState
                                                    .userController
                                                    .assuranceLevel) !==
                                                AssuranceLevel.KYC_VERIFIED
                                            ) {
                                                globalState.userController.assuranceLevel =
                                                    AssuranceLevel.UNVERIFIED;
                                            }
                                            globalState.vaultController.emitAuditEvent(
                                                "KYC_FAILED_OR_CANCELLED",
                                                {
                                                    status: $status,
                                                    reason: $reason,
                                                },
                                            );
                                        }
                                        if (isPostOnboardingUpgrade) {
                                            await goto("/main");
                                        } else {
                                            await goto("/register");
                                        }
                                    } else {
                                        // Approved/duplicate - go back to KYC decision
                                        closeEventStream();
                                        showVeriffModal = false;
                                    }
                                } else {
                                    closeEventStream();
                                    showVeriffModal = false;
                                }
                            }}
                        >
                            {$verifStep > 2 &&
                            $status !== "approved" &&
                            $status !== "duplicate"
                                ? "Continue without verification"
                                : "Back"}
                        </ButtonAction>

                        {#if $verifStep > 2 && ($status === "approved" || $status === "duplicate")}
                            <ButtonAction
                                class="flex-1"
                                callback={handleContinue}
                                color="primary"
                            >
                                {$status === "approved"
                                    ? "Continue"
                                    : "Claim Vault"}
                            </ButtonAction>
                        {:else if $verifStep > 2 && $status !== "declined"}
                            <ButtonAction
                                class="flex-1"
                                callback={handleContinue}
                                color="primary"
                            >
                                Retry
                            </ButtonAction>
                        {/if}
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</main>
