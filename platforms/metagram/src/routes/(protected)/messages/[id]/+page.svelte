<script lang="ts">
	import {MessageInput, ChatMessage} from "$lib/fragments";

    let messageValue = $state("");
</script>

<section class="relative h-[100dvh] overflow-y-scroll hide-scrollbar">
    <ChatMessage transactionType = 'outgoing'
    userImgSrc = 'https://picsum.photos/id/237/200/300'
    time = '12:55 AM'
    message=
        'Lorem ipsum dolor sit amet consectetur adipisicing'/>

        <ChatMessage transactionType = 'outgoing'
        userImgSrc = 'https://picsum.photos/id/237/200/300'
        time = '12:55 AM'
        isHeadNeeded={false}
        message=
            'Lorem ipsum dolor sit amet consectetur adipisicing'/>

            <ChatMessage transactionType = 'outgoing'
            userImgSrc = 'https://picsum.photos/id/237/200/300'
            time = '12:55 AM'
            isHeadNeeded={false}
            message=
                'Lorem ipsum dolor sit amet consectetur adipisicing'/>
    
                <ChatMessage transactionType = 'incoming'
    userImgSrc = 'https://picsum.photos/id/237/500'
    time = '12:55 AM'
    message=
        'Lorem ipsum dolor sit amet consectetur adipisicing'/>

        <ChatMessage transactionType = 'incoming'
        userImgSrc = 'https://picsum.photos/id/237/500'
        time = '12:55 AM'
        isHeadNeeded={false}
        message=
            'Lorem ipsum dolor sit amet consectetur adipisicing'/>

            <ChatMessage transactionType = 'incoming'
            userImgSrc = 'https://picsum.photos/id/237/500'
            time = '12:55 AM'
            isHeadNeeded={false}
            message=
                'Lorem ipsum dolor sit amet consectetur adipisicing'/>

        <!-- <MessageInput class="sticky bottom-0 start-0 w-full" variant="dm" src="https://picsum.photos/id/237/200/300" bind:value={messageValue} handleSend={async() => alert("sent")}/> -->
</section>