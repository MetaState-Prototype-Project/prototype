<!--
    Legacy KYC upgrade overlay (extracted from /main during the F21 redesign
    refactor). Not currently mounted — the redesigned home doesn't have an
    entry point yet. To re-enable, import and mount with bind:open and pass
    the relevant callbacks.

    Self-contained state machine + UI. Pulls globalState from context, same as
    the parent page used to.
-->
<script lang="ts">
import {
    PUBLIC_PROVISIONER_SHARED_SECRET,
    PUBLIC_PROVISIONER_URL,
} from "$env/static/public";
import type { GlobalState } from "$lib/global";
import * as Button from "$lib/ui/Button";
import { capitalize } from "$lib/utils";
import axios from "axios";
import { getContext, untrack } from "svelte";
import { Shadow } from "svelte-loading-spinners";

type KycStep =
    | "idle"
    | "checking-hw"
    | "hw-error"
    | "starting"
    | "start-error"
    | "verifying"
    | "result"
    | "upgrading"
    | "duplicate";

interface DiditWarning {
    short_description?: string;
}

interface DiditIdVerification {
    warnings?: DiditWarning[];
    full_name?: string;
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    document_type?: string;
    document_number?: string;
    issuing_state_name?: string;
    issuing_state?: string;
    expiration_date?: string;
    date_of_issue?: string;
}

interface DiditDecision {
    status?: string;
    reviews?: Array<{ comment?: string }>;
    id_verifications?: DiditIdVerification[];
    session_id?: string;
    session?: {
        sessionId?: string;
    };
}

interface DiditCompleteResult {
    type?: string;
    session?: {
        sessionId?: string;
    };
}

interface UpgradeErrorBody {
    duplicate?: boolean;
    existingW3id?: string | null;
    message?: string;
}

interface IKycUpgradeOverlayProps {
    open: boolean;
    /** Called after a successful upgrade so the parent can refresh binding docs. */
    onupgraded?: () => void;
    /** Called when the overlay closes for any reason (cancel, error dismissal). */
    onclose?: () => void;
}

const { open, onupgraded, onclose }: IKycUpgradeOverlayProps = $props();

const globalState = getContext<() => GlobalState>("globalState")();

let kycStep = $state<KycStep>("idle");
let kycError = $state<string | null>(null);
let diditActualSessionId = $state<string | null>(null);
let diditDecision = $state<DiditDecision | null>(null);
let diditResult = $state<"approved" | "declined" | "in_review" | null>(null);
let diditRejectionReason = $state<string | null>(null);
let duplicateEName = $state<string | null>(null);

// Fire startKycUpgrade once per open=true edge. Reading `kycStep` inside
// `untrack` prevents the effect from re-running when the flow internally
// flips `kycStep` (e.g. catch → "start-error"), which would otherwise
// spin the network call in a tight loop.
$effect(() => {
    if (open) {
        untrack(() => {
            if (kycStep === "idle") {
                startKycUpgrade();
            }
        });
    }
});

function resetKyc() {
    kycStep = "idle";
    kycError = null;
    diditActualSessionId = null;
    diditDecision = null;
    diditResult = null;
    diditRejectionReason = null;
    duplicateEName = null;
    onclose?.();
}

