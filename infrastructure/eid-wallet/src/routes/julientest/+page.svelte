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
          class="rounded-full fi fis fi-{id} scale-150 mr-12 outline-8 outline-gray-900"
        ></div>
      {/snippet}
      {value}
    </Selector>
  {/each}
</fieldset>
