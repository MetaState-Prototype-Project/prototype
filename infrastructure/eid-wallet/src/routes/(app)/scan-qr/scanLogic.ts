import {
    Format,
    type PermissionState,
    type Scanned,
    cancel,
    checkPermissions,
    requestPermissions,
    scan,
} from "@tauri-apps/plugin-barcode-scanner";
import { openUrl } from "@tauri-apps/plugin-opener";
import axios from "axios";
import { type Writable, get, writable } from "svelte/store";

import type { GlobalState } from "$lib/global";

export interface SigningData {
    type?: string;
    pollId?: string;
    voteData?: Record<string, unknown>;
    userId?: string;
    sessionId?: string;
    message?: string;
    redirect?: string;
    platform_url?: string;
    pollDetails?: {
        title: string;
        creatorName: string;
        options: string[];
    };
    platformUrl?: string;
}

export interface DeepLinkData {
    type: string;
    platform?: string;
    session?: string;
    redirect?: string;
    redirect_uri?: string;
    data?: string;
    pollId?: string;
}

export interface RevealedVoteData {
    chosenOption: string;
    pollId: string;
    voterId?: string;
}

interface CreateScanLogicParams {
    globalState: GlobalState;
    goto: (path: string) => Promise<void>;
}

interface ScanStores {
    platform: Writable<string | null>;
    hostname: Writable<string | null>;
    session: Writable<string | null>;
    codeScannedDrawerOpen: Writable<boolean>;
    loggedInDrawerOpen: Writable<boolean>;
    signingDrawerOpen: Writable<boolean>;
    scannedData: Writable<Scanned | undefined>;
    scanning: Writable<boolean>;
    loading: Writable<boolean>;
    redirect: Writable<string | null>;
    signingSessionId: Writable<string | null>;
    signingData: Writable<SigningData | null>;
    isSigningRequest: Writable<boolean>;
    showSigningSuccess: Writable<boolean>;
    isBlindVotingRequest: Writable<boolean>;
    selectedBlindVoteOption: Writable<number | null>;
    blindVoteError: Writable<string | null>;
    isSubmittingBlindVote: Writable<boolean>;
    isRevealRequest: Writable<boolean>;
    revealPollId: Writable<string | null>;
    revealError: Writable<string | null>;
    isRevealingVote: Writable<boolean>;
    revealSuccess: Writable<boolean>;
    revealedVoteData: Writable<RevealedVoteData | null>;
    authError: Writable<string | null>;
    signingError: Writable<string | null>;
    authLoading: Writable<boolean>;
}

interface ScanActions {
    startScan: () => Promise<void>;
    cancelScan: () => Promise<void>;
    handleAuth: () => Promise<void>;
    handleSignVote: () => Promise<void>;
    handleBlindVote: () => Promise<void>;
    handleRevealVote: () => Promise<void>;
    handleSuccessOkay: () => Promise<void>;
    closeDrawer: () => Promise<void>;
    setCodeScannedDrawerOpen: (value: boolean) => void;
    setLoggedInDrawerOpen: (value: boolean) => void;
    setSigningDrawerOpen: (value: boolean) => void;
    setRevealRequestOpen: (value: boolean) => void;
    handleBlindVoteSelection: (value: number | null) => void;
    handleAuthRequest: (content: string) => void;
    handleSigningRequest: (content: string) => void;
    handleRevealRequest: (content: string) => void;
    handleDeepLinkData: (data: DeepLinkData) => Promise<void>;
    handleBlindVotingRequest: (
        blindVoteData: SigningData,
        platformUrl: string | null,
        redirectUri: string | null,
    ) => Promise<void>;
    initialize: () => Promise<() => void>;
}

interface ScanLogic {
    stores: ScanStores;
    actions: ScanActions;
}

