<script lang="ts">
import { Header } from "$lib/fragments";
import { runtime } from "$lib/global/runtime.svelte";

const { children } = $props();
</script>

<main class="h-[100vh] px-[5vw] pb-[4.5vh]">
    <Header title={runtime.header.title ?? ""}/>
    {@render children?.()}
</main>