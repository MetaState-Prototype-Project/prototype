<script lang="ts">
	import { LiveDataFlow, Logs } from '$lib/fragments';
    
	let currentSelectedEventIndex = $state(-1);

	const events = [
		{
			timestamp: new Date(),
			action: 'upload',
			message: 'msg_123',
			to: 'alice.vault.dev'
		},
		{
			timestamp: new Date(),
			action: 'fetch',
			message: 'msg_124',
			from: 'bob.vault.dev'
		},
		{
			timestamp: new Date(),
			action: 'webhook',
			to: 'Alice',
			from: 'Pic'
		}
	];
</script>

<section class="flex gap-2">
	<LiveDataFlow events={[
		{ id: "1", from: "Alice", to: "Pictique", vaultName: "Alice.Vault.Dev", imageSrc: "" },
		{ id: "2", from: "Pictique", to: "Bob",vaultName: "Pictique.Vault.Dev", imageSrc: "" },
		{ id: "3", from: "Bob", to: "", vaultName: "Bob.Vault.Dev", imageSrc: "" },
	]}/>
	<Logs class="w-[40%]" {events} bind:activeEventIndex={currentSelectedEventIndex} />
</section>
