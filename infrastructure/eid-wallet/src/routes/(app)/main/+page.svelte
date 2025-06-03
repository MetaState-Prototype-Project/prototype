<script lang="ts">
    import { goto } from "$app/navigation";
    import { Hero, IdentityCard } from "$lib/fragments";
    import type { GlobalState } from "$lib/global";
    import { Drawer } from "$lib/ui";
    import * as Button from "$lib/ui/Button";
    import { QrCodeIcon } from "@hugeicons/core-free-icons";
    import { HugeiconsIcon } from "@hugeicons/svelte";
    import { getContext, onMount, type Snippet } from "svelte";

    let userData: Record<string, unknown> = $state();
    let greeting = $state();
    let ename = $state();

    let shareQRdrawerOpen = $state(false);

    function shareQR() {
        alert("QR Code shared!");
        shareQRdrawerOpen = false;
    }

    const globalState = getContext<() => GlobalState>("globalState")();

    onMount(async () => {
        userData = await globalState.userController.user;
        const vaultData = await globalState.vaultController.vault;
        ename = vaultData.ename;

        const currentHour = new Date().getHours();
        greeting =
            currentHour > 17
                ? "Good Evening"
                : currentHour > 12
                  ? "Good Afternoon"
                  : "Good Morning";
    });
</script>

<Hero
    title={greeting ?? "Hi!"}
    subtitle="Welcome back to your eID Wallet"
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
        userId={ename ?? "Loading..."}
        viewBtn={() => alert("View button clicked!")}
        shareBtn={() => (shareQRdrawerOpen = true)}
    />
{/snippet}
{#snippet ePassport()}
    <IdentityCard
        variant="ePassport"
        viewBtn={() => goto("/ePassport")}
        {userData}
    />
{/snippet}
{#snippet eVault()}
    <IdentityCard variant="eVault" usedStorage={15} totalStorage={100} />
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
    <div
        class="flex justify-center relative items-center overflow-hidden h-full bg-gray rounded-3xl p-8"
    >
        <div
            class="bg-white h-[72px] w-[1000px] -rotate-45 absolute top-4"
        ></div>
        <div
            class="bg-white h-[72px] w-[1000px] -rotate-45 absolute bottom-4"
        ></div>
        <img class="z-10" src="/images/dummyQR.png" alt="QR Code" />
    </div>

    <h4 class="text-center">Share your eName</h4>
    <p class="text-black-700 text-center">
        Anyone scanning this can see your eName
    </p>
    <div class="flex justify-center items-center mt-4">
        <Button.Action variant="solid" callback={shareQR} class="w-full">
            Share
        </Button.Action>
    </div>
</Drawer>

<Button.Nav href="/scan-qr">
    <Button.Action
        variant="solid"
        size="sm"
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

