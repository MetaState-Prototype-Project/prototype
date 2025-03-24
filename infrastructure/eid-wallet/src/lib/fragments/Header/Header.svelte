<script lang="ts">
    import { Back } from "$lib/icons";
    import Avatar from "$lib/icons/Avatar.svelte";
    import type { HTMLAttributes } from "svelte/elements";

    interface IHeaderProps extends HTMLAttributes<HTMLElement> {
        title: string
        isUserLoggedIn?: boolean;
        isBackRequired?: boolean;
    }

    let {title= "Create Pin", isUserLoggedIn = true, isBackRequired = true}:IHeaderProps = $props()
</script>

<header class="flex justify-between items-center">
    <Back/>
    <h1 class="">{title}</h1>
    <Avatar/>
</header>