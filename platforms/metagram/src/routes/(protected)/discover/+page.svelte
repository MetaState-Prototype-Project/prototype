<script lang="ts">
	import { Input } from '$lib/ui';

	let searchValue = $state();
</script>

<section>
	<Input type="text" bind:value={searchValue} placeholder="Search user, post and more." />
</section>
