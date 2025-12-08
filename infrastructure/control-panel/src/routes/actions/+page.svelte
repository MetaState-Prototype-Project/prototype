<script lang="ts">
	import { ButtonAction } from '$lib/ui';

	type ToastVariant = 'success' | 'error';
	type ToastState = { message: string; variant: ToastVariant };

	const DREAMSYNC_ENDPOINT = 'https://dreamsync.w3ds.metastate.foundation/api/matches/trigger';

	let isTriggering = $state(false);
	let toast = $state<ToastState | null>(null);
	let toastTimeout: ReturnType<typeof setTimeout> | null = null;

	const showToast = (message: string, variant: ToastVariant) => {
		toast = { message, variant };

		if (toastTimeout) {
			clearTimeout(toastTimeout);
		}

		toastTimeout = setTimeout(() => {
			toast = null;
		}, 4000);
	};

	const triggerDreamSync = async () => {
		isTriggering = true;

		try {
			const response = await fetch(DREAMSYNC_ENDPOINT, { method: 'POST' });

			if (!response.ok) {
				throw new Error(`DreamSync responded with ${response.status}`);
			}

			showToast('DreamSync matchmaking triggered successfully.', 'success');
		} catch (error) {
			console.error('Failed to trigger DreamSync matchmaking', error);
			showToast('Could not trigger DreamSync matchmaking. Please try again.', 'error');
		} finally {
			isTriggering = false;
		}
	};
</script>

<section class="max-w-3xl space-y-6">
	<div class="rounded-2xl border border-black-100 bg-white px-8 py-6 shadow-sm">
		<h2 class="text-2xl font-semibold text-black">Actions</h2>
		<p class="mt-2 text-black-700">
			Manual actions for orchestrating DreamSync. Trigger matchmaking directly from the control panel.
		</p>

		<div class="mt-6 flex items-center gap-4">
			<ButtonAction
				variant="solid"
				size="sm"
				isLoading={isTriggering}
				blockingClick
				callback={triggerDreamSync}
				class="whitespace-nowrap"
			>
				Trigger DreamSync
			</ButtonAction>
			<span class="text-sm text-black-500">Sends a POST to {DREAMSYNC_ENDPOINT}</span>
		</div>
	</div>
</section>

{#if toast}
	<div
		class={`fixed right-6 top-24 z-50 rounded-lg border px-4 py-3 shadow-lg ${
			toast.variant === 'success'
				? 'border-green-200 bg-green-100 text-green-800'
				: 'border-danger-200 bg-danger-100 text-danger-500'
		}`}
	>
		<p class="font-semibold">{toast.message}</p>
	</div>
{/if}

