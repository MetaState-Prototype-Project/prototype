<script lang="ts">
	import { PUBLIC_PROFILE_EDITOR_BASE_URL } from '$env/static/public';
	import { login } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { Skeleton } from '@metastate-foundation/ui/skeleton';
	import { Button } from '@metastate-foundation/ui/button';

	let status = $state<'loading' | 'error'>('loading');
	let errorMessage = $state('');

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		const ename = params.get('ename');
		const session = params.get('session');
		const signature = params.get('signature');

		if (!ename || !session || !signature) {
			status = 'error';
			errorMessage = 'Missing authentication parameters.';
			return;
		}

		window.history.replaceState({}, '', window.location.pathname);

		try {
			const response = await fetch(`${PUBLIC_PROFILE_EDITOR_BASE_URL}/api/auth`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ename, session, signature })
			});

			if (response.ok) {
				const data = await response.json();
				if (data.token && data.user) {
					login(data.token, data.user);
					window.location.href = '/profile';
					return;
				}
			}

			const errorData = await response.json().catch(() => ({}));
			status = 'error';
			errorMessage = errorData.message || 'Authentication failed.';
		} catch {
			status = 'error';
			errorMessage = 'Connection failed. Please try again.';
		}
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
	{#if status === 'loading'}
		<div class="flex flex-col items-center gap-3">
			<Skeleton class="h-8 w-8 rounded-full" />
			<p class="text-sm text-muted-foreground">Authenticating...</p>
		</div>
	{:else}
		<div class="flex flex-col items-center gap-4 p-6 text-center">
			<p class="text-destructive">{errorMessage}</p>
			<Button variant="link" href="/auth">Try again</Button>
		</div>
	{/if}
</div>
