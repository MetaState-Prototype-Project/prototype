<script lang="ts">
	import { Button, Helper, Input, Label } from '$lib/ui';
</script>

<div>
	<Label>Change your username</Label>
	<Input type="text" placeholder="Edit Username" />
	<Helper>You can only do this 3 more times</Helper>
</div>
<hr class="text-grey" />
<Button size="sm" variant="secondary" callback={() => alert('saved')}>Save Changes</Button>
