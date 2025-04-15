<script lang="ts">
import { cn } from "$lib/utils";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import type { Snippet } from "svelte";
import type { HTMLLabelAttributes } from "svelte/elements";
import { fade } from "svelte/transition";

interface ISelectorProps extends HTMLLabelAttributes {
    id: string;
    name: string;
    value: string;
    icon?: Snippet<[string]>;
    selected?: string;
    children?: Snippet;
}

let {
    id,
    name,
    value,
    icon = undefined,
    selected = $bindable(),
    children = undefined,
    ...restProps
}: ISelectorProps = $props();
</script>

<label
    {...restProps}
    for={id}
    class={cn(
        ["flex w-full justify-between items-center ps-[5vw] py-6", restProps.class].join(
            " "
        )
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
            <div class="">
              {@render icon?.(id)}
            </div>
            {/if}
            <p>
              {@render children?.()}
            </p>
        </div>
    </div>
    {#if selected === value}
        <div in:fade={{ duration: 150, delay: 0 }} class="overflow-hidden">
            <HugeiconsIcon
                color="var(--color-white)"
                icon={Tick01Icon}
                className="bg-primary-500 rounded-full w-6 h-6"
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
  <script lang="ts">
    import Selector from '$lib/ui/Selector/Selector.svelte'
    import { getLanguageWithCountry } from '$lib/utils/getLanguage'
    import { writable } from 'svelte/store'
  
    const AVAILABLE_LANGUAGES = ['en-GB', 'es', 'de', 'fr', 'ru']
  
    const selectors = AVAILABLE_LANGUAGES.map((locale) => {
      const { code, name } = getLanguageWithCountry(locale)
  
      return {
        id: code,
        value: name,
        checked: locale === 'en-GB',
      }
    })
  
    let selected = writable(selectors[0].value)
  </script>
  
  <h1 class="text-2xl font-bold">Select your language</h1>
  
  <fieldset class="mx-8 flex flex-col gap-4 mt-12">
    {#each selectors as selector}
      {@const { id, value, checked } = selector}
  
      <Selector {id} name="lang" {value} bind:selected={$selected}>
        {#snippet icon(id: string)}
          <div
            class="rounded-full fi fis fi-{id} scale-150 mr-12 outline-8 outline-gray"
          ></div>
        {/snippet}
        {value}
      </Selector>
    {/each}
  </fieldset>
  ```
-->
