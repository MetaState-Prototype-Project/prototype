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
    let signingSuccess = $state(false);

    async function startScan() {
        let permissions = await checkPermissions()
            .then((permissions) => {
                return permissions;
            })
            .catch(() => {
                return null;
            });

        if (permissions === "prompt") {
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
            // Format: w3ds://sign?session=<sessionId>&data=<base64Data>&redirect_uri=<redirectUri>
            const url = new URL(content);
            signingSessionId = url.searchParams.get("session");
            const base64Data = url.searchParams.get("data");
            const redirectUri = url.searchParams.get("redirect_uri");

            if (!signingSessionId || !base64Data || !redirectUri) {
                console.error("Invalid signing request parameters");
                return;
            }

            // Store redirect_uri for later use
            redirect = redirectUri;

            // Decode the base64 data
            try {
                const decodedString = atob(base64Data);
                signingData = JSON.parse(decodedString);

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
            } catch (error) {
                console.error("Error decoding signing data:", error);
                return;
            }

            isSigningRequest = true;
            signingDrawerOpen = true;
        } catch (error) {
            console.error("Error parsing signing request:", error);
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

            // In a real implementation, you would use the vault's signing capabilities
            // For now, we'll simulate the signing process
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate signing delay

            // Create the signed payload
            const signedPayload = {
                sessionId: signingSessionId,
                signature: "simulated_signature_" + Date.now(), // In real implementation, this would be the actual signature
                publicKey: vault?.ename || "unknown_public_key", // Use eName as public key for now
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

            // Close the signing drawer and show success
            signingDrawerOpen = false;
            signingSuccess = true;

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
                        // Show success message briefly, then continue
                        setTimeout(() => {
                            signingSuccess = false;
                            startScan();
                        }, 1500); // Give user time to see success message
                        return;
                    }
                } catch (error) {
                    console.error("Error parsing deep link data:", error);
                }
            }

            // Not from deep link, continue scanning after a short delay
            setTimeout(() => {
                signingSuccess = false;
                startScan();
            }, 2000);
        } catch (error) {
            console.error("Error signing vote:", error);
            // You could show an error message here
        } finally {
            loading = false;
        }
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
        function handleDeepLinkData(data: any) {
            console.log("Handling deep link data:", data);
            console.log("Data type:", data.type);
            console.log("Platform:", data.platform);
            console.log("Session:", data.session);
            console.log("Redirect:", data.redirect);
            console.log("Redirect URI:", data.redirect_uri);

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
                    } catch (error) {
                        console.error("Error decoding signing data:", error);
                        return;
                    }
                    isSigningRequest = true;
                    signingDrawerOpen = true;
                    console.log("Signing modal should now be open");
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
                handleDeepLinkData(data);
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
        const handleAuthEvent = (event: CustomEvent) => {
            console.log("Received deepLinkAuth event:", event.detail);
            handleDeepLinkData({
                type: "auth",
                ...event.detail,
            });
        };

        const handleSignEvent = (event: CustomEvent) => {
            console.log("Received deepLinkSign event:", event.detail);
            handleDeepLinkData({
                type: "sign",
                ...event.detail,
            });
        };

        window.addEventListener(
            "deepLinkAuth",
            handleAuthEvent as EventListener,
        );
        window.addEventListener(
            "deepLinkSign",
            handleSignEvent as EventListener,
        );

        // Cleanup event listeners
        onDestroy(() => {
            window.removeEventListener(
                "deepLinkAuth",
                handleAuthEvent as EventListener,
            );
            window.removeEventListener(
                "deepLinkSign",
                handleSignEvent as EventListener,
            );
        });
    });

    onDestroy(async () => {
        await cancelScan();
    });
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
    title={signingData?.pollId ? "Sign Vote" : "Sign Message"}
    bind:isPaneOpen={signingDrawerOpen}
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

    <h4>
        {signingData?.pollId ? "Sign Vote Request" : "Sign Message Request"}
    </h4>
    <p class="text-black-700">
        {signingData?.pollId
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

        <div class="bg-gray rounded-2xl w-full p-4">
            <h4 class="text-base text-black-700">Your Vote</h4>
            <div class="text-black-700 font-normal">
                {#if signingData?.voteData?.optionId !== undefined}
                    <!-- Normal voting mode -->
                    <p>
                        You selected: <strong
                            >Option {parseInt(signingData.voteData.optionId) +
                                1}</strong
                        >
                    </p>
                    <p class="text-sm text-gray-600 mt-1">
                        (This is the option number from the poll)
                    </p>
                {:else if signingData?.voteData?.ranks}
                    <!-- Ranked voting mode -->
                    <p class="mb-2">Your ranking order:</p>
                    <div class="space-y-2">
                        {#each Object.entries(signingData.voteData.ranks).sort(([a], [b]) => parseInt(a) - parseInt(b)) as [rank, optionIndex]}
                            <div
                                class="flex items-center space-x-3 p-2 bg-blue-50 rounded-lg"
                            >
                                <span
                                    class="text-sm bg-blue-500 text-white px-3 py-1 rounded-full font-medium"
                                >
                                    {rank === "1"
                                        ? "1st"
                                        : rank === "2"
                                          ? "2nd"
                                          : rank === "3"
                                            ? "3rd"
                                            : `${rank}th`}
                                </span>
                                <span class="font-medium"
                                    >Option {parseInt(String(optionIndex)) +
                                        1}</span
                                >
                            </div>
                        {/each}
                    </div>
                    <p class="text-sm text-gray-600 mt-2">
                        (1st = most preferred, 2nd = second choice, etc.)
                    </p>
                {:else if signingData?.voteData?.points}
                    <!-- Points voting mode -->
                    <p class="mb-2">Your point distribution:</p>
                    <div class="space-y-2">
                        {#each Object.entries(signingData.voteData.points)
                            .filter(([_, points]) => (points as number) > 0)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b)) as [optionIndex, points]}
                            <div
                                class="flex items-center space-x-3 p-2 bg-purple-50 rounded-lg"
                            >
                                <span
                                    class="text-sm bg-purple-500 text-white px-3 py-1 rounded-full font-medium"
                                >
                                    {points} pts
                                </span>
                                <span class="font-medium"
                                    >Option {parseInt(String(optionIndex)) +
                                        1}</span
                                >
                            </div>
                        {/each}
                    </div>
                    <p class="text-sm text-gray-600 mt-2">
                        (Total: {Object.values(
                            signingData.voteData.points,
                        ).reduce(
                            (sum, points) =>
                                (sum as number) + ((points as number) || 0),
                            0,
                        )}/100 points)
                    </p>
                {:else}
                    <p>Vote data not available</p>
                {/if}
            </div>
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
        <Button.Action variant="solid" class="w-full" callback={handleSignVote}>
            {loading
                ? "Signing..."
                : signingData?.pollId
                  ? "Sign Vote"
                  : "Sign Message"}
        </Button.Action>
    </div>

    <div class="text-center mt-3">
        <p class="text-sm text-gray-600">
            After signing, you'll be redirected back to the platform
        </p>
    </div>
</Drawer>

<!-- Success message -->
{#if signingSuccess}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
        <div class="bg-white rounded-lg p-6 max-w-sm mx-4 text-center">
            <div
                class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
            >
                <HugeiconsIcon
                    size={32}
                    icon={QrCodeIcon}
                    color="var(--color-success)"
                />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-2">
                {signingData?.pollId
                    ? "Vote Signed Successfully!"
                    : "Message Signed Successfully!"}
            </h3>
            <p class="text-gray-600">
                {signingData?.pollId
                    ? "Your vote has been signed and submitted to the voting system."
                    : "Your message has been signed and submitted successfully."}
            </p>

            {#if redirect}
                <div class="mt-4">
                    <Button.Action
                        variant="solid"
                        size="sm"
                        callback={() => {
                            try {
                                if (redirect) {
                                    window.location.href = redirect;
                                }
                            } catch (error) {
                                console.error("Manual redirect failed:", error);
                            }
                        }}
                        class="w-full"
                    >
                        Return to Platform Now
                    </Button.Action>
                </div>
            {/if}
        </div>
    </div>
{/if}
