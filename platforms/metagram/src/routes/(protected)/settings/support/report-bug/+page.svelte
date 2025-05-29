<script lang="ts">
	import { InputFile } from '$lib/fragments';
	import { Button, Input, Label } from '$lib/ui';
</script>

<div>
	<Label>What issue are you facing?</Label>
	<Input type="text" placeholder="Describe your issue" />
</div>
<hr class="text-grey" />
<div>
	<Label>Attach a screenshot (optional)</Label>
	<InputFile label="Click to upload a photo"></InputFile>
</div>
<hr class="text-grey" />
<Button size="sm" variant="secondary" callback={() => alert('reported')}>Report bug</Button>
