<script lang="ts">
	import { HugeiconsIcon } from '@hugeicons/svelte'
    import { SearchIcon, Home01FreeIcons, Home02FreeIcons, Home13Icon } from '@hugeicons/core-free-icons'
	import type { HTMLAttributes } from "svelte/elements";
	import {Home} from '$lib/icons';

    interface IBottomNavProps extends HTMLAttributes<HTMLElement> {
        activeTab: string | number;
    } 
    let {activeTab = $bindable()}:IBottomNavProps = $props();

    $effect(() => {
        alert(activeTab)
    })
</script>

<div class="flex items-center justify-between px-7 py-2 w-full border border-grey">
    <label for="home">
    <Home size="24px" color={activeTab === "home" ? "var(--color-brand-burnt-orange)" : "var(--color-black-400)"} fill={activeTab === "home" ? "var(--color-brand-burnt-orange)" : "white"}/>

    </label>
    <input id="home" type="radio" value="home" bind:group={activeTab} name={"navTabs"} class="hidden">

    <label for="search">
    <HugeiconsIcon
    icon={Home01FreeIcons}
    altIcon={Home02FreeIcons}
    showAlt={activeTab === "search"}
    />
    </label>
    <input id="search" type="radio" value="search" bind:group={activeTab} name={"navTabs"} class="hidden">

    <label for="scan">
    <HugeiconsIcon
    icon={Home01FreeIcons}
    altIcon={Home02FreeIcons}
    showAlt={activeTab === "scan"}
    />
    </label>
    <input id="scan" type="radio" value="scan" bind:group={activeTab} name={"navTabs"} class="hidden">

    <label for="comments">
    <HugeiconsIcon
    icon={Home01FreeIcons}
    altIcon={Home02FreeIcons}
    showAlt={activeTab === "comments"}
    />
    </label>
    <input id="comments" type="radio" value="comments" bind:group={activeTab} name={"navTabs"} class="hidden">

    <label for="profile">
    <HugeiconsIcon
    icon={Home01FreeIcons}
    altIcon={Home02FreeIcons}
    showAlt={activeTab === "profile"}
    />
    </label>
    <input id="profile" type="radio" value="profile" bind:group={activeTab} name={"navTabs"} class="hidden">
</div>