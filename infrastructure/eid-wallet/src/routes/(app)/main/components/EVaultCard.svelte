<script lang="ts">
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

interface IEVaultCardProps {
    /** Available storage label, e.g. "80 Gb". */
    available: string;
    oninfo?: () => void;
}

const { available, oninfo }: IEVaultCardProps = $props();
</script>

<section
    class="bg-white rounded-2xl p-4 shadow-card flex items-start justify-between gap-3"
>
    <div>
        <p class="text-lg text-black-700 font-medium">Your eVault</p>
        <p class="text-2xl font-medium text-black mt-0.5">
            {available}
            <span class="font-medium text-black opacity-50">available</span>
        </p>
    </div>
    <button
        type="button"
        aria-label="About eVault"
        onclick={oninfo}
        class="text-black-300 active:opacity-60 mt-0.5"
    >
        <HugeiconsIcon
            icon={InformationCircleIcon}
            size={24}
            strokeWidth={2}
        />
    </button>
</section>
