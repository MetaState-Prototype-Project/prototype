<script lang="ts">
import { updateEducation, type Education } from "$lib/stores/profile";
import { toast } from "svelte-sonner";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@metastate-foundation/ui/card";
import { Button } from "@metastate-foundation/ui/button";
import { Input } from "@metastate-foundation/ui/input";
import { Textarea } from "@metastate-foundation/ui/textarea";
import { Label } from "@metastate-foundation/ui/label";
import { Separator } from "@metastate-foundation/ui/separator";

let {
    entries = [],
    editable = false,
}: { entries?: Education[]; editable?: boolean } = $props();

let showForm = $state(false);
let editIndex = $state<number | null>(null);
let form = $state<Education>({
    institution: "",
    degree: "",
    startDate: "",
    sortOrder: 0,
});

function openAdd() {
    form = {
        institution: "",
        degree: "",
        fieldOfStudy: "",
        startDate: "",
        endDate: "",
        description: "",
        sortOrder: entries.length,
    };
    editIndex = null;
    showForm = true;
}

function openEdit(index: number) {
    form = { ...entries[index] };
    editIndex = index;
    showForm = true;
}

async function save() {
    const updated = [...entries];
    if (editIndex !== null) {
        updated[editIndex] = form;
    } else {
        updated.push(form);
    }
    try {
        await updateEducation(updated);
        showForm = false;
        toast.success("Education updated");
    } catch {
        toast.error("Failed to update education");
    }
}

async function remove(index: number) {
    const updated = entries.filter((_, i) => i !== index);
    try {
        await updateEducation(updated);
        toast.success("Education removed");
    } catch {
        toast.error("Failed to remove education");
    }
}
</script>

<Card>
    <CardHeader>
        <div class="flex items-center justify-between">
            <CardTitle>Education</CardTitle>
            {#if editable}
                <Button variant="ghost" size="sm" onclick={openAdd}
                    >+ Add</Button
                >
            {/if}
        </div>
    </CardHeader>

    <CardContent>
        {#if showForm}
            <Card class="mb-4 bg-muted/30">
                <CardContent class="grid gap-3 pt-6">
                    <div class="space-y-1">
                        <Label>Institution</Label>
                        <Input
                            bind:value={form.institution}
                            placeholder="e.g. ETH Zurich"
                        />
                    </div>
                    <div class="space-y-1">
                        <Label>Degree</Label>
                        <Input
                            bind:value={form.degree}
                            placeholder="e.g. BSc Computer Science"
                        />
                    </div>
                    <div class="space-y-1">
                        <Label>Field of study</Label>
                        <Input
                            bind:value={form.fieldOfStudy}
                            placeholder="e.g. Computer Science"
                        />
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <Label>Start date</Label>
                            <Input bind:value={form.startDate} type="date" />
                        </div>
                        <div class="space-y-1">
                            <Label
                                >End date <span
                                    class="text-muted-foreground/50 font-normal text-xs"
                                    >(leave empty if current)</span
                                ></Label
                            >
                            <Input bind:value={form.endDate} type="date" />
                        </div>
                    </div>
                    <div class="space-y-1">
                        <Label>Description</Label>
                        <Textarea
                            bind:value={form.description}
                            rows={3}
                            placeholder="Activities, achievements..."
                        />
                    </div>
                    <div class="flex gap-2">
                        <Button size="sm" onclick={save}>Save</Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => {
                                showForm = false;
                            }}>Cancel</Button
                        >
                    </div>
                </CardContent>
            </Card>
        {/if}

        <div class="space-y-4">
            {#each entries as entry, i}
                {#if i > 0}
                    <Separator />
                {/if}
                <div class="flex items-start justify-between">
                    <div>
                        <h3 class="text-sm font-semibold text-foreground">
                            {entry.degree}{entry.fieldOfStudy
                                ? `, ${entry.fieldOfStudy}`
                                : ""}
                        </h3>
                        <p class="text-sm text-muted-foreground">
                            {entry.institution}
                        </p>
                        <p class="text-xs text-muted-foreground/60">
                            {entry.startDate}{entry.endDate
                                ? ` — ${entry.endDate}`
                                : " — Present"}
                        </p>
                        {#if entry.description}
                            <p class="mt-2 text-sm text-muted-foreground">
                                {entry.description}
                            </p>
                        {/if}
                    </div>
                    {#if editable}
                        <div class="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onclick={() => openEdit(i)}
                            >
                                <svg
                                    class="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    ><path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                                    /></svg
                                >
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onclick={() => remove(i)}
                            >
                                <svg
                                    class="h-4 w-4 text-destructive"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    ><path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    /></svg
                                >
                            </Button>
                        </div>
                    {/if}
                </div>
            {:else}
                {#if !showForm}
                    <p class="text-sm italic text-muted-foreground/50">
                        {editable
                            ? "Add your education"
                            : "No education listed"}
                    </p>
                {/if}
            {/each}
        </div>
    </CardContent>
</Card>
