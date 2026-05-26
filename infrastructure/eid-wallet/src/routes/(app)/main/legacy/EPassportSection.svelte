<!--
    Legacy ePassport card section (extracted from /main during the F21
    redesign refactor). Not currently mounted — the redesigned home
    surfaces identity through the Binding Documents section instead.
    Re-mount if the ePassport card needs a place in the new layout.
-->
<script lang="ts">
import { goto } from "$app/navigation";
import { IdentityCard } from "$lib/fragments";

interface IEPassportSectionProps {
    userData: Record<string, string> | undefined;
    bindingDocsLoaded: boolean;
    hasOnlySelfDocs: boolean;
    missingProvisionerDocs: boolean;
}

const {
    userData,
    bindingDocsLoaded,
    hasOnlySelfDocs,
    missingProvisionerDocs,
}: IEPassportSectionProps = $props();
</script>

<section class="mt-5">
    <h4>ePassport</h4>
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
        class="cursor-pointer relative"
        onclick={() => goto("/ePassport")}
        role="link"
        tabindex="0"
        onkeydown={(e) => {
            if (e.key === "Enter") goto("/ePassport");
        }}
    >
        <div class="relative z-10">
            <IdentityCard
                variant="ePassport"
                userData={userData ?? {}}
            />
        </div>
        {#if bindingDocsLoaded && (hasOnlySelfDocs || missingProvisionerDocs)}
            <button
                onclick={(e) => {
                    e.stopPropagation();
                    goto("/ePassport");
                }}
                class="relative z-0 w-full -mt-3 -translate-y-2.5 rounded-b-2xl px-4 pt-7.5 pb-3 flex items-center justify-center gap-2 text-sm font-medium shadow-md transition-colors
                {missingProvisionerDocs
                    ? 'bg-emerald-400 text-emerald-900 active:bg-emerald-500'
                    : 'bg-amber-400 text-amber-900 active:bg-amber-500'}"
            >
                <span>{missingProvisionerDocs ? "↑" : "⚠"}</span>
                {missingProvisionerDocs
                    ? "New – add binding docs for trust & recovery"
                    : "Verify your identity – secure DigitalSelf & earn trust"}
            </button>
        {/if}
    </div>
</section>
