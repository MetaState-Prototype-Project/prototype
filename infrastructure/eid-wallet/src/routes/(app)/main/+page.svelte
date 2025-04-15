<script lang="ts">
import { goto } from "$app/navigation";
import { Hero, IdentityCard } from "$lib/fragments";
import { Drawer } from "$lib/ui";
import * as Button from "$lib/ui/Button";
import { QrCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import type { Snippet } from "svelte";

const dummyData = {
    Name: "John Doe",
    "Date of birth": "01 - 01 - 1990",
    "ID submitted": "American Passport",
    "Passport number": "1234567-US",
};

let shareQRdrawerOpen = $state(false);

function shareQR() {
    alert("QR Code shared!");
    shareQRdrawerOpen = false;
}
</script>

    
<Hero
    title="Good morning!"
    subtitle="Don't forget to drink water."
    showSettings
/>

{#snippet Section(title: string, children: Snippet)}
    <section class="mt-8">
    <h4 class="mb-2">{title}</h4>
        {@render children()}
    </section>
{/snippet}

{#snippet eName()}
    <IdentityCard
    variant="eName"
    userId="caa0f630-2413-5aceaa2c-4628ce93e497"
    viewBtn={() => alert("View button clicked!")}
    shareBtn={() => shareQRdrawerOpen = true}
    />
{/snippet}
{#snippet ePassport()}
    <IdentityCard
    variant="ePassport"
    viewBtn={() => goto("/ePassport")}
    userData={dummyData}
    />
{/snippet}
{#snippet eVault()}
    <IdentityCard
    variant="eVault"
    usedStorage={15}
    totalStorage={100}
    />
{/snippet}

<main class="pb-16">
    {@render Section("eName", eName)}
    {@render Section("ePassport", ePassport)}
    {@render Section("eVault", eVault)}
</main>

<Drawer
    title="Scan QR Code"
    bind:isPaneOpen={shareQRdrawerOpen}
    class="flex flex-col gap-4 items-center justify-center"
>
    <div class="flex justify-center relative items-center overflow-hidden h-full bg-gray rounded-3xl p-8">
        <div class="bg-white h-[72px] w-[1000px] -rotate-45 absolute top-4"></div>
        <div class="bg-white h-[72px] w-[1000px] -rotate-45 absolute bottom-4"></div>
        <img class="z-10" src="/images/dummyQR.png" alt="QR Code" />
    </div>

    <h4 class="text-center">Share your eName</h4>
    <p class="text-black-700 text-center">Anyone scanning this can see your eName</p>
    <div class="flex justify-center items-center mt-4">
        <Button.Action
            variant="solid"
            callback={shareQR}
            class="w-full"
        >
            Share
        </Button.Action>
    </div>
</Drawer>

<Button.Nav href="/scan-qr">
    <Button.Action
        variant="solid"
        onclick={() => alert("Action button clicked!")}
        class="mx-auto text-nowrap flex gap-8 fixed bottom-5 left-1/2 -translate-x-1/2 z-10"
    >
        <HugeiconsIcon
            size={32}
            strokeWidth={2}
            className="mr-2"
            icon={QrCodeIcon}
        />
        Scan to Login
    </Button.Action>
</Button.Nav>