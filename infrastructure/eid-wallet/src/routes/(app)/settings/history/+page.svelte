<script lang="ts">
import { runtime } from "$lib/global/runtime.svelte";
import { m } from "$lib/paraglide/messages";

$effect(() => {
    runtime.header.title = m.history_title();
});
</script>

<main>
</main>