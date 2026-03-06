<script lang="ts">
	import { ButtonAction } from '$lib/ui';
	import { onMount } from 'svelte';

	type ToastVariant = 'success' | 'error';
	type ToastState = { message: string; variant: ToastVariant };

	let health = $state<{ ok: boolean; apns: boolean; fcm: boolean } | null>(null);

	// Single send
	let singleToken = $state('');
	let singlePlatform = $state('');
	let singleTitle = $state('Hello');
	let singleBody = $state('This is a test notification');
	let singleSubtitle = $state('');
	let singleSending = $state(false);
	let platformHint = $state('');

	// Send by eName
	let enameInput = $state('');
	let enameTitle = $state('Hello');
	let enameBody = $state('This is a test notification');
	let enameSubtitle = $state('');
	let enameSending = $state(false);

	// Bulk send (to all registered devices)
	let bulkTitle = $state('Hello');
	let bulkBody = $state('This is a test notification');
	let bulkSubtitle = $state('');
	let bulkSending = $state(false);
	let deviceCount = $state<number | null>(null);

	let toast = $state<ToastState | null>(null);
	let toastTimeout: ReturnType<typeof setTimeout> | null = null;

	const showToast = (message: string, variant: ToastVariant) => {
		toast = { message, variant };
		if (toastTimeout) clearTimeout(toastTimeout);
		toastTimeout = setTimeout(() => (toast = null), 4000);
	};

	function detectPlatform(token: string): string | null {
		const cleaned = token.replace(/\s/g, '');
		if (!cleaned) return null;
		return /^[a-fA-F0-9]{64}$/.test(cleaned) ? 'iOS (APNS)' : 'Android (FCM)';
	}

	$effect(() => {
		platformHint = detectPlatform(singleToken) ?? '';
	});

	const sendSingle = async () => {
		if (!singleToken.trim()) {
			showToast('Enter a token', 'error');
			return;
		}
		if (!singleTitle.trim() || !singleBody.trim()) {
			showToast('Title and body are required', 'error');
			return;
		}
		singleSending = true;
		try {
			const res = await fetch('/api/notifications/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: singleToken.trim(),
					...(singlePlatform && { platform: singlePlatform }),
					payload: {
						title: singleTitle,
						body: singleBody,
						...(singleSubtitle && { subtitle: singleSubtitle })
					}
				})
			});
			const data = await res.json();
			if (data.success) {
				showToast('Notification sent!', 'success');
			} else {
				showToast(data.error ?? 'Failed to send', 'error');
			}
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Request failed', 'error');
		} finally {
			singleSending = false;
		}
	};

	const sendByEName = async () => {
		if (!enameInput.trim()) {
			showToast('Enter an eName', 'error');
			return;
		}
		if (!enameTitle.trim() || !enameBody.trim()) {
			showToast('Title and body are required', 'error');
			return;
		}
		enameSending = true;
		try {
			const res = await fetch('/api/notifications/send-by-ename', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					eName: enameInput.trim(),
					payload: {
						title: enameTitle,
						body: enameBody,
						...(enameSubtitle && { subtitle: enameSubtitle })
					}
				})
			});
			const data = await res.json();
			if (data.success) {
				showToast(
					`Sent to ${data.sent}/${data.total} devices for ${enameInput.trim()}${data.failed > 0 ? ` (${data.failed} failed)` : ''}`,
					data.failed > 0 ? 'error' : 'success'
				);
			} else {
				showToast(data.error ?? 'Send failed', 'error');
			}
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Request failed', 'error');
		} finally {
			enameSending = false;
		}
	};

	const sendBulkAll = async () => {
		if (!bulkTitle.trim() || !bulkBody.trim()) {
			showToast('Title and body are required', 'error');
			return;
		}
		bulkSending = true;
		try {
			const res = await fetch('/api/notifications/send-bulk-all', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					payload: {
						title: bulkTitle,
						body: bulkBody,
						...(bulkSubtitle && { subtitle: bulkSubtitle })
					}
				})
			});
			const data = await res.json();
			if (data.success) {
				showToast(
					`Sent to ${data.sent}/${data.total} devices${data.failed > 0 ? ` (${data.failed} failed)` : ''}`,
					data.failed > 0 ? 'error' : 'success'
				);
				deviceCount = data.total;
			} else {
				showToast(data.error ?? 'Send failed', 'error');
			}
		} catch (err) {
			showToast(err instanceof Error ? err.message : 'Request failed', 'error');
		} finally {
			bulkSending = false;
		}
	};

	onMount(async () => {
		try {
			const [healthRes, countRes] = await Promise.all([
				fetch('/api/notifications/health'),
				fetch('/api/notifications/devices-count')
			]);
			health = await healthRes.json();
			const countData = await countRes.json();
			deviceCount = countData.count ?? 0;
		} catch {
			health = { ok: false, apns: false, fcm: false };
		}
	});
</script>

