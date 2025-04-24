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
    if (!(await globalState.userController.user)) {
        await goto("/onboarding");
        return;
    }
    if (!(await globalState.securityController.pinHash)) {
        await goto("/register");
        return;
    }
    await goto("/login");
});
</script>

<Button.Action class={`w-full`} variant="danger" callback={clearPin}>
    Clear Pin
</Button.Action>

{cleared ? "Pin cleared, restart app" : "Login"}
