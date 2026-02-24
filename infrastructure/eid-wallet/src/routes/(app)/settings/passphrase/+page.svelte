<script lang="ts">
import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import { runtime } from "$lib/global/runtime.svelte";
import { ButtonAction, Drawer } from "$lib/ui";
import { ShieldKeyIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { getContext, onMount } from "svelte";

let globalState: GlobalState | undefined = $state(undefined);

let passphrase = $state("");
let confirmPassphrase = $state("");
let isLoading = $state(false);
let showSuccessDrawer = $state(false);
let errorMessage = $state<string | null>(null);
let hasExistingPassphrase = $state(false);

const REQUIREMENTS = [
    { label: "At least 12 characters", test: (p: string) => p.length >= 12 },
    { label: "Uppercase letter (A–Z)", test: (p: string) => /[A-Z]/.test(p) },
    { label: "Lowercase letter (a–z)", test: (p: string) => /[a-z]/.test(p) },
    { label: "Number (0–9)", test: (p: string) => /[0-9]/.test(p) },
    {
        label: "Special character (!@#$…)",
        test: (p: string) => /[^A-Za-z0-9]/.test(p),
    },
];

$effect(() => {
    runtime.header.title = "Recovery Passphrase";
});

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    if (!globalState) throw new Error("Global state is not defined");
    try {
        hasExistingPassphrase =
            await globalState.vaultController.hasRecoveryPassphrase();
    } catch {
        // non-critical
    }
});

async function handleSave() {
    errorMessage = null;

    if (!passphrase) {
        errorMessage = "Please enter a passphrase.";
        return;
    }

    const unmet = REQUIREMENTS.filter((r) => !r.test(passphrase));
    if (unmet.length > 0) {
        errorMessage = "Passphrase does not meet all requirements.";
        return;
    }

    if (passphrase !== confirmPassphrase) {
        errorMessage = "Passphrases do not match.";
        return;
    }

    isLoading = true;
    try {
        await globalState?.vaultController.setRecoveryPassphrase(
            passphrase,
            confirmPassphrase,
        );
        passphrase = "";
        confirmPassphrase = "";
        hasExistingPassphrase = true;
        showSuccessDrawer = true;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errorMessage = message.includes("requirements")
            ? message
            : "Failed to save passphrase. Please try again.";
        console.error("setRecoveryPassphrase failed:", err);
    } finally {
        isLoading = false;
    }
}

async function handleClose() {
    showSuccessDrawer = false;
    await goto("/settings");
}

const allMet = $derived(
    passphrase.length > 0 && REQUIREMENTS.every((r) => r.test(passphrase)),
);
const mismatch = $derived(
    confirmPassphrase.length > 0 && confirmPassphrase !== passphrase,
);
</script>

<main
    class="h-[85vh] px-[5vw] pb-[8svh] flex flex-col justify-between"
    style="padding-top: max(4svh, env(safe-area-inset-top));"
>
    <section class="flex flex-col gap-[3svh]">
        {#if hasExistingPassphrase}
            <p class="text-black-700">
                A recovery passphrase is already set. Enter a new one below to replace it.
            </p>
        {:else}
            <p class="text-black-700">
                Set a passphrase that will be required when recovering your eVault.
                Only a secure hash is stored — your passphrase is never readable.
            </p>
        {/if}

        <div>
            <p class="mb-[1svh]">New passphrase</p>
            <input
                type="password"
                bind:value={passphrase}
                autocomplete="new-password"
                placeholder="Enter your passphrase"
                class="w-full rounded-xl border border-transparent bg-gray px-4 py-3 focus:outline-none focus:border-primary transition-colors"
            />

            {#if passphrase}
                <ul class="mt-[1.5svh] flex flex-col gap-[0.6svh]">
                    {#each REQUIREMENTS as req}
                        <li class="small flex items-center gap-2 {req.test(passphrase) ? 'text-green-600' : 'text-black-300'}">
                            <span class="font-bold w-3 text-center">{req.test(passphrase) ? "✓" : "·"}</span>
                            {req.label}
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>

        <div>
            <p class="mb-[1svh]">Confirm passphrase</p>
            <input
                type="password"
                bind:value={confirmPassphrase}
                autocomplete="new-password"
                placeholder="Re-enter your passphrase"
                class="w-full rounded-xl border {mismatch ? 'border-danger' : 'border-transparent'} bg-gray px-4 py-3 focus:outline-none focus:border-primary transition-colors"
            />
            {#if mismatch}
                <p class="text-danger mt-[0.5svh]">Passphrases do not match.</p>
            {/if}
        </div>

        {#if errorMessage}
            <p class="text-danger">{errorMessage}</p>
        {/if}
    </section>

    <ButtonAction
        class="w-full"
        callback={handleSave}
        disabled={isLoading || !allMet || !confirmPassphrase || mismatch}
    >
        {isLoading ? "Saving…" : hasExistingPassphrase ? "Update Passphrase" : "Set Passphrase"}
    </ButtonAction>
</main>

<Drawer bind:isPaneOpen={showSuccessDrawer}>
    <div class="relative bg-gray w-18 h-18 rounded-3xl flex justify-center items-center mb-[2.3svh]">
        <span class="relative z-1">
            <HugeiconsIcon icon={ShieldKeyIcon} color="var(--color-primary)" />
        </span>
        <img class="absolute top-0 start-0" src="/images/Line.svg" alt="" />
        <img class="absolute top-0 start-0" src="/images/Line2.svg" alt="" />
    </div>
    <h4>Recovery Passphrase {hasExistingPassphrase ? "Updated" : "Set"}!</h4>
    <p class="text-black-700 mt-[0.5svh] mb-[2.3svh]">
        Your recovery passphrase has been securely stored. You will need it when recovering your eVault.
    </p>
    <ButtonAction class="w-full" callback={handleClose}>Done</ButtonAction>
</Drawer>
