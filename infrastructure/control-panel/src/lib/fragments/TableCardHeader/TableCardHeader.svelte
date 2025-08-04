<script lang="ts">
    let { title, searchValue = $bindable(""), rightTitle}:{title: string, searchValue: string, rightTitle: string} =  $props();
</script>

<header class="w-full flex items-center justify-between mb-4 px-4">
    <div class="flex items-center gap-4">
        <p class="text-black-700 font-semibold whitespace-nowrap">{title}</p>
        <input
            type="text"
            placeholder="Search eVaults"
            bind:value={searchValue}
            class="border border-gray-300 bg-black-100 px-4 py-1.5 rounded-[8px] w-full text-xs text-black-700 placeholder:text-black-700 outline-0"
        />
    </div>
    
    <div class="flex gap-2 items-center">
        <span class='w-2 h-2 inline-block rounded-full bg-secondary'></span>
        <p class="text-sm text-black-700">{rightTitle}</p>
    </div>
</header>