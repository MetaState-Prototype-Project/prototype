<script lang="ts">
	import { UserRequest } from '$lib/fragments';
	import { Input } from '$lib/ui';

	let searchValue = $state();
</script>

<section>
	<Input type="text" bind:value={searchValue} placeholder="Search user, post and more." />
    {#if searchValue}
    <ul class="pb-4 mt-6">
        {#each { length: 5 } as _}
            <li class="mb-4">
                <UserRequest
                    userImgSrc="https://www.gravatar.com/avatar/2c7d99fe281ecd3bcd65ab915bac6dd5?s=250"
                    userName="luffythethird"
                    description="I’ve always wished life came at me fast. Funny how that wish never came through"
                    handleFollow={async () => alert('Adsad')}
                />
            </li>
        {/each}
    </ul>
    {/if}
</section>
