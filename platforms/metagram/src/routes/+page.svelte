<script lang="ts">
	import { goto } from '$app/navigation';

	$effect(() => {
		goto('/home');
	});
</script>
