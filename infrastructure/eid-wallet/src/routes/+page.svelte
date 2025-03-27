<script lang="ts">
import { goto } from "$app/navigation";
import ButtonAction from "$lib/ui/Button/ButtonAction.svelte";
</script>

<ButtonAction callback={async() => await(goto("/onboarding"))}>Onboarding Flow</ButtonAction>
<ButtonAction callback={async() => await(goto("/register"))}>Create PIN</ButtonAction>
