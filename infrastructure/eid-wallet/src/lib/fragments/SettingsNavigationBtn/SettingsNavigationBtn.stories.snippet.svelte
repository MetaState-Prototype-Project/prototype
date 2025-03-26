<script context="module">
import { LanguageSquareIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

export { icon };
</script>

{#snippet icon()}
    <HugeiconsIcon size={30}  color="var(--color-black-500)" icon={LanguageSquareIcon} />
{/snippet}
