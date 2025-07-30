<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import Avatar from '../../ui/Avatar/Avatar.svelte';
	import { cn } from '../../utils';

	interface IGroupProps extends HTMLAttributes<HTMLButtonElement> {
		avatar: string;
		name: string;
		unread?: boolean;
		callback: () => void;
	}

	const { avatar, name, unread = false, callback, ...restProps }: IGroupProps = $props();
</script>

<button
	{...restProps}
	class={cn([
		'relative flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-4',
		restProps.class
	])}
	onclick={callback}
>
	<Avatar src={avatar} alt="Group Avatar" size="md" />
	<span class="flex w-full items-center justify-between">
		<h2 class="text-left font-medium">{name}</h2>
		{#if unread}
			<span class="h-2 w-2 rounded-full bg-blue-500"></span>
		{/if}
	</span>
</button>

<!--
@component
@name GroupItem
@description A group item component that displays a group avatar and name, with an optional unread indicator.
@props
    - avatar: string - The URL of the group avatar image.
    - name: string - The group name.
    - unread: boolean - Optional. Indicates if there are unread messages. Defaults to false.
    - callback: () => void - Function to call when the group is clicked.
@usage
    <script>
        import GroupItem from '$lib/ui/GroupItem.svelte';
    </script>

    <GroupItem
        avatar="https://example.com/group-avatar.jpg"
        name="Study Buddies"
        unread={true}
        callback={() => console.log('Group clicked')}
    />
-->
