<script lang="ts">
	import { Button, Helper, Input, Label } from '$lib/ui';

	let username: string;
</script>

<div>
	<Label>Change your username</Label>
	<Input type="text" placeholder="Edit Username" bind:value={username} />
	<Helper>You can only do this 3 more times</Helper>
</div>
<hr class="text-grey" />
<Button size="sm" variant="secondary" callback={() => alert('saved')}>Save Changes</Button>
