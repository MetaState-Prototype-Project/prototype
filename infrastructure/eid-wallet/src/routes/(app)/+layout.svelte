<script lang="ts">
import type { Snippet } from "svelte";
import type { LayoutData } from "./$types";

let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="p-6 mb-16">
    {@render children()}
</div>