<script lang="ts">
import { cn } from "$lib/utils";
import type { HTMLAttributes } from "svelte/elements";

interface IConnection extends HTMLAttributes<HTMLElement> {
    imgSrc: string;
    connectionName: string;
    lastConnected: Date;
    onClick?: () => void;
}

let {
    imgSrc,
    connectionName,
    lastConnected,
    onClick,
    ...restProps
}: IConnection = $props();
</script>

<div
  {...restProps}
  class={cn('flex items-center justify-between px-3 py-2', restProps.class)}
>
  <div class="flex items-center gap-2">
    <div
      class="p-3 bg-gray max-w-max rounded-4xl object-cover flex items-center"
    >
      <img class="size-6" src={imgSrc} alt={connectionName} />
    </div>
    <div>
      <h2 class="text-md font-medium text-black-900">{connectionName}</h2>
      <p class="text-xs text-black-700">Last Active {lastConnected}</p>
    </div>
  </div>
  <button class="p-2 text-md font-semibold text-primary-500" onclick={onClick}>
    Disconnect
  </button>
</div>
