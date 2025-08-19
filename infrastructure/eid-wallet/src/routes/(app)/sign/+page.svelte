<script lang="ts">
    import { goto } from "$app/navigation";
    import AppNav from "$lib/fragments/AppNav/AppNav.svelte";
    import type { GlobalState } from "$lib/global";
    import { Drawer } from "$lib/ui";
    import * as Button from "$lib/ui/Button";
    import { exists, signPayload } from "@auvo/tauri-plugin-crypto-hw-api";
    import { getContext, onMount } from "svelte";

    const globalState = getContext<() => GlobalState>("globalState")();

    interface SigningData {
        session: string;
        data: string;
        redirect_uri: string;
    }

    let signingData: SigningData | null = $state(null);
    let decodedData: {
        // Generic signature request
        message?: string;
        sessionId?: string;
        // Poll-specific request (keep existing functionality)
        pollId?: string;
        voteData?: {
            optionId?: number;
            ranks?: Record<string, number>;
        };
        userId?: string;
    } | null = $state(null);
    let signingStatus: "pending" | "signing" | "success" | "error" =
        $state("pending");
    let errorMessage = $state("");

    onMount(() => {
        // Get signing data from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const session = urlParams.get("session");
        const data = urlParams.get("data");
        const redirect_uri = urlParams.get("redirect_uri");

        if (!session || !data || !redirect_uri) {
            errorMessage =
                "Invalid signing request. Missing required parameters.";
            signingStatus = "error";
            return;
        }

        try {
            // Decode base64 data
            const decodedString = atob(data);
            decodedData = JSON.parse(decodedString);

            // Simple debug logging
            console.log("🔍 DEBUG: Decoded data received!");
            console.log("🔍 DEBUG: Raw decoded string:", decodedString);
            console.log("🔍 DEBUG: Parsed data:", decodedData);
            console.log("🔍 DEBUG: Data keys:", Object.keys(decodedData || {}));

            signingData = { session, data, redirect_uri };
            signingStatus = "pending";
        } catch (error) {
            console.error("Error decoding signing data:", error);
            errorMessage = "Invalid signing data format.";
            signingStatus = "error";
        }
    });

    async function handleSign() {
        if (!signingData || !decodedData) return;

        try {
            signingStatus = "signing";

            // Get the vault for signing
            const vault = await globalState.vaultController.vault;
            if (!vault) {
                throw new Error("No vault available for signing");
            }

            // Create the message to sign based on type
            let messageToSign: string;

            if (decodedData.pollId && decodedData.voteData) {
                // Poll-specific signing
                messageToSign = JSON.stringify({
                    pollId: decodedData.pollId,
                    voteData: decodedData.voteData,
                    userId: decodedData.userId,
                    timestamp: Date.now(),
                });
            } else {
                // Generic signature request
                messageToSign = JSON.stringify({
                    message: decodedData.message,
                    sessionId: decodedData.sessionId,
                    timestamp: Date.now(),
                });
            }

            // In a real implementation, you would use the vault's signing capabilities
            // For now, we'll simulate the signing process
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate signing delay

            // check if default key pair exists
            const keyExists = exists("default");

            if (!keyExists) {
                // this would only indicate that it is an old evault/wallet
                // ask them to delete and make a new one maybe or some fallback
                // behaviour if we need it
                throw new Error("Default key pair does not exist");
            }

            // Create the signed payload
            const signedPayload: {
                sessionId: string;
                publicKey: string; // Use eName as public key for now
                message: string;
                signature?: string;
            } = {
                sessionId: signingData.session,
                publicKey: vault.ename, // Use eName as public key for now
                message: messageToSign,
            };

            const signature = await signPayload(
                "default",
                JSON.stringify(signedPayload),
            );

            signedPayload.signature = signature;

            // Send the signed payload to the redirect URI
            const response = await fetch(signingData.redirect_uri, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(signedPayload),
            });

            if (!response.ok) {
                throw new Error("Failed to submit signed payload");
            }

            signingStatus = "success";

            // Redirect back to the main app after a short delay
            setTimeout(() => {
                goto("/main");
            }, 3000);
        } catch (error) {
            console.error("Error during signing:", error);
            errorMessage =
                error instanceof Error ? error.message : "Signing failed";
            signingStatus = "error";
        }
    }

    function handleCancel() {
        goto("/main");
    }

    function handleRetry() {
        signingStatus = "pending";
        errorMessage = "";
    }
</script>

<AppNav title="Sign Message" titleClasses="text-white" iconColor="white" />

<div
    class="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4"
