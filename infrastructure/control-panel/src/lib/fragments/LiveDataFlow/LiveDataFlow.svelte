<script lang="ts">
	import { Database01FreeIcons, PauseFreeIcons, PlayFreeIcons } from "@hugeicons/core-free-icons";
	import { HugeiconsIcon } from "@hugeicons/svelte";

  interface IEvent {
    id: string,
    from: string,
    to: string,
    imageSrc: string,
    vaultName: string
  }

  interface IDataFlowProps {
    events: IEvent[];
  }
  let {events}: IDataFlowProps = $props();
	let isPaused = $state(false);
</script>

<style>
    .dot{
        offset-path: rect(0px 100% 175px 0px round 0%);
        offset-distance: 0%;
        offset-rotate: auto;
        animation: move 10s linear infinite;
        animation-play-state: var(--dot-animation-state, running);
    }

    @keyframes move {
  0% {
    offset-distance: 100%;
    opacity: 1;
  }
  50% {
    opacity: 1;
  }
  55% {
    opacity: 0.4;
  }
  60% {
    opacity: 0;
  }
  100% {
    offset-distance: 0%;
    opacity: 0;
  }
}

</style>

<article class="w-full h-[80vh] px-16 py-6 flex flex-col items-center bg-gray rounded-md">
    <div class="w-full flex justify-between items-center mb-20.5">
        <h4 class="text-xl">Live Monitering</h4>
        <button onclick={() => isPaused = !isPaused} class="px-4 py-3 flex items-center gap-2 text-base font-geist font-medium text-black-700 bg-white border border-[#e5e5e5] rounded-4xl">
            {#if isPaused}
            <HugeiconsIcon icon={PlayFreeIcons} size="24px"/>
            {:else}
            <HugeiconsIcon icon={PauseFreeIcons} size="24px"/>
            {/if}
            {isPaused ? 'Resume Live Feed' : 'Pause Live Feed'}
        </button>
    </div>
    <div class="relative w-full flex justify-between items-center z-10">
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <div class="w-[88%] h-[175px] absolute top-[55%] start-[50%] z-[-1] translate-x-[-50%] bg-transparent border border-t-transparent border-s-green border-b-green border-e-green rounded-md">
            <div class="dot absolute h-2.5 w-2.5 top-0 start-[-1px] bg-green rounded-full" style="--dot-animation-state: {isPaused ? 'paused' : 'running'}"/>
        </div>

        <div class="flex flex-col items-center justify-center rounded-md gap-2 bg-white p-3 border border-black/10">
            <HugeiconsIcon icon={Database01FreeIcons}/>
            <div class="font-semibold text-sm">{events[0].from}</div>
            <div class="text-xs text-gray-500">{events[0].vaultName}</div>
        </div>

        <div class="bg-white p-3 rounded-md shadow absolute top-[200px] start-[50%] translate-x-[-50%]  text-center">
            <img src="/" alt="Icon">
            <div class="text-xs text-gray-700">{events[1].from}</div>
        </div>

        <div class="flex flex-col items-center justify-center rounded-md gap-2 bg-white p-3 border border-green">
            <HugeiconsIcon icon={Database01FreeIcons}/>
            <div class="font-semibold text-sm">{events[2].from}</div>
            <div class="text-xs text-gray-500">{events[2].vaultName}</div>
        </div>
    </div>
</article>
