<script lang="ts">
import { onMount, setContext } from "svelte";
import { cubicOut } from "svelte/easing";
import "../app.css";
import { beforeNavigate, goto, onNavigate, preloadCode } from "$app/navigation";
import { page } from "$app/state";
import { GlobalState } from "$lib/global/state";

import { runtime } from "$lib/global/runtime.svelte";
import { swipedetect } from "$lib/utils";
import {
    isAuthPromptInFlight,
    isDeepLinkFlowActive,
    isWalletAuthenticated,
    markDeepLinkPending,
    markDeepLinkReady,
} from "$lib/utils/deepLinkFlow";
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
let mainWrapper: HTMLElement | undefined = $state(undefined);
// Last URL handed to handleDeepLink, used to drop duplicate deliveries of the
// same cold-start URL. Not reactive: it never drives rendering.
let lastHandledDeepLink: string | undefined;
let resolveInitialDeepLink = () => {};
const initialDeepLinkReady = new Promise<void>((resolve) => {
    resolveInitialDeepLink = resolve;
});

setContext("globalState", () => globalState);
setContext("initialDeepLinkReady", initialDeepLinkReady);
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

        // Register first so a URL delivered while getCurrent() is checking the
        // cold-start payload cannot fall into a gap between the two calls.
        await onOpenUrl((urls) => {
            if (urls && urls.length > 0) {
                try {
                    // handleDeepLink stores pendingDeepLink synchronously when
                    // authentication is required, before starting navigation.
                    handleDeepLink(urls[0]);
                } catch (error) {
                    console.error(
                        "Error handling deep link from onOpenUrl:",
                        error,
                    );
                }
            }
        });

        // Check if app was started via deep link.
        const initialUrls = await getCurrent();
        if (initialUrls && initialUrls.length > 0) {
            handleDeepLink(initialUrls[0]);
        }

        // NOTE: there is deliberately no window-level "deepLinkReceived"
        // listener here. handleDeepLink dispatches that event itself, so a
        // listener in this layout would re-handle its own dispatch, re-write
        // sessionStorage and fire a second goto("/scan-qr") — a duplicate
        // navigation that could unmount /scan-qr's drawer just after it
        // opened. /scan-qr subscribes to the event directly; that is the only
        // consumer it needs.
    } catch (error) {
        console.error("Failed to initialize deep link listener:", error);
    } finally {
        resolveInitialDeepLink();
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

    /**
     * Turn a deep-link URL into a payload, or null when it is not one we
     * understand or is missing required parameters.
     */
    function parseDeepLink(urlString: string): Record<string, string> | null {
        let url: URL;
        try {
            url = new URL(urlString);
        } catch (error) {
            console.error("Failed to parse deep link URL:", urlString, error);
            return null;
        }

        const params = url.searchParams;
        // For w3ds:// URLs the action lands in the hostname
        // ("w3ds://auth" -> hostname "auth"), but custom schemes are not
        // uniformly parsed across platforms, so fall back to the pathname.
        const action = url.hostname || url.pathname.replace(/^\/+/, "");

        const required = (...names: string[]) => {
            const out: Record<string, string> = {};
            for (const name of names) {
                const value = params.get(name);
                if (!value) {
                    console.log(
                        `Deep link "${action}" missing required parameter "${name}"`,
                    );
                    return null;
                }
                out[name] = value;
            }
            return out;
        };

        if (action === "auth") {
            const p = required("session", "platform", "redirect");
            return p && { type: "auth", ...p };
        }

        if (action === "sign") {
            const p = required("session", "data", "redirect_uri");
            return p && { type: "sign", ...p };
        }

        if (action === "reveal") {
            const p = required("pollId");
            return p && { type: "reveal", ...p };
        }

        console.log("Unknown deep link action:", action, "from", urlString);
        return null;
    }

    /**
     * Route an incoming deep link.
     *
     * Order-independence is the whole point here. This runs concurrently with
     * authentication on a cold start, so it must behave correctly whether it
     * fires before the biometric prompt, while the prompt is on screen, or
     * after the user is already inside the app.
     */
    function handleDeepLink(urlString: string) {
        console.log("Deep link received:", urlString);

        // Android commonly delivers a cold-start URL through BOTH getCurrent()
        // and the onOpenUrl callback. Handling it twice fires two navigations
        // at the consent screen, and the second one can unmount the drawer the
        // first just opened. One delivery per URL is enough.
        if (urlString === lastHandledDeepLink) {
            console.log("Duplicate deep link delivery ignored:", urlString);
            return;
        }
        lastHandledDeepLink = urlString;

        const payload = parseDeepLink(urlString);
        if (!payload) return;

        const currentPath = window.location.pathname;
        const alreadyInsideApp =
            isAuthenticatedRoute(currentPath) || isWalletAuthenticated();

        console.log("Deep link routing:", {
            payloadType: payload.type,
            currentPath,
            alreadyInsideApp,
            authPromptInFlight: isAuthPromptInFlight(),
        });

        // The user is not through authentication yet. Park the payload and let
        // whoever owns the auth prompt deliver it afterwards.
        if (!alreadyInsideApp) {
            markDeepLinkPending(payload);

            // A biometric/PIN prompt is already on screen. Its post-auth
            // routine will pick the payload up and navigate. Issuing our own
            // goto() here would race that navigation — the bug where the
            // consent screen flashed and vanished on fast authentication.
            if (isAuthPromptInFlight()) {
                console.log(
                    "Auth prompt in flight, deferring navigation to post-auth routine",
                );
                return;
            }

            goto("/login").catch((error) => {
                console.error("Error navigating to login:", error);
            });
            return;
        }

        // Authenticated: hand the payload straight to the consent screen. The
        // event covers an already-mounted /scan-qr; sessionStorage covers the
        // mount that the goto() below triggers.
        markDeepLinkReady(payload);
        window.dispatchEvent(
            new CustomEvent("deepLinkReceived", { detail: payload }),
        );

        if (currentPath !== "/scan-qr") {
            goto("/scan-qr").catch((error) => {
                console.error("Error navigating to scan-qr:", error);
            });
        }
    }

    navigationStack.push(window.location.pathname);
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
