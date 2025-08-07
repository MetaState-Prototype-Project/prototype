<script lang="ts">
	import { Avatar } from '$lib/ui';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	interface IUserRequestprops extends HTMLAttributes<HTMLElement> {
		userImgSrc: string;
		handle: string;
		description: string;
		handleFollow: () => Promise<void>;
	}

	let { userImgSrc, handle, description, ...restProps }: IUserRequestprops = $props();
</script>

<article
	{...restProps}
	class={cn(['flex items-center justify-between', restProps.class].join(' '))}
>
	<div class="me-4.5 flex items-start">
		<Avatar size="sm" src={userImgSrc} />
		<div class="ms-2">
			<h3 class="font-semibold text-black">{handle}</h3>
			<p class="text-black-600">{description}</p>
		</div>
	</div>
</article>

<!--
@component
@name UserRequest
@description A user request card component displaying avatar, name, description, and a follow button.
@props
  - userImgSrc: URL string for the user's avatar image.
  - handle: Display name of the user.
  - description: A short description or context for the request.
  - handleFollow: Async function to execute when the "Follow" button is clicked.
  - (spread) HTMLAttributes<HTMLElement>: Additional HTML attributes passed to the root <article> element.
@usage
<script>
    import UserRequest from '$lib/fragments/UserRequest.svelte';

    async function followUser() {
      console.log("User followed!");
    }
  </script>

  <UserRequest
    userImgSrc="https://picsum.photos/id/237/200"
    handle="John Doe"
    description="Wants to connect with you"
    handleFollow={followUser}
  />
-->
