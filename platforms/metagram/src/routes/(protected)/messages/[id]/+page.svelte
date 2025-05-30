<script lang="ts">
	import { MessageInput, ChatMessage } from '$lib/fragments';

	let messageValue = $state('');
</script>

<section class="relative chat">
	{#each { length: 12 } as _}
		<ChatMessage
			transactionType="outgoing"
			userImgSrc="https://picsum.photos/id/237/200/300"
			time="12:55 AM"
			message="Lorem ipsum dolor sit amet consectetur adipisicing"
		/>

		<ChatMessage
			transactionType="outgoing"
			userImgSrc="https://picsum.photos/id/237/200/300"
			time="12:55 AM"
			isHeadNeeded={false}
			message="Lorem ipsum dolor sit amet consectetur adipisicing"
		/>

		<ChatMessage
			transactionType="outgoing"
			userImgSrc="https://picsum.photos/id/237/200/300"
			time="12:55 AM"
			isHeadNeeded={false}
			message="Lorem ipsum dolor sit amet consectetur adipisicing"
		/>

		<ChatMessage
			transactionType="incoming"
			userImgSrc="https://picsum.photos/id/237/500"
			time="12:55 AM"
			message="Lorem ipsum dolor sit amet consectetur adipisicing"
		/>

		<ChatMessage
			transactionType="incoming"
			userImgSrc="https://picsum.photos/id/237/500"
			time="12:55 AM"
			isHeadNeeded={false}
			message="Lorem ipsum dolor sit amet consectetur adipisicing"
		/>

		<ChatMessage
			transactionType="incoming"
			userImgSrc="https://picsum.photos/id/237/500"
			time="12:55 AM"
			isHeadNeeded={false}
			message="Lorem ipsum dolor sit amet consectetur adipisicing Lorem ipsum dolor sit amet consectetur adipisicing Lorem ipsum dolor sit amet consectetur adipisicing Lorem ipsum dolor sit amet consectetur adipisicing "
		/>
	{/each}

    <MessageInput
        class="sticky start-0 bottom-[-15px] w-full"
        variant="dm"
        src="https://picsum.photos/id/237/200/300"
        bind:value={messageValue}
        handleSend={async () => alert('sent')}
    />
</section>