<section class="max-w-4xl space-y-6">
	<div class="border-black-100 rounded-2xl border bg-white px-8 py-6 shadow-sm">
		<h2 class="text-2xl font-semibold text-black">Notifications</h2>
		<p class="text-black-700 mt-2">
			Send push notifications via APNS (iOS) and FCM (Android). Platform is auto-detected from
			token format when not specified.
		</p>
		{#if health}
			<div class="text-black-500 mt-2 flex gap-4 text-sm">
				<span>Trigger: {health.ok ? 'Connected' : 'Not connected'}</span>
				{#if health.ok}
					<span>APNS: {health.apns ? '✓' : '✗'}</span>
					<span>FCM: {health.fcm ? '✓' : '✗'}</span>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Single notification -->
	<div class="border-black-100 rounded-2xl border bg-white px-8 py-6 shadow-sm">
		<h3 class="text-lg font-semibold text-black">Send single notification</h3>
		<div class="mt-4 space-y-4">
			<div>
				<label for="single-token" class="text-black-700 mb-1 block text-sm font-medium"
					>Token (APNS or FCM)</label
				>
				<textarea
					id="single-token"
					bind:value={singleToken}
					placeholder="Paste device token..."
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
					rows="3"
				></textarea>
				{#if platformHint}
					<p class="text-black-500 mt-1 text-xs">Detected: {platformHint}</p>
				{/if}
			</div>
			<div>
				<label for="single-platform" class="text-black-700 mb-1 block text-sm font-medium"
					>Platform (optional)</label
				>
				<select
					id="single-platform"
					bind:value={singlePlatform}
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
				>
					<option value="">Auto-detect</option>
					<option value="ios">iOS (APNS)</option>
					<option value="android">Android (FCM)</option>
				</select>
			</div>
			<div>
				<label for="single-title" class="text-black-700 mb-1 block text-sm font-medium"
					>Title</label
				>
				<input
					id="single-title"
					type="text"
					bind:value={singleTitle}
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="single-body" class="text-black-700 mb-1 block text-sm font-medium"
					>Body</label
				>
				<input
					id="single-body"
					type="text"
					bind:value={singleBody}
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="single-subtitle" class="text-black-700 mb-1 block text-sm font-medium"
					>Subtitle (optional)</label
				>
				<input
					id="single-subtitle"
					type="text"
					bind:value={singleSubtitle}
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
			</div>
			<ButtonAction
				variant="solid"
				size="sm"
				isLoading={singleSending}
				blockingClick
				callback={sendSingle}
			>
				Send
			</ButtonAction>
		</div>
	</div>

	<!-- Send by eName -->
	<div class="border-black-100 rounded-2xl border bg-white px-8 py-6 shadow-sm">
		<h3 class="text-lg font-semibold text-black">Send by eName</h3>
		<p class="text-black-500 mt-1 text-sm">
			Send to all devices registered for a specific eName (e.g. @user-id).
		</p>
		<div class="mt-4 space-y-4">
			<div>
				<label for="ename-input" class="text-black-700 mb-1 block text-sm font-medium"
					>eName</label
				>
				<input
					id="ename-input"
					type="text"
					bind:value={enameInput}
					placeholder="@user-id or user-id"
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="ename-title" class="text-black-700 mb-1 block text-sm font-medium"
					>Title</label
				>
				<input
					id="ename-title"
					type="text"
					bind:value={enameTitle}
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="ename-body" class="text-black-700 mb-1 block text-sm font-medium"
					>Body</label
				>
				<input
					id="ename-body"
					type="text"
					bind:value={enameBody}
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="ename-subtitle" class="text-black-700 mb-1 block text-sm font-medium"
					>Subtitle (optional)</label
				>
				<input
					id="ename-subtitle"
					type="text"
					bind:value={enameSubtitle}
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
			</div>
			<ButtonAction
				variant="solid"
				size="sm"
				isLoading={enameSending}
				blockingClick
				callback={sendByEName}
			>
				Send to eName
			</ButtonAction>
		</div>
	</div>

	<!-- Bulk: send to all registered devices -->
	<div class="border-black-100 rounded-2xl border bg-white px-8 py-6 shadow-sm">
		<h3 class="text-lg font-semibold text-black">Send to all registered devices</h3>
		<p class="text-black-500 mt-1 text-sm">
			One-button push to every device with a registered push token (from provisioner).
		</p>
		{#if deviceCount !== null}
			<p class="text-black-500 mt-1 text-sm font-medium">
				{deviceCount} device{deviceCount === 1 ? '' : 's'} with push token{deviceCount === 1 ? '' : 's'}
			</p>
		{/if}
		<div class="mt-4 space-y-4">
			<div>
				<label for="bulk-title" class="text-black-700 mb-1 block text-sm font-medium"
					>Title</label
				>
				<input
					id="bulk-title"
					type="text"
					bind:value={bulkTitle}
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="bulk-body" class="text-black-700 mb-1 block text-sm font-medium"
					>Body</label
				>
				<input
					id="bulk-body"
					type="text"
					bind:value={bulkBody}
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
			</div>
			<div>
				<label for="bulk-subtitle" class="text-black-700 mb-1 block text-sm font-medium"
					>Subtitle (optional)</label
				>
				<input
					id="bulk-subtitle"
					type="text"
					bind:value={bulkSubtitle}
					class="border-black-100 w-full rounded-lg border px-3 py-2 text-sm"
				/>
			</div>
			<ButtonAction
				variant="solid"
				size="sm"
				isLoading={bulkSending}
				blockingClick
				callback={sendBulkAll}
			>
				Send to all
			</ButtonAction>
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
