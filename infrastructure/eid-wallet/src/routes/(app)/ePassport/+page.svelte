<script lang="ts">
    import {
        PUBLIC_EID_WALLET_TOKEN,
        PUBLIC_PROVISIONER_URL,
        PUBLIC_PROVISIONER_SHARED_SECRET,
    } from "$env/static/public";
    import { AppNav, IdentityCard } from "$lib/fragments";
    import type { GlobalState } from "$lib/global";
    import { capitalize } from "$lib/utils";
    import { ButtonAction } from "$lib/ui";
    import axios from "axios";
    import { getContext, onMount } from "svelte";
    import { Shadow } from "svelte-loading-spinners";

    const globalState = getContext<() => GlobalState>("globalState")();

    let userData = $state<
        Record<string, string | boolean | undefined> | undefined
    >(undefined);
    let docData = $state<Record<string, unknown>>({});
    let hasOnlySelfDocs = $state(false);
    let missingProvisionerDocs = $state(false);
    let bindingDocsLoaded = $state(false);

    // ── Inline KYC upgrade state ──────────────────────────────────────────────────
    type KycStep =
        | "idle"
        | "checking-hw"
        | "hw-error"
        | "starting"
        | "verifying"
        | "result"
        | "upgrading"
        | "duplicate";

    let kycStep = $state<KycStep>("idle");
    let kycError = $state<string | null>(null);
    let diditActualSessionId = $state<string | null>(null);
    let diditDecision = $state<any>(null);
    let diditResult = $state<"approved" | "declined" | "in_review" | null>(
        null,
    );
    let diditRejectionReason = $state<string | null>(null);
    let duplicateEName = $state<string | null>(null);
    // ─────────────────────────────────────────────────────────────────────────────

    async function loadBindingDocuments(): Promise<void> {
        const vault = await globalState.vaultController.vault;
        if (!vault?.uri || !vault?.ename) {
            bindingDocsLoaded = true;
            return;
        }

        const ename = vault.ename.startsWith("@")
            ? vault.ename
            : `@${vault.ename}`;
        const gqlUrl = new URL("/graphql", vault.uri).toString();

        try {
            const res = await fetch(gqlUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-ENAME": ename,
                    ...(PUBLIC_EID_WALLET_TOKEN
                        ? { Authorization: `Bearer ${PUBLIC_EID_WALLET_TOKEN}` }
                        : {}),
                },
                body: JSON.stringify({
                    query: `query {
                    bindingDocuments(first: 50) {
                        edges {
                            node {
                                parsed
                            }
                        }
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
            console.warn("[ePassport] Failed to load binding documents:", err);
        } finally {
            bindingDocsLoaded = true;
        }
    }

    // ── KYC upgrade functions ─────────────────────────────────────────────────────

    function resetKyc() {
        kycStep = "idle";
        kycError = null;
        diditActualSessionId = null;
        diditDecision = null;
        diditResult = null;
        diditRejectionReason = null;
        duplicateEName = null;
    }

    async function startKycUpgrade() {
        kycError = null;
        kycStep = "checking-hw";

        const hardwareAvailable = await globalState.keyService.probeHardware();
        if (!hardwareAvailable) {
            kycStep = "hw-error";
            return;
        }

        kycStep = "starting";
        try {
            await globalState.walletSdkAdapter.ensureKey(
                "default",
                "onboarding",
            );

            const { data } = await axios.post(
                new URL("/verification", PUBLIC_PROVISIONER_URL).toString(),
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
                    embeddedContainerId: "didit-container-epassport",
                },
            });
        } catch (err) {
            console.error("[KYC] Failed to start:", err);
            kycError =
                err instanceof Error
                    ? err.message
                    : "Failed to start verification. Please try again.";
            kycStep = "idle";
            setTimeout(() => {
                kycError = null;
            }, 6000);
        }
    }

    const handleDiditComplete = async (result: any) => {
        if (result.type === "cancelled") {
            resetKyc();
            return;
        }

        if (!result.session?.sessionId) {
            resetKyc();
            kycError = "Verification did not return a session ID.";
            return;
        }

        diditActualSessionId = result.session.sessionId;
        kycStep = "starting";

        try {
            const { data: decision } = await axios.get(
                new URL(
                    `/verification/decision/${result.session.sessionId}`,
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
            resetKyc();
            kycError =
                "Failed to retrieve verification result. Please try again.";
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
                    "/verification/upgrade",
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

            // Update local ePassport data from the verified Didit decision
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

                // Refresh local state so card re-renders immediately
                const userInfo = await globalState.userController.user;
                userData = { ...userInfo, isFake: false };
                docData = {
                    "Valid From": issueDate
                        ? new Date(issueDate).toDateString()
                        : "",
                    "Valid Until": expiryDate
                        ? new Date(expiryDate).toDateString()
                        : "",
                    "Verified On": new Date().toDateString(),
                };
            }

            resetKyc();
            // Refresh binding docs so amber box disappears
            bindingDocsLoaded = false;
            hasOnlySelfDocs = false;
            missingProvisionerDocs = false;
            await loadBindingDocuments();
        } catch (err: any) {
            console.error("[KYC] Upgrade failed:", err);
            const body = err?.response?.data;
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

    // ─────────────────────────────────────────────────────────────────────────────

    onMount(async () => {
        const userInfo = await globalState.userController.user;
        const isFake = await globalState.userController.isFake;
        docData = (await globalState.userController.document) ?? {};
        userData = { ...userInfo, isFake };

        await loadBindingDocuments();
    });
</script>

<AppNav title="ePassport" class="mb-8" />

<div>
    {#if userData}
        <IdentityCard variant="ePassport" {userData} class="shadow-lg" />
    {/if}
    {#if docData}
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

    {#if bindingDocsLoaded && (hasOnlySelfDocs || missingProvisionerDocs)}
        <div class="mt-6 px-1">
            {#if missingProvisionerDocs}
                <div
                    class="mb-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl"
                >
                    <p class="text-sm font-medium text-emerald-800 mb-1">
                        Upgrade available
                    </p>
                    <p class="text-sm text-emerald-700 leading-relaxed">
                        Your identity is verified locally but your eVault is
                        missing the binding documents to prove it. Add them now
                        to unlock the full trust level.
                    </p>
                </div>
                <ButtonAction class="w-full" callback={startKycUpgrade}>
                    Add Binding Documents
                </ButtonAction>
            {:else}
                <div
                    class="mb-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                >
                    <p class="text-sm text-amber-800 leading-relaxed">
                        Your eVault only contains a self-declared binding
                        document. Verify your identity to increase your trust
                        level.
                    </p>
                </div>
                <ButtonAction class="w-full" callback={startKycUpgrade}>
                    Enhance Trust Level
                </ButtonAction>
            {/if}
        </div>
    {/if}
</div>

<!-- ── KYC upgrade overlay ───────────────────────────────────────────────────── -->
{#if kycStep !== "idle"}
    {#if kycStep === "checking-hw" || kycStep === "hw-error" || kycStep === "starting" || kycStep === "upgrading"}
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
                    {/if}
                </article>

                {#if kycStep === "hw-error"}
                    <div class="flex-none pt-8 pb-12">
                        <ButtonAction
                            variant="soft"
                            class="w-full"
                            callback={resetKyc}
                        >
                            Cancel
                        </ButtonAction>
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
            <div id="didit-container-epassport" class="flex-1 w-full"></div>
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
                <ButtonAction variant="soft" class="w-full" callback={resetKyc}>
                    Got it
                </ButtonAction>
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
                    <ButtonAction class="w-full" callback={handleUpgrade}
                        >Continue</ButtonAction
                    >
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
                    <ButtonAction
                        variant="soft"
                        class="w-full"
                        callback={resetKyc}>Close</ButtonAction
                    >
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
                    <ButtonAction class="w-full" callback={startKycUpgrade}
                        >Try Again</ButtonAction
                    >
                    <ButtonAction
                        variant="soft"
                        class="w-full"
                        callback={resetKyc}>Cancel</ButtonAction
                    >
                </div>
            {/if}
        </div>
    {/if}
{/if}
