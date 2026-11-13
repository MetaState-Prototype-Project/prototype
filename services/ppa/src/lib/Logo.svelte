<script lang="ts">
    let { size = 28 }: { size?: number } = $props();
</script>

<!-- Three linked nodes: the association binding platforms together. -->
<svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
>
    <circle cx="16" cy="16" r="15" fill="var(--color-brand-wash)" />
    <path
        d="M10 11.5 L22 20.5 M22 11.5 L10 20.5 M16 9 L16 23"
        stroke="var(--color-brand-tint)"
        stroke-width="1.5"
        stroke-linecap="round"
    />
    <circle cx="16" cy="8.5" r="3.25" fill="var(--color-brand)" />
    <circle cx="9" cy="21" r="3.25" fill="var(--color-brand)" />
    <circle cx="23" cy="21" r="3.25" fill="var(--color-brand)" />
</svg>
