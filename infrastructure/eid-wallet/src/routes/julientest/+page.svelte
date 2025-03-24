<script lang="ts">
  import Selector from '$lib/ui/Selector/Selector.svelte'
  import { writable } from 'svelte/store'

  let selectors = [
    {
      id: 'gb',
      value: 'English UK (Default)',
      checked: true,
    },
    {
      id: 'es',
      value: 'Spanish',
      checked: false,
    },
    {
      id: 'de',
      value: 'German',
      checked: false,
    },
    {
      id: 'fr',
      value: 'French',
      checked: false,
    },
    {
      id: 'ru',
      value: 'Russian',
      checked: false,
    },
  ]

  let selected = writable(selectors[0].value)
</script>

<h1 class="text-2xl font-bold">Select your language</h1>

<fieldset class="mx-8 flex flex-col gap-12 mt-12">
  {#each selectors as selector}
    {@const { id, value, checked } = selector}

    <Selector {id} name="lang" {value} {checked} bind:selected={$selected}>
      {#snippet flagIcon(id: string)}
        <div
          class="rounded-full fi fis fi-{id} scale-150 mr-8 outline-8 outline-gray-900"
        ></div>
      {/snippet}
      {value}
    </Selector>
  {/each}
</fieldset>
