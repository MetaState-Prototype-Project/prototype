<!--
    Legacy marketplace banner (extracted from /main during the F21 redesign
    refactor). Replaced by the AppsMarketplace tiles on the redesigned home.
    Re-mount if we want to promote post-platforms as a standalone banner.
-->
<script lang="ts">
import * as Button from "$lib/ui/Button";
import { LinkSquare02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
</script>

<Button.Nav
    href="https://marketplace.w3ds.metastate.foundation/"
    target="_blank"
    rel="noopener noreferrer"
    class="rounded-3xl z-0 w-full border border-gray-300 h-48 text-black p-3 mt-8 flex flex-col justify-end cursor-pointer relative overflow-hidden transition-shadow"
>
    <img
        src="/marketplace.png"
        alt="Marketplace"
        class="absolute inset-0 z-0 w-full h-full object-cover object-bottom"
    />
    <div
        class="absolute inset-0 z-1 bg-linear-to-t from-white via-white/60 to-transparent"
    ></div>
    <span class="text-2xl font-bold flex gap-2 relative z-10 drop-shadow-lg">
        Discover Post Platforms
    </span>
    <div
        class="text-sm opacity-90 relative z-10 drop-shadow-md flex gap-1 items-center"
    >
        Explore
        <div class="flex items-center">
            <img
                src="/images/W3DSLogoBlack.svg"
                alt="W3DS Logo"
                class="h-4"
            />
            -enabled services
        </div>
        <span class="relative z-10">
            <HugeiconsIcon
                size={16}
                strokeWidth={1.5}
                icon={LinkSquare02Icon}
            />
        </span>
    </div>
</Button.Nav>
