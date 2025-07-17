<script lang="ts">
import { cn } from "$lib/utils";
import type { Snippet } from "svelte";
import type { HTMLAnchorAttributes } from "svelte/elements";

interface IButtonNav extends HTMLAnchorAttributes {
    href: string;
    children: Snippet;
}

const { href, children, ...restProps }: IButtonNav = $props();
</script>

<a {href} {...restProps} class={cn(restProps.class)}>
    {@render children()}
</a>

<!-- 
@component
export default ButtonNav;
@description
This component is a wrapper for a button that navigates to a different page.

@props
- href: The URL of the page to navigate to.
- children: The content of the button.
- ...restProps: Any other props that can be passed to an anchor element.

@usage
```html
<script lang="ts">
    import * as Button from '$lib/ui/Button'
    import { SettingsIcon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
</script>

<Button.Nav href="/settings">
    // The content of the button
</Button.Nav>
```
 -->