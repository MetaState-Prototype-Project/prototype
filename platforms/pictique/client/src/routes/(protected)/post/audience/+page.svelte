<script lang="ts">
	import { audience } from '$lib/store/store.svelte';
	import { InputRadio } from '$lib/ui';
</script>

<h1 class="mb-4">Who can see your posts?</h1>
<span class="flex flex-col gap-4">
	<label for="Everyone" class="flex items-center justify-between">
		Everyone
		<InputRadio value="Everyone" name="audience" bind:selected={audience.value} />
	</label>
	<label for="Only Followers" class="flex items-center justify-between">
		Only Followers
		<InputRadio value="Only Followers" name="audience" bind:selected={audience.value} />
	</label>
	<label for="No one" class="flex items-center justify-between">
		No one
		<InputRadio value="No one" name="audience" bind:selected={audience.value} />
	</label>
</span>
