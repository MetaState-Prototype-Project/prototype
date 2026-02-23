<script lang="ts">
    import { goto } from "$app/navigation";
    import {
        PUBLIC_PROVISIONER_URL,
        PUBLIC_REGISTRY_URL,
    } from "$env/static/public";
    import { Hero } from "$lib/fragments";
    import { GlobalState } from "$lib/global";
    import { ButtonAction } from "$lib/ui";
    import { capitalize } from "$lib/utils";
    import axios from "axios";
    import { getContext, onDestroy, onMount } from "svelte";
    import { Shadow } from "svelte-loading-spinners";
    import { v4 as uuidv4 } from "uuid";
    import { provision } from "wallet-sdk";

    type VerifStatus =
        | "idle"
        | "pending"
        | "approved"
        | "declined"
        | "duplicate"
        | "in_review";

    let globalState: GlobalState | undefined = $state(undefined);
    let status = $state<VerifStatus>("idle");
    let reason = $state<string>("");
    let loading = $state(false);
    let error = $state<string | null>(null);

    let showResultModal = $state(false);
    let hardwareKeySupported = $state(false);
    let hardwareKeyCheckComplete = $state(false);
    let verificationId = $state<string | null>(null);
    let websocketData = $state<{ w3id?: string } | null>(null);
    let showEmbeddedVerification = $state(false);

    // Person/document data from SSE
    let personData = $state<{
        firstName: string;
        lastName: string;
        dateOfBirth: string;
    } | null>(null);
    let documentData = $state<{
        type: string;
        country: string;
        number: string;
        validFrom: string;
        validUntil: string;
    } | null>(null);

    const KEY_ID = "default";

    let eventSource: EventSource | null = null;

    function watchEventStream(id: string) {
        const sseUrl = new URL(
            `/verification/sessions/${id}`,
            PUBLIC_PROVISIONER_URL,
        ).toString();
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => console.log("SSE connected");

        eventSource.onmessage = (e) => {
            const data = JSON.parse(e.data as string);
            console.log("[SSE]", data);
            if (!data.status) return;

            status = data.status as VerifStatus;
            reason = data.reason ?? "";
            websocketData = data;

            if (data.person) {
                personData = {
                    firstName: data.person.firstName?.value ?? "",
                    lastName: data.person.lastName?.value ?? "",
                    dateOfBirth: data.person.dateOfBirth?.value ?? "",
                };
            }
            if (data.document) {
                documentData = {
                    type: data.document.type?.value ?? "",
                    country: data.document.country?.value ?? "",
                    number: data.document.number?.value ?? "",
                    validFrom: data.document.validFrom?.value ?? "",
                    validUntil: data.document.validUntil?.value ?? "",
                };
            }

            showEmbeddedVerification = false;
            showResultModal = true;
        };

        eventSource.onerror = (err) => {
            console.error("SSE error:", err);
            eventSource?.close();
        };
    }

    function closeEventStream() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    }

    async function checkHardwareKeySupport() {
        try {
            if (!globalState) throw new Error("Global state not defined");
            hardwareKeySupported =
                await globalState.keyService.isHardwareAvailable();
        } catch {
            hardwareKeySupported = false;
        } finally {
            hardwareKeyCheckComplete = true;
        }
    }

    async function handleVerification() {
        if (!globalState) return;
        error = null;

        try {
            await globalState.walletSdkAdapter.ensureKey(KEY_ID, "onboarding");
        } catch (keyError) {
            console.error("Failed to ensure key:", keyError);
            await goto("/onboarding");
            return;
        }

        try {
            const { data } = await axios.post(
                new URL("/verification", PUBLIC_PROVISIONER_URL).toString(),
            );
            console.log("[Didit] session response:", data);

            if (!data.verificationUrl) {
                throw new Error(
                    `Backend did not return a verificationUrl. Response: ${JSON.stringify(data)}`,
                );
            }

            verificationId = data.id;
            watchEventStream(data.id);

            showEmbeddedVerification = true;
            // Wait a tick for the container div to be mounted in the DOM
            await new Promise((r) => setTimeout(r, 50));

            const { DiditSdk } = await import("@didit-protocol/sdk-web");
            const sdk = DiditSdk.shared;
            sdk.onComplete = (result) => {
                console.log(
                    "[Didit] Verification completed:",
                    result.type,
                    result.session?.status,
                );
                if (result.type === "cancelled") {
                    showEmbeddedVerification = false;
                } else if (result.error) {
                    console.error("[Didit] SDK error:", result.error.message);
                    error = result.error.message ?? "Verification error";
                    showEmbeddedVerification = false;
                }
                console.log(result);
                showEmbeddedVerification = false;
            };

            await sdk.startVerification({
                url: data.verificationUrl,
                configuration: {
                    embedded: true,
                    embeddedContainerId: "didit-container",
                },
            });
        } catch (err) {
            console.error("Failed to start Didit verification:", err);
            error = "Failed to start verification. Please try again.";
        }
    }

    const handleContinue = async () => {
        if (status !== "approved" && status !== "duplicate") return;
        if (!globalState) throw new Error("Global state not defined");

        loading = true;

        if (personData) {
            globalState.userController.user = {
                name: capitalize(
                    `${personData.firstName} ${personData.lastName}`,
                ),
                "Date of Birth": personData.dateOfBirth
                    ? new Date(personData.dateOfBirth).toDateString()
                    : "",
                "ID submitted": documentData
                    ? documentData.type === "passport"
                        ? `Passport - ${documentData.country}`
                        : documentData.type === "drivers_license"
                          ? `Driving License - ${documentData.country}`
                          : `ID Card - ${documentData.country}`
                    : "Verified",
                "Document Number": documentData?.number ?? "",
            };
            globalState.userController.document = {
                "Valid From": documentData?.validFrom
                    ? new Date(documentData.validFrom).toDateString()
                    : "",
                "Valid Until": documentData?.validUntil
                    ? new Date(documentData.validUntil).toDateString()
                    : "",
                "Verified On": new Date().toDateString(),
            };
        }
        globalState.userController.isFake = false;

        setTimeout(() => {
            goto("/register");
        }, 10_000);
    };

    onMount(async () => {
        globalState = getContext<() => GlobalState>("globalState")();
        await checkHardwareKeySupport();
        if (!hardwareKeySupported) {
            await goto("/onboarding");
            return;
        }
        try {
            await globalState.walletSdkAdapter.ensureKey(KEY_ID, "onboarding");
        } catch {
            await goto("/onboarding");
        }
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
                Get any ID ready. You'll be guided through a quick identity
                verification — no app download required.
            {/snippet}
        </Hero>
        <img
            class="mx-auto mt-10 w-[70vw]"
            src="images/Passport.svg"
            alt="passport"
        />
    </section>

    <div class="grow"></div>

    {#if error}
        <div
            class="w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center"
        >
            {error}
        </div>
    {/if}

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
</main>

<!-- Embedded Didit verification — full screen with safe-area padding -->
{#if showEmbeddedVerification && !showResultModal}
    <div
        class="fixed inset-0 z-50 bg-white flex flex-col"
        style="padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(24px, env(safe-area-inset-bottom));"
    >
        <div class="flex-none flex justify-end px-4 pt-2">
            <button
                class="text-sm text-black-500 underline"
                onclick={() => {
                    showEmbeddedVerification = false;
                    closeEventStream();
                }}
            >
                Cancel
            </button>
        </div>
        <div id="didit-container" class="flex-1 w-full"></div>
    </div>
{/if}

<!-- Result modal — shown when SSE delivers the verification outcome -->
{#if showResultModal}
    <div
        role="dialog"
        aria-modal="true"
        class="fixed inset-0 z-50 bg-white flex flex-col h-full"
    >
        <div class="grow overflow-y-auto px-[5vw] pt-[8svh]">
            {#if loading}
                <div
                    class="my-20 flex flex-col items-center justify-center gap-6"
                >
                    <Shadow size={40} color="rgb(142, 82, 255)" />
                    <h3>Generating your eName</h3>
                </div>
            {:else}
                <div class="flex flex-col gap-6">
                    {#if status === "approved"}
                        <h3>Verification Success</h3>
                        <p>You can now continue to create your eName.</p>
                    {:else if status === "duplicate"}
                        <h3>Old eVault Found</h3>
                        <p>
                            We found an existing eVault associated with your
                            identity.
                        </p>
                    {:else if status === "in_review"}
                        <h3>Under Review</h3>
                        <p>
                            Your verification is being reviewed. You'll be
                            notified when it's complete.
                        </p>
                    {:else}
                        <h3>Verification Failed</h3>
                        <p>{reason}</p>
                    {/if}
                </div>
            {/if}
        </div>

        <div class="flex-none px-[5vw] pb-[8svh] pt-4">
            {#if !loading}
                <div class="flex flex-col w-full gap-3">
                    {#if status === "approved" || status === "duplicate"}
                        <ButtonAction class="w-full" callback={handleContinue}>
                            {status === "duplicate"
                                ? "Claim Vault"
                                : "Continue"}
                        </ButtonAction>
                    {/if}
                    <ButtonAction
                        variant="soft"
                        class="w-full"
                        callback={() => {
                            closeEventStream();
                            showResultModal = false;
                            status = "idle";
                        }}
                    >
                        {status === "approved" || status === "duplicate"
                            ? "Back"
                            : "Try Again"}
                    </ButtonAction>
                </div>
            {/if}
        </div>
    </div>
{/if}
