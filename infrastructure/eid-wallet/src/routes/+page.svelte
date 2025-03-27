<script lang="ts">
import Header from "$lib/fragments/Header/Header.svelte";
import IdentityCard from "$lib/fragments/IdentityCard/IdentityCard.svelte";
function handleProfile() {
	console.log("click");
}
</script>

<Header title="Identity Card"  handleProfile={handleProfile} />

<IdentityCard viewBtn={() => console.log("click")} />