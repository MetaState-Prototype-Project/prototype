<script lang="ts">
import SplashScreen from "$lib/fragments/SplashScreen/SplashScreen.svelte";
import Toast from "$lib/ui/Toast/Toast.svelte";
import { getContext, onDestroy, onMount, setContext } from "svelte";
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
        globalState = await GlobalState.create();
    } catch (error) {
        console.error("Failed to initialize global state:", error);
        // Consider adding fallback behavior or user notification
    }

    // Handle deep links
    try {
        const { onOpenUrl, getCurrent } = await import(
            "@tauri-apps/plugin-deep-link"
        );

        // Check if app was started via deep link
        const initialUrls = await getCurrent();
        if (initialUrls && initialUrls.length > 0) {
            handleDeepLink(initialUrls[0]);
        }

        // Listen for future deep links
        await onOpenUrl((urls) => {
            if (urls && urls.length > 0) {
                handleDeepLink(urls[0]);
            }
        });

        // Set up global event listener for deep links that arrive when app is already open
        // This ensures deep links work even if the scan-qr page isn't mounted yet
        globalDeepLinkHandler = (event: Event) => {
            const customEvent = event as CustomEvent;
            console.log("Global deep link event received:", customEvent.detail);

            // Check if we're already on the scan page
            if (window.location.pathname === "/scan-qr") {
                // We're already on the scan page, dispatch the event directly
                console.log("Already on scan page, dispatching event directly");
                const directEvent = new CustomEvent("deepLinkReceived", {
                    detail: customEvent.detail,
                });
                window.dispatchEvent(directEvent);
            } else {
                // Store the deep link data and navigate to scan page
                console.log("Not on scan page, storing data and navigating");
                sessionStorage.setItem(
                    "deepLinkData",
                    JSON.stringify(customEvent.detail),
                );
                goto("/scan-qr");
            }
        };

        window.addEventListener("deepLinkReceived", globalDeepLinkHandler);
    } catch (error) {
        console.error("Failed to initialize deep link listener:", error);
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
            console.log(
                "Current path:",
                currentPath,
                "Is on scan page:",
                isOnScanPage,
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

                    // Check if user is authenticated by looking for vault data
                    const checkAuth = async () => {
                        try {
                            // Try to access vault data - if this fails, user is not authenticated
                            const globalState =
                                getContext<() => GlobalState>("globalState")();
                            if (globalState) {
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

                                    goto("/scan-qr");
                                    return;
                                }
                            }
                        } catch (error) {
                            console.log(
                                "User not authenticated, redirecting to login",
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
                        goto("/login");
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

                    // Check if user is authenticated by looking for vault data
                    const checkAuth = async () => {
                        try {
                            // Try to access vault data - if this fails, user is not authenticated
                            const globalState =
                                getContext<() => GlobalState>("globalState")();
                            if (globalState) {
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

                                    goto("/scan-qr");
                                    return;
                                }
                            }
                        } catch (error) {
                            console.log(
                                "User not authenticated, redirecting to login",
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
                        goto("/login");
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

                    // Check if user is authenticated by looking for vault data
                    const checkAuth = async () => {
                        try {
                            // Try to access vault data - if this fails, user is not authenticated
                            const globalState =
                                getContext<() => GlobalState>("globalState")();
                            if (globalState) {
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

                                    goto("/scan-qr");
                                    return;
                                }
                            }
                        } catch (error) {
                            console.log(
                                "User not authenticated, redirecting to login",
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
                        goto("/login");
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

    showSplashScreen = false;
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

$effect(() => console.log("top", safeAreaTop));

onNavigate(async (navigation) => {
    if (!document.startViewTransition) return;

    const from = navigation.from?.url.pathname;
    const to = navigation.to?.url.pathname;

    if (!from || !to || from === to) return;

    // Prevent navigation to login/register/onboarding when logged in
    if (to === "/login" || to === "/register" || to === "/onboarding") {
        try {
            const gs = getContext<() => GlobalState>("globalState");
            if (gs) {
                const state = gs();
                const vault = await state.vaultController.vault;
                if (vault) {
                    // User is logged in, prevent navigation and redirect to main
                    await goto("/main");
                    return;
                }
            }
        } catch (error) {
            // If we can't check, allow navigation
            console.error("Error checking auth state:", error);
        }
    }

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
            if (dir === "right") {
                // Prevent going back to login/register/onboarding screens when logged in
                const currentPath = window.location.pathname;
                if (currentPath === "/login" || currentPath === "/register" || currentPath === "/onboarding") {
                    // If we're on login/register/onboarding, allow back navigation
                    window.history.back();
                } else {
                    // Check if we're logged in by checking if we can access globalState
                    try {
                        const gs = getContext<() => GlobalState>("globalState");
                        if (gs) {
                            // User is logged in, prevent going back to login/register/onboarding
                            const historyLength = window.history.length;
                            // Only allow back if we're not going to login/register/onboarding
                            const previousPath = document.referrer;
                            if (previousPath && 
                                !previousPath.includes("/login") && 
                                !previousPath.includes("/register") && 
                                !previousPath.includes("/onboarding")) {
                                window.history.back();
                            } else {
                                // Redirect to main instead
                                goto("/main");
                            }
                        } else {
                            window.history.back();
                        }
                    } catch {
                        window.history.back();
                    }
                }
            }
        });
    }
});

// Prevent browser back button from going to login/register/onboarding when logged in
$effect(() => {
    const handlePopState = async (event: PopStateEvent) => {
        const currentPath = window.location.pathname;
        
        // If navigating to login, register, or onboarding, check if user is logged in
        if (currentPath === "/login" || currentPath === "/register" || currentPath === "/onboarding") {
            try {
                const gs = getContext<() => GlobalState>("globalState");
                if (gs) {
                    const state = gs();
                    // Check if user has vault (is logged in)
                    const vault = await state.vaultController.vault;
                    if (vault) {
                        // User is logged in, prevent navigation to login/register/onboarding
                        event.preventDefault();
                        await goto("/main");
                        // Push main to history to replace the restricted route
                        window.history.pushState(null, "", "/main");
                    }
                }
            } catch (error) {
                // If we can't check, allow navigation
                console.error("Error checking auth state:", error);
            }
        }
    };

    window.addEventListener("popstate", handlePopState);
    
    return () => {
        window.removeEventListener("popstate", handlePopState);
    };
});
</script>

{#if showSplashScreen}
    <SplashScreen />
{:else}
    <div
        class="fixed top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-primary z-50"
    ></div>
    <div
        bind:this={mainWrapper}
        class="bg-white h-screen overflow-scroll pt-10"
    >
        {#if children}
            {@render children()}
        {/if}
    </div>
{/if}

<svelte:component this={Toast} />

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
