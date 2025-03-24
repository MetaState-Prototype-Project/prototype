<script lang="ts">
    import type { HTMLAttributes } from 'svelte/elements';

    interface IIdentityCard extends HTMLAttributes<HTMLElement>{
        variant: string;
        copyBtn: () => void;
    }

</script>

<div class="relative bg-black-900 rounded-xl w-full min-h-[150px] text-white shadow-lg overflow-hidden mb-5">
    <div class="w-full h-full pointer-events-none flex gap-13 justify-end absolute right-15 bottom-20">
        <div class="w-10 bg-white/10 h-[300%] rotate-40"></div>
        <div class="w-10 bg-white/10 h-[300%] rotate-40"></div>
    </div>
    <div class="p-5 flex flex-col gap-2">
        <div>
            <img src="/images/GreenCheckmark.svg" alt="">
        </div>
        <div>
            <h2 class="text-md text-gray-400 font-semibold">Your W3ID</h2>
            <div class="flex items-center justify-between w-full">
                <p class="text-white w-[60%]">@caa0f630-2413-5ace-aa2c-4628ce93e497</p>
                <button>Copy</button>
            </div>
        </div>
    </div>
</div>

<div class="relative bg-primary-900 rounded-xl w-full min-h-[150px] text-white shadow-lg overflow-hidden">
    <div class="w-full h-full pointer-events-none flex gap-13 justify-end absolute right-15 bottom-20">
        <div class="w-10 bg-white/10 h-[300%] rotate-40"></div>
        <div class="w-10 bg-white/10 h-[300%] rotate-40"></div>
    </div>
    <div class="p-5 flex flex-col gap-4">
        <div class="flex justify-between">
            <img src="/images/GreenCheckmark.svg" alt="">
            <img src="/images/Eye.svg" alt="">
        </div>
        <div class="flex gap-2 flex-col">
            <div class="flex justify-between">
                <div class="text-md font-normal">Name</div>
                <div class="text-md font-medium">Ananya Rana</div>
            </div>
            <div class="flex justify-between">
                <div class="text-md font-normal">Name</div>
                <div class="text-md font-medium">Ananya Rana</div>
            </div>
            <div class="flex justify-between">
                <div class="text-md font-normal">Name</div>
                <div class="text-md font-medium">Ananya Rana</div>
            </div>
            <div class="flex justify-between">
                <div class="text-md font-normal">Name</div>
                <div class="text-md font-medium">Ananya Rana</div>
            </div>
        </div>
    </div>
</div>