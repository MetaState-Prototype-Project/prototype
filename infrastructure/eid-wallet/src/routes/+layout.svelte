<script lang="ts">
import { onDestroy, onMount, setContext } from "svelte";
import { cubicOut } from "svelte/easing";
import "../app.css";
import { beforeNavigate, goto, onNavigate, preloadCode } from "$app/navigation";
import { page } from "$app/state";
import { GlobalState } from "$lib/global/state";

import { runtime } from "$lib/global/runtime.svelte";
import { swipedetect } from "$lib/utils";
import { installTerminalConsoleBridge } from "$lib/utils/terminalConsole";
import { type Status, checkStatus } from "@tauri-apps/plugin-biometric";

// Mirror console.* to the Tauri host stdout so logs land in `pnpm tauri dev`.
installTerminalConsoleBridge();

const { children } = $props();

let globalState: GlobalState | undefined = $state(undefined);
let navigationStack: string[] = [];
// Direction of the next route transition. Set by onNavigate before the
// route content swaps, read by the slide transitions wrapping {@render children()}.
let routeDirection = $state<"forward" | "backward">("forward");

// Asymmetric route transitions: only one element moves per direction.
//   Forward  → NEW slides in over OLD (OLD stays put).
//   Backward → OLD slides out to the right, revealing NEW (NEW stays put).
// The moving element gets a higher z-index so it sits on top of the
// static one during the animation.
function slideIn(
    _node: HTMLElement,
    { direction }: { direction: "forward" | "backward" },
) {
    if (direction === "backward") {
        // NEW stays put — no animation, just instantaneous mount.
        return { duration: 0 };
    }
    return {
        duration: 200,
        easing: cubicOut,
        css: (t: number) =>
            `transform: translateX(${(1 - t) * 100}%); z-index: 70;`,
    };
}

function slideOut(
    _node: HTMLElement,
    { direction }: { direction: "forward" | "backward" },
) {
    if (direction === "forward") {
        // OLD stays put for the duration of the new page's slide-in.
        return {
            duration: 200,
            css: () => "transform: translateX(0);",
        };
    }
    // Backward — slide OLD off to the right.
    return {
        duration: 200,
        easing: cubicOut,
        css: (t: number) =>
            `transform: translateX(${(1 - t) * 100}%); z-index: 70;`,
    };
}
let globalDeepLinkHandler: ((event: Event) => void) | undefined;
let mainWrapper: HTMLElement | undefined = $state(undefined);
let isAppReady = $state(false);
let pendingDeepLinks: string[] = $state([]);

setContext("globalState", () => globalState);
setContext("setGlobalState", (value: GlobalState | undefined) => {
    globalState = value;
});

onMount(async () => {
    // Bundle preload for the routes the splash CTAs reach — keeps the
    // first navigation snappy on cold start.
    preloadCode("/onboarding").catch(() => {});
    preloadCode("/recover").catch(() => {});

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

    // Helper function to check if user is on an authenticated route.
    // Routes under (app)/ are protected by the auth guard. Since SvelteKit
    // route groups (parentheses) don't appear in the URL, enumerate the
    // top-level segments here. Any new (app)/<segment>/ folder must be
    // added below or its deep-links will redirect to /login.
    function isAuthenticatedRoute(pathname: string): boolean {
        const appRouteSegments = [
            "main",
            "scan-qr",
            "settings",
            "personal",
            "notifications",
            "social-bindings",
            "ePassport",
        ];
        const firstSegment = pathname.split("/")[1] ?? "";
        return appRouteSegments.includes(firstSegment);
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

    navigationStack.push(window.location.pathname);
    isAppReady = true;

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
    const from = navigation.from?.url.pathname;
    const to = navigation.to?.url.pathname;

    if (!from || !to || from === to) return;

    // Mark routes that have their own mount-time refresh guard. A SvelteKit
    // navigation (link/goto) fires this hook; a hard reload does not — so
    // the guard's onMount sees the flag iff the user genuinely navigated
    // in, and redirects to / otherwise. Any caller can goto("/onboarding")
    // without thinking about it.
    if (to === "/onboarding") {
        sessionStorage.setItem("navigatingToOnboarding", "true");
    }

    // Direction comes from the navigation TYPE, not stack indices. Indexing
    // into the stack gave wrong answers when the user navigated forward to a
    // route they'd visited before in the same session: the old entry was still
    // in the stack with a lower index, so `toIndex < fromIndex` triggered a
    // backward slide on what was actually a forward link tap.
    const isBack =
        navigation.type === "popstate" &&
        typeof navigation.delta === "number" &&
        navigation.delta < 0;

    if (isBack) {
        routeDirection = "backward";
        const toIndex = navigationStack.lastIndexOf(to);
        if (toIndex !== -1) {
            navigationStack = navigationStack.slice(0, toIndex + 1);
        }
    } else {
        routeDirection = "forward";
        navigationStack.push(to);
    }
});

// Pre-app auth routes — system/browser back must NOT land here once the user
// has reached an (app) route, otherwise pressing Android back from /main
// surfaces /login or /onboarding and the user can re-trigger flows they
// already finished. Forward navigations are unaffected. beforeNavigate must
// run synchronously, so we use the navigation stack as the "is signed in"
// proxy: if the user has ever landed on an (app) route in this session, any
// back-nav to an auth screen is blocked.
const AUTH_PATHS = new Set(["/", "/login", "/onboarding", "/recover"]);
const APP_PATH_PREFIXES = [
    "/main",
    "/scan-qr",
    "/personal",
    "/social-bindings",
    "/ePassport",
    "/settings",
    "/notifications",
    "/open-message",
];
const isAppPath = (p: string) =>
    APP_PATH_PREFIXES.some(
        (prefix) => p === prefix || p.startsWith(`${prefix}/`),
    );

beforeNavigate((navigation) => {
    if (navigation.type !== "popstate") return;

    const from = navigation.from?.url.pathname;
    const to = navigation.to?.url.pathname;

    // /main is the home — a hard floor. Pressing back from it should never
    // surface a sibling app route (scan, settings) or an auth screen. Once a
    // user has reached home, only forward navigations apply.
    if (from === "/main") {
        navigation.cancel();
        return;
    }

    // For any other route, still block back-nav that would land on a
    // pre-app auth screen if the user has reached the app this session.
    if (!to || !AUTH_PATHS.has(to)) return;
    if (!navigationStack.some(isAppPath)) return;
    navigation.cancel();
});

$effect(() => {
    if (mainWrapper) {
        swipedetect(mainWrapper, (dir: string) => {
            if (dir === "right") window.history.back();
        });
    }
});
</script>

<!-- Splash is now a regular route at /+page.svelte, so the layout just
     wraps {@render children()} with the slide transition. No more fixed
     overlay, no more stacking-context trickery. -->
<div
    bind:this={mainWrapper}
    data-route-wrapper
    class="bg-white min-h-screen overflow-y-auto relative overflow-x-hidden"
>
    {#if children}
        {#key page.url.pathname}
            <div
                data-route-wrapper
                class="absolute inset-0 bg-white"
                in:slideIn={{ direction: routeDirection }}
                out:slideOut={{ direction: routeDirection }}
            >
                {@render children()}
            </div>
        {/key}
    {/if}
</div>

<div
    class="fixed top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-primary z-80"
></div>

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
