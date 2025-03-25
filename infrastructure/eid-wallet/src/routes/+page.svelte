<script lang="ts">
    import { goto } from "$app/navigation";
    import ButtonAction from "$lib/ui/Button/ButtonAction.svelte";


</script>

<ButtonAction cb={async() => await(goto("/onboarding"))}>Onboarding Flow</ButtonAction>