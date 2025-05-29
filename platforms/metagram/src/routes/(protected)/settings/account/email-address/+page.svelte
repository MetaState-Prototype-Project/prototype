<script lang="ts">
	import { Input, Label } from '$lib/ui';
	let userEmail: string = 'ananya@auvo.io';
</script>

<div>
	<Label>Your email address</Label>
	<Input type="email" value={userEmail} disabled />
</div>
