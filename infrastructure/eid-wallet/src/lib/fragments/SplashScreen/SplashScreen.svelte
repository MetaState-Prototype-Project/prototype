<script lang="ts">
import { ButtonAction } from "$lib/ui";
import { onMount } from "svelte";
import { cubicOut } from "svelte/easing";
import { fly } from "svelte/transition";

interface ISplashScreenProps {
    /** false = state A (logo "closed"). true = state B (tagline revealed). */
    open?: boolean;
    /** true = state C (bottom drawer with CTAs revealed). */
    showDrawer?: boolean;
    oncreate?: () => void;
    onrestore?: () => void;
    /** When provided, the drawer renders a single "Continue" button instead
     *  of the Create / Restore pair (returning-user variant). */
    oncontinue?: () => void;
}

const {
    open = false,
    showDrawer = false,
    oncreate,
    onrestore,
    oncontinue,
}: ISplashScreenProps = $props();

// Roboto Condensed ships with font-display: swap, so without this gate the
// 110px "eID" renders in the system fallback first, then snaps to the real
// face once the woff arrives — a very visible flicker on the splash.
const LOGO_FONT_SPEC = "500 110px 'Roboto Condensed Variable'";
let fontReady = $state(false);

onMount(async () => {
    if (typeof document === "undefined" || !document.fonts) {
        fontReady = true;
        return;
    }
    if (document.fonts.check(LOGO_FONT_SPEC)) {
        fontReady = true;
        return;
    }
    try {
        await document.fonts.load(LOGO_FONT_SPEC);
    } catch {
        // Fall through — show the text rather than leave it invisible forever.
    }
    fontReady = true;
});
</script>

<div
    class="relative min-h-dvh bg-primary overflow-hidden flex flex-col"
>
    <!-- Logo group: vertically biased toward top-third, mirroring the Figma spec.
         CSS animation (not svelte in:fade) because Svelte 5 skips intros for
         elements already present at first render. Bg stays solid (no flash). -->
    <div
        class="splash-content flex-1 flex flex-col items-center justify-start pt-[22svh]"
    >
        <div class="flex flex-col items-center">
            <span
                class="text-white font-condensed font-medium text-[110px] leading-[88%] tracking-[-0.02em] -my-1 transition-opacity duration-150"
                class:opacity-0={!fontReady}
            >
                eID
            </span>
            <!-- Tagline: height-animated so opening pushes the W3DS pill down
                 (gives the "logo unfolds, tagline emerges" feel). -->
            <div
                class="overflow-hidden transition-all duration-500 ease-out"
                style:max-height={open ? "2.5rem" : "0"}
                style:opacity={open ? 0.5 : 0}
                aria-hidden={!open}
            >
                <p class="text-white text-2xl font-medium leading-[120%]">
                    Your Digital Self
                </p>
            </div>
            <img
                src="/images/w3ds-logo-main.svg"
                alt="W3DS"
                width="90"
                height="44"
                class="mt-4 transition-all duration-1000 ease-out"
            />
        </div>
    </div>

    {#if showDrawer}
        <div
            in:fly={{
                y: 400,
                duration: 500,
                easing: cubicOut,
                opacity: 1,
            }}
            class="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl px-5 pt-5 flex flex-col gap-3"
            style="padding-bottom: max(20px, env(safe-area-inset-bottom));"
        >
            {#if oncontinue}
                <ButtonAction
                    variant="solid"
                    callback={oncontinue}
                    class="w-full uppercase tracking-wide active:bg-primary-400"
                >
                    Continue
                </ButtonAction>
            {:else}
                <ButtonAction
                    variant="solid"
                    callback={oncreate}
                    class="w-full uppercase tracking-wide active:bg-primary-400"
                >
                    Create Digital Self
                </ButtonAction>
                <ButtonAction
                    variant="soft"
                    callback={onrestore}
                    class="w-full uppercase tracking-wide text-black active:bg-primary-200"
                >
                    Restore Digital Self
                </ButtonAction>
                <p
                    class="text-center font-medium text-md text-black-700/50 leading-normal"
                >
                    By continuing you agree to our
                    <a
                        href="https://metastate.foundation/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary"
                    >
                        Terms &amp; Conditions
                    </a>
                    and
                    <a
                        href="https://metastate.foundation/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary"
                    >
                        Privacy Policy
                    </a>
                </p>
            {/if}
        </div>
    {/if}
</div>

<style>
    @keyframes splash-content-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    .splash-content {
        animation: splash-content-in 500ms ease-out both;
    }
</style>
