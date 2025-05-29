<script>
	import { InputFile } from '$lib/fragments';
	import { Button, Input, Label } from '$lib/ui';
</script>

<div>
	<Label>Write to us</Label>
	<Input type="text" placeholder="Send a message" />
</div>
<hr class="text-grey" />
<div>
	<Label>Attach a screenshot (optional)</Label>
	<InputFile label="Click to upload a photo"></InputFile>
</div>
<hr class="text-grey" />
<Button size="sm" variant="secondary" callback={() => alert('sent')}>Send</Button>
