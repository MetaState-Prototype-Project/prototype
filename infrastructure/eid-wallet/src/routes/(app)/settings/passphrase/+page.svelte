<script lang="ts">
import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import { runtime } from "$lib/global/runtime.svelte";
import { ButtonAction, Drawer } from "$lib/ui";
import { LockPasswordIcon, ShieldKeyIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { getContext, onMount } from "svelte";

let globalState: GlobalState | undefined = $state(undefined);

let passphrase = $state("");
let confirmPassphrase = $state("");
let isLoading = $state(false);
let showSuccessDrawer = $state(false);
let errorMessage = $state<string | null>(null);
let strengthErrors = $state<string[]>([]);
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

function checkStrength(p: string): string[] {
    return REQUIREMENTS.filter((r) => !r.test(p)).map((r) => r.label);
}

$effect(() => {
    runtime.header.title = "Recovery Passphrase";
});

$effect(() => {
    strengthErrors = passphrase ? checkStrength(passphrase) : [];
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

    const errors = checkStrength(passphrase);
    if (errors.length > 0) {
        errorMessage = "Passphrase does not meet requirements.";
        return;
    }

    if (passphrase !== confirmPassphrase) {
        errorMessage = "Passphrases do not match.";
        return;
    }

    isLoading = true;
    try {
        await globalState!.vaultController.setRecoveryPassphrase(
            passphrase,
            confirmPassphrase,
        );
        passphrase = "";
        confirmPassphrase = "";
        hasExistingPassphrase = true;
        showSuccessDrawer = true;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Surface server-side strength errors if returned
        if (message.includes("requirements")) {
            errorMessage = message;
        } else {
            errorMessage = "Failed to save passphrase. Please try again.";
        }
        console.error("setRecoveryPassphrase failed:", err);
    } finally {
        isLoading = false;
    }
}

async function handleClose() {
    showSuccessDrawer = false;
    await goto("/settings");
}
</script>

<main
    class="h-[85vh] px-[5vw] pb-[8svh] flex flex-col justify-between"
    style="padding-top: max(4svh, env(safe-area-inset-top));"
>
    <section class="flex flex-col gap-5">
        <!-- Info banner -->
        <div class="bg-primary-50 border border-primary-200 rounded-xl p-4 text-sm text-primary-900">
            <p class="font-semibold mb-1">Why set a recovery passphrase?</p>
            <p class="text-primary-800">
                When recovering your eVault, you will be required to provide
                this passphrase in addition to your biometric identity. Only a
                secure hash is stored — your passphrase is never readable.
            </p>
            {#if hasExistingPassphrase}
                <p class="mt-2 text-xs font-medium text-green-700">
                    ✓ A recovery passphrase is already set. Submitting below will replace it.
                </p>
            {/if}
        </div>

        <!-- Passphrase input -->
        <div class="flex flex-col gap-1">
            <label
                for="passphrase"
                class="text-sm font-medium text-black-700"
            >
                New Passphrase
            </label>
            <input
                id="passphrase"
                type="password"
                bind:value={passphrase}
                autocomplete="new-password"
                placeholder="Enter your passphrase"
                class="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition"
            />
        </div>

        <!-- Requirements checklist -->
        {#if passphrase}
            <ul class="flex flex-col gap-1 text-xs">
                {#each REQUIREMENTS as req}
                    <li
                        class="flex items-center gap-2 {req.test(passphrase)
                            ? 'text-green-600'
                            : 'text-gray-400'}"
                    >
                        <span class="w-4 text-center font-bold">
                            {req.test(passphrase) ? "✓" : "·"}
                        </span>
                        {req.label}
                    </li>
                {/each}
            </ul>
        {/if}

        <!-- Confirm input -->
        <div class="flex flex-col gap-1">
            <label
                for="confirm-passphrase"
                class="text-sm font-medium text-black-700"
            >
                Confirm Passphrase
            </label>
            <input
                id="confirm-passphrase"
                type="password"
                bind:value={confirmPassphrase}
                autocomplete="new-password"
                placeholder="Re-enter your passphrase"
                class="w-full rounded-xl border {confirmPassphrase &&
                confirmPassphrase !== passphrase
                    ? 'border-red-400 focus:ring-red-200'
                    : 'border-gray-300 focus:ring-primary-200'} bg-white px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-2 transition"
            />
            {#if confirmPassphrase && confirmPassphrase !== passphrase}
                <p class="text-xs text-red-500 mt-0.5">
                    Passphrases do not match.
                </p>
            {/if}
        </div>

        <!-- Global error -->
        {#if errorMessage}
            <p class="text-sm text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                {errorMessage}
            </p>
        {/if}
    </section>

    <ButtonAction
        class="w-full"
        callback={handleSave}
        disabled={isLoading ||
            strengthErrors.length > 0 ||
            !passphrase ||
            passphrase !== confirmPassphrase}
    >
        {isLoading ? "Saving…" : hasExistingPassphrase ? "Update Passphrase" : "Set Passphrase"}
    </ButtonAction>
</main>

<!-- Success drawer -->
<Drawer bind:isPaneOpen={showSuccessDrawer}>
    <div
        class="relative bg-gray w-18 h-18 rounded-3xl flex justify-center items-center mb-[2.3svh]"
    >
        <span class="relative z-1">
            <HugeiconsIcon
                icon={ShieldKeyIcon}
                color="var(--color-primary)"
            />
        </span>
        <img class="absolute top-0 start-0" src="/images/Line.svg" alt="" />
        <img class="absolute top-0 start-0" src="/images/Line2.svg" alt="" />
    </div>
    <h4>Recovery Passphrase Set!</h4>
    <p class="text-black-700 mt-[0.5svh] mb-[2.3svh]">
        Your recovery passphrase has been securely stored. You will need it
        when recovering your eVault in the future.
    </p>
    <ButtonAction class="w-full" callback={handleClose}>Done</ButtonAction>
</Drawer>
