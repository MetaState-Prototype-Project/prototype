<script lang="ts">
	import { Database01FreeIcons, PauseFreeIcons } from "@hugeicons/core-free-icons";
	import { HugeiconsIcon } from "@hugeicons/svelte";

	let isPaused = $state(false);

	const dummyEvents = [
		{ id: 1, from: "alice", to: "pictique" },
		{ id: 2, from: "pictique", to: "bob" }
	];
</script>

<style>
    .dot{
        offset-path: rect(0px 100% 175px 0px round 0%);
        offset-distance: 0%;
        offset-rotate: auto;
        animation: move 10s linear infinite;
    }

    @keyframes move {
  0% {
    offset-distance: 100%;
    opacity: 1;
  }
  60% {
    opacity: 1; /* dot visible along right and bottom */
  }
  70% {
    opacity: 0; /* start fading out on left curve */
  }
  80% {
    opacity: 0;   /* fully invisible near top edge */
  }
  95% {
    opacity: 0;
  }
  100% {
    offset-distance: 0%;
    opacity: 0;   /* remains invisible until teleport */
  }
}
</style>

<article class="w-full h-[80vh] px-16 py-6 flex flex-col items-center bg-gray rounded-md">
    <div class="w-full flex justify-between items-center mb-20.5">
        <h4 class="text-xl">Live Monitering</h4>
        <button class="px-4 py-3 flex items-center gap-2 text-base font-geist font-medium text-black-700 bg-white border border-[#e5e5e5] rounded-4xl">
            <HugeiconsIcon icon={PauseFreeIcons} size="24px"/>
            Pause Live Feed
        </button>
    </div>
    <div class="relative w-full flex justify-between items-center z-10">
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <div class="w-[88%] h-[175px] absolute top-[55%] start-[50%] z-[-1] translate-x-[-50%] bg-transparent border border-t-transparent border-s-green border-b-green border-e-green rounded-md">
            <div class="dot absolute h-2.5 w-2.5 top-0 start-[-1px] bg-green rounded-full"/>
        </div>

        <div class="flex flex-col items-center justify-center rounded-md gap-2 bg-white p-3 border border-black/10">
            <HugeiconsIcon icon={Database01FreeIcons}/>
            <div class="font-semibold text-sm">Alice</div>
            <div class="text-xs text-gray-500">alice.vault.dev</div>
        </div>

        <div class="bg-white p-3 rounded-md shadow absolute top-[200px] start-[50%] translate-x-[-50%]  text-center">
            <img src="/" alt="Icon">
            <div class="text-xs text-gray-700">pictique</div>
        </div>

        <div class="flex flex-col items-center justify-center rounded-md gap-2 bg-white p-3 border border-green">
            <HugeiconsIcon icon={Database01FreeIcons}/>
            <div class="font-semibold text-sm">BOB</div>
            <div class="text-xs text-gray-500">BOB.vault.dev</div>
        </div>
    </div>
</article>
