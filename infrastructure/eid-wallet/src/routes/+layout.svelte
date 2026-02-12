<script lang="ts">
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import { onDestroy, onMount, setContext } from "svelte";
import "../app.css";
import { goto, onNavigate } from "$app/navigation";
import { GlobalState } from "$lib/global/state";

import { runtime } from "$lib/global/runtime.svelte";
import { swipedetect } from "$lib/utils";
import { type Status, checkStatus } from "@tauri-apps/plugin-biometric";

const { children } = $props();

let globalState: GlobalState | undefined = $state(undefined);

let showSplashScreen = $state(false);
let previousRoute = null;
let navigationStack: string[] = [];
let globalDeepLinkHandler: ((event: Event) => void) | undefined;
let mainWrapper: HTMLElement | undefined = $state(undefined);
let isAppReady = $state(false);
let pendingDeepLinks: string[] = $state([]);

setContext("globalState", () => globalState);
setContext("setGlobalState", (value: GlobalState | undefined) => {
    globalState = value;
});

// replace with actual data loading logic
async function loadData() {
    await new Promise((resolve) => setTimeout(resolve, 1500));
}

async function ensureMinimumDelay() {
    await new Promise((resolve) => setTimeout(resolve, 500));
}

/**
 * Helper to add a timeout to any promise
 */
function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    name: string,
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(
                () => reject(new Error(`${name} timed out after ${ms}ms`)),
                ms,
            ),
        ),
    ]);
}

