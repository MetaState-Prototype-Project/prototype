<script lang="ts">
import { AppNav } from "$lib/fragments";
import { runtime } from "$lib/global/runtime.svelte";

const { children } = $props();
</script>

<main>
    <AppNav title={runtime.header.title ?? ""}/>
    {@render children?.()}
</main>