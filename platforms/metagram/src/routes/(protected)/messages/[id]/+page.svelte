<script lang="ts">
	import ChatMessage from "$lib/fragments/ChatMessage/ChatMessage.svelte";

</script>

<section>
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
    userImgSrc = 'https://picsum.photos/id/237/200/300'
    time = '12:55 AM'
    message=
        'Lorem ipsum dolor sit amet consectetur adipisicing'/>

        <ChatMessage transactionType = 'incoming'
        userImgSrc = 'https://picsum.photos/id/237/200/300'
        time = '12:55 AM'
        isHeadNeeded={false}
        message=
            'Lorem ipsum dolor sit amet consectetur adipisicing'/>

            <ChatMessage transactionType = 'incoming'
            userImgSrc = 'https://picsum.photos/id/237/200/300'
            time = '12:55 AM'
            isHeadNeeded={false}
            message=
                'Lorem ipsum dolor sit amet consectetur adipisicing'/>
</section>