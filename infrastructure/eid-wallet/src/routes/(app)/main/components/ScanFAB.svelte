<script lang="ts">
import * as Button from "$lib/ui/Button";
import { QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

interface IScanFABProps {
    href?: string;
    /** When true, position fixed at the viewport bottom (the regular FAB).
     *  When false, render inline — used by the welcome tour where the Scan
     *  button is part of the card flow rather than floating. */
    fixed?: boolean;
}

const { href = "/scan-qr", fixed = true }: IScanFABProps = $props();
</script>

<Button.Nav
    {href}
    class={fixed
        ? "fixed bottom-12 left-1/2 -translate-x-1/2"
        : "flex justify-center"}
>
    <Button.Action
        variant="solid"
        size="md"
        class="mx-auto text-nowrap flex gap-3 uppercase tracking-wide"
    >
        Scan
        <HugeiconsIcon size={24} strokeWidth={2} icon={QrCodeIcon} />
    </Button.Action>
</Button.Nav>
