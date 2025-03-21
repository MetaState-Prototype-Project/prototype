<script lang="ts">
    import { Drawer } from "$lib/ui";
    let isPaneOpen = $state(false);
</script>

<button class="btn btn-soft" onclick={() => isPaneOpen = true}>Open</button>



<Drawer bind:isPaneOpen>
   <div class="bg-red-300">aslkfamfoasdiownednciaosndoasfnas dfklaklfndskalnflka skflndalknfsdkalfnlksndafknsdkjlfngskjngfjnasdfjnasjkdfnjksdanfjnsadjknfjksandflknsdnskflndalknfsdkalfnlksndafknsdkjlfngskjngfjnasdfjnasjkdfnjksdanfjnsadjknfjksandflknsdnskflndalknfsdkalfnlksndafknsdkjlfngskjngfjnasdfjnasjkdfnjksdanfjnsadjknfjksandflknsdnskflndalknfsdkalfnlksndafknsdkjlfngskjngfjnasdfjnasjkdfnjksdanfjnsadjknfjksandflknsdnskflndalknfsdkalfnlksndafknsdkjlfngskjngfjnasdfjnasjkdfnjksdanfjnsadjknfjksandflknsdnskflndalknfsdkalfnlksndafknsdkjlfngskjngfjnasdfjnasjkdfnjksdanfjnsadjknfjksandflknsdnskflndalknfsdkalfnlksndafknsdkjlfngskjngfjnasdfjnasjkdfnjksdanfjnsadjknfjksandflknsdn</div>
</Drawer>