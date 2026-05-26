<script lang="ts">
import { goto } from "$app/navigation";
import { Hero } from "$lib/fragments";
import IdentityCard from "$lib/fragments/IdentityCard/IdentityCard.svelte";
import type { GlobalState } from "$lib/global";
import { pendingRecovery } from "$lib/stores/pendingRecovery";
import { ButtonAction } from "$lib/ui";
import { getContext, onMount } from "svelte";
import { get } from "svelte/store";

let userData = $state<Record<string, string | boolean | undefined>>();
let globalState: GlobalState = getContext<() => GlobalState>("globalState")();
const RECOVERY_SKIP_PROFILE_SETUP_KEY = "recoverySkipProfileSetup";

const handleFinish = async () => {
    const recovery = get(pendingRecovery);
    if (recovery) {
        localStorage.setItem(RECOVERY_SKIP_PROFILE_SETUP_KEY, "true");
        // Recovery can happen on a fresh device, so make sure a key exists
        // before navigating into the app. If this throws we surface it rather
        // than silently navigating into a broken state.
        try {
            await globalState.keyService.ensureKey();
        } catch (error) {
            console.error(
                "[e-passport] ensureKey failed during recovery:",
                error,
            );
            return;
        }
        // setVaultAndPersist awaits the store write — the plain `vault =`
        // setter races the (app) auth guard, which reads vault from the
        // store on the next route and bounces back to /login if the write
        // hasn't landed yet. Background chores stay fire-and-forget inside.
        await globalState.vaultController.setVaultAndPersist({
            uri: recovery.uri,
            ename: recovery.ename,
        });
        pendingRecovery.set(null);
    }
    // Mark onboarding complete for BOTH recovery and normal-onboarding flows.
    // Setting it earlier (in register) makes the auth guard at /review and
    // /e-passport treat the user as logged in and bounce them to /login.
    globalState.isOnboardingComplete = true;
    await goto("/main");
};

onMount(async () => {
    const userInfo = await globalState.userController.user;
    const isFake = await globalState.userController.isFake;
    userData = { ...userInfo, isFake };
});
</script>

<main
    class="min-h-[100svh] px-4 flex flex-col justify-between"
    style="padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: max(16px, env(safe-area-inset-bottom));"
>
    <section class="mt-4">
        <Hero
            title="Here's your ePassport"
            class="mb-2"
            titleClasses="text-2xl"
        >
            {#snippet subtitle()}
                <p>
                    Your ePassport lets you log in to any W3DS-enabled platform
                    – <strong>no usernames, no passwords</strong>. If you lose
                    or change your phone, you can re-create your ePassport on a
                    new device with the same eName.
                </p>
            {/snippet}
        </Hero>
        <IdentityCard variant="ePassport" {userData} />
    </section>
    <div class="mt-auto flex flex-col gap-3">
        <ButtonAction class="w-full" callback={handleFinish}
            >Finish</ButtonAction
        >
        <ButtonAction
            variant="soft"
            class="w-full"
            callback={() => goto("/register")}>Back</ButtonAction
        >
    </div>
</main>
