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
    class="bg-white rounded-2xl border border-black-100 p-4 shadow-sm flex items-start justify-between gap-3"
>
    <div>
        <p class="text-sm text-black-500">Your eVault</p>
        <p class="text-2xl font-bold text-black-900 mt-0.5">
            {available}
            <span class="font-normal text-black-500">available</span>
        </p>
    </div>
    <button
        type="button"
        aria-label="About eVault"
        onclick={oninfo}
        class="text-black-500 active:opacity-60 mt-0.5"
    >
        <HugeiconsIcon
            icon={InformationCircleIcon}
            size={18}
            strokeWidth={2}
        />
    </button>
</section>