async function startKycUpgrade() {
    kycError = null;
    kycStep = "checking-hw";

    // Probe with a hard timeout — on some devices the first Keystore call
    // can hang silently. Without this the overlay would sit on the spinner
    // indefinitely with no way to recover.
    console.log("[KYC] probeHardware: starting");
    const probeStart = Date.now();
    let hardwareAvailable: boolean;
    try {
        hardwareAvailable = await Promise.race([
            globalState.keyService.probeHardware(),
            new Promise<never>((_, reject) =>
                setTimeout(
                    () => reject(new Error("probeHardware timed out")),
                    10_000,
                ),
            ),
        ]);
        console.log(
            `[KYC] probeHardware: returned ${hardwareAvailable} in ${Date.now() - probeStart}ms`,
        );
    } catch (err) {
        console.error("[KYC] probeHardware failed/timed out:", err);
        kycError =
            err instanceof Error && err.message === "probeHardware timed out"
                ? "Hardware capability check timed out after 10s. Check adb logcat for crypto-hw plugin errors."
                : `Hardware check failed: ${err instanceof Error ? err.message : String(err)}`;
        kycStep = "start-error";
        return;
    }

    if (!hardwareAvailable) {
        kycStep = "hw-error";
        return;
    }

    kycStep = "starting";
    try {
        await globalState.walletSdkAdapter.ensureKey("default", "onboarding");

        const { data } = await axios.post(
            new URL("/verification/v2", PUBLIC_PROVISIONER_URL).toString(),
            {},
            {
                headers: {
                    "x-shared-secret": PUBLIC_PROVISIONER_SHARED_SECRET,
                },
            },
        );

        if (!data.verificationUrl) {
            throw new Error(
                `Backend did not return a verificationUrl. Response: ${JSON.stringify(data)}`,
            );
        }

        kycStep = "verifying";

        await new Promise((r) => setTimeout(r, 50));

        const { DiditSdk } = await import("@didit-protocol/sdk-web");
        const sdk = DiditSdk.shared;
        sdk.onComplete = handleDiditComplete;
        await sdk.startVerification({
            url: data.verificationUrl,
            configuration: {
                embedded: true,
                embeddedContainerId: "didit-container-home",
            },
        });
    } catch (err) {
        console.error("[KYC] Failed to start:", err);
        kycError =
            err instanceof Error
                ? err.message
                : "Failed to start verification. Please try again.";
        kycStep = "start-error";
    }
}

const handleDiditComplete = async (result: DiditCompleteResult) => {
    console.log("[KYC] onComplete:", result);

    if (result.type === "cancelled") {
        resetKyc();
        return;
    }

    if (!result.session?.sessionId) {
        kycError = "Verification did not return a session ID.";
        resetKyc();
        return;
    }

    diditActualSessionId = result.session.sessionId;
    kycStep = "starting";

    try {
        const { data: decision } = await axios.get<DiditDecision>(
            new URL(
                `/verification/v2/decision/${result.session.sessionId}`,
                PUBLIC_PROVISIONER_URL,
            ).toString(),
            {
                headers: {
                    "x-shared-secret": PUBLIC_PROVISIONER_SHARED_SECRET,
                },
            },
        );

        diditDecision = decision;
        const rawStatus: string = decision.status ?? "";
        diditResult = rawStatus.toLowerCase().replace(" ", "_") as
            | "approved"
            | "declined"
            | "in_review";

        if (diditResult !== "approved") {
            diditRejectionReason =
                decision.reviews?.[0]?.comment ??
                decision.id_verifications?.[0]?.warnings?.[0]
                    ?.short_description ??
                "Verification could not be completed.";
        }

        kycStep = "result";
    } catch (err) {
        console.error("[KYC] Failed to fetch decision:", err);
        kycError = "Failed to retrieve verification result. Please try again.";
        resetKyc();
        setTimeout(() => {
            kycError = null;
        }, 6000);
    }
};

