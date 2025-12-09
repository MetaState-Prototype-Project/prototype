<script lang="ts">
	import { ButtonAction } from '$lib/ui';

	type ToastVariant = 'success' | 'error';
	type ToastState = { message: string; variant: ToastVariant };

	const DREAMSYNC_ENDPOINT = 'https://dreamsync.w3ds.metastate.foundation/api/matches/trigger';
	const NETWORK_TIMEOUT = 4 * 60 * 1000; // 4 minutes in milliseconds

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

		const controller = new AbortController();
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		try {
			timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT);

			const response = await fetch(DREAMSYNC_ENDPOINT, {
				method: 'POST',
				signal: controller.signal
			});

			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}

			if (!response.ok) {
				throw new Error(`DreamSync responded with ${response.status}`);
			}

			showToast('DreamSync matchmaking triggered successfully.', 'success');
		} catch (error) {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			if (error instanceof Error && error.name === 'AbortError') {
				showToast(
					'Request timed out. Matchmaking may still be processing. Please wait a few minutes and check the status.',
					'error'
				);
			} else {
				console.error('Failed to trigger DreamSync matchmaking', error);
				showToast('Could not trigger DreamSync matchmaking. Please try again.', 'error');
			}
		} finally {
			isTriggering = false;
		}
	};
</script>

<section class="max-w-3xl space-y-6">
	<div class="border-black-100 rounded-2xl border bg-white px-8 py-6 shadow-sm">
		<h2 class="text-2xl font-semibold text-black">Actions</h2>
		<p class="text-black-700 mt-2">
			Manual actions for orchestrating DreamSync. Trigger matchmaking directly from the
			control panel.
		</p>

		<div class="mt-6 space-y-4">
			<div class="flex items-center gap-4">
				<ButtonAction
					variant="solid"
					size="sm"
					isLoading={isTriggering}
					disableBlur
					blockingClick
					callback={triggerDreamSync}
					class="whitespace-nowrap"
				>
					Trigger DreamSync
				</ButtonAction>
			</div>
			<p class="text-black-500 text-sm">
				Note: Matchmaking can take up to 4 minutes to complete. Please wait for the process
				to finish.
			</p>
		</div>
	</div>
</section>

{#if toast}
	<div
		class={`fixed top-24 right-6 z-50 rounded-lg border px-4 py-3 shadow-lg ${
			toast.variant === 'success'
				? 'border-green-200 bg-green-100 text-green-800'
				: 'border-danger-200 bg-danger-100 text-danger-500'
		}`}
	>
		<p class="font-semibold">{toast.message}</p>
	</div>
{/if}
