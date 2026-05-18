<!--
    Welcome tour overlay — renders the description + CTA panel that sits on
    top of /main during the first-visit walkthrough. Click capture beneath
    the panel blocks interaction with the underlying cards.

    The lasso, card visibility, and scroll-into-view are owned by /main
    because they live with the actual cards. WelcomeTour only owns the
    bottom panel and the step advancement.
-->
<script lang="ts" module>
export type TourStep = "ename" | "binding-docs" | "evault" | "apps" | "scan";

export const TOUR_ORDER: TourStep[] = [
    "ename",
    "binding-docs",
    "evault",
    "apps",
    "scan",
];

interface ITourStepDef {
    description: string;
    cta: string;
}

export const TOUR_STEPS: Record<TourStep, ITourStepDef> = {
    ename: {
        description:
            "This is your eName — a unique, persistent identifier used globally in the digital world. It is permanently tied to your real self.",
        cta: "Okay",
    },
    "binding-docs": {
        description:
            "Bind your real and digital selves in different ways. This protects your identity and strengthens control over your data.",
        cta: "Alright",
    },
    evault: {
        description:
            "This is your eVault — your sovereign data storage. From now on, all platforms will read and write data about you from here, under your control.",
        cta: "Alright",
    },
    apps: {
        description:
            "Discover apps that work with your eVault — their number is growing fast!",
        cta: "Next",
    },
    scan: {
        description:
            "Log in to any W3DS service by scanning the QR code. No need to create new accounts — your Digital Self is your sovereign account for all platforms.",
        cta: "Finish",
    },
};
</script>

<script lang="ts">
import * as Button from "$lib/ui/Button";
import { fade, fly } from "svelte/transition";

interface IWelcomeTourProps {
    step: TourStep;
    /** Called with the next step, or null when the tour finishes. */
    onnext: (next: TourStep | null) => void;
}

const { step, onnext }: IWelcomeTourProps = $props();

const def = $derived(TOUR_STEPS[step]);
const isLast = $derived(step === "scan");

function handleClick() {
    if (isLast) {
        onnext(null);
        return;
    }
    const idx = TOUR_ORDER.indexOf(step);
    onnext(TOUR_ORDER[idx + 1]);
}
</script>

<!-- Click capture beneath the panel — blocks interaction with the cards
     underneath as well as touch/wheel scroll attempts. Programmatic
     scrollIntoView from /main is unaffected. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="fixed inset-0 z-40"
    style="touch-action: none;"
    aria-hidden="true"
    onwheel={(e) => e.preventDefault()}
    ontouchmove={(e) => e.preventDefault()}
></div>

<!-- Bottom panel: description + CTA, fades white toward the bottom. -->
<div
    class="fixed bottom-0 left-0 right-0 z-50 px-5 pt-12 pb-10 flex flex-col gap-6 bg-linear-to-t from-white from-30% via-white/95 to-transparent pointer-events-none"
    style="padding-bottom: max(2.5rem, env(safe-area-inset-bottom));"
>
    {#key step}
        <p
            class="text-primary text-base font-medium leading-relaxed text-left"
            in:fade={{
                duration: 250,
                delay: step === "ename" ? 500 : 200,
            }}
            out:fade={{ duration: 150 }}
        >
            {def.description}
        </p>
    {/key}
    <div
        class="pointer-events-auto"
        in:fly={{ y: 20, duration: 300, delay: 800 }}
    >
        <Button.Action
            variant="solid"
            class="w-full uppercase tracking-wide"
            callback={handleClick}
        >
            {def.cta}
        </Button.Action>
    </div>
</div>
