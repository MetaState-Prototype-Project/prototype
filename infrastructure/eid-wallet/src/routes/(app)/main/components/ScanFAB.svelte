<script lang="ts">
import * as Button from "$lib/ui/Button";
import { QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

interface IScanFABProps {
    href?: string;
}

const { href = "/scan-qr" }: IScanFABProps = $props();
</script>

<Button.Nav {href} class="fixed bottom-12 left-1/2 -translate-x-1/2">
    <Button.Action
        variant="solid"
        size="md"
        class="mx-auto text-nowrap flex gap-3 uppercase tracking-wide"
    >
        Scan
        <HugeiconsIcon size={24} strokeWidth={2} icon={QrCodeIcon} />
    </Button.Action>
</Button.Nav>
