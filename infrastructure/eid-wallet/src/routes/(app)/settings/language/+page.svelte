<script lang="ts">
import { runtime } from "$lib/global/runtime.svelte";
import {
    AVAILABLE_LANGUAGES,
    getCurrentLanguage,
    setCurrentLanguage,
} from "$lib/stores/language";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

let selected = $state(getCurrentLanguage().name);

$effect(() => {
    runtime.header.title = "Language";
});

$effect(() => {
    setCurrentLanguage(selected);
});
</script>

<main class="flex flex-col gap-1 mt-4">
    {#each AVAILABLE_LANGUAGES as lang (lang.name)}
        <label
            class="w-full flex items-center gap-3 py-3 active:opacity-70"
            class:opacity-50={!lang.enabled}
            class:pointer-events-none={!lang.enabled}
        >
            <input
                type="radio"
                name="language"
                value={lang.name}
                bind:group={selected}
                disabled={!lang.enabled}
                class="sr-only"
            />
            <div
                class="w-12 h-12 text-[24px] rounded-xl bg-white flex items-center justify-center shrink-0 shadow-card"
            >
                <span
                    class="rounded-full fi fis fi-{lang.country}"
                    aria-hidden="true"
                ></span>
            </div>
            <p class="font-semibold text-black-700 text-lg flex-1">
                {lang.name}
            </p>
            {#if selected === lang.name}
                <div
                    class="w-6 h-6 rounded-full bg-success-300 flex items-center justify-center shrink-0"
                >
                    <HugeiconsIcon
                        icon={Tick01Icon}
                        size={14}
                        color="var(--color-black-900)"
                        strokeWidth={3}
                    />
                </div>
            {:else}
                <div
                    class="w-6 h-6 rounded-full border-2 border-black-100 shrink-0"
                ></div>
            {/if}
        </label>
    {/each}
</main>