async function handleUpgrade() {
    if (!diditDecision) return;
    const vault = await globalState.vaultController.vault;
    const w3id = vault?.ename;
    if (!w3id) {
        kycError = "No active eVault found for upgrade.";
        return;
    }

    const sessionId =
        diditActualSessionId ??
        diditDecision.session_id ??
        diditDecision.session?.sessionId;
    if (!sessionId) {
        kycError = "Missing session ID from verification result.";
        return;
    }

    kycStep = "upgrading";
    try {
        const { data } = await axios.post(
            new URL(
                "/verification/v2/upgrade",
                PUBLIC_PROVISIONER_URL,
            ).toString(),
            { diditSessionId: sessionId, w3id },
            {
                headers: {
                    "x-shared-secret": PUBLIC_PROVISIONER_SHARED_SECRET,
                },
            },
        );
        if (!data.success) {
            if (data.duplicate) {
                duplicateEName = data.existingW3id ?? null;
                kycStep = "duplicate";
            } else {
                kycError = data.message ?? "Upgrade failed";
                kycStep = "result";
            }
            return;
        }
        const idVerif = diditDecision?.id_verifications?.[0];
        if (idVerif) {
            const fullName = (
                idVerif.full_name ??
                `${idVerif.first_name ?? ""} ${idVerif.last_name ?? ""}`
            ).trim();
            const dob: string = idVerif.date_of_birth ?? "";
            const docType: string = idVerif.document_type ?? "";
            const docNumber: string = idVerif.document_number ?? "";
            const country: string =
                idVerif.issuing_state_name ?? idVerif.issuing_state ?? "";
            const expiryDate: string = idVerif.expiration_date ?? "";
            const issueDate: string = idVerif.date_of_issue ?? "";

            globalState.userController.user = {
                name: capitalize(fullName),
                "Date of Birth": dob ? new Date(dob).toDateString() : "",
                "ID submitted":
                    [docType, country].filter(Boolean).join(" - ") ||
                    "Verified",
                "Document Number": docNumber,
            };
            globalState.userController.document = {
                "Valid From": issueDate
                    ? new Date(issueDate).toDateString()
                    : "",
                "Valid Until": expiryDate
                    ? new Date(expiryDate).toDateString()
                    : "",
                "Verified On": new Date().toDateString(),
            };
            globalState.userController.isFake = false;
        }

        onupgraded?.();
        resetKyc();
    } catch (err: unknown) {
        console.error("[KYC] Upgrade failed:", err);
        const body: UpgradeErrorBody | undefined = axios.isAxiosError(err)
            ? (err.response?.data as UpgradeErrorBody | undefined)
            : undefined;
        if (body?.duplicate) {
            duplicateEName = body.existingW3id ?? null;
            kycStep = "duplicate";
        } else {
            kycError =
                body?.message ??
                (err instanceof Error
                    ? err.message
                    : "Upgrade failed. Please try again.");
            kycStep = "result";
            setTimeout(() => {
                kycError = null;
            }, 6000);
        }
    }
}
</script>

