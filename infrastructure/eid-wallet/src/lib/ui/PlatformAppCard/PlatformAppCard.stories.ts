import type { ComponentProps } from "svelte";
import PlatformAppCard from "./PlatformAppCard.svelte";

/**
 * Visual verification for the PlatformAppCard icon cascade:
 *
 *   1. Bundled local icon — hostname's first subdomain is in
 *      `@metastate-foundation/platform-icons`.
 *   2. apple-touch-icon — third-party platform that ships
 *      `/apple-touch-icon.png`.
 *   3. favicon — third-party platform without apple-touch-icon but with
 *      `/favicon.ico`.
 *   4. Letter fallback — unreachable hostname / no hostname at all.
 *
 * Run with `pnpm --filter eid-wallet storybook` and inspect each story.
 * Stages 2 and 3 require an internet connection.
 */

export default {
    title: "UI/PlatformAppCard",
    component: PlatformAppCard,
    tags: ["autodocs"],
    parameters: {
        // The card has a transparent background everywhere; give it a tinted
        // backdrop in Storybook so the white card body is visible.
        backgrounds: { default: "tinted" },
    },
    render: (args: ComponentProps<typeof PlatformAppCard>) => ({
        Component: PlatformAppCard,
        props: args,
    }),
};

export const BundledIcon = {
    name: "1. Bundled icon (eVoting)",
    args: {
        hostname: "evoting.w3ds.metastate.foundation",
        platformName: "eVoting",
    },
};

export const AppleTouchIcon = {
    name: "2. apple-touch-icon fallback (GitHub)",
    args: {
        hostname: "github.com",
        platformName: "GitHub",
    },
};

export const FaviconFallback = {
    name: "3. favicon.ico fallback (djangoproject.com)",
    args: {
        // djangoproject.com returns 404 on /apple-touch-icon.png but 200 on
        // /favicon.ico — so the cascade has to walk past apple before landing
        // on favicon.
        hostname: "djangoproject.com",
        platformName: "Django",
    },
};

export const LetterFallback = {
    name: "4. Letter fallback (no hostname)",
    args: {
        hostname: null,
        platformName: "Mystery App",
    },
};

export const UnreachableHost = {
    name: "4b. Letter fallback (unreachable host)",
    args: {
        // No DNS resolution → both apple-touch-icon and favicon error → falls
        // through to the letter.
        hostname: "this-domain-definitely-does-not-exist-12345.invalid",
        platformName: "Broken",
    },
};

export const Branded = {
    name: "0. Branding from the auth link (name + logo)",
    args: {
        // An app behind the W3DS OIDC connector: the hostname is the
        // connector's, while `name` and `logo` from the w3ds://auth link say
        // which application the user is signing in to.
        hostname: "oidc.w3ds.metastate.foundation",
        platformName: "Acme Corp SSO",
        displayName: "Acme Corp SSO",
        logoUrl: "https://oidc.w3ds.metastate.foundation/logo.png",
    },
};

export const BrandedBrokenLogo = {
    name: "0b. Branding with an unreachable logo",
    args: {
        // The logo fails to load, so the card falls back to the hostname's
        // icons while keeping the explicit name.
        hostname: "oidc.w3ds.metastate.foundation",
        platformName: "Acme Corp SSO",
        displayName: "Acme Corp SSO",
        logoUrl:
            "https://this-domain-definitely-does-not-exist-12345.invalid/logo.png",
    },
};
