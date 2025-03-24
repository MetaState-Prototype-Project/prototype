<script lang="ts">

    import { Drawer } from "$lib/ui";
    let isPaneOpen = $state(false);
</script>

<button class="btn btn-soft" onclick={() => isPaneOpen = true}>Open</button>




<Drawer bind:isPaneOpen isCancelRequired={true}>
   <div class="bg-red-300">aslkfamfoasdiownednciaosndoasfnas </div>
   <div>asfnladmfpamsfl asd</div>
   <div>aslkfasf;,;</div>
   <button class="btn btn-soft" >Open</button>
   <button class="btn btn-soft">Open</button>
</Drawer>