onMount(async () => {
    let status: Status | undefined = undefined;
    try {
        status = await checkStatus();
    } catch (error) {
        status = {
            biometryType: 0,
            isAvailable: false,
        };
    }
    runtime.biometry = status.biometryType;

    try {
        globalState = await withTimeout(
            GlobalState.create(),
            10000,
            "GlobalState.create",
        );
    } catch (error) {
        console.error("Failed to initialize global state:", error);
        // Show error and prevent app from continuing without global state
        alert("Failed to initialize app. Please restart the application.");
        throw error; // Prevent further execution
    }

    // Handle deep links
    try {
        const { onOpenUrl, getCurrent } = await import(
            "@tauri-apps/plugin-deep-link"
        );

        // Check if app was started via deep link
        const initialUrls = await getCurrent();
        if (initialUrls && initialUrls.length > 0) {
            if (globalState) {
                handleDeepLink(initialUrls[0]);
            } else {
                pendingDeepLinks = [...pendingDeepLinks, initialUrls[0]];
            }
        }

        // Listen for future deep links
        await onOpenUrl((urls) => {
            if (urls && urls.length > 0) {
                try {
                    if (isAppReady && globalState) {
                        handleDeepLink(urls[0]);
                    } else {
                        // Queue deep link if app isn't ready yet
                        console.log(
                            "App not ready, queueing deep link:",
                            urls[0],
                        );
                        pendingDeepLinks = [...pendingDeepLinks, urls[0]];
                    }
                } catch (error) {
                    console.error(
                        "Error handling deep link from onOpenUrl:",
                        error,
                    );
                }
            }
        });

        // Set up global event listener for deep links that arrive when app is already open
        // This ensures deep links work even if the scan-qr page isn't mounted yet
        globalDeepLinkHandler = (event: Event) => {
            try {
                const customEvent = event as CustomEvent;
                console.log(
                    "Global deep link event received:",
                    customEvent.detail,
                );

                if (!isAppReady || !globalState) {
                    console.log(
                        "App not ready, storing deep link data for later",
                    );
                    sessionStorage.setItem(
                        "deepLinkData",
                        JSON.stringify(customEvent.detail),
                    );
                    return;
                }

                // Check if we're already on the scan page
                if (window.location.pathname === "/scan-qr") {
                    // We're already on the scan page, dispatch the event directly
                    console.log(
                        "Already on scan page, dispatching event directly",
                    );
                    const directEvent = new CustomEvent("deepLinkReceived", {
                        detail: customEvent.detail,
                    });
                    window.dispatchEvent(directEvent);
                } else {
                    // Store the deep link data and navigate to scan page
                    console.log(
                        "Not on scan page, storing data and navigating",
                    );
                    sessionStorage.setItem(
                        "deepLinkData",
                        JSON.stringify(customEvent.detail),
                    );
                    goto("/scan-qr").catch((error) => {
                        console.error("Error navigating to scan-qr:", error);
                    });
                }
            } catch (error) {
                console.error("Error in globalDeepLinkHandler:", error);
            }
        };

        window.addEventListener("deepLinkReceived", globalDeepLinkHandler);
    } catch (error) {
        console.error("Failed to initialize deep link listener:", error);
    }

    // Helper function to check if user is on an authenticated route
    function isAuthenticatedRoute(pathname: string): boolean {
        // Authenticated routes are those under (app)/ which are protected by the auth guard
        const authenticatedRoutes = ["/main", "/scan-qr", "/settings"];
        return authenticatedRoutes.includes(pathname);
    }

    function handleDeepLink(urlString: string) {
        console.log("Deep link received:", urlString);

        try {
            const url = new URL(urlString);
            const path = url.pathname;
            const params = url.searchParams;

            console.log("Deep link path:", path);
            console.log("Deep link hostname:", url.hostname);
            console.log("Deep link protocol:", url.protocol);
            console.log("Deep link full URL object:", url);
            console.log(
                "Deep link params:",
                Object.fromEntries(params.entries()),
            );

            // Check if we're already on the scan-qr page
            const currentPath = window.location.pathname;
            const isOnScanPage = currentPath === "/scan-qr";
            const isOnAuthenticatedRoute = isAuthenticatedRoute(currentPath);
            console.log(
                "Current path:",
                currentPath,
                "Is on scan page:",
                isOnScanPage,
                "Is on authenticated route:",
                isOnAuthenticatedRoute,
            );

            // For w3ds:// URLs, we need to check the hostname instead of pathname
            // w3ds://auth becomes hostname: "auth", pathname: ""
            const action = url.hostname || path;
            console.log("Deep link action (hostname):", action);

            // Example: w3ds://auth?session=123&platform=example&redirect=https://example.com
            if (action === "auth") {
                // Handle authentication deep link
                const sessionId = params.get("session");
                const platform = params.get("platform");
                const redirect = params.get("redirect");

                console.log(
                    "Auth deep link - session:",
                    sessionId,
                    "platform:",
                    platform,
                    "redirect:",
                    redirect,
                );

                if (sessionId && platform && redirect) {
                    // Always store the deep link data first
                    const deepLinkData = {
                        type: "auth",
                        session: sessionId,
                        platform: platform,
                        redirect: redirect,
                    };

                    // Check if user is authenticated by checking if they're on an authenticated route
                    const checkAuth = async () => {
                        // First check if user is on an authenticated route
                        // If not, they need to login first regardless of vault existence
                        if (!isOnAuthenticatedRoute) {
                            console.log(
                                "User not on authenticated route, storing deep link and redirecting to login",
                            );
                            sessionStorage.setItem(
                                "pendingDeepLink",
                                JSON.stringify(deepLinkData),
                            );
                            goto("/login").catch((error) => {
                                console.error(
                                    "Error navigating to login:",
                                    error,
                                );
                            });
                            return;
                        }

                        try {
                            // Wait for globalState to be ready if it's not yet
                            if (!globalState) {
                                console.log(
                                    "GlobalState not ready, waiting...",
                                );
                                // Wait a bit and retry, or just redirect to login
                                let retries = 0;
                                const maxRetries = 10;
                                while (!globalState && retries < maxRetries) {
                                    await new Promise((resolve) =>
                                        setTimeout(resolve, 100),
                                    );
                                    retries++;
                                }

                                if (!globalState) {
                                    console.log(
                                        "GlobalState still not ready, storing deep link and redirecting to login",
                                    );
                                    sessionStorage.setItem(
                                        "pendingDeepLink",
                                        JSON.stringify(deepLinkData),
                                    );
                                    goto("/login").catch((error) => {
                                        console.error(
                                            "Error navigating to login:",
                                            error,
                                        );
                                    });
                                    return;
                                }
                            }

                            const vault =
                                await globalState.vaultController.vault;
                            if (vault) {
                                // User is authenticated, dispatch event and navigate to scan page
                                console.log(
                                    "User authenticated, dispatching deep link event and navigating to scan-qr",
                                );

                                // Dispatch a custom event that the scan page can listen to
                                const deepLinkEvent = new CustomEvent(
                                    "deepLinkReceived",
                                    {
                                        detail: deepLinkData,
                                    },
                                );
                                window.dispatchEvent(deepLinkEvent);

                                // Also store in sessionStorage as backup
                                sessionStorage.setItem(
                                    "deepLinkData",
                                    JSON.stringify(deepLinkData),
                                );

                                goto("/scan-qr").catch((error) => {
                                    console.error(
                                        "Error navigating to scan-qr:",
                                        error,
                                    );
                                });
                                return;
                            }
                        } catch (error) {
                            console.log(
                                "User not authenticated, redirecting to login",
                                error,
                            );
                        }

                        // User not authenticated, store deep link data and redirect to login
                        console.log(
                            "User not authenticated, storing deep link data and redirecting to login",
                        );
                        sessionStorage.setItem(
                            "pendingDeepLink",
                            JSON.stringify(deepLinkData),
                        );
                        goto("/login").catch((error) => {
                            console.error("Error navigating to login:", error);
                        });
                    };

                    checkAuth();
                } else {
                    console.log("Missing required auth parameters");
                }
            } else if (action === "sign") {
                // Handle signing deep link
                const sessionId = params.get("session");
                const data = params.get("data");
                const redirectUri = params.get("redirect_uri");

                console.log(
                    "Sign deep link - session:",
                    sessionId,
                    "data:",
                    data,
                    "redirect_uri:",
                    redirectUri,
                );

                if (sessionId && data && redirectUri) {
                    // Always store the deep link data first
                    const deepLinkData = {
                        type: "sign",
                        session: sessionId,
                        data: data,
                        redirect_uri: redirectUri,
                    };

                    // Check if user is authenticated by checking if they're on an authenticated route
                    const checkAuth = async () => {
                        // First check if user is on an authenticated route
                        // If not, they need to login first regardless of vault existence
                        if (!isOnAuthenticatedRoute) {
                            console.log(
                                "User not on authenticated route, storing deep link and redirecting to login",
                            );
                            sessionStorage.setItem(
                                "pendingDeepLink",
                                JSON.stringify(deepLinkData),
                            );
                            goto("/login").catch((error) => {
                                console.error(
                                    "Error navigating to login:",
                                    error,
                                );
                            });
                            return;
                        }

                        try {
                            // Wait for globalState to be ready if it's not yet
                            if (!globalState) {
                                console.log(
                                    "GlobalState not ready, waiting...",
                                );
                                // Wait a bit and retry, or just redirect to login
                                let retries = 0;
                                const maxRetries = 10;
                                while (!globalState && retries < maxRetries) {
                                    await new Promise((resolve) =>
                                        setTimeout(resolve, 100),
                                    );
                                    retries++;
                                }

                                if (!globalState) {
                                    console.log(
                                        "GlobalState still not ready, storing deep link and redirecting to login",
                                    );
                                    sessionStorage.setItem(
                                        "pendingDeepLink",
                                        JSON.stringify(deepLinkData),
                                    );
                                    goto("/login").catch((error) => {
                                        console.error(
                                            "Error navigating to login:",
                                            error,
                                        );
                                    });
                                    return;
                                }
                            }

                            const vault =
                                await globalState.vaultController.vault;
                            if (vault) {
                                // User is authenticated, dispatch event and navigate to scan page
                                console.log(
                                    "User authenticated, dispatching deep link event and navigating to scan-qr",
                                );

                                // Dispatch a custom event that the scan page can listen to
                                const deepLinkEvent = new CustomEvent(
                                    "deepLinkReceived",
                                    {
                                        detail: deepLinkData,
                                    },
                                );
                                window.dispatchEvent(deepLinkEvent);

                                // Also store in sessionStorage as backup
                                sessionStorage.setItem(
                                    "deepLinkData",
                                    JSON.stringify(deepLinkData),
                                );

                                goto("/scan-qr").catch((error) => {
                                    console.error(
                                        "Error navigating to scan-qr:",
                                        error,
                                    );
                                });
                                return;
                            }
                        } catch (error) {
                            console.log(
                                "User not authenticated, redirecting to login",
                                error,
                            );
                        }

                        // User not authenticated, store deep link data and redirect to login
                        console.log(
                            "User not authenticated, storing deep link data and redirecting to login",
                        );
                        sessionStorage.setItem(
                            "pendingDeepLink",
                            JSON.stringify(deepLinkData),
                        );
                        goto("/login").catch((error) => {
                            console.error("Error navigating to login:", error);
                        });
                    };

                    checkAuth();
                } else {
                    console.log("Missing required signing parameters");
                }
            } else if (action === "reveal") {
                // Handle reveal deep link
                const pollId = params.get("pollId");

                console.log("Reveal deep link - pollId:", pollId);

                if (pollId) {
                    // Always store the deep link data first
                    const deepLinkData = {
                        type: "reveal",
                        pollId: pollId,
                    };

                    // Check if user is authenticated by checking if they're on an authenticated route
                    const checkAuth = async () => {
                        // First check if user is on an authenticated route
                        // If not, they need to login first regardless of vault existence
                        if (!isOnAuthenticatedRoute) {
                            console.log(
                                "User not on authenticated route, storing deep link and redirecting to login",
                            );
                            sessionStorage.setItem(
                                "pendingDeepLink",
                                JSON.stringify(deepLinkData),
                            );
                            goto("/login").catch((error) => {
                                console.error(
                                    "Error navigating to login:",
                                    error,
                                );
                            });
                            return;
                        }

                        try {
                            // Wait for globalState to be ready if it's not yet
                            if (!globalState) {
                                console.log(
                                    "GlobalState not ready, waiting...",
                                );
                                // Wait a bit and retry, or just redirect to login
                                let retries = 0;
                                const maxRetries = 10;
                                while (!globalState && retries < maxRetries) {
                                    await new Promise((resolve) =>
                                        setTimeout(resolve, 100),
                                    );
                                    retries++;
                                }

                                if (!globalState) {
                                    console.log(
                                        "GlobalState still not ready, storing deep link and redirecting to login",
                                    );
                                    sessionStorage.setItem(
                                        "pendingDeepLink",
                                        JSON.stringify(deepLinkData),
                                    );
                                    goto("/login").catch((error) => {
                                        console.error(
                                            "Error navigating to login:",
                                            error,
                                        );
                                    });
                                    return;
                                }
                            }

                            const vault =
                                await globalState.vaultController.vault;
                            if (vault) {
                                // User is authenticated, dispatch event and navigate to scan page
                                console.log(
                                    "User authenticated, dispatching deep link event and navigating to scan-qr for reveal",
                                );

                                // Dispatch a custom event that the scan page can listen to
                                const deepLinkEvent = new CustomEvent(
                                    "deepLinkReceived",
                                    {
                                        detail: deepLinkData,
                                    },
                                );
                                window.dispatchEvent(deepLinkEvent);

                                // Also store in sessionStorage as backup
                                sessionStorage.setItem(
                                    "deepLinkData",
                                    JSON.stringify(deepLinkData),
                                );

                                goto("/scan-qr").catch((error) => {
                                    console.error(
                                        "Error navigating to scan-qr:",
                                        error,
                                    );
                                });
                                return;
                            }
                        } catch (error) {
                            console.log(
                                "User not authenticated, redirecting to login",
                                error,
                            );
                        }

                        // User not authenticated, store deep link data and redirect to login
                        console.log(
                            "User not authenticated, storing reveal deep link data and redirecting to login",
                        );
                        sessionStorage.setItem(
                            "pendingDeepLink",
                            JSON.stringify(deepLinkData),
                        );
                        goto("/login").catch((error) => {
                            console.error("Error navigating to login:", error);
                        });
                    };

                    checkAuth();
                } else {
                    console.log("Missing required reveal parameters");
                }
            } else {
                console.log("Unknown deep link path:", path);
            }
        } catch (error) {
            console.error("Failed to parse deep link URL:", error);
        }
    }

    showSplashScreen = true; // Can't set up the original state to true or animation won't start
    navigationStack.push(window.location.pathname);

    await Promise.all([loadData(), ensureMinimumDelay()]);

    // Only hide splash screen if globalState is initialized
    if (globalState) {
        showSplashScreen = false;
        // Mark app as ready and process any pending deep links
        isAppReady = true;
    }

    // Process queued deep links
    if (pendingDeepLinks.length > 0 && globalState) {
        console.log("Processing", pendingDeepLinks.length, "queued deep links");
        for (const deepLink of pendingDeepLinks) {
            try {
                handleDeepLink(deepLink);
            } catch (error) {
                console.error("Error processing queued deep link:", error);
            }
        }
        pendingDeepLinks = [];
    }
});

