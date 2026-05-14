<script lang="ts">
    import { ButtonAction } from "$lib/ui";
    import { cubicOut } from "svelte/easing";
    import { fade, fly } from "svelte/transition";

    interface ISplashScreenProps {
        /** false = state A (logo "closed"). true = state B (tagline revealed). */
        open?: boolean;
        /** true = state C (bottom drawer with CTAs revealed). */
        showDrawer?: boolean;
        /** Fired when "Create Digital Self" is tapped. */
        oncreate?: () => void;
        /** Fired when "Restore Digital Self" is tapped. */
        onrestore?: () => void;
    }

    const {
        open = false,
        showDrawer = false,
        oncreate,
        onrestore,
    }: ISplashScreenProps = $props();
</script>

<div
    out:fade={{ duration: 200 }}
    class="z-50 fixed inset-0 bg-primary overflow-hidden flex flex-col"
>
    <!-- Logo group: vertically biased toward top-third, mirroring the Figma spec.
         CSS animation (not svelte in:fade) because Svelte 5 skips intros for
         elements already present at first render. Bg stays solid (no flash). -->
    <div
        class="splash-content flex-1 flex flex-col items-center justify-start pt-[22svh]"
    >
        <div class="flex flex-col items-center">
            <span
                class="text-white font-medium text-[110px] leading-[88%] tracking-[-0.02em] -my-1"
                style="font-family: 'Roboto Condensed Variable', sans-serif;"
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
            transition:fly={{
                y: 400,
                duration: 500,
                easing: cubicOut,
                opacity: 1,
            }}
            class="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl px-5 pt-5 flex flex-col gap-3"
            style="padding-bottom: max(20px, env(safe-area-inset-bottom));"
        >
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
