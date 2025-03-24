<script lang="ts">
    import type { HTMLAttributes } from "svelte/elements";

    interface IHeaderProps extends HTMLAttributes<HTMLElement> {
        title: string
        isUserLoggedIn?: boolean;
        isBackRequired?: boolean;
    }

    let {title= "Create Pin", isUserLoggedIn = true, isBackRequired = true}:IHeaderProps = $props()
</script>

<header class="flex justify-between items-center">
    back
    <h1 class="text-3xl text-">{title}</h1>
    avatar
</header>