// Cleanup global event listeners
onDestroy(() => {
    if (typeof globalDeepLinkHandler !== "undefined") {
        window.removeEventListener("deepLinkReceived", globalDeepLinkHandler);
    }
});

const safeAreaTop = $derived.by(
    () =>
        Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
                "--safe-top",
            ),
        ) || 0,
);

onNavigate((navigation) => {
    if (!document.startViewTransition) return;

    const from = navigation.from?.url.pathname;
    const to = navigation.to?.url.pathname;

    if (!from || !to || from === to) return;

    let direction: "left" | "right" = "right";

    const fromIndex = navigationStack.lastIndexOf(from);
    const toIndex = navigationStack.lastIndexOf(to);

    if (toIndex !== -1 && toIndex < fromIndex) {
        // Backward navigation
        direction = "left";
        navigationStack = navigationStack.slice(0, toIndex + 1);
    } else {
        // Forward navigation (or new path)
        direction = "right";
        navigationStack.push(to);
    }

    document.documentElement.setAttribute("data-transition", direction);
    previousRoute = to;

    return new Promise((resolve) => {
        document.startViewTransition(async () => {
            resolve();
            await navigation.complete;
        });
    });
});

$effect(() => {
    if (mainWrapper) {
        swipedetect(mainWrapper, (dir: string) => {
            if (dir === "right") window.history.back();
        });
    }
});
</script>

{#if showSplashScreen || !globalState}
    <SplashScreen />
{:else}
    <div
        class="fixed top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-primary z-50"
    ></div>
    <div
        bind:this={mainWrapper}
        class="bg-white h-screen overflow-scroll py-10"
    >
        {#if children}
            {@render children()}
        {/if}
    </div>
{/if}

<style>
    :root {
        --safe-bottom: env(safe-area-inset-bottom);
        --safe-top: env(safe-area-inset-top);
    }

    :global(body),
    * {
        -webkit-overflow-scrolling: touch; /* keeps momentum scrolling on iOS */
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE 10+ */
    }

    /* Hide scrollbar for WebKit (Chrome, Safari) */
    :global(body::-webkit-scrollbar),
    *::-webkit-scrollbar {
        display: none;
    }
</style>