>
    <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        {#if signingStatus === "pending" && signingData && decodedData}
            <!-- Signing Request -->
            <div class="text-center space-y-6">
                <div
                    class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto"
                >
                    <span class="text-4xl">📝</span>
                </div>

                <div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-2">
                        {decodedData.pollId ? "Sign Your Vote" : "Sign Message"}
                    </h2>
                    <p class="text-gray-600">
                        {decodedData.pollId
                            ? "You're about to sign a vote for the following poll:"
                            : "You're about to sign the following message:"}
                    </p>
                </div>

                {#if decodedData.pollId && decodedData.voteData}
                    <!-- Poll Details -->
                    <div class="bg-gray-50 rounded-lg p-4 text-left">
                        <h3 class="font-semibold text-gray-900 mb-2">
                            Poll Details
                        </h3>
                        <div class="space-y-2 text-sm text-gray-600">
                            <div>
                                <span class="font-medium">Poll ID:</span>
                                {decodedData.pollId?.slice(0, 8)}...
                            </div>
                            <div>
                                <span class="font-medium">Voting Mode:</span>
                                {decodedData.voteData?.optionId
                                    ? "Single Choice"
                                    : "Ranked Choice"}
                            </div>
                            {#if decodedData.voteData?.optionId}
                                <div>
                                    <span class="font-medium"
                                        >Selected Option:</span
                                    >
                                    Option {decodedData.voteData.optionId + 1}
                                </div>
                            {:else if decodedData.voteData?.ranks}
                                <div>
                                    <span class="font-medium">Rankings:</span>
                                    <div class="ml-2 space-y-1">
                                        {#each Object.entries(decodedData.voteData.ranks) as [rank, optionIndex]}
                                            <div>
                                                {rank === "1"
                                                    ? "1st"
                                                    : rank === "2"
                                                      ? "2nd"
                                                      : "3rd"}: Option {(optionIndex as number) +
                                                    1}
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                {:else}
                    <!-- Generic Message Details -->
                    <div class="bg-gray-50 rounded-lg p-4 text-left">
                        <h3 class="font-semibold text-gray-900 mb-2">
                            Message Details
                        </h3>
                        <div class="space-y-2 text-sm text-gray-600">
                            <div>
                                <span class="font-medium">Message:</span>
                                <p class="mt-1 text-gray-700">
                                    {decodedData.message}
                                </p>
                            </div>
                            <div>
                                <span class="font-medium">Session ID:</span>
                                <p class="mt-1 font-mono text-gray-700">
                                    {decodedData.sessionId?.slice(0, 8)}...
                                </p>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Security Notice -->
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div class="flex items-start space-x-3">
                        <span class="text-blue-600 text-lg">🛡️</span>
                        <div class="text-sm text-blue-800">
                            <p class="font-medium mb-1">Security Notice</p>
                            <p>
                                {decodedData.pollId
                                    ? "By signing this message, you're confirming your vote. This action cannot be undone."
                                    : "By signing this message, you're confirming your agreement to the content. This action cannot be undone."}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex space-x-3">
                    <Button.Action
                        variant="danger-soft"
                        callback={handleCancel}
                        class="flex-1"
                    >
                        Cancel
                    </Button.Action>
                    <Button.Action
                        variant="solid"
                        callback={handleSign}
                        class="flex-1"
                    >
                        {decodedData.pollId ? "Sign Vote" : "Sign Message"}
                    </Button.Action>
                </div>
            </div>
        {:else if signingStatus === "signing"}
            <!-- Signing in Progress -->
            <div class="text-center space-y-6">
                <div
                    class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto animate-pulse"
                >
                    <span class="text-4xl">⏰</span>
                </div>

                <div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-2">
                        {decodedData?.pollId
                            ? "Signing Your Vote"
                            : "Signing Your Message"}
                    </h2>
                    <p class="text-gray-600">
                        Please wait while we process your signature...
                    </p>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div class="flex items-center space-x-3">
                        <div
                            class="w-3 h-3 bg-blue-600 rounded-full animate-pulse"
                        ></div>
                        <span class="text-sm text-blue-800"
                            >Processing signature...</span
                        >
                    </div>
                </div>
            </div>
        {:else if signingStatus === "success"}
            <!-- Signing Success -->
            <div class="text-center space-y-6">
                <div
                    class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto"
                >
                    <span class="text-4xl">✅</span>
                </div>

                <div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-2">
                        {decodedData?.pollId
                            ? "Vote Signed Successfully!"
                            : "Message Signed Successfully!"}
                    </h2>
                    <p class="text-gray-600">
                        {decodedData?.pollId
                            ? "Your vote has been signed and submitted to the voting system."
                            : "Your message has been signed and submitted successfully."}
                    </p>
                </div>

                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div class="flex items-center space-x-3">
                        <span class="text-green-600 text-lg">✅</span>
                        <span class="text-sm text-green-800"
                            >Signature verified and vote submitted</span
                        >
                    </div>
                </div>

                <p class="text-sm text-gray-500">Redirecting to main app...</p>
            </div>
        {:else if signingStatus === "error"}
            <!-- Signing Error -->
            <div class="text-center space-y-6">
                <div
                    class="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto"
                >
                    <span class="text-4xl">❌</span>
                </div>

                <div>
                    <h2 class="text-2xl font-bold text-gray-900 mb-2">
                        Signing Failed
                    </h2>
                    <p class="text-gray-600">{errorMessage}</p>
                </div>

                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="flex items-center space-x-3">
                        <span class="text-red-600 text-lg">⚠️</span>
                        <span class="text-sm text-red-800"
                            >Unable to complete signing process</span
                        >
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex space-x-3">
                    <Button.Action
                        variant="soft"
                        callback={handleCancel}
                        class="flex-1"
                    >
                        Go Back
                    </Button.Action>
                    <Button.Action
                        variant="solid"
                        callback={handleRetry}
                        class="flex-1"
                    >
                        Try Again
                    </Button.Action>
                </div>
            </div>
        {/if}
    </div>
</div>
