<script context="module">
import { SettingsNavigationBtn } from "$lib/fragments";
import { SettingsIcon } from "@hugeicons/core-free-icons";

export { ButtonText, ButtonNavText, ButtonNavSettings };
</script>

{#snippet ButtonText()}
  Button
{/snippet}

{#snippet ButtonNavText()}
  Nav Button
{/snippet}

{#snippet ButtonNavSettings()}
<SettingsNavigationBtn icon={SettingsIcon} label="Settings" />
  {/snippet}