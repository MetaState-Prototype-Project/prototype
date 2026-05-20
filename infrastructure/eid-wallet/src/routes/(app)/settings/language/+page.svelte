<script lang="ts">
import { runtime } from "$lib/global/runtime.svelte";
import {
    AVAILABLE_LANGUAGES,
    getCurrentLanguage,
    setCurrentLanguage,
} from "$lib/stores/language";
import { Selector } from "$lib/ui";

let selected = $state(getCurrentLanguage().name);

$effect(() => {
    runtime.header.title = "Language";
});

$effect(() => {
    setCurrentLanguage(selected);
});
</script>

<main>
    {#each AVAILABLE_LANGUAGES as lang, i}
        <Selector
            id={`option-${i}`}
            name={lang.name}
            bind:selected
            value={lang.name}
            disable={!lang.enabled}
        >
            {lang.name}
            {#snippet icon()}
                <div
                    class={`rounded-full fi fis fi-${lang.country} scale-150 mr-12 outline-8 outline-gray`}
                ></div>
            {/snippet}
        </Selector>
    {/each}
</main>
