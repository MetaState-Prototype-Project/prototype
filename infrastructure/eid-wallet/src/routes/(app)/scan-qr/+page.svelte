<script lang="ts">
    import { goto } from "$app/navigation";
    import { PUBLIC_PROVISIONER_URL } from "$env/static/public";
    import AppNav from "$lib/fragments/AppNav/AppNav.svelte";
    import type { GlobalState } from "$lib/global";
    import { Drawer } from "$lib/ui";
    import * as Button from "$lib/ui/Button";
    import { QrCodeIcon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import {
        Format,
        type PermissionState,
        type Scanned,
        cancel,
        checkPermissions,
        requestPermissions,
        scan,
    } from "@tauri-apps/plugin-barcode-scanner";
    import {
        exists,
        generate,
        getPublicKey,
        signPayload,
        // verifySignature
    } from "@auvo/tauri-plugin-crypto-hw-api";
    import axios from "axios";
    import { getContext, onDestroy, onMount } from "svelte";
    import type { SVGAttributes } from "svelte/elements";

    const globalState = getContext<() => GlobalState>("globalState")();
    const pathProps: SVGAttributes<SVGPathElement> = {
        stroke: "white",
        "stroke-width": 7,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
    };

    let platform = $state();
    let hostname = $state();
    let session = $state();
    let codeScannedDrawerOpen = $state(false);
    let loggedInDrawerOpen = $state(false);
    let signingDrawerOpen = $state(false);
    let scannedData: Scanned | undefined = $state(undefined);
    let scanning = false;
    let loading = false;
    let redirect = $state<string | null>();
    let permissions_nullable: PermissionState | null;

    // Signing specific state
    let signingSessionId = $state<string | null>(null);
    let signingData = $state<any>(null);
    let isSigningRequest = $state(false);
    let showSigningSuccess = $state(false);

    // Blind voting specific state
    let isBlindVotingRequest = $state(false);
    let selectedBlindVoteOption = $state<number | null>(null);
    let blindVoteError = $state<string | null>(null); // Add error state
    let isSubmittingBlindVote = $state(false); // Add loading state

    // Reveal vote specific state
    let isRevealRequest = $state(false);
    let revealPollId = $state<string | null>(null);
    let revealError = $state<string | null>(null);
    let isRevealingVote = $state(false);
    let revealSuccess = $state(false);
    let revealedVoteData = $state<any>(null);

    // Debug logging for selectedBlindVoteOption changes
    $effect(() => {
        console.log(
            "🔍 DEBUG: selectedBlindVoteOption changed to:",
            selectedBlindVoteOption,
        );
    });

    async function startScan() {
        let permissions = await checkPermissions()
            .then((permissions) => {
                return permissions;
            })
            .catch(() => {
                return null;
            });

        if (permissions === "prompt" || permissions === "denied") {
            permissions = await requestPermissions();
        }

        permissions_nullable = permissions;

        if (permissions === "granted") {
            const formats = [Format.QRCode];
            const windowed = true;
            if (scanning) return;
            scanning = true;
            scan({ formats, windowed })
                .then((res) => {
                    scannedData = res;

                    // Check if this is a signing request
                    if (res.content.startsWith("w3ds://sign")) {
                        handleSigningRequest(res.content);
                    } else if (res.content.startsWith("w3ds://reveal")) {
                        handleRevealRequest(res.content);
                    } else if (res.content.includes("/blind-vote")) {
                        // This is a blind voting request via HTTP URL
                        // Parse the URL and extract the data
                        try {
                            const url = new URL(res.content);
                            const sessionId = url.searchParams.get("session");
                            const base64Data = url.searchParams.get("data");
                            const redirectUri =
                                url.searchParams.get("redirect_uri");
                            const platformUrl =
                                url.searchParams.get("platform_url");

                            if (
                                sessionId &&
                                base64Data &&
                                redirectUri &&
                                platformUrl
                            ) {
                                // Decode the base64 data
                                const decodedString = atob(
                                    decodeURIComponent(base64Data),
                                );
                                const decodedData = JSON.parse(decodedString);

                                if (decodedData.type === "blind-vote") {
                                    console.log(
                                        "🔍 Detected blind voting request from HTTP URL",
                                    );
                                    // Call the existing function with the right parameters
                                    handleBlindVotingRequest(
                                        decodedData,
                                        platformUrl,
                                        redirectUri,
                                    );
                                    return;
                                }
                            }
                        } catch (error) {
                            console.error(
                                "Error parsing blind voting HTTP URL:",
                                error,
                            );
                        }
                        // If parsing fails, fall back to auth request
                        handleAuthRequest(res.content);
                    } else {
                        handleAuthRequest(res.content);
                    }
                })
                .catch((error) => {
                    console.error("Scan error:", error);
                })
                .finally(() => {
                    scanning = false;
                });
        }
    }

    async function handleAuth() {
        const vault = await globalState.vaultController.vault;
        if (!vault || !redirect) return;

        try {
            await axios.post(redirect, { ename: vault.ename, session });
            codeScannedDrawerOpen = false;

            // Check if this was from a deep link
            let deepLinkData = sessionStorage.getItem("deepLinkData");
            if (!deepLinkData) {
                // Also check for pending deep link data
                deepLinkData = sessionStorage.getItem("pendingDeepLink");
            }

            if (deepLinkData) {
                try {
                    const data = JSON.parse(deepLinkData);
                    console.log(
                        "Deep link data found after auth completion:",
                        data,
                    );

                    if (data.type === "auth") {
                        console.log(
                            "Auth completed via deep link, redirecting back to platform",
                        );
                        console.log("Redirect URL:", data.redirect);

                        // Validate the redirect URL
                        if (
                            !data.redirect ||
                            typeof data.redirect !== "string"
                        ) {
                            console.error(
                                "Invalid redirect URL:",
                                data.redirect,
                            );
                            loggedInDrawerOpen = true;
                            startScan();
                            return;
                        }

                        // Check if URL is valid
                        try {
                            new URL(data.redirect);
                            console.log("Redirect URL is valid");
                        } catch (urlError) {
                            console.error("Invalid URL format:", urlError);
                            loggedInDrawerOpen = true;
                            startScan();
                            return;
                        }

                        // Redirect back to the platform that initiated the request
                        try {
                            console.log(
                                "Attempting redirect to:",
                                data.redirect,
                            );

                            // Try multiple redirect methods for better compatibility
                            try {
                                // Method 1: Direct assignment
                                window.location.href = data.redirect;
                            } catch (error1) {
                                console.log(
                                    "Method 1 failed, trying method 2:",
                                    error1,
                                );

                                try {
                                    // Method 2: Using assign
                                    window.location.assign(data.redirect);
                                } catch (error2) {
                                    console.log(
                                        "Method 2 failed, trying method 3:",
                                        error2,
                                    );

                                    try {
                                        // Method 3: Using replace
                                        window.location.replace(data.redirect);
                                    } catch (error3) {
                                        console.log(
                                            "Method 3 failed, using fallback:",
                                            error3,
                                        );
                                        throw new Error(
                                            "All redirect methods failed",
                                        );
                                    }
                                }
                            }
                        } catch (error) {
                            console.error(
                                "All redirect methods failed, staying in app:",
                                error,
                            );
                            // If redirect fails, fall back to normal flow
                            loggedInDrawerOpen = true;
                            startScan();
                        }
                        return;
                    }
                } catch (error) {
                    console.error(
                        "Error parsing deep link data for redirect:",
                        error,
                    );
                }
            } else {
                console.log("No deep link data found after auth completion");
            }

            // Not from deep link, show normal success flow
            loggedInDrawerOpen = true;
            startScan();
        } catch (error) {
            console.error("Error completing authentication:", error);
            // Handle error appropriately
        }
    }

    async function cancelScan() {
        await cancel();
        scanning = false;
    }

    function handleAuthRequest(content: string) {
        const url = new URL(content);
        platform = url.searchParams.get("platform");
        const redirectUrl = new URL(url.searchParams.get("redirect") || "");
        redirect = url.searchParams.get("redirect");
        session = url.searchParams.get("session");
        hostname = redirectUrl.hostname;
        isSigningRequest = false;
        codeScannedDrawerOpen = true;
    }

    function handleSigningRequest(content: string) {
        try {
            // Parse w3ds://sign URI scheme
            // Format: w3ds://sign?session=<sessionId>&data=<base64Data>&redirect_uri=<redirectUri>&platform_url=<platformUrl>

            // Handle w3ds:// scheme by converting to a parseable format
            let parseableContent = content;
            if (content.startsWith("w3ds://")) {
                parseableContent = content.replace(
                    "w3ds://",
                    "https://dummy.com/",
                );
            }

            const url = new URL(parseableContent);
            signingSessionId = url.searchParams.get("session");
            const base64Data = url.searchParams.get("data");
            const redirectUri = url.searchParams.get("redirect_uri");
            const platformUrl = url.searchParams.get("platform_url");

            console.log("🔍 Parsed w3ds://sign URI:", {
                session: signingSessionId,
                data: base64Data,
                redirect_uri: redirectUri,
                platform_url: platformUrl,
            });

            console.log("🔍 Raw redirect_uri from QR:", redirectUri);
            console.log("🔍 Raw platform_url from QR:", platformUrl);

            if (!signingSessionId || !base64Data || !redirectUri) {
                console.error("Invalid signing request parameters:", {
                    signingSessionId,
                    base64Data,
                    redirectUri,
                });
                return;
            }

            // Store redirect_uri for later use
            redirect = redirectUri;

            // Decode the base64 data
            try {
                const decodedString = atob(base64Data);
                const decodedData = JSON.parse(decodedString);

                // Check if this is a blind voting request
                if (decodedData.type === "blind-vote") {
                    console.log("🔍 Detected blind voting request");
                    handleBlindVotingRequest(
                        decodedData,
                        platformUrl,
                        redirectUri,
                    );
                    return;
                }

                // Regular signing request
                signingData = decodedData;

                // Debug logging
                console.log("🔍 DEBUG: Decoded signing data:", signingData);
                console.log(
                    "🔍 DEBUG: Data keys:",
                    Object.keys(signingData || {}),
                );
                console.log(
                    "🔍 DEBUG: Is poll request?",
                    !!(signingData?.pollId && signingData?.voteData),
                );

                // Only set signing modal for regular signing requests (not blind voting)
                isSigningRequest = true;
                signingDrawerOpen = true;
            } catch (error) {
                console.error("Error decoding signing data:", error);
                return;
            }
        } catch (error) {
            console.error("Error parsing signing request:", error);
        }
    }

    function handleRevealRequest(content: string) {
        try {
            // Parse w3ds://reveal URI scheme
            // Format: w3ds://reveal?pollId=<pollId>

            // Handle w3ds:// scheme by converting to a parseable format
            let parseableContent = content;
            if (content.startsWith("w3ds://")) {
                parseableContent = content.replace(
                    "w3ds://",
                    "https://dummy.com/",
                );
            }

            const url = new URL(parseableContent);
            const pollId = url.searchParams.get("pollId");

            console.log("🔍 Parsed w3ds://reveal URI:", {
                pollId: pollId,
            });

            if (!pollId) {
                console.error("Invalid reveal request parameters:", {
                    pollId,
                });
                return;
            }

            revealPollId = pollId;
            isRevealRequest = true;
            // Don't open the code scanned drawer - we want the reveal drawer
            // codeScannedDrawerOpen = true;
        } catch (error) {
            console.error("Error parsing reveal request:", error);
        }
    }

    async function handleSignVote() {
        if (!signingData || !signingSessionId) return;

        try {
            loading = true;

            // Get the vault for signing
            const vault = await globalState.vaultController.vault;
            if (!vault) {
                throw new Error("No vault available for signing");
            }

            // Create the message to sign based on type
            let messageToSign: string;

            if (signingData.pollId && signingData.voteData) {
                // Poll-specific signing
                messageToSign = JSON.stringify({
                    pollId: signingData.pollId,
                    voteData: signingData.voteData,
                    userId: signingData.userId,
                    // Removed timestamp since backend doesn't verify it
                });
            } else {
                // Generic signature request
                messageToSign = JSON.stringify({
                    message: signingData.message,
                    sessionId: signingData.sessionId,
                    timestamp: Date.now(),
                });
            }

            // 🔐 REAL CRYPTOGRAPHIC SIGNING using Tauri crypto plugin
            console.log("🔐 Starting cryptographic signing process...");

            // Check if crypto hardware exists
            const cryptoExists = await exists("default");
            if (!cryptoExists) {
                throw new Error("Cryptographic hardware not available");
            }

            // Generate default key if it doesn't exist
            try {
                await generate("default");
                console.log("✅ Default key generated/verified");
            } catch (error) {
                console.log(
                    "Default key already exists or generation failed:",
                    error,
                );
            }

            // Get the public key
            const publicKey = await getPublicKey("default");
            console.log("🔑 Public key retrieved:", publicKey);

            // Sign the message payload
            console.log("✍️ Signing message:", messageToSign);
            const signature = await signPayload("default", messageToSign);
            console.log("✅ Message signed successfully");

            // Create the signed payload with real signature
            const signedPayload = {
                sessionId: signingSessionId,
                signature: signature,
                publicKey: vault?.ename || "unknown_public_key", // Use eName as public key
                message: messageToSign,
            };

            // Send the signed payload to the redirect URI
            if (!redirect) {
                throw new Error("No redirect URI available");
            }

            const response = await fetch(redirect, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(signedPayload),
            });

            if (!response.ok) {
                throw new Error("Failed to submit signed payload");
            }

            // Stop the camera and show success state in the drawer
            if (scanning) {
                cancelScan();
            }
            showSigningSuccess = true;

            console.log(
                signingData.pollId
                    ? "Vote signed successfully!"
                    : "Message signed successfully!",
            );

            // Check if this was from a deep link
            const deepLinkData = sessionStorage.getItem("deepLinkData");
            if (deepLinkData) {
                try {
                    const data = JSON.parse(deepLinkData);
                    if (data.type === "sign") {
                        console.log("Signing completed via deep link");
                        // For deep links, just continue scanning
                        startScan();
                        return;
                    }
                } catch (error) {
                    console.error("Error parsing deep link data:", error);
                }
            }

            // Not from deep link, show success state (drawer will handle the redirect)
        } catch (error) {
            console.error("Error signing vote:", error);
        } finally {
            loading = false;
        }
    }

    async function handleBlindVotingRequest(
        blindVoteData: any,
        platformUrl: string | null,
        redirectUri: string | null,
    ) {
        try {
            console.log("🔍 Handling blind voting request:", blindVoteData);
            console.log("🔗 Platform URL:", platformUrl);

            // Extract poll details from the blind vote data
            const pollId = blindVoteData.pollId;
            if (!pollId) {
                throw new Error("No poll ID provided in blind vote data");
            }

            // Fetch poll details from the platform
            const pollResponse = await fetch(
                `${platformUrl}/api/polls/${pollId}`,
            );
            if (!pollResponse.ok) {
                throw new Error("Failed to fetch poll details");
            }

            const pollDetails = await pollResponse.json();
            console.log("📊 Poll details:", pollDetails);

            // Store the data for the blind voting interface
            signingData = {
                pollId: pollId,
                pollDetails: pollDetails,
                redirect: redirectUri,
                sessionId: blindVoteData.sessionId,
                platform_url: platformUrl, // Add the platform URL for API calls
            };

            console.log("🔍 DEBUG: Stored signing data:", {
                pollId,
                redirect: redirectUri,
                platform_url: platformUrl,
            });

            // Set up blind voting state
            isBlindVotingRequest = true;
            selectedBlindVoteOption = null;
            signingDrawerOpen = true;
            blindVoteError = null; // Clear any previous errors

            console.log("✅ Blind voting request set up successfully");
            console.log("🔍 DEBUG: State after setup:");
            console.log("  - isBlindVotingRequest:", isBlindVotingRequest);
            console.log("  - signingDrawerOpen:", signingDrawerOpen);
            console.log("  - signingData:", signingData);
            console.log("  - signingData.pollId:", signingData?.pollId);
            console.log(
                "  - signingData.pollDetails:",
                !!signingData?.pollDetails,
            );
        } catch (error) {
            console.error("❌ Error handling blind voting request:", error);
        }
    }

    async function handleBlindVote() {
        console.log("🔍 DEBUG: handleBlindVote called");
        console.log(
            "🔍 DEBUG: selectedBlindVoteOption:",
            selectedBlindVoteOption,
        );
        console.log("🔍 DEBUG: signingData:", signingData);
        console.log("🔍 DEBUG: isBlindVotingRequest:", isBlindVotingRequest);

        // Clear any previous errors and start loading
        blindVoteError = null;
        isSubmittingBlindVote = true;

        if (selectedBlindVoteOption === null || !signingData) {
            const errorMsg = "No vote option selected or poll details missing";
            console.error("❌ Validation failed:", errorMsg);
            console.error(
                "❌ selectedBlindVoteOption:",
                selectedBlindVoteOption,
            );
            console.error(
                "❌ selectedBlindVoteOption === null:",
                selectedBlindVoteOption === null,
            );
            console.error("❌ signingData:", signingData);
            blindVoteError = errorMsg;
            isSubmittingBlindVote = false;
            return;
        }

        try {
            // Get the vault for user identification
            const vault = await globalState.vaultController.vault;
            if (!vault) {
                throw new Error("No vault available for blind voting");
            }

            // 🔐 Get the real public key for voter identification
            let voterPublicKey: string;
            try {
                const cryptoExists = await exists("default");
                if (!cryptoExists) {
                    throw new Error("Cryptographic hardware not available");
                }

                // Generate default key if it doesn't exist
                try {
                    await generate("default");
                    console.log(
                        "✅ Default key generated/verified for blind voting",
                    );
                } catch (edit) {
                    console.log(
                        "Default key already exists or generation failed:",
                        edit,
                    );
                }

                // Get the public key
                voterPublicKey = await getPublicKey("default");
                console.log("🔑 Voter public key retrieved:", voterPublicKey);
            } catch (error) {
                console.error("Failed to get cryptographic public key:", error);
                // Fallback to ename if crypto fails
                voterPublicKey = vault.ename || "unknown_public_key";
            }

            // Dynamically import the blindvote library
            const { VotingSystem } = await import("blindvote");

            // Use the user's W3ID as the voter ID (strip @ prefix if present)
            const voterId = vault.ename?.startsWith("@")
                ? vault.ename.slice(1)
                : vault.ename;
            console.log("🔍 DEBUG: Using voter ID:", voterId);

            // Get platform URL for API calls
            const platformUrl = signingData.platform_url;
            if (!platformUrl) {
                throw new Error("Platform URL not provided in signing data");
            }

            // Check if user has already voted before attempting registration
            console.log("🔍 DEBUG: Checking if user has already voted...");
            const voteStatusResponse = await axios.get(
                `${platformUrl}/api/polls/${signingData.pollId}/vote?userId=${voterId}`,
            );

            console.log(
                "🔍 DEBUG: Vote status response:",
                voteStatusResponse.data,
            );

            // The API returns null if user hasn't voted, or a Vote object if they have
            if (voteStatusResponse.data !== null) {
                throw new Error(
                    "You have already submitted a vote for this poll",
                );
            }

            console.log(
                "🔍 DEBUG: User has not voted yet, proceeding with registration",
            );

            // Register the voter on the backend first
            console.log("🔍 DEBUG: Registering voter on backend:", voterId);
            const registerResponse = await axios.post(
                `${platformUrl}/api/votes/${signingData.pollId}/register`,
                {
                    voterId: voterId,
                },
            );

            if (
                registerResponse.status < 200 ||
                registerResponse.status >= 300
            ) {
                throw new Error("Failed to register voter on backend");
            }
            console.log("🔍 DEBUG: Voter registered on backend successfully");

            // Generate vote data locally using the blindvote library (PRIVACY PRESERVING)
            console.log("🔍 DEBUG: Generating vote data locally...");

            // Create ElectionConfig from poll details
            const electionConfig = {
                id: signingData.pollId,
                title: signingData.pollDetails.title,
                description: "",
                options: signingData.pollDetails.options.map(
                    (option: string, index: number) => `option_${index}`,
                ),
                maxVotes: 1,
                allowAbstain: false,
            };

            console.log("🔍 DEBUG: Created electionConfig:", electionConfig);

            // Create voting system and register voter locally
            const votingSystem = new VotingSystem();
            votingSystem.createElection(
                signingData.pollId,
                signingData.pollId,
                electionConfig.options,
            );

            // Register the voter locally (this creates the voter's key pair and anchor)
            console.log("🔍 DEBUG: Registering voter locally:", voterId);
            votingSystem.registerVoter(
                voterId,
                signingData.pollId,
                signingData.pollId,
            );

            // Generate vote data with the selected option (PRIVACY PRESERVING - only known locally)
            const optionId = `option_${selectedBlindVoteOption}`;
            console.log("🔍 DEBUG: Generating vote data for option:", optionId);

            const voteData = votingSystem.generateVoteData(
                voterId,
                signingData.pollId,
                signingData.pollId,
                optionId,
            );

            // Extract commitments and anchors from the generated data
            const commitments = voteData.commitments;
            const anchors = voteData.anchors;

            // Convert Uint8Array to hex strings for API transmission
            const hexCommitments: Record<string, string> = {};
            const hexAnchors: Record<string, string> = {};

            for (const [optionId, commitment] of Object.entries(commitments)) {
                hexCommitments[optionId] = Array.from(commitment)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
            }

            for (const [optionId, anchor] of Object.entries(anchors)) {
                hexAnchors[optionId] = Array.from(anchor)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
            }

            // Store vote data locally for later revelation
            // Convert BigInt values to strings for JSON serialization
            const localVoteData = {
                pollId: signingData.pollId,
                voterId: voterId, // Store voterId for ownership verification
                optionId: `option_${selectedBlindVoteOption}`, // Use the correct option ID format
                chosenOption: selectedBlindVoteOption, // Store the actual chosen option number
                optionText:
                    signingData.pollDetails.options[selectedBlindVoteOption], // Store the actual option text
                commitments: commitments,
                anchors: anchors,
                timestamp: new Date().toISOString(),
            };

            // Custom JSON serializer to handle BigInt values
            const jsonString = JSON.stringify(localVoteData, (key, value) => {
                if (typeof value === "bigint") {
                    return value.toString();
                }
                return value;
            });

            localStorage.setItem(`blindVote_${signingData.pollId}`, jsonString);

            // Submit to the API (PRIVACY PRESERVING - no chosenOptionId revealed)
            const payload = {
                pollId: signingData.pollId,
                voterId: voterId,
                // chosenOptionId is NOT sent - this preserves privacy!
                commitments: hexCommitments,
                anchors: hexAnchors,
                sessionId: signingData.sessionId,
                userW3id: vault?.ename || "",
            };

            console.log("🔍 DEBUG: Original commitments:", commitments);
            console.log("🔍 DEBUG: Original anchors:", anchors);
            console.log("🔍 DEBUG: Hex commitments:", hexCommitments);
            console.log("🔍 DEBUG: Hex anchors:", hexAnchors);
            console.log(
                "🔗 Submitting blind vote to API:",
                signingData.redirect,
            );
            console.log("📦 Payload:", payload);

            // Convert BigInt values to strings for API submission
            const apiPayload = JSON.stringify(payload, (key, value) => {
                if (typeof value === "bigint") {
                    return value.toString();
                }
                return value;
            });

            // Ensure we have a full URL for the redirect
            // The redirect from frontend is a relative path like /api/votes/{pollId}/blind
            // We need to combine it with the platform URL
            console.log("🔍 DEBUG: Constructing redirect URL:");
            console.log(
                "🔍 DEBUG: signingData.redirect:",
                signingData.redirect,
            );
            console.log(
                "🔍 DEBUG: signingData.platform_url:",
                signingData.platform_url,
            );

            const redirectUrl = signingData.redirect.startsWith("http")
                ? signingData.redirect
                : `${signingData.platform_url}${signingData.redirect}`;

            console.log("🔍 DEBUG: Final redirect URL:", redirectUrl);
            console.log("🔍 Submitting blind vote to:", redirectUrl);

            const response = await axios.post(redirectUrl, apiPayload, {
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (response.status >= 200 && response.status < 300) {
                console.log("✅ Blind vote submitted successfully");

                // Reset states gradually to avoid white screen
                blindVoteError = null;
                isSubmittingBlindVote = false;

                // Stop the camera and show success state for blind voting
                if (scanning) {
                    cancelScan();
                }
                showSigningSuccess = true;
            } else {
                console.error("❌ Failed to submit blind vote");
                blindVoteError =
                    "Failed to submit blind vote. Please try again.";
            }
        } catch (error) {
            console.error("❌ Error submitting blind vote:", error);
            blindVoteError =
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred during blind voting";

            // Make sure we're not stuck in loading state
            isSubmittingBlindVote = false;

            // Don't reset other states on error - let user see the error and retry
        } finally {
            // Always ensure loading state is reset
            isSubmittingBlindVote = false;
        }
    }

    function closeDrawer() {
        // Stop the camera if it's running
        if (scanning) {
            cancelScan();
        }

        codeScannedDrawerOpen = false;
        loggedInDrawerOpen = false;
        signingDrawerOpen = false;
        isBlindVotingRequest = false;
        selectedBlindVoteOption = null;
        signingData = null;
        signingSessionId = null;
        showSigningSuccess = false;
    }

    function handleSuccessOkay() {
        // Stop the camera if it's running
        if (scanning) {
            cancelScan();
        }

        // Reset all states
        showSigningSuccess = false;
        signingDrawerOpen = false;
        isBlindVotingRequest = false;
        selectedBlindVoteOption = null;
        signingData = null;
        signingSessionId = null;

        // Redirect to main page
        goto("/main");
    }

    onMount(async () => {
        console.log("Scan QR page mounted, checking authentication...");

        // Security check: Ensure user is authenticated before allowing access
        try {
            const vault = await globalState.vaultController.vault;
            if (!vault) {
                console.log("User not authenticated, redirecting to login");
                await goto("/login");
                return;
            }
            console.log(
                "User authenticated, proceeding with scan functionality",
            );
        } catch (error) {
            console.log("Authentication check failed, redirecting to login");
            await goto("/login");
            return;
        }

        console.log("Scan QR page mounted, checking for deep link data...");

        // Function to handle deep link data
        async function handleDeepLinkData(data: any) {
            console.log("Handling deep link data:", data);
            console.log("Data type:", data.type);
            console.log("Platform:", data.platform);
            console.log("Session:", data.session);
            console.log("Redirect:", data.redirect);
            console.log("Redirect URI:", data.redirect_uri);

            // Prevent duplicate processing by checking if we're already handling this type of request
            if (data.type === "auth" && codeScannedDrawerOpen) {
                console.log(
                    "Auth request already in progress, ignoring duplicate",
                );
                return;
            }
            if (data.type === "sign" && signingDrawerOpen) {
                console.log(
                    "Signing request already in progress, ignoring duplicate",
                );
                return;
            }
            if (data.type === "reveal" && isRevealRequest) {
                console.log(
                    "Reveal request already in progress, ignoring duplicate",
                );
                return;
            }

            if (data.type === "auth") {
                console.log("Handling auth deep link");
                // Handle auth deep link
                platform = data.platform;
                session = data.session;
                redirect = data.redirect;

                try {
                    hostname = new URL(data.redirect).hostname;
                } catch (error) {
                    console.error("Error parsing redirect URL:", error);
                    hostname = "unknown";
                }

                isSigningRequest = false;
                codeScannedDrawerOpen = true;
                console.log("Auth modal should now be open");
                console.log(
                    "Final state - platform:",
                    platform,
                    "redirect:",
                    redirect,
                    "hostname:",
                    hostname,
                );
            } else if (data.type === "sign") {
                console.log("Handling signing deep link");
                // Handle signing deep link
                signingSessionId = data.session;
                const base64Data = data.data;
                const redirectUri = data.redirect_uri;

                if (signingSessionId && base64Data && redirectUri) {
                    redirect = redirectUri;
                    try {
                        const decodedString = atob(base64Data);
                        signingData = JSON.parse(decodedString);
                        console.log("Decoded signing data:", signingData);

                        // Check if this is actually a blind voting request
                        if (signingData.type === "blind-vote") {
                            console.log(
                                "🔍 Blind voting request detected in sign deep link",
                            );

                            // Set up blind voting state
                            isBlindVotingRequest = true;
                            selectedBlindVoteOption = null;
                            signingDrawerOpen = true;
                            blindVoteError = null;

                            // Extract platform URL from the data
                            const platformUrl =
                                signingData.platformUrl ||
                                "http://192.168.0.225:7777";

                            // Set up signingData for blind voting UI
                            signingData = {
                                pollId: signingData.pollId,
                                sessionId: signingData.sessionId,
                                platform_url: platformUrl,
                                redirect: redirectUri, // Add the redirect URI from the deep link
                                // We'll need to fetch poll details, but for now set a placeholder
                                pollDetails: {
                                    title: "Loading poll details...",
                                    creatorName: "Loading...",
                                    options: ["Loading..."],
                                },
                            };

                            // Fetch poll details in the background
                            try {
                                const pollResponse = await fetch(
                                    `${platformUrl}/api/polls/${signingData.pollId}`,
                                );
                                if (pollResponse.ok) {
                                    const pollDetails =
                                        await pollResponse.json();
                                    signingData.pollDetails = pollDetails;
                                    console.log(
                                        "✅ Poll details fetched:",
                                        pollDetails,
                                    );
                                }
                            } catch (error) {
                                console.error(
                                    "Failed to fetch poll details:",
                                    error,
                                );
                                blindVoteError = "Failed to load poll details";
                            }

                            return;
                        }

                        // Regular signing request
                        isSigningRequest = true;
                        signingDrawerOpen = true;
                        console.log("Signing modal should now be open");
                    } catch (error) {
                        console.error("Error decoding signing data:", error);
                        return;
                    }
                }
            } else if (data.type === "reveal") {
                console.log("Handling reveal deep link");
                // Handle reveal deep link
                const pollId = data.pollId;

                if (pollId) {
                    console.log("🔍 Reveal request for poll:", pollId);

                    // Set up reveal state
                    revealPollId = pollId;
                    isRevealRequest = true;

                    console.log("✅ Reveal request set up successfully");
                    console.log("🔍 DEBUG: State after setup:");
                    console.log("  - revealPollId:", revealPollId);
                    console.log("  - isRevealRequest:", isRevealRequest);
                } else {
                    console.error("Missing pollId in reveal request");
                }
            }
        }

        // Check if we have deep link data from sessionStorage
        let deepLinkData = sessionStorage.getItem("deepLinkData");
        if (!deepLinkData) {
            // Also check for pending deep link data (from unauthenticated users)
            deepLinkData = sessionStorage.getItem("pendingDeepLink");
        }

        if (deepLinkData) {
            console.log("Found deep link data:", deepLinkData);
            try {
                const data = JSON.parse(deepLinkData);
                console.log("Parsed deep link data:", data);
                await handleDeepLinkData(data);
                // Clear both storage keys to be safe
                sessionStorage.removeItem("deepLinkData");
                sessionStorage.removeItem("pendingDeepLink");
            } catch (error) {
                console.error("Error parsing deep link data:", error);
                sessionStorage.removeItem("deepLinkData");
                sessionStorage.removeItem("pendingDeepLink");
            }
        } else {
            console.log("No deep link data found, starting normal scanning");
            // No deep link data, start normal scanning
            startScan();
        }

        // Listen for deep link events when already on the page
        const handleDeepLinkReceived = async (event: CustomEvent) => {
            console.log("Received deepLinkReceived event:", event.detail);
            await handleDeepLinkData(event.detail);
        };

        // Also listen for the legacy events as backup
        const handleAuthEvent = async (event: CustomEvent) => {
            console.log("Received deepLinkAuth event:", event.detail);
            await handleDeepLinkData({
                type: "auth",
                ...event.detail,
            });
        };

        const handleSignEvent = async (event: CustomEvent) => {
            console.log("Received deepLinkSign event:", event.detail);
            await handleDeepLinkData({
                type: "sign",
                ...event.detail,
            });
        };

        // Listen for the new global deep link event
        window.addEventListener("deepLinkReceived", (event) => {
            console.log("Scan page received deepLinkReceived event:", event);
            handleDeepLinkReceived(event as CustomEvent);
        });

        // Listen for legacy deep link events
        window.addEventListener("deepLinkAuth", (event) =>
            handleAuthEvent(event as CustomEvent),
        );
        window.addEventListener("deepLinkSign", (event) =>
            handleSignEvent(event as CustomEvent),
        );

        // Cleanup event listeners
        onDestroy(() => {
            window.removeEventListener("deepLinkReceived", (event) =>
                handleDeepLinkReceived(event as CustomEvent),
            );
            window.removeEventListener("deepLinkAuth", (event) =>
                handleAuthEvent(event as CustomEvent),
            );
            window.removeEventListener("deepLinkSign", (event) =>
                handleSignEvent(event as CustomEvent),
            );
        });
    });

    onDestroy(async () => {
        await cancelScan();
    });

    async function handleRevealVote() {
        if (!revealPollId) return;

        try {
            isRevealingVote = true;
            revealError = null;

            // Get the vault for identification
            const vault = await globalState.vaultController.vault;
            if (!vault) {
                throw new Error("No vault available for revealing vote");
            }

            // Get the locally stored blind vote data for this poll
            const storedVoteKey = `blindVote_${revealPollId}`;
            console.log(
                "🔍 Debug: Looking for localStorage key:",
                storedVoteKey,
            );

            const storedVoteData = localStorage.getItem(storedVoteKey);
            console.log("🔍 Debug: Raw storedVoteData:", storedVoteData);
            console.log(
                "🔍 Debug: storedVoteData type:",
                typeof storedVoteData,
            );
            console.log(
                "🔍 Debug: storedVoteData length:",
                storedVoteData?.length,
            );

            if (!storedVoteData) {
                throw new Error(
                    "No blind vote found for this poll. Make sure you submitted a blind vote first.",
                );
            }

            try {
                console.log("🔍 Debug: Attempting to parse JSON...");
                const parsedVoteData = JSON.parse(storedVoteData);
                console.log(
                    "🔍 Debug: Successfully parsed vote data:",
                    parsedVoteData,
                );
                console.log(
                    "🔍 Debug: parsedVoteData type:",
                    typeof parsedVoteData,
                );
                console.log(
                    "🔍 Debug: parsedVoteData keys:",
                    Object.keys(parsedVoteData),
                );

                // Check if this is the user's own vote
                console.log(
                    "🔍 Debug: Comparing voterId:",
                    parsedVoteData.voterId,
                    "with vault.ename:",
                    vault.ename,
                );

                // Strip @ prefix from both values for comparison
                const storedVoterId =
                    parsedVoteData.voterId?.replace(/^@/, "") || "";
                const currentVoterId = vault.ename?.replace(/^@/, "") || "";

                console.log(
                    "🔍 Debug: After stripping @ - storedVoterId:",
                    storedVoterId,
                    "currentVoterId:",
                    currentVoterId,
                );

                if (storedVoterId !== currentVoterId) {
                    throw new Error("This blind vote does not belong to you.");
                }

                // Get the chosen option from the stored data
                console.log(
                    "🔍 Debug: Looking for chosen option in:",
                    parsedVoteData,
                );
                console.log(
                    "🔍 Debug: parsedVoteData.optionText:",
                    parsedVoteData.optionText,
                );
                console.log(
                    "🔍 Debug: parsedVoteData.chosenOption:",
                    parsedVoteData.chosenOption,
                );
                console.log(
                    "🔍 Debug: parsedVoteData.optionId:",
                    parsedVoteData.optionId,
                );

                const chosenOption =
                    parsedVoteData.optionText ||
                    `Option ${parsedVoteData.chosenOption + 1}` ||
                    "Unknown option";

                console.log("🔍 Debug: Final chosenOption:", chosenOption);

                revealedVoteData = {
                    chosenOption: chosenOption,
                    pollId: revealPollId,
                    voterId: vault.ename,
                };

                console.log("✅ Vote revealed successfully from local storage");
                console.log("🔍 Debug: Setting revealSuccess to true");
                console.log(
                    "🔍 Debug: Final revealedVoteData:",
                    revealedVoteData,
                );
                revealSuccess = true;

                // Don't close the drawer - let it show the revealed vote
                // The drawer content will change to show the success state
            } catch (parseError: any) {
                console.error("❌ JSON Parse Error Details:", parseError);
                console.error("❌ Parse Error Message:", parseError.message);
                console.error("❌ Parse Error Stack:", parseError.stack);
                console.error(
                    "❌ Raw data that failed to parse:",
                    storedVoteData,
                );

                // Try to identify what went wrong
                if (storedVoteData && typeof storedVoteData === "string") {
                    try {
                        // Try to find where the JSON breaks
                        const firstBrace = storedVoteData.indexOf("{");
                        const lastBrace = storedVoteData.lastIndexOf("}");
                        console.log("🔍 Debug: First brace at:", firstBrace);
                        console.log("🔍 Debug: Last brace at:", lastBrace);
                        if (firstBrace !== -1 && lastBrace !== -1) {
                            console.log(
                                "🔍 Debug: Substring to check:",
                                storedVoteData.substring(
                                    firstBrace,
                                    lastBrace + 1,
                                ),
                            );
                        }
                    } catch (debugError) {
                        console.error(
                            "❌ Debug parsing also failed:",
                            debugError,
                        );
                    }
                }

                throw new Error(
                    "Failed to parse stored vote data. The vote may be corrupted.",
                );
            }
        } catch (error: any) {
            console.error("❌ Error revealing vote:", error);
            revealError = error.message || "Failed to reveal vote";
        } finally {
            isRevealingVote = false;
        }
    }
</script>

<AppNav title="Scan QR Code" titleClasses="text-white" iconColor="white" />

<div
    class="flex flex-col justify-center items-center min-h-[calc(100vh-200px)] pb-20"
>
    <svg
        class="mx-auto"
        width="204"
        height="215"
        viewBox="0 0 204 215"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M46 4H15C8.92487 4 4 8.92487 4 15V46" {...pathProps} />
        <path d="M158 4H189C195.075 4 200 8.92487 200 15V46" {...pathProps} />
        <path d="M46 211H15C8.92487 211 4 206.075 4 200V169" {...pathProps} />
        <path
            d="M158 211H189C195.075 211 200 206.075 200 200V169"
            {...pathProps}
        />
    </svg>

    <h4 class="text-white font-semibold text-center mt-20">
        Point the camera at the code
    </h4>
</div>

<!-- code scanned drawer -->
<Drawer
    title="Scan QR Code"
    bind:isPaneOpen={codeScannedDrawerOpen}
    class="flex flex-col gap-4 items-center justify-center"
>
    <div
        class="flex justify-center mb-4 relative items-center overflow-hidden bg-gray rounded-xl p-4 h-[72px] w-[72px]"
    >
        <div
            class="bg-white h-[16px] w-[200px] -rotate-45 absolute top-1"
        ></div>
        <div
            class="bg-white h-[16px] w-[200px] -rotate-45 absolute bottom-1"
        ></div>
        <HugeiconsIcon
            size={40}
            className="z-10"
            icon={QrCodeIcon}
            strokeWidth={1.5}
            color="var(--color-primary)"
        />
    </div>

    <h4>Code scanned!</h4>
    <p class="text-black-700">You're trying to access the following site</p>

    <div class="bg-gray rounded-2xl w-full p-4 mt-4">
        <h4 class="text-base text-black-700">Platform Name</h4>
        <p class="text-black-700 font-normal capitalize">
            {platform ?? "Unable to get name"}
        </p>
    </div>

    <div class="bg-gray rounded-2xl w-full p-4">
        <h4 class="text-base text-black-700">Website URL</h4>
        <p class="text-black-700 font-normal">
            {hostname ?? scannedData?.content}
        </p>
    </div>
    <div class="flex justify-center gap-3 items-center mt-4">
        <Button.Action
            variant="danger-soft"
            class="w-full"
            callback={() => {
                codeScannedDrawerOpen = false;
                startScan();
            }}
        >
            Decline
        </Button.Action>
        <Button.Action variant="solid" class="w-full" callback={handleAuth}>
            Confirm
        </Button.Action>
    </div>

    {#if isSigningRequest === false}
        <div class="text-center mt-3">
            <p class="text-sm text-gray-600">
                After confirmation, you may return to {platform} and continue there
            </p>
        </div>
    {/if}
</Drawer>

<!-- logged in drawer -->
<Drawer
    title="Scan QR Code"
    bind:isPaneOpen={loggedInDrawerOpen}
    class="flex flex-col gap-4 items-center justify-center"
>
    <div
        class="flex justify-center mb-4 relative items-center overflow-hidden bg-gray rounded-xl p-4 h-[72px] w-[72px]"
    >
        <div
            class="bg-white h-[16px] w-[200px] -rotate-45 absolute top-1"
        ></div>
        <div
            class="bg-white h-[16px] w-[200px] -rotate-45 absolute bottom-1"
        ></div>
        <HugeiconsIcon
            size={40}
            className="z-10"
            icon={QrCodeIcon}
            strokeWidth={1.5}
            color="var(--color-primary)"
        />
    </div>

    <h4>You're logged in!</h4>
    <p class="text-black-700">You're now connected to {platform}</p>

    <div class="flex flex-col gap-3 mt-4">
        {#if redirect && platform}
            <div class="text-center mt-3">
                <p class="text-sm text-gray-600">
                    You may return to {platform} and continue there
                </p>
            </div>
        {/if}

        <Button.Action
            variant="soft"
            class="w-full"
            callback={() => {
                loggedInDrawerOpen = false;
                goto("/main");
                startScan();
            }}
        >
            Ok
        </Button.Action>
    </div>
</Drawer>

<!-- signing confirmation drawer -->
<Drawer
    title={showSigningSuccess
        ? "Success"
        : isBlindVotingRequest
          ? "Blind Vote"
          : signingData?.pollId
            ? "Sign Vote"
            : "Sign Message"}
    bind:isPaneOpen={signingDrawerOpen}
    class="flex flex-col gap-4 items-center justify-center"
>
    {#if showSigningSuccess}
        <!-- Success Content -->
        <div
            class="flex justify-center mb-4 relative items-center overflow-hidden bg-green-100 rounded-xl p-4 h-[72px] w-[72px]"
        >
            <div
                class="bg-green-500 h-[16px] w-[200px] -rotate-45 absolute top-1"
            ></div>
            <div
                class="bg-green-500 h-[16px] w-[200px] -rotate-45 absolute bottom-1"
            ></div>
            <HugeiconsIcon
                size={40}
                className="z-10"
                icon={QrCodeIcon}
                strokeWidth={1.5}
                color="var(--color-success)"
            />
        </div>

        <h4 class="text-green-800">
            {isBlindVotingRequest
                ? "Blind Vote Submitted Successfully!"
                : signingData?.pollId
                  ? "Vote Signed Successfully!"
                  : "Message Signed Successfully!"}
        </h4>
        <p class="text-black-700 text-center">
            {isBlindVotingRequest
                ? "Your blind vote has been submitted and is now completely hidden using cryptographic commitments."
                : signingData?.pollId
                  ? "Your vote has been signed and submitted to the voting system."
                  : "Your message has been signed and submitted successfully."}
        </p>

        <div class="flex justify-center mt-6 w-full">
            <Button.Action
                variant="solid"
                class="w-full"
                callback={handleSuccessOkay}
            >
                Okay
            </Button.Action>
        </div>
    {:else}
        <!-- Regular Signing Content -->
        <div
            class="flex justify-center mb-4 relative items-center overflow-hidden bg-gray rounded-xl p-4 h-[72px] w-[72px]"
        >
            <div
                class="bg-white h-[16px] w-[200px] -rotate-45 absolute top-1"
            ></div>
            <div
                class="bg-white h-[16px] w-[200px] -rotate-45 absolute bottom-1"
            ></div>
            <HugeiconsIcon
                size={40}
                className="z-10"
                icon={QrCodeIcon}
                strokeWidth={1.5}
                color="var(--color-primary)"
            />
        </div>

        <h4>
            {isBlindVotingRequest
                ? "Blind Vote Request"
                : signingData?.pollId
                  ? "Sign Vote Request"
                  : "Sign Message Request"}
        </h4>
        <p class="text-black-700">
            {isBlindVotingRequest
                ? "You're being asked to submit a blind vote for the following poll"
                : signingData?.pollId
                  ? "You're being asked to sign a vote for the following poll"
                  : "You're being asked to sign the following message"}
        </p>

        {#if signingData?.pollId && signingData?.voteData}
            <!-- Poll Details -->
            <div class="bg-gray rounded-2xl w-full p-4 mt-4">
                <h4 class="text-base text-black-700">Poll ID</h4>
                <p class="text-black-700 font-normal">
                    {signingData?.pollId ?? "Unknown"}
                </p>
            </div>
        {:else if isBlindVotingRequest && signingData?.pollDetails}
            <!-- Blind Voting UI -->
            <div class="blind-voting-section">
                <h3 class="text-lg font-semibold mb-4">Blind Voting</h3>

                <!-- Error Display -->
                {#if blindVoteError}
                    <div
                        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4"
                    >
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <svg
                                    class="h-5 w-5 text-red-400"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div class="ml-3">
                                <h3 class="text-sm font-medium text-red-800">
                                    Error
                                </h3>
                                <div class="mt-2 text-sm text-red-700">
                                    {blindVoteError}
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Poll Details -->
                <div class="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 class="font-medium text-gray-900 mb-2">
                        Poll: {signingData.pollDetails?.title || "Unknown"}
                    </h4>
                    <p class="text-sm text-gray-600">
                        Creator: {signingData.pollDetails?.creatorName ||
                            "Unknown"}
                    </p>
                </div>

                <!-- Vote Options -->
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700 mb-2"
                        >Select your vote:</label
                    >
                    {#each signingData.pollDetails?.options || [] as option, index}
                        <label class="flex items-center mb-2">
                            <input
                                type="radio"
                                name="blindVoteOption"
                                value={index}
                                bind:group={selectedBlindVoteOption}
                                on:change={() => {
                                    console.log(
                                        `🔍 Radio changed: index = ${index}, value = ${index}, selectedBlindVoteOption = ${selectedBlindVoteOption}`,
                                    );
                                    // Force the value to be a number
                                    selectedBlindVoteOption = Number(index);
                                }}
                                class="mr-2"
                            />
                            <span class="text-sm">{option}</span>
                        </label>
                    {/each}
                </div>

                <!-- Submit Button -->
                <button
                    on:click={() => {
                        console.log(
                            `🔍 Submit button clicked. selectedBlindVoteOption = ${selectedBlindVoteOption}, type = ${typeof selectedBlindVoteOption}`,
                        );
                        handleBlindVote();
                    }}
                    disabled={selectedBlindVoteOption === null ||
                        isSubmittingBlindVote}
                    class="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                    {#if isSubmittingBlindVote}
                        <span class="flex items-center justify-center">
                            <svg
                                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    class="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    stroke-width="4"
                                ></circle>
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                            </svg>
                            Submitting...
                        </span>
                    {:else}
                        Submit Blind Vote
                    {/if}
                </button>
            </div>
        {:else}
            <!-- Generic Message Details -->
            <div class="bg-gray rounded-2xl w-full p-4 mt-4">
                <h4 class="text-base text-black-700">Message</h4>
                <p class="text-black-700 font-normal">
                    {signingData?.message ?? "No message provided"}
                </p>
            </div>

            <div class="bg-gray rounded-2xl w-full p-4">
                <h4 class="text-base text-black-700">Session ID</h4>
                <p class="text-black-700 font-normal font-mono">
                    {signingData?.sessionId?.slice(0, 8) ?? "Unknown"}...
                </p>
            </div>
        {/if}

        <div class="flex justify-center gap-3 items-center mt-4">
            {#if !isBlindVotingRequest}
                <Button.Action
                    variant="danger-soft"
                    class="w-full"
                    callback={() => {
                        signingDrawerOpen = false;
                        startScan();
                    }}
                >
                    Decline
                </Button.Action>
            {/if}
            {#if !isBlindVotingRequest}
                <Button.Action
                    variant="solid"
                    class="w-full"
                    callback={handleSignVote}
                >
                    {loading
                        ? "Signing..."
                        : signingData?.pollId
                          ? "Sign Vote"
                          : "Sign Message"}
                </Button.Action>
            {/if}
        </div>
    {/if}
</Drawer>

<!-- Reveal Vote Drawer -->
<Drawer
    title={revealSuccess ? "Vote Revealed" : "Reveal Blind Vote"}
    bind:isPaneOpen={isRevealRequest}
    class="flex flex-col gap-4 items-center justify-center"
>
    {#if revealSuccess && revealedVoteData}
        <div class="bg-white rounded-lg p-4 border border-green-200">
            <p class="text-lg font-semibold text-green-900">
                You voted for: <span class="text-blue-600"
                    >{revealedVoteData.chosenOption}</span
                >
            </p>
            <p class="text-sm text-green-600 mt-2">
                Poll ID: {revealedVoteData.pollId}
            </p>
        </div>

        <div class="flex justify-center mt-6 w-full">
            <Button.Action
                variant="solid"
                class="w-full"
                callback={() => {
                    // Go back in history instead of potentially causing white screen
                    window.history.back();
                }}
            >
                Okay
            </Button.Action>
        </div>
    {:else}
        <!-- Show reveal form content -->
        <div
            class="flex justify-center mb-4 relative items-center overflow-hidden bg-gray rounded-xl p-4 h-[72px] w-[72px]"
        >
            <div
                class="bg-white h-[16px] w-[200px] -rotate-45 absolute top-1"
            ></div>
            <div
                class="bg-white h-[16px] w-[200px] -rotate-45 absolute bottom-1"
            ></div>
            <HugeiconsIcon
                size={40}
                className="z-10"
                icon={QrCodeIcon}
                strokeWidth={1.5}
                color="var(--color-primary)"
            />
        </div>

        <h4>Reveal Your Blind Vote</h4>
        <p class="text-black-700 text-center">
            You're about to reveal your blind vote for poll: {revealPollId}
        </p>

        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p class="text-sm text-blue-800 text-center">
                <strong>Note:</strong> Revealing your vote will show your choice
                locally in this wallet. This action cannot be undone.
            </p>
        </div>

        {#if revealError}
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
                <p class="text-sm text-red-800 text-center">
                    {revealError}
                </p>
            </div>
        {/if}

        <div class="flex justify-center gap-3 items-center mt-4 w-full">
            <Button.Action
                variant="danger-soft"
                class="w-full"
                callback={() => {
                    // Go back in history instead of potentially causing white screen
                    window.history.back();
                }}
            >
                Cancel
            </Button.Action>
            <Button.Action
                variant="solid"
                class="w-full"
                callback={handleRevealVote}
                disabled={isRevealingVote}
            >
                {#if isRevealingVote}
                    Revealing...
                {:else}
                    Reveal Vote
                {/if}
            </Button.Action>
        </div>
    {/if}
</Drawer>

<!-- Success message -->
