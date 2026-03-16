<script lang="ts">
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';

	$effect(() => {
		if ($isAuthenticated) {
			goto('/profile');
		} else {
			goto('/auth');
		}
	});
</script>
