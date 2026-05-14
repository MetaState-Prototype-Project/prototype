<script lang="ts">
import { goto } from "$app/navigation";
import type { GlobalState } from "$lib/global";
import * as Button from "$lib/ui/Button";
import { getContext, onMount } from "svelte";

let globalState: GlobalState | undefined = $state(undefined);

let clearPin = $state(async () => {});
let cleared = $state(false);

onMount(async () => {
    globalState = getContext<() => GlobalState>("globalState")();
    if (!globalState) throw new Error("Global state is not defined");
    clearPin = async () => {
        try {
            await globalState?.securityController.clearPin();
            cleared = true;
        } catch (error) {
            console.error("Failed to clear PIN:", error);
            // Consider adding user-facing error feedback
        }
    };
    let onboardingComplete = false;
    try {
        onboardingComplete = await globalState.isOnboardingComplete;
    } catch (error) {
        console.error("Failed to determine onboarding status:", error);
    }

    const user = await globalState.userController.user;
    const pinHash = await globalState.securityController.pinHash;
    const vault = await globalState.vaultController.vault;
    console.log(
        "[ROOT] routing check — onboardingComplete:",
        onboardingComplete,
        "| user:",
        !!user,
        "| pinHash:",
        !!pinHash,
        "| vault:",
        !!vault,
    );

    if (!onboardingComplete || !user) {
        // First-time user — the layout's splash + drawer owns this entry,
        // we stay on / so the drawer's CTAs route from here.
        console.log(
            "[ROOT] staying on / for splash drawer (onboardingComplete:",
            onboardingComplete,
            ", user:",
            !!user,
            ")",
        );
        return;
    }
    if (!pinHash) {
        console.log("[ROOT] → /register (no pinHash)");
        await goto("/register");
        return;
    }
    console.log("[ROOT] → /login");
    await goto("/login");
});
</script>
