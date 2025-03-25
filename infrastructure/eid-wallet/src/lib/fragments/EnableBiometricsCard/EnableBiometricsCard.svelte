<script lang="ts">
    import { cn } from "$lib/utils";
    import type { HTMLAttributes } from "svelte/elements";

    interface IBiometricCardProps extends HTMLAttributes<HTMLElement> {
        handleEnableBiometrics?: () => Promise<void>;
        email?: string
        isModalOpen?: boolean
    }

    let modal: HTMLDivElement;

    let {handleEnableBiometrics= undefined, email = "abc@appleseed.com",isModalOpen = $bindable(false), ...restProps}: IBiometricCardProps = $props()

    const cBase = "max-w-[270px] min-h-[183px] bg-white rounded-[14px] py-[20px] px-0 flex flex-col items-center justify-between"
</script>

<div class={`modal ${isModalOpen ? "modal-open" : ""}`} role="dialog" bind:this={modal}>
    <div {...restProps} class={cn(`modal-box ${cBase}`, restProps.class)}>
        <img src="" alt="icon">
        <div>
            <h1 class="text-black text-[17px] font-medium text-center">Touch ID</h1>
            <p class="text-center text-black text-[13px] font-normal">{email}</p>
        </div>
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <div class="h-[1px] w-full bg-black-100"/>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <p class="text-blue text-[17px] font-medium" onclick={handleEnableBiometrics}>Enable biometrics</p>
    </div>
  </div>