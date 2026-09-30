<script lang="ts">
import { m } from "$lib/i18n";
import {
    DEFAULT_RIBBON_APPS,
    MARKETPLACE_URL,
    type RibbonApp,
    fetchRibbonApps,
} from "$lib/utils/marketplaceApps";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { onMount } from "svelte";

interface IAppsMarketplaceProps {
    href?: string;
}

const { href = `${MARKETPLACE_URL}/` }: IAppsMarketplaceProps = $props();

const CATEGORY_LABELS: Record<string, () => string> = {
    social: m.marketplace_category_social,
    governance: m.marketplace_category_governance,
    finance: m.marketplace_category_finance,
};

let apps = $state<RibbonApp[]>(DEFAULT_RIBBON_APPS);
let failedLogos = $state<Record<string, true>>({});

function categoryLabel(category: string): string {
    return CATEGORY_LABELS[category.toLowerCase()]?.() ?? category;
}

onMount(() => {
    fetchRibbonApps()
        .then((list) => {
            if (list.length > 0) apps = list;
        })
        .catch((error) => {
            console.warn("Could not load marketplace apps:", error);
        });
});
</script>

<section class="mt-8">
    <a
        {href}
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1 mb-3 text-black-900 active:opacity-70"
    >
        <h3 class="font-semibold text-2xl leading-none">{m.marketplace_title()}</h3>
        <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={2.5} />
    </a>

    <!-- Negative horizontal margin lets the carousel bleed to the screen
         edges so partially-visible cards on the right suggest more content.
         The inner padding restores alignment with the rest of the page.
         scroll-px-5 shifts snap points by the same amount so the first card
         lands flush with the surrounding content (instead of edge-to-edge)
         at scroll-start. -->
    <div
        class="apps-carousel -mx-5 px-5 flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-pl-5 scroll-pr-5"
    >
        {#each apps as app (app.id)}
            <a
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                class="snap-start shrink-0 w-28 h-32 bg-card-alternative rounded-3xl px-3 py-4 flex flex-col items-start justify-between active:opacity-70"
            >
                {#if app.logo && !failedLogos[app.id]}
                    <img
                        src={app.logo}
                        alt=""
                        width="40"
                        height="40"
                        class="block w-10 h-10 object-contain"
                        aria-hidden="true"
                        onerror={() => (failedLogos[app.id] = true)}
                    />
                {:else}
                    <div
                        class="w-10 h-10 rounded-xl bg-white text-black-900 font-semibold text-lg flex items-center justify-center"
                        aria-hidden="true"
                    >
                        {Array.from(app.name)[0]?.toUpperCase()}
                    </div>
                {/if}
                <div>
                    <p
                        class="font-medium text-lg text-black-900 leading-tight truncate w-full"
                    >
                        {app.name}
                    </p>
                    <p class="text-black-500 leading-tight">
                        {categoryLabel(app.category)}
                    </p>
                </div>
            </a>
        {/each}

        <a
            {href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={m.marketplace_see_all_aria()}
            class="snap-start shrink-0 w-28 h-32 bg-card-alternative rounded-3xl px-3 py-4 flex flex-col items-start justify-between active:opacity-70"
        >
            <div
                class="w-10 h-10 rounded-xl bg-white text-black-900 flex items-center justify-center"
            >
                <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={20}
                    strokeWidth={3}
                />
            </div>
            <p class="font-medium text-lg text-black-900 leading-tight">
                {m.marketplace_all_apps()}
            </p>
        </a>
    </div>
</section>

<style>
/* The global scrollbar-hide rules in +layout.svelte don't reach this scope,
   so hide the carousel's horizontal scrollbar locally. */
.apps-carousel {
    scrollbar-width: none;
}
.apps-carousel::-webkit-scrollbar {
    display: none;
}
</style>
