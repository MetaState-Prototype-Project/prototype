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
        globalState.vaultController.vault = {
            uri: recovery.uri,
            ename: recovery.ename,
        };
        pendingRecovery.set(null);
    }
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
    <section>
        <Hero
            title="Here's your ePassport"
            class="mb-2"
            titleClasses="text-2xl"
        >
            {#snippet subtitle()}
                <p>
                    You can use it to access any platform that supports the Web
                    3.0 Data Space – <strong>no usernames, no passwords</strong
                    >. If you lose your phone, you can reissue your ePassport on
                    another device, linked to the same <strong>eName</strong>.
                </p>
            {/snippet}
        </Hero>
        <IdentityCard variant="ePassport" {userData} />
    </section>
    <div class="mt-auto flex flex-col gap-3">
        <ButtonAction class="w-full" callback={handleFinish}>Finish</ButtonAction>
        <ButtonAction variant="soft" class="w-full" callback={() => goto("/register")}>Back</ButtonAction>
    </div>
</main>
