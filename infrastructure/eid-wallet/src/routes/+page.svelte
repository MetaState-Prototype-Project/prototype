<script lang="ts">
  import SquircleDigit from '$lib/icons/SquircleDigit.svelte'
  import * as Button from '$lib/ui/Button'

  // dummy async function
  async function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function dummyFunction() {
    await delay(1000)
    console.log('Button clicked!')
  }
</script>

<h1 class="text-lg text-primary-900">Archivo font Everyone</h1>

<div class="bg-secondary-700 text-primary-500 p-4">Secondary Background</div>
<div class="flex gap-2 mx-4">
  <div class="flex flex-col gap-2">
    <Button.Action
      cb={dummyFunction}
      blockingClick
      variant="solid"
      class="w-full"
    >
      <SquircleDigit class="mr-2" />
      Button
    </Button.Action>
    <Button.Action variant="solid" disabled
      ><SquircleDigit class="mr-2" />Button</Button.Action
    >
    <Button.Action variant="danger" role="danger"
      ><SquircleDigit class="mr-2" />Button</Button.Action
    >
  </div>
  <div class="flex flex-col gap-2">
    <Button.Action
      cb={async () => {
        await delay(1000)
        console.log('Button clicked!')
      }}
      blockingClick
      variant="soft"><SquircleDigit class="mr-2" />Button</Button.Action
    >
    <Button.Action variant="soft" disabled
      ><SquircleDigit class="mr-2" />Button</Button.Action
    >
    <Button.Action variant="danger-soft"
      ><SquircleDigit class="mr-2" />Button</Button.Action
    >
  </div>
</div>
