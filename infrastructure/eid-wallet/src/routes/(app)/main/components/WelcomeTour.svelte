<!--
    Welcome tour overlay — renders the description + CTA panel that sits on
    top of /main during the first-visit walkthrough. Click capture beneath
    the panel blocks interaction with the underlying cards.

    The lasso, card visibility, and scroll-into-view are owned by /main
    because they live with the actual cards. WelcomeTour only owns the
    bottom panel and the step advancement.
-->
<script lang="ts" module>
import { m } from "$lib/i18n";
export type TourStep = "ename" | "binding-docs" | "evault" | "apps" | "scan";

export const TOUR_ORDER: TourStep[] = [
    "ename",
    "binding-docs",
    "evault",
    "apps",
    "scan",
];

// Copy is held as getters, not strings: this table is module scope, so
// plain `m.*()` calls would freeze at whatever locale was active when the
// module first loaded.
interface ITourStepDef {
    /** One paragraph per array entry — rendered as separate <p> elements. */
    description: () => string[];
    cta: () => string;
}

export const TOUR_STEPS: Record<TourStep, ITourStepDef> = {
    ename: {
        description: () => [m.tour_ename_p1(), m.tour_ename_p2()],
        cta: m.common_okay,
    },
    "binding-docs": {
        description: () => [m.tour_binding_docs()],
        cta: m.tour_cta_got_it,
    },
    evault: {
        description: () => [m.tour_evault()],
        cta: m.tour_cta_alright,
    },
    apps: {
        description: () => [m.tour_apps()],
        cta: m.common_next,
    },
    scan: {
        description: () => [m.tour_scan()],
        cta: m.tour_cta_finish,
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
    <div class="grid items-end">
        {#key step}
            <div
                class="flex flex-col gap-3 [grid-area:1/1]"
                in:fade|global={{
                    duration: 600,
                    delay: step === "ename" ? 800 : 200,
                }}
                out:fade|global={{ duration: 150 }}
            >
                {#each def.description() as paragraph, i (i)}
                    <p
                        class="text-primary text-lg font-medium leading-relaxed text-left"
                    >
                        {paragraph}
                    </p>
                {/each}
            </div>
        {/key}
    </div>
    <div
        class="pointer-events-auto"
        in:fly|global={{ y: 20, duration: 600, delay: 800 }}
    >
        <Button.Action
            variant="solid"
            class="w-full uppercase tracking-wide"
            callback={handleClick}
        >
            {def.cta()}
        </Button.Action>
    </div>
</div>
