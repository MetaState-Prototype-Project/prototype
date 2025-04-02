<script lang="ts">
import { AppNav } from "$lib/fragments";
import { runtime } from "$lib/global/runtime.svelte";

const { children } = $props();
</script>

<main class="h-[100vh] px-[5vw] pb-[4.5vh]">
    <AppNav title={runtime.header.title ?? ""}/>
    {@render children?.()}
</main>