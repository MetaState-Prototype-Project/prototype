<script lang="ts">
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

interface IStepHeaderProps {
    /** Step title rendered as h3. */
    title: string;
    /** Current step number (1-indexed). When omitted, the "X of N steps"
     *  row is hidden — used for non-step screens like /login that still
     *  want the same centered-title visual. */
    step?: number;
    /** Total number of steps. Defaults to 3. Only rendered when `step` is
     *  also provided. */
    total?: number;
    /** Fired when the back chevron is tapped. When omitted, the chevron is
     *  not rendered at all. */
    onback?: () => void;
}

const { title, step, total = 3, onback }: IStepHeaderProps = $props();
</script>

<header class="flex flex-row items-center gap-4 pt-4">
    {#if onback}
        <button
            type="button"
            onclick={onback}
            aria-label="Back"
            class="w-10 h-10 absolute rounded-full bg-black-100 flex items-center justify-center cursor-pointer shrink-0 active:opacity-70"
        >
            <HugeiconsIcon
                icon={ArrowLeft01Icon}
                size={20}
                color="currentColor"
                strokeWidth={2}
            />
        </button>
    {/if}
    <div class="flex flex-col w-full items-center">
        <h3 class="font-semibold leading-none">{title}</h3>
        {#if step !== undefined}
            <p class="text-black-500 text-sm mt-1 leading-none">
                {step} of {total} steps
            </p>
        {/if}
    </div>
</header>
