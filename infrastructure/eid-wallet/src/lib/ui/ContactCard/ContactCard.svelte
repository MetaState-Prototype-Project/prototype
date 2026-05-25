<script lang="ts">
/**
 * Contact card for person-based scan drawers (social binding).
 * Mirrors PlatformAppCard's stacked layout: avatar above, card below,
 * `-mb-8` on the avatar pulls the card up so the avatar overlaps the
 * card's top half-and-half. No absolute positioning — nothing clips.
 */
interface IContactCardProps {
    eName: string | null | undefined;
    name: string | null | undefined;
    class?: string;
}

const { eName, name, class: classes = "" }: IContactCardProps = $props();

const displayName = $derived(name ?? eName ?? "Unknown");

const initials = $derived.by(() => {
    const source = name ?? "";
    const parts = source
        .split(/\s+/u)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "");
    const joined = parts.join("");
    return joined || (eName?.replace(/^@/, "")[0]?.toUpperCase() ?? "?");
});
</script>

<div class="flex flex-col items-center w-full {classes}">
    <div
        class="relative z-10 w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-md -mb-8"
    >
        <span class="text-xl font-bold text-white">{initials}</span>
    </div>
    <div
        class="bg-white rounded-3xl shadow-card pt-12 pb-6 px-6 flex flex-col items-center gap-2 w-full"
    >
        <h3 class="text-2xl font-bold text-black-900 text-center">
            {displayName}
        </h3>
        {#if eName && eName !== displayName}
            <p class="text-sm text-black-500 break-all text-center">{eName}</p>
        {/if}
    </div>
</div>
