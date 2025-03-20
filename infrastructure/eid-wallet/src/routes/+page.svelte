<script lang="ts">
	import Connection from "$lib/ui/Connection/Connection.svelte";


</script>

<!-- <button class="btn btn-soft">Default</button>
<button class="btn btn-soft btn-primary">Primary</button>
<button class="btn btn-soft btn-secondary">Secondary</button>
<button class="btn btn-soft btn-accent">Accent</button>
<button class="btn btn-soft btn-info">Info</button>
<button class="btn btn-soft btn-success">Success</button>
<button class="btn btn-soft btn-warning">Warning</button>
<button class="btn btn-soft btn-error">Error</button>

<h1 class="text-lg text-primary-900">Archivo font Everyone</h1>

<div class="bg-secondary-700 text-primary-500 p-4">Secondary Background</div> -->

<Connection 
    imgSrc="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRGPvo_J4nWlDM0kxFW0rsfR5UeOOC6uMvpfQ&s"
    connectionName="Facebook.com"
    lastConnected={new Date().toDateString() + ', ' + new Date().toLocaleTimeString()}
    onclick={() => alert("Disconnected!")} 
/>