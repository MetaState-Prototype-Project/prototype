<script lang="ts">
	import { goto } from '$app/navigation';
	import { Message } from '$lib/fragments';
	import { Input } from '$lib/ui';

	let searchValue = $state('');
</script>

<section>
	<Input type="text" bind:value={searchValue} placeholder="Search Messages" class="my-6" />
	{#each { length: 6 } as _, i}
		<Message
			class="mb-6"
			avatar="https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250"
			username="donaldthefirstt"
			text="i was thinking of making it to the conference so we could take some more fire pictures like last time"
			unread={false}
			callback={() => goto(`/messages/${i}`)}
		/>
		<Message
			class="mb-6"
			avatar="https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250"
			username="donaldthefirstt"
			text="i was thinking of making it to the conference so we could take some more fire pictures like last time"
			unread={true}
			callback={() => goto(`/messages/${i}`)}
		/>
	{/each}
</section>
