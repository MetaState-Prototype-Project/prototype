<script lang="ts">
import { AppNav, IdentityCard } from "$lib/fragments";
import * as Button from "$lib/ui/Button";
import { Share05Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";

const dummyData = {
	Name: "John Doe",
	"Date of birth": "01-01-1990",
	"ID submitted": "American Passport",
	"Passport number": "1234567-US",
};

const secondDummyData = {
	"Birth Name": "John Doe",
	"Place of birth": "New York, USA",
	Nationality: "American",
	"ID submitted": "American Passport",
	"Expiry date": "19-12-2027",
};

function shareEPassport() {
	alert("EPassport Code shared!");
}
</script>

<AppNav title="ePassport" class="mb-8" />

<div>
    <IdentityCard
        variant="ePassport"
        userData={dummyData}
        class="shadow-lg"
    />
    <div class="p-6 pt-12 bg-gray w-full rounded-2xl -mt-8 flex flex-col gap-2">
        {#each Object.entries(secondDummyData) as [fieldName, value] }    
            <div class="flex justify-between">
                <p class="text-black-700 font-normal">{fieldName}</p>
                <p class="text-black-500 font-medium">{value}</p>
            </div>
        {/each}
    </div>
</div>

<Button.Action
    variant="solid"
    callback={shareEPassport}
    class="mx-auto text-nowrap flex gap-8 fixed bottom-5 left-1/2 -translate-x-1/2 z-10"
>
    <HugeiconsIcon
        size={32}
        strokeWidth={2}
        className="mr-2"
        icon={Share05Icon}
    />
    Share ePassport
</Button.Action>