{#if kycStep !== "idle"}
    {#if kycStep === "checking-hw" || kycStep === "hw-error" || kycStep === "starting" || kycStep === "start-error" || kycStep === "upgrading"}
        <div class="fixed inset-0 z-50 bg-white overflow-y-auto">
            <div
                class="min-h-full flex flex-col p-6"
                style="padding-top: max(24px, env(safe-area-inset-top));"
            >
                <article class="grow flex flex-col items-start w-full">
                    <img
                        src="/images/GetStarted.svg"
                        alt="get-started"
                        class="w-full mb-4"
                    />

                    {#if kycError}
                        <div
                            class="bg-[#ff3300] rounded-md p-2 w-full text-center text-white mb-4"
                        >
                            {kycError}
                        </div>
                    {/if}

                    {#if kycStep === "checking-hw" || kycStep === "starting" || kycStep === "upgrading"}
                        <div
                            class="w-full py-20 flex flex-col items-center justify-center gap-6"
                        >
                            <Shadow size={40} color="rgb(142, 82, 255)" />
                            <h4 class="text-center">
                                {kycStep === "checking-hw"
                                    ? "Checking device capabilities..."
                                    : kycStep === "upgrading"
                                      ? "Upgrading your eVault…"
                                      : "Starting verification…"}
                            </h4>
                        </div>
                    {:else if kycStep === "hw-error"}
                        <h4 class="mt-2 mb-2 text-red-600 text-left">
                            Hardware Security Not Available
                        </h4>
                        <p class="text-black-700 mb-4">
                            Your phone doesn't support hardware crypto keys,
                            which is a requirement for verified IDs.
                        </p>
                        <p class="text-black-700">
                            Hardware-backed identity verification is not
                            available on this device.
                        </p>
                    {:else if kycStep === "start-error"}
                        <h4 class="mt-2 mb-2 text-red-600 text-left">
                            Couldn't start verification
                        </h4>
                        <p class="text-black-700 mb-4 wrap-break-word">
                            {kycError ??
                                "Failed to start verification. Please try again."}
                        </p>
                    {/if}
                </article>

                {#if kycStep === "hw-error"}
                    <div class="flex-none pt-8 pb-12">
                        <Button.Action
                            variant="soft"
                            class="w-full"
                            callback={resetKyc}
                        >
                            Cancel
                        </Button.Action>
                    </div>
                {:else if kycStep === "start-error"}
                    <div class="flex-none pt-8 pb-12 flex flex-col gap-3">
                        <Button.Action
                            class="w-full"
                            callback={startKycUpgrade}
                        >
                            Try Again
                        </Button.Action>
                        <Button.Action
                            variant="soft"
                            class="w-full"
                            callback={resetKyc}
                        >
                            Cancel
                        </Button.Action>
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    {#if kycStep === "verifying"}
        <div
            class="fixed inset-0 z-50 bg-white flex flex-col"
            style="padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(24px, env(safe-area-inset-bottom));"
        >
            <div class="flex-none flex justify-end px-4 pt-2">
                <button
                    class="text-sm text-black-500 underline"
                    onclick={resetKyc}
                >
                    Cancel
                </button>
            </div>
            <div id="didit-container-home" class="flex-1 w-full"></div>
        </div>
    {/if}

    {#if kycStep === "duplicate"}
        <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
        <div
            class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
            style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
        >
            <div class="flex items-center gap-3">
                <div
                    class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-lg font-bold"
                >
                    !
                </div>
                <h3 class="text-lg font-bold">Identity Already Registered</h3>
            </div>
            <p class="text-black-700 text-sm leading-relaxed">
                This identity document is already linked to an existing eVault.
                You can't create a duplicate — each person gets one verified
                eVault.
            </p>
            {#if duplicateEName}
                <div class="rounded-xl bg-gray-50 border border-gray-200 p-4">
                    <p class="text-xs text-black-500 mb-1">
                        Your existing eVault eName
                    </p>
                    <p
                        class="font-mono text-sm font-medium text-black-900 break-all"
                    >
                        {duplicateEName}
                    </p>
                </div>
                <p class="text-sm text-black-500">
                    Use the eName above to recover access to your existing
                    eVault instead.
                </p>
            {/if}
            <div class="flex flex-col gap-3 pt-2">
                <Button.Action
                    variant="soft"
                    class="w-full"
                    callback={resetKyc}
                >
                    Got it
                </Button.Action>
            </div>
        </div>
    {/if}

    {#if kycStep === "result"}
        <div class="fixed inset-0 z-40 bg-black/40" aria-hidden="true"></div>
        <div
            class="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-xl flex flex-col gap-4"
            style="padding: 1.5rem 1.5rem max(1.5rem, env(safe-area-inset-bottom));"
        >
            {#if kycError}
                <div
                    class="bg-[#ff3300] rounded-md p-2 w-full text-center text-white text-sm"
                >
                    {kycError}
                </div>
            {/if}

            {#if diditResult === "approved"}
                <div class="flex items-center gap-3">
                    <div
                        class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-lg font-bold"
                    >
                        ✓
                    </div>
                    <h3 class="text-lg font-bold">Identity Verified</h3>
                </div>
                <p class="text-black-700 text-sm">
                    Your identity has been verified. Your eVault trust level
                    will now be upgraded.
                </p>
                <div class="flex flex-col gap-3 pt-2">
                    <Button.Action class="w-full" callback={handleUpgrade}>
                        Continue
                    </Button.Action>
                </div>
            {:else if diditResult === "in_review"}
                <div class="flex items-center gap-3">
                    <div
                        class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-lg font-bold"
                    >
                        ⏳
                    </div>
                    <h3 class="text-lg font-bold">Under Review</h3>
                </div>
                <p class="text-black-700 text-sm">
                    Your verification is being manually reviewed. You'll be
                    notified when it's complete.
                </p>
                <div class="flex flex-col gap-3 pt-2">
                    <Button.Action
                        variant="soft"
                        class="w-full"
                        callback={resetKyc}
                    >
                        Close
                    </Button.Action>
                </div>
            {:else}
                <div class="flex items-center gap-3">
                    <div
                        class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-lg font-bold"
                    >
                        ✗
                    </div>
                    <h3 class="text-lg font-bold">Verification Failed</h3>
                </div>
                <p class="text-black-700 text-sm">
                    {diditRejectionReason ??
                        "Your verification could not be completed."}
                </p>
                <div class="flex flex-col gap-3 pt-2">
                    <Button.Action class="w-full" callback={startKycUpgrade}>
                        Try Again
                    </Button.Action>
                    <Button.Action
                        variant="soft"
                        class="w-full"
                        callback={resetKyc}
                    >
                        Cancel
                    </Button.Action>
                </div>
            {/if}
        </div>
    {/if}
{/if}
