<script lang="ts">
import { runtime } from "$lib/global/runtime.svelte";
import { Selector } from "$lib/ui";

let languages: { name: string; country: string }[] = [
	{ name: "English", country: "gb" },
	{ name: "Spanish", country: "es" },
	{ name: "German", country: "de" },
	{ name: "French", country: "fr" },
];
let selected = $state("");

$effect(() => {
	runtime.header.title = "Language";
});
</script>



<main>
    {#each languages as lang, i}
    <Selector id={`option-${i}`} name={lang.name} bind:selected value={lang.name}>
        {lang.name}
        {#snippet icon()}
        <div
            class={`rounded-full fi fis fi-${lang.country} scale-150 mr-12 outline-8 outline-gray`}
        ></div>
        {/snippet}
    </Selector>
    {/each}
</main>