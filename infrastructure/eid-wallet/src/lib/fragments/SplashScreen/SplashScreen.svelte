<script lang="ts">
    import { cubicOut } from "svelte/easing";
    import { fade, scale } from "svelte/transition";
</script>

<div
    out:fade={{ duration: 150 }}
    class="z-50 absolute w-screen h-screen overflow-hidden"
>
    <div class="relative w-screen h-screen bg-primary overflow-hidden">
        <img
            in:scale={{
                start: 0.8,
                duration: 500,
                easing: cubicOut,
                opacity: 1,
            }}
            class="absolute w-full bottom-[-80px] start-0"
            src="/images/Shape1.svg"
            alt="illustration"
        />
        <img
            in:scale={{
                start: 0.8,
                duration: 500,
                easing: cubicOut,
                opacity: 1,
            }}
            class="absolute w-full top-[50px] end-[100px]"
            src="/images/Shape2.svg"
            alt="illustration"
        />
        <div
            in:scale={{
                start: 0.9,
                duration: 500,
                easing: cubicOut,
                opacity: 1,
            }}
            class="absolute w-full top-[42%] start-[50%] translate-x-[-50%] translate-y-[-42%]"
        >
            <h1
                in:fade={{ duration: 500 }}
                class="text-center text-white text-[44px]"
            >
                eID Wallet
            </h1>
            <p in:fade={{ duration: 500 }} class="text-center text-white">
                for Web 3.0 Data Space
            </p>
        </div>
        <img
            in:fade={{ duration: 500 }}
            class="absolute bottom-[116px] start-[50%] translate-x-[-50%]"
            src="/images/W3DSLogoWhite.svg"
            alt="logo"
        />
    </div>
</div>

<style>
</style>
