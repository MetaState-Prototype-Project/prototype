<script lang="ts">
	import { goto } from '$app/navigation';
	import { Message } from '$lib/fragments';
	import { Input } from '$lib/ui';

	let searchValue = $state('');
</script>

<section>
	{#if true}
		<h2>It's lonely in here, please start a chat with someone first</h2>{:else}
		<Input type="text" bind:value={searchValue} placeholder="Search Messages" class="my-6" />
		<Message
			class="mb-6"
			avatar="https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250"
			username="donaldthefirstt"
			text="i was thinking of making it to the conference so we could take some more fire pictures like last time"
			unread={false}
			callback={() => goto(`/messages/`)}
		/>
		<Message
			class="mb-6"
			avatar="https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250"
			username="donaldthefirstt"
			text="i was thinking of making it to the conference so we could take some more fire pictures like last time"
			unread={true}
			callback={() => goto(`/messages/`)}
		/>
	{/if}
</section>
