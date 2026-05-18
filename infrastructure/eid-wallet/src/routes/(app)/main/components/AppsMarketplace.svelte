<script lang="ts">
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

interface IAppsMarketplaceProps {
    href?: string;
}

const {
    href = "https://marketplace.w3ds.metastate.foundation/",
}: IAppsMarketplaceProps = $props();
</script>

<section class="mt-2">
    <a
        {href}
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1 mb-3 text-black-900 active:opacity-70"
    >
        <h3 class="font-semibold">Apps marketplace</h3>
        <HugeiconsIcon icon={ArrowRight01Icon} size={18} strokeWidth={2} />
    </a>
    <div class="grid grid-cols-3 gap-3">
        <div class="bg-blue-50 rounded-2xl p-3 flex flex-col items-start">
            <div
                class="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center font-extrabold text-lg mb-2"
            >
                B
            </div>
            <p class="font-semibold text-black-900 leading-tight">Blasby</p>
            <p class="text-xs text-black-500 leading-tight">Social</p>
        </div>
        <div class="bg-pink-50 rounded-2xl p-3 flex flex-col items-start">
            <div
                class="w-10 h-10 rounded-xl bg-pink-500 text-white flex items-center justify-center font-extrabold text-lg mb-2"
            >
                P
            </div>
            <p class="font-semibold text-black-900 leading-tight">Pictique</p>
            <p class="text-xs text-black-500 leading-tight">Social</p>
        </div>
        <div class="bg-red-50 rounded-2xl p-3 flex flex-col items-start">
            <div
                class="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center font-extrabold text-lg mb-2"
            >
                E
            </div>
            <p class="font-semibold text-black-900 leading-tight">eVoting</p>
            <p class="text-xs text-black-500 leading-tight">Governance</p>
        </div>
    </div>
</section>
