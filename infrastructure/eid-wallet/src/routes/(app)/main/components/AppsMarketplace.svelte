<script lang="ts">
import { m } from "$lib/i18n";
import {
    MARKETPLACE_URL,
    type RibbonApp,
    fetchRibbonApps,
    readCachedRibbonApps,
    writeCachedRibbonApps,
} from "$lib/utils/marketplaceApps";
import { ArrowRight01Icon, Store01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { onMount } from "svelte";

interface IAppsMarketplaceProps {
    href?: string;
}

const { href = `${MARKETPLACE_URL}/` }: IAppsMarketplaceProps = $props();

// Start from the last list that loaded, so the ribbon is filled at once and
// still has content offline. The live list replaces it when it arrives.
const cached = readCachedRibbonApps();
let apps = $state<RibbonApp[]>(cached ?? []);
let loading = $state(!cached);
// Keys of apps whose remote logo failed to load; they show a placeholder.
let brokenLogos = $state<Set<string>>(new Set());

// Categories the wallet has translations for; anything else is shown as
// the platform published it.
const CATEGORY_LABELS: Record<string, () => string> = {
    social: m.marketplace_category_social,
    governance: m.marketplace_category_governance,
    finance: m.marketplace_category_finance,
};

function categoryLabel(category: string): string {
    return CATEGORY_LABELS[category.toLowerCase()]?.() ?? category;
}

function markLogoBroken(key: string) {
    brokenLogos = new Set(brokenLogos).add(key);
}

onMount(() => {
    let cancelled = false;
    fetchRibbonApps()
        .then((live) => {
            if (cancelled) return;
            apps = live;
            brokenLogos = new Set();
            if (live.length) writeCachedRibbonApps(live);
        })
        .catch((error) => {
            console.warn("[AppsMarketplace] could not load apps:", error);
        })
        .finally(() => {
            if (!cancelled) loading = false;
        });
    return () => {
        cancelled = true;
    };
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
        {#if loading}
            {#each { length: 3 } as _, i (i)}
                <div
                    class="snap-start shrink-0 w-31.5 h-36 bg-card-alternative rounded-3xl px-3 py-4 flex flex-col items-start justify-between animate-pulse"
                    aria-hidden="true"
                >
                    <div class="w-11.25 h-11.25 rounded-xl bg-black-100"></div>
                    <div class="w-full flex flex-col gap-1.5">
                        <div class="h-4 w-3/4 rounded bg-black-100"></div>
                        <div class="h-3 w-1/2 rounded bg-black-100"></div>
                    </div>
                </div>
            {/each}
        {/if}

        {#each apps as app (app.key)}
            <a
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                class="snap-start shrink-0 w-31.5 h-36 bg-card-alternative rounded-3xl px-3 py-4 flex flex-col items-start justify-between active:opacity-70"
            >
                {#if app.logo && !brokenLogos.has(app.key)}
                    <img
                        src={app.logo}
                        alt=""
                        width="45"
                        height="45"
                        loading="lazy"
                        referrerpolicy="no-referrer"
                        class="block w-11.25 h-11.25 rounded-xl object-contain"
                        aria-hidden="true"
                        onerror={() => markLogoBroken(app.key)}
                    />
                {:else}
                    <!-- Same placeholder the marketplace shows for a
                         platform without a logo. -->
                    <div
                        class="w-11.25 h-11.25 rounded-xl flex items-center justify-center text-black-900 bg-[hsl(270,100%,85%)]"
                        aria-hidden="true"
                    >
                        <HugeiconsIcon
                            icon={Store01Icon}
                            size={22}
                            strokeWidth={2}
                        />
                    </div>
                {/if}
                <div class="w-full min-w-0">
                    <p
                        class="font-medium text-lg text-black-900 leading-tight truncate w-full"
                    >
                        {app.name}
                    </p>
                    {#if app.category}
                        <p class="text-black-500 leading-tight truncate w-full">
                            {categoryLabel(app.category)}
                        </p>
                    {/if}
                </div>
            </a>
        {/each}

        <a
            {href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={m.marketplace_see_all_aria()}
            class="snap-start shrink-0 w-31.5 h-36 bg-card-alternative rounded-3xl px-3 py-4 flex flex-col items-start justify-between active:opacity-70"
        >
            <div
                class="w-11.25 h-11.25 rounded-xl bg-white text-black-900 flex items-center justify-center"
            >
                <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={22}
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
