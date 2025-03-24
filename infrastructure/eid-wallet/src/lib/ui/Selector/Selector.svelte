<script lang="ts" generics="T">
  import { cn } from '$lib/utils'
  import { Tick01Icon } from '@hugeicons/core-free-icons'
  import { HugeiconsIcon } from '@hugeicons/svelte'
  import { fly, slide } from 'svelte/transition'

  let {
    id,
    name,
    value,
    icon = undefined,
    selected = $bindable(),
    children = undefined,
    ...restProps
  } = $props()
</script>

<!-- {#each langs as lang}
<Selector id={lang.id} name="lang" icon={lang.icon}>{lang.label}</Selector>
{/each} -->
<div class="flex w-full justify-between">
  <div>
    <input
      type="radio"
      {id}
      {name}
      {value}
      class="appearance-none"
      bind:group={selected}
      {...restProps}
    />
    <label for={id} class="capitalize">
      {#if icon}
        <HugeiconsIcon {icon} className="mr-4" />
      {/if}
      {@render children()}
    </label>
  </div>
  {#if selected === value}
    <div
      in:fly={{ duration: 150, delay: 0, x: 20, opacity: 0 }}
      out:fly={{ duration: 150, delay: 0, x: 20, opacity: 0 }}
      class="overflow-hidden"
    >
      <HugeiconsIcon
        color="var(--color-white)"
        icon={Tick01Icon}
        className="bg-primary-900 rounded-full w-6 h-6"
      />
    </div>
  {/if}
</div>

<!-- 
  @component
   -->