export function createScanLogic({
    globalState,
    goto,
}: CreateScanLogicParams): ScanLogic {
    const platform = writable<string | null>(null);
    const hostname = writable<string | null>(null);
    const session = writable<string | null>(null);
    const codeScannedDrawerOpen = writable(false);
    const loggedInDrawerOpen = writable(false);
    const signingDrawerOpen = writable(false);
    const scannedData = writable<Scanned | undefined>(undefined);
    const scanning = writable(false);
    const loading = writable(false);
    const redirect = writable<string | null>(null);
    const signingSessionId = writable<string | null>(null);
    const signingData = writable<SigningData | null>(null);
    const isSigningRequest = writable(false);
    const showSigningSuccess = writable(false);
    const isBlindVotingRequest = writable(false);
    const selectedBlindVoteOption = writable<number | null>(null);
    const blindVoteError = writable<string | null>(null);
    const isSubmittingBlindVote = writable(false);
    const isRevealRequest = writable(false);
    const revealPollId = writable<string | null>(null);
    const revealError = writable<string | null>(null);
    const isRevealingVote = writable(false);
    const revealSuccess = writable(false);
    const revealedVoteData = writable<RevealedVoteData | null>(null);
    const authError = writable<string | null>(null);
    const signingError = writable<string | null>(null);
    const authLoading = writable(false);

    let permissionsNullable: PermissionState | null = null;

    async function startScan() {
        let permissions: PermissionState | null = null;
        try {
            permissions = await checkPermissions();
        } catch {
            permissions = null;
        }

        if (permissions === "prompt" || permissions === "denied") {
            permissions = await requestPermissions();
        }

        permissionsNullable = permissions;

        if (permissions === "granted") {
            const formats = [Format.QRCode];
            const windowed = true;
            if (get(scanning)) return;
            scanning.set(true);

            scan({ formats, windowed })
                .then((res) => {
                    scannedData.set(res);
                    const content = res.content;
                    if (content.startsWith("w3ds://sign")) {
                        handleSigningRequest(content);
                    } else if (content.startsWith("w3ds://reveal")) {
                        handleRevealRequest(content);
                    } else if (content.includes("/blind-vote")) {
                        try {
                            const url = new URL(content);
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
                                const decodedString = atob(
                                    decodeURIComponent(base64Data),
                                );
                                const decodedData: SigningData =
                                    JSON.parse(decodedString);

                                if (decodedData.type === "blind-vote") {
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
                        handleAuthRequest(content);
                    } else {
                        handleAuthRequest(content);
                    }
                })
                .catch((error) => {
                    console.error("Scan error:", error);
                })
                .finally(() => {
                    scanning.set(false);
                });
        }
    }

    async function cancelScan() {
        await cancel();
        scanning.set(false);
    }

    async function handleAuth() {
        const vault = await globalState.vaultController.vault;
        if (!vault || !get(redirect)) return;

        // Clear previous errors and set loading state
        authError.set(null);
        authLoading.set(true);

        try {
            const KEY_ID = "default";
            const isFake = await globalState.userController.isFake;
            const signingContext = isFake ? "pre-verification" : "onboarding";
            
            console.log("=".repeat(70));
            console.log("🔐 [scanLogic] handleAuth - Preparing to sign payload");
            console.log("=".repeat(70));
            console.log(`⚠️  Using keyId: ${KEY_ID} (NOT ${vault.ename})`);
            console.log(`⚠️  Using context: ${signingContext} (NOT "signing")`);
            console.log(`⚠️  This ensures we use the SAME key that was synced to eVault`);
            console.log("=".repeat(70));

            const { created } = await globalState.keyService.ensureKey(
                KEY_ID,
                signingContext,
            );
            console.log(
                "Key generation result for signing:",
                created ? "key-generated" : "key-exists",
            );

            const w3idResult = vault.ename;
            if (!w3idResult) {
                throw new Error("Failed to get W3ID");
            }

            const sessionPayload = get(session) as string;

            const signature = await globalState.keyService.signPayload(
                KEY_ID,
                signingContext,
                sessionPayload,
            );

            const redirectUrl = get(redirect);
            if (!redirectUrl) {
                throw new Error(
                    "No redirect URL configured for authentication",
                );
            }

            // Strip path from redirectUri and append /deeplink-login
            const loginUrl = new URL("/deeplink-login", redirectUrl);
            loginUrl.searchParams.set("ename", vault.ename);
            loginUrl.searchParams.set("session", get(session) as string);
            loginUrl.searchParams.set("signature", signature);
            loginUrl.searchParams.set("appVersion", "0.4.0");

            console.log(`🔗 Opening login URL: ${loginUrl.toString()}`);

            // Open URL in browser using tauri opener
            await openUrl(loginUrl.toString());

            // Close the auth drawer first
            codeScannedDrawerOpen.set(false);

            let deepLinkData = sessionStorage.getItem("deepLinkData");
            if (!deepLinkData) {
                deepLinkData = sessionStorage.getItem("pendingDeepLink");
            }

            if (deepLinkData) {
                try {
                    const data = JSON.parse(deepLinkData) as DeepLinkData;
                    console.log(
                        "Deep link data found after auth completion:",
                        data,
                    );

                    if (data.type === "auth") {
                        if (
                            !data.redirect ||
                            typeof data.redirect !== "string"
                        ) {
                            console.error(
                                "Invalid redirect URL:",
                                data.redirect,
                            );
                            // Ensure auth drawer is closed before opening logged in drawer
                            codeScannedDrawerOpen.set(false);
                            loggedInDrawerOpen.set(true);
                            startScan();
                            return;
                        }

                        try {
                            new URL(data.redirect);
                        } catch (urlError) {
                            console.error("Invalid URL format:", urlError);
                            // Ensure auth drawer is closed before opening logged in drawer
                            codeScannedDrawerOpen.set(false);
                            loggedInDrawerOpen.set(true);
                            startScan();
                            return;
                        }

                        try {
                            window.location.href = data.redirect;
                        } catch (error1) {
                            console.log(
                                "Method 1 failed, trying method 2:",
                                error1,
                            );
                            try {
                                window.location.assign(data.redirect);
                            } catch (error2) {
                                console.log(
                                    "Method 2 failed, trying method 3:",
                                    error2,
                                );
                                try {
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

            // Ensure auth drawer is closed before opening logged in drawer
            codeScannedDrawerOpen.set(false);
            loggedInDrawerOpen.set(true);
            startScan();
        } catch (error) {
            console.error("Error completing authentication:", error);

            // Set user-friendly error message
            let errorMessage = "Authentication failed. Please try again.";
            if (error instanceof Error) {
                if (
                    error.message.includes("network") ||
                    error.message.includes("timeout")
                ) {
                    errorMessage =
                        "Network error. Please check your connection and try again.";
                } else if (error.message.includes("W3ID")) {
                    errorMessage =
                        "Failed to retrieve your identity. Please try again.";
                } else if (error.message.includes("redirect")) {
                    errorMessage =
                        "Invalid redirect URL. Please scan the QR code again.";
                }
            }
            authError.set(errorMessage);
        } finally {
            authLoading.set(false);
        }
    }

    function handleAuthRequest(content: string) {
        const url = new URL(content);
        platform.set(url.searchParams.get("platform"));
        const redirectUrl = new URL(url.searchParams.get("redirect") || "");
        redirect.set(url.searchParams.get("redirect"));
        session.set(url.searchParams.get("session"));
        hostname.set(redirectUrl.hostname);
        isSigningRequest.set(false);
        authError.set(null); // Clear any previous auth errors
        codeScannedDrawerOpen.set(true);
    }

    function handleSigningRequest(content: string) {
        // Clear any previous signing errors
        signingError.set(null);

        try {
            let parseableContent = content;
            if (content.startsWith("w3ds://")) {
                parseableContent = content.replace(
                    "w3ds://",
                    "https://dummy.com/",
                );
            }

            const url = new URL(parseableContent);
            signingSessionId.set(url.searchParams.get("session"));
            const base64Data = url.searchParams.get("data");
            const redirectUri = url.searchParams.get("redirect_uri");
            const platformUrl = url.searchParams.get("platform_url");

            console.log("🔍 Parsed w3ds://sign URI:", {
                session: get(signingSessionId),
                data: base64Data,
                redirect_uri: redirectUri,
                platform_url: platformUrl,
            });

            if (!get(signingSessionId) || !base64Data || !redirectUri) {
                console.error("Invalid signing request parameters:", {
                    signingSessionId: get(signingSessionId),
                    base64Data,
                    redirectUri,
                });
                signingError.set(
                    "Invalid signing request. Please scan the QR code again.",
                );
                return;
            }

            redirect.set(redirectUri);

            try {
                const decodedString = atob(base64Data);
                const decodedData: SigningData = JSON.parse(decodedString);

                if (decodedData.type === "blind-vote") {
                    handleBlindVotingRequest(
                        decodedData,
                        platformUrl,
                        redirectUri,
                    );
                    return;
                }

                signingData.set(decodedData);

                isSigningRequest.set(true);
                signingDrawerOpen.set(true);
            } catch (error) {
                console.error("Error decoding signing data:", error);
                signingError.set(
                    "Failed to decode signing data. The QR code may be invalid.",
                );
                return;
            }
        } catch (error) {
            console.error("Error parsing signing request:", error);
            signingError.set(
                "Failed to parse signing request. Please scan the QR code again.",
            );
        }
    }

    function handleRevealRequest(content: string) {
        try {
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

            revealPollId.set(pollId);
            isRevealRequest.set(true);
        } catch (error) {
            console.error("Error parsing reveal request:", error);
        }
    }

    async function handleBlindVotingRequest(
        blindVoteData: SigningData,
        platformUrl: string | null,
        redirectUri: string | null,
    ) {
        try {
            const pollId = blindVoteData.pollId;
            if (!pollId) {
                throw new Error("No poll ID provided in blind vote data");
            }

            const pollResponse = await fetch(
                `${platformUrl}/api/polls/${pollId}`,
            );
            if (!pollResponse.ok) {
                throw new Error("Failed to fetch poll details");
            }

            const pollDetails = await pollResponse.json();

            signingData.set({
                pollId: pollId,
                pollDetails: pollDetails,
                redirect: redirectUri ?? undefined,
                sessionId: blindVoteData.sessionId,
                platform_url: platformUrl ?? undefined,
            });

            isBlindVotingRequest.set(true);
            selectedBlindVoteOption.set(null);
            signingDrawerOpen.set(true);
            blindVoteError.set(null);
        } catch (error) {
            console.error("❌ Error handling blind voting request:", error);
        }
    }

    async function handleSignVote() {
        const currentSigningData = get(signingData);
        const currentSigningSessionId = get(signingSessionId);
        if (!currentSigningData || !currentSigningSessionId) return;

        // Clear previous errors
        signingError.set(null);

        try {
            loading.set(true);

            const vault = await globalState.vaultController.vault;
            if (!vault) {
                throw new Error("No vault available for signing");
            }

            // ⚠️ CRITICAL: Use the SAME keyId and context that was synced to eVault!
            // The key synced to eVault uses keyId="default" with context="onboarding" or "pre-verification"
            // NOT vault.ename with context="signing"!
            const KEY_ID = "default";
            const isFake = await globalState.userController.isFake;
            const signingContext = isFake ? "pre-verification" : "onboarding";
            
            console.log("=".repeat(70));
            console.log("🔐 [scanLogic] Preparing to sign payload");
            console.log("=".repeat(70));
            console.log(`⚠️  Using keyId: ${KEY_ID} (NOT ${vault.ename})`);
            console.log(`⚠️  Using context: ${signingContext} (NOT "signing")`);
            console.log(`⚠️  This ensures we use the SAME key that was synced to eVault`);
            console.log("=".repeat(70));

            const { created } = await globalState.keyService.ensureKey(
                KEY_ID,
                signingContext,
            );
            console.log(
                "Key generation result for signing:",
                created ? "key-generated" : "key-exists",
            );

            const w3idResult = vault.ename;
            if (!w3idResult) {
                throw new Error("Failed to get W3ID");
            }

            const messageToSign= currentSigningSessionId;


            console.log(
                "🔐 Starting cryptographic signing process with KeyManager...",
            );

            const signature = await globalState.keyService.signPayload(
                KEY_ID,
                signingContext,
                currentSigningSessionId
            );
            console.log("✅ Message signed successfully");

            const signedPayload = {
                sessionId: currentSigningSessionId,
                signature: signature,
                w3id: w3idResult,
                message: messageToSign,
            };

            const redirectUri = get(redirect);

            if (!redirectUri) {
                throw new Error("No redirect URI available");
            }

            const response = await fetch(redirectUri, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(signedPayload),
            });

            if (!response.ok) {
                throw new Error("Failed to submit signed payload");
            }

            if (get(scanning)) {
                cancelScan();
            }
            showSigningSuccess.set(true);

            const deepLinkData = sessionStorage.getItem("deepLinkData");
            if (deepLinkData) {
                try {
                    const data = JSON.parse(deepLinkData) as DeepLinkData;
                    if (data.type === "sign") {
                        console.log("Signing completed via deep link");
                        startScan();
                        return;
                    }
                } catch (error) {
                    console.error("Error parsing deep link data:", error);
                }
            }
        } catch (error) {
            console.error("Error signing vote:", error);

            // Set user-friendly error message
            let errorMessage = "Failed to sign. Please try again.";
            if (error instanceof Error) {
                if (
                    error.message.includes("vault") ||
                    error.message.includes("W3ID")
                ) {
                    errorMessage =
                        "Failed to retrieve your identity. Please try again.";
                } else if (
                    error.message.includes("network") ||
                    error.message.includes("fetch")
                ) {
                    errorMessage =
                        "Network error. Please check your connection and try again.";
                } else if (error.message.includes("redirect")) {
                    errorMessage =
                        "No destination URL available. Please scan the QR code again.";
                } else if (
                    error.message.includes("submit") ||
                    error.message.includes("payload")
                ) {
                    errorMessage =
                        "Failed to submit signature. The server may be unavailable.";
                }
            }
            signingError.set(errorMessage);
        } finally {
            loading.set(false);
        }
    }

    async function handleBlindVote() {
        console.log("🔍 DEBUG: handleBlindVote called");
        const currentSelectedOption = get(selectedBlindVoteOption);
        const currentSigningData = get(signingData);
        console.log(
            "🔍 DEBUG: selectedBlindVoteOption:",
            currentSelectedOption,
        );
        console.log("🔍 DEBUG: signingData:", currentSigningData);
        console.log(
            "🔍 DEBUG: isBlindVotingRequest:",
            get(isBlindVotingRequest),
        );

        blindVoteError.set(null);
        isSubmittingBlindVote.set(true);

        if (
            currentSelectedOption === null ||
            !currentSigningData ||
            !currentSigningData.pollId ||
            !currentSigningData.pollDetails
        ) {
            const errorMsg = "No vote option selected or poll details missing";
            console.error("❌ Validation failed:", errorMsg);
            console.error("❌ selectedBlindVoteOption:", currentSelectedOption);
            console.error(
                "❌ selectedBlindVoteOption === null:",
                currentSelectedOption === null,
            );
            console.error("❌ signingData:", currentSigningData);
            blindVoteError.set(errorMsg);
            isSubmittingBlindVote.set(false);
            return;
        }

        const pollId = currentSigningData.pollId;
        const pollDetails = currentSigningData.pollDetails;

        try {
            const vault = await globalState.vaultController.vault;
            if (!vault) {
                throw new Error("No vault available for blind voting");
            }

            let voterPublicKey: string;
            try {
                const { created } = await globalState.keyService.ensureKey(
                    vault.ename,
                    "signing",
                );
                console.log(
                    "Key generation result for blind voting:",
                    created ? "key-generated" : "key-exists",
                );

                const w3idResult = vault.ename;
                if (!w3idResult) {
                    throw new Error("Failed to get W3ID");
                }
                voterPublicKey = w3idResult;

                console.log("🔑 Voter W3ID retrieved:", voterPublicKey);
            } catch (error) {
                console.error("Failed to get W3ID using KeyManager:", error);
                voterPublicKey = vault.ename || "unknown_public_key";
            }

            const { VotingSystem } = await import("blindvote");

            const voterId = vault.ename?.startsWith("@")
                ? vault.ename.slice(1)
                : vault.ename;
            console.log("🔍 DEBUG: Using voter ID:", voterId);

            const platformUrl = currentSigningData.platform_url;
            if (!platformUrl) {
                throw new Error("Platform URL not provided in signing data");
            }

            console.log("🔍 DEBUG: Checking if user has already voted...");
            const voteStatusResponse = await axios.get(
                `${platformUrl}/api/polls/${pollId}/vote?userId=${voterId}`,
            );

            console.log(
                "🔍 DEBUG: Vote status response:",
                voteStatusResponse.data,
            );

            if (voteStatusResponse.data !== null) {
                throw new Error(
                    "You have already submitted a vote for this poll",
                );
            }

            console.log(
                "🔍 DEBUG: User has not voted yet, proceeding with registration",
            );

            console.log("🔍 DEBUG: Registering voter on backend:", voterId);
            const registerResponse = await axios.post(
                `${platformUrl}/api/votes/${pollId}/register`,
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

            console.log("🔍 DEBUG: Generating vote data locally...");

            const electionConfig = {
                id: pollId,
                title: pollDetails.title,
                description: "",
                options: pollDetails.options.map(
                    (_option: string, index: number) => `option_${index}`,
                ),
                maxVotes: 1,
                allowAbstain: false,
            };

            console.log("🔍 DEBUG: Created electionConfig:", electionConfig);

            const votingSystem = new VotingSystem();
            votingSystem.createElection(pollId, pollId, electionConfig.options);

            console.log("🔍 DEBUG: Registering voter locally:", voterId);
            votingSystem.registerVoter(voterId, pollId, pollId);

            const optionId = `option_${currentSelectedOption}`;
            console.log("🔍 DEBUG: Generating vote data for option:", optionId);

            const voteData = votingSystem.generateVoteData(
                voterId,
                pollId,
                pollId,
                optionId,
            );

            const commitments = voteData.commitments;
            const anchors = voteData.anchors;

            const hexCommitments: Record<string, string> = {};
            const hexAnchors: Record<string, string> = {};

            for (const [commitmentOptionId, commitment] of Object.entries(
                commitments,
            )) {
                hexCommitments[commitmentOptionId] = Array.from(commitment)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
            }

            for (const [anchorOptionId, anchor] of Object.entries(anchors)) {
                hexAnchors[anchorOptionId] = Array.from(anchor)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
            }

            const localVoteData = {
                pollId: pollId,
                voterId: voterId,
                optionId: `option_${currentSelectedOption}`,
                chosenOption: currentSelectedOption,
                optionText: pollDetails.options[currentSelectedOption],
                commitments: commitments,
                anchors: anchors,
                timestamp: new Date().toISOString(),
            };

            const jsonString = JSON.stringify(localVoteData, (key, value) => {
                if (typeof value === "bigint") {
                    return value.toString();
                }
                return value;
            });

            localStorage.setItem(`blindVote_${pollId}`, jsonString);

            const payload = {
                pollId: pollId,
                voterId: voterId,
                commitments: hexCommitments,
                anchors: hexAnchors,
                sessionId: currentSigningData.sessionId,
                userW3id: vault?.ename || "",
            };

            console.log("🔍 DEBUG: Original commitments:", commitments);
            console.log("🔍 DEBUG: Original anchors:", anchors);
            console.log("🔍 DEBUG: Hex commitments:", hexCommitments);
            console.log("🔍 DEBUG: Hex anchors:", hexAnchors);
            console.log(
                "🔗 Submitting blind vote to API:",
                currentSigningData.redirect,
            );
            console.log("📦 Payload:", payload);

            const apiPayload = JSON.stringify(payload, (key, value) => {
                if (typeof value === "bigint") {
                    return value.toString();
                }
                return value;
            });

            const redirectUrl = currentSigningData.redirect?.startsWith("http")
                ? currentSigningData.redirect
                : `${currentSigningData.platform_url ?? ""}${
                      currentSigningData.redirect || ""
                  }`;

            if (!redirectUrl) {
                throw new Error("Redirect URL not provided");
            }

            console.log("🔍 DEBUG: Final redirect URL:", redirectUrl);
            console.log("🔍 Submitting blind vote to:", redirectUrl);

            const response = await axios.post(redirectUrl, apiPayload, {
                headers: {
                    "Content-Type": "application/json",
                },
            });

            if (response.status >= 200 && response.status < 300) {
                console.log("✅ Blind vote submitted successfully");

                blindVoteError.set(null);
                isSubmittingBlindVote.set(false);

                if (get(scanning)) {
                    cancelScan();
                }
                showSigningSuccess.set(true);
            } else {
                console.error("❌ Failed to submit blind vote");
                blindVoteError.set(
                    "Failed to submit blind vote. Please try again.",
                );
            }
        } catch (error) {
            console.error("❌ Error submitting blind vote:", error);
            blindVoteError.set(
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred during blind voting",
            );
            isSubmittingBlindVote.set(false);
        } finally {
            isSubmittingBlindVote.set(false);
        }
    }

    async function handleRevealVote() {
        const currentPollId = get(revealPollId);
        if (!currentPollId) return;

        try {
            isRevealingVote.set(true);
            revealError.set(null);

            const vault = await globalState.vaultController.vault;
            if (!vault) {
                throw new Error("No vault available for revealing vote");
            }

            const storedVoteKey = `blindVote_${currentPollId}`;
            console.log(
                "🔍 Debug: Looking for localStorage key:",
                storedVoteKey,
            );

            const storedVoteData = localStorage.getItem(storedVoteKey);
            console.log("🔍 Debug: Raw storedVoteData:", storedVoteData);

            if (!storedVoteData) {
                throw new Error(
                    "No blind vote found for this poll. Make sure you submitted a blind vote first.",
                );
            }

            try {
                console.log("🔍 Debug: Attempting to parse JSON...");
                const parsedVoteData = JSON.parse(storedVoteData) as Record<
                    string,
                    unknown
                >;
                console.log(
                    "🔍 Debug: Successfully parsed vote data:",
                    parsedVoteData,
                );

                const storedVoterId =
                    (parsedVoteData.voterId as string | null)?.replace(
                        /^@/,
                        "",
                    ) ?? "";
                const currentVoterId = vault.ename?.replace(/^@/, "") ?? "";

                if (storedVoterId !== currentVoterId) {
                    throw new Error("This blind vote does not belong to you.");
                }

                const chosenOption =
                    (parsedVoteData.optionText as string | undefined) ||
                    (typeof parsedVoteData.chosenOption === "number"
                        ? `Option ${(parsedVoteData.chosenOption as number) + 1}`
                        : "Unknown option");

                revealedVoteData.set({
                    chosenOption: chosenOption,
                    pollId: currentPollId,
                    voterId: vault.ename,
                });

                revealSuccess.set(true);
            } catch (parseError) {
                console.error("❌ JSON Parse Error Details:", parseError);
                console.error(
                    "❌ Raw data that failed to parse:",
                    storedVoteData,
                );
                throw new Error(
                    "Failed to parse stored vote data. The vote may be corrupted.",
                );
            }
        } catch (error) {
            console.error("❌ Error revealing vote:", error);
            revealError.set(
                error instanceof Error
                    ? error.message
                    : "Failed to reveal vote",
            );
        } finally {
            isRevealingVote.set(false);
        }
    }

    async function closeDrawer() {
        if (get(scanning)) {
            await cancelScan();
        }

        codeScannedDrawerOpen.set(false);
        loggedInDrawerOpen.set(false);
        signingDrawerOpen.set(false);
        isBlindVotingRequest.set(false);
        selectedBlindVoteOption.set(null);
        signingData.set(null);
        signingSessionId.set(null);
        showSigningSuccess.set(false);
    }

    async function handleSuccessOkay() {
        if (get(scanning)) {
            await cancelScan();
        }

        showSigningSuccess.set(false);
        signingDrawerOpen.set(false);
        isBlindVotingRequest.set(false);
        selectedBlindVoteOption.set(null);
        signingData.set(null);
        signingSessionId.set(null);

        await goto("/main");
    }

    function setCodeScannedDrawerOpen(value: boolean) {
        codeScannedDrawerOpen.set(value);
        // Clear auth error when drawer is closed
        if (!value) {
            authError.set(null);
        }
    }

    function setLoggedInDrawerOpen(value: boolean) {
        loggedInDrawerOpen.set(value);
    }

    function setSigningDrawerOpen(value: boolean) {
        signingDrawerOpen.set(value);
        // Clear signing error when drawer is closed
        if (!value) {
            signingError.set(null);
        }
    }

    function setRevealRequestOpen(value: boolean) {
        isRevealRequest.set(value);
    }

    function handleBlindVoteSelection(value: number | null) {
        selectedBlindVoteOption.set(value);
    }

    async function handleDeepLinkData(data: DeepLinkData) {
        console.log("Handling deep link data:", data);
        console.log("Data type:", data.type);
        console.log("Platform:", data.platform);
        console.log("Session:", data.session);
        console.log("Redirect:", data.redirect);
        console.log("Redirect URI:", data.redirect_uri);

        if (data.type === "auth" && get(codeScannedDrawerOpen)) {
            console.log("Auth request already in progress, ignoring duplicate");
            return;
        }
        if (data.type === "sign" && get(signingDrawerOpen)) {
            console.log(
                "Signing request already in progress, ignoring duplicate",
            );
            return;
        }
        if (data.type === "reveal" && get(isRevealRequest)) {
            console.log(
                "Reveal request already in progress, ignoring duplicate",
            );
            return;
        }

        if (data.type === "auth") {
            console.log("Handling auth deep link");

            // Close all other modals first
            signingDrawerOpen.set(false);
            loggedInDrawerOpen.set(false);
            isRevealRequest.set(false);

            platform.set(data.platform ?? null);
            session.set(data.session ?? null);
            redirect.set(data.redirect ?? null);

            try {
                hostname.set(new URL(data.redirect || "").hostname);
            } catch (error) {
                console.error("Error parsing redirect URL:", error);
                hostname.set("unknown");
            }

            isSigningRequest.set(false);
            authError.set(null); // Clear any previous auth errors
            codeScannedDrawerOpen.set(true);
        } else if (data.type === "sign") {
            console.log("Handling signing deep link");

            // Close all other modals first
            codeScannedDrawerOpen.set(false);
            loggedInDrawerOpen.set(false);
            isRevealRequest.set(false);

            signingSessionId.set(data.session ?? null);
            const base64Data = data.data;
            const redirectUri = data.redirect_uri;

            if (get(signingSessionId) && base64Data && redirectUri) {
                redirect.set(redirectUri);
                signingError.set(null); // Clear any previous signing errors

                try {
                    const decodedString = atob(base64Data);
                    const parsedSigningData = JSON.parse(
                        decodedString,
                    ) as SigningData;
                    console.log("Decoded signing data:", parsedSigningData);

                    if (
                        parsedSigningData &&
                        parsedSigningData.type === "blind-vote"
                    ) {
                        console.log(
                            "🔍 Blind voting request detected in sign deep link",
                        );

                        isBlindVotingRequest.set(true);
                        selectedBlindVoteOption.set(null);
                        signingDrawerOpen.set(true);
                        blindVoteError.set(null);

                        const platformUrlCandidate =
                            parsedSigningData?.platformUrl?.trim();

                        if (!platformUrlCandidate) {
                            const errorMessage =
                                "Missing platform URL in signing data and no PUBLIC_PLATFORM_URL configured.";
                            blindVoteError.set(errorMessage);
                            throw new Error(errorMessage);
                        }

                        let platformUrl: string;
                        try {
                            // Validate the URL and normalize trailing slashes for consistent API calls.
                            const validatedUrl = new URL(platformUrlCandidate);
                            platformUrl = validatedUrl
                                .toString()
                                .replace(/\/+$/, "");
                        } catch (error) {
                            const message =
                                error instanceof Error
                                    ? error.message
                                    : String(error);
                            const errorMessage = `Invalid platform URL "${platformUrlCandidate}": ${message}`;
                            blindVoteError.set(
                                "Invalid platform URL in signing request.",
                            );
                            throw new Error(errorMessage);
                        }

                        signingData.set({
                            pollId: parsedSigningData?.pollId,
                            sessionId: parsedSigningData?.sessionId,
                            platform_url: platformUrl,
                            redirect: redirectUri,
                            pollDetails: {
                                title: "Loading poll details...",
                                creatorName: "Loading...",
                                options: ["Loading..."],
                            },
                        });

                        try {
                            const pollResponse = await fetch(
                                `${platformUrl}/api/polls/${get(signingData)?.pollId}`,
                            );
                            if (pollResponse.ok) {
                                const pollDetails = await pollResponse.json();
                                signingData.update((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              pollDetails,
                                          }
                                        : prev,
                                );
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
                            blindVoteError.set("Failed to load poll details");
                        }

                        return;
                    }

                    signingData.set(parsedSigningData);
                    isSigningRequest.set(true);
                    signingDrawerOpen.set(true);
                } catch (error) {
                    console.error("Error decoding signing data:", error);
                    return;
                }
            }
        } else if (data.type === "reveal") {
            console.log("Handling reveal deep link");

            // Close all other modals first
            codeScannedDrawerOpen.set(false);
            loggedInDrawerOpen.set(false);
            signingDrawerOpen.set(false);

            const pollId = data.pollId;

            if (pollId) {
                console.log("🔍 Reveal request for poll:", pollId);

                revealError.set(null); // Clear any previous reveal errors
                revealPollId.set(pollId);
                isRevealRequest.set(true);
            } else {
                console.error("Missing pollId in reveal request");
                revealError.set("Invalid reveal request. Poll ID is missing.");
            }
        }
    }

    async function initialize() {
        console.log("Scan QR page mounted, checking authentication...");

        try {
            const vault = await globalState.vaultController.vault;
            if (!vault) {
                console.log("User not authenticated, redirecting to login");
                await goto("/login");
                return () => {};
            }
            console.log(
                "User authenticated, proceeding with scan functionality",
            );
        } catch (error) {
            console.log("Authentication check failed, redirecting to login");
            await goto("/login");
            return () => {};
        }

        console.log("Scan QR page mounted, checking for deep link data...");

        const deepLinkHandler = (event: Event) => {
            const customEvent = event as CustomEvent<DeepLinkData>;
            const detail = (customEvent.detail ?? {}) as DeepLinkData;
            console.log("Received deepLinkReceived event:", detail);
            void handleDeepLinkData(detail);
        };

        const authHandler = (event: Event) => {
            const customEvent = event as CustomEvent<Record<string, unknown>>;
            console.log("Received deepLinkAuth event:", customEvent.detail);
            void handleDeepLinkData({
                type: "auth",
                ...(customEvent.detail ?? {}),
            } as DeepLinkData);
        };

        const signHandler = (event: Event) => {
            const customEvent = event as CustomEvent<Record<string, unknown>>;
            console.log("Received deepLinkSign event:", customEvent.detail);
            void handleDeepLinkData({
                type: "sign",
                ...(customEvent.detail ?? {}),
            } as DeepLinkData);
        };

        window.addEventListener("deepLinkReceived", deepLinkHandler);
        window.addEventListener("deepLinkAuth", authHandler);
        window.addEventListener("deepLinkSign", signHandler);

        let deepLinkData = sessionStorage.getItem("deepLinkData");
        if (!deepLinkData) {
            deepLinkData = sessionStorage.getItem("pendingDeepLink");
        }

        if (deepLinkData) {
            console.log("Found deep link data:", deepLinkData);
            try {
                const data = JSON.parse(deepLinkData) as DeepLinkData;
                console.log("Parsed deep link data:", data);
                await handleDeepLinkData(data);
            } catch (error) {
                console.error("Error parsing deep link data:", error);
            } finally {
                sessionStorage.removeItem("deepLinkData");
                sessionStorage.removeItem("pendingDeepLink");
            }
        } else {
            console.log("No deep link data found, starting normal scanning");
            startScan();
        }

        return () => {
            window.removeEventListener("deepLinkReceived", deepLinkHandler);
            window.removeEventListener("deepLinkAuth", authHandler);
            window.removeEventListener("deepLinkSign", signHandler);
        };
    }

    return {
        stores: {
            platform,
            hostname,
            session,
            codeScannedDrawerOpen,
            loggedInDrawerOpen,
            signingDrawerOpen,
            scannedData,
            scanning,
            loading,
            redirect,
            signingSessionId,
            signingData,
            isSigningRequest,
            showSigningSuccess,
            isBlindVotingRequest,
            selectedBlindVoteOption,
            blindVoteError,
            isSubmittingBlindVote,
            isRevealRequest,
            revealPollId,
            revealError,
            isRevealingVote,
            revealSuccess,
            revealedVoteData,
            authError,
            signingError,
            authLoading,
        },
        actions: {
            startScan,
            cancelScan,
            handleAuth,
            handleBlindVote,
            handleSignVote,
            handleRevealVote,
            handleSuccessOkay,
            closeDrawer,
            setCodeScannedDrawerOpen,
            setLoggedInDrawerOpen,
            setSigningDrawerOpen,
            setRevealRequestOpen,
            handleBlindVoteSelection,
            handleAuthRequest,
            handleSigningRequest,
            handleRevealRequest,
            handleDeepLinkData,
            handleBlindVotingRequest,
            initialize,
        },
    };
}
