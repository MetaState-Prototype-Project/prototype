<script lang="ts">
import { page } from "$app/state";
import { AppNav } from "$lib/fragments";
import { runtime } from "$lib/global/runtime.svelte";

const { children } = $props();

// Captured ONCE at layout init. SvelteKit re-keys the route subtree on each
// pathname change (see root +layout.svelte), so a fresh layout instance is
// created with a fresh `subtitleAtMount`. The OLD instance keeps its
// captured value through the entire slide-out transition — without this we
// were routing subtitle through shared $state and the OLD AppNav would
// re-render mid- or post-transition, producing a visible flash.
const VERSION = "0.7.1";
const subtitleAtMount =
    page.url.pathname === "/settings" ? `App Version ${VERSION}` : undefined;
</script>

<main>
    <AppNav
        title={runtime.header.title ?? ""}
        subtitle={subtitleAtMount}
        onback={runtime.header.onback}
    />
    {@render children?.()}
</main>