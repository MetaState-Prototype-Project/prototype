<script lang="ts" generics="T">
  import { cn } from '$lib/utils'
  import { Tick01Icon } from '@hugeicons/core-free-icons'
  import { HugeiconsIcon } from '@hugeicons/svelte'
  import type { HTMLLabelAttributes } from 'svelte/elements'
  import { fade } from 'svelte/transition'

  interface ISelectorProps extends HTMLLabelAttributes {
    id: string
    name: string
    value: string
    icon?: (id: string) => any
    selected?: string
    children?: () => any
  }

  let {
    id,
    name,
    value,
    icon = undefined,
    selected = $bindable(),
    children = undefined,
    ...restProps
  }: ISelectorProps = $props()
</script>

<label
  {...restProps}
  for={id}
  class={cn(
    ['flex w-full justify-between items-center py-4', restProps.class].join(' ')
  )}
>
  <div class="flex">
    <div class="capitalize flex items-center">
      <input
        type="radio"
        {id}
        {name}
        {value}
        class="appearance-none"
        bind:group={selected}
      />
      {#if icon}
        <div>{@render icon(id)}</div>
      {/if}
      {#if children}
        {@render children()}
      {/if}
    </div>
  </div>
  {#if selected === value}
    <div in:fade={{ duration: 150, delay: 0 }} class="overflow-hidden">
      <HugeiconsIcon
        color="var(--color-white)"
        icon={Tick01Icon}
        className="bg-primary-900 rounded-full w-6 h-6"
      />
    </div>
  {/if}
</label>

<!-- 
  @component
  export default Selector
  @description
  A radio button with an icon and a label
  @props
  - id: string
  - name: string
  - value: string
  - icon: (id: string) => any
  - selected: string
  - children: () => any
  @slots
  - default: The label of the radio button
  @example
  ```svelte
  <Selector id="gb" name="lang" value="English UK (Default)" bind:selected={$selected}>
    <div class="rounded-full fi fis fi-gb scale-150 mr-12 outline-8 outline-gray-900"></div>
    English UK (Default)
  </Selector>
  ```
-->
