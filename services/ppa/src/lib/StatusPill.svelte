<script lang="ts">
    let {
        decision = null,
        level = null,
    }: {
        decision?: "granted" | "denied" | null;
        level?: string | null;
    } = $props();
</script>

{#if decision === "granted"}
    <span class="pill bg-positive-wash text-positive">
        <span class="size-1.5 rounded-full bg-positive"></span>
        {level ?? "Granted"}
    </span>
{:else if decision === "denied"}
    <span class="pill bg-negative-wash text-negative">
        <span class="size-1.5 rounded-full bg-negative"></span>
        Denied
    </span>
{:else}
    <span class="pill bg-caution-wash text-caution">
        <span class="size-1.5 rounded-full bg-caution"></span>
        Awaiting review
    </span>
{/if}
