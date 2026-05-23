<script lang="ts">
import { AppNav } from "$lib/fragments";
import {
    type PhotoMark,
    marksAchieved,
    personalBinding,
    removePhoto,
} from "$lib/stores/personalBinding";
import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import type { Snippet } from "svelte";
import AddKnowledgeSheet from "./components/AddKnowledgeSheet.svelte";
import AddParametersSheet from "./components/AddParametersSheet.svelte";
import AddPhotoSheet from "./components/AddPhotoSheet.svelte";

const binding = $derived($personalBinding);
const achieved = $derived(marksAchieved(binding));
const photosFilled = $derived(binding.photos.length > 0);
const parametersFilled = $derived(binding.parameters.trim().length > 0);
const knowledgeFilled = $derived(
    !!(binding.knowledge?.question && binding.knowledge?.answer),
);

let photoSheetOpen = $state(false);
let editingPhoto = $state<PhotoMark | null>(null);
let parametersSheetOpen = $state(false);
let knowledgeSheetOpen = $state(false);

function openPhotoSheet(photo: PhotoMark | null = null) {
    editingPhoto = photo;
    photoSheetOpen = true;
}

function handlePhotoSheetChange(open: boolean) {
    photoSheetOpen = open;
    if (!open) editingPhoto = null;
}
</script>

<!-- ── Shared card shell ────────────────────────────────────────────────
     Outer chrome, header (title + subtitle + optional ✓), then whatever
     the caller renders via `body`. Keeps the three sections in sync
     without dragging the per-section body markup into a single big snippet. -->
{#snippet markCard(
    title: string,
    subtitle: string,
    completed: boolean,
    body: Snippet,
)}
    <section class="bg-white rounded-3xl px-3 py-4 shadow-card">
        <header class="flex items-start justify-between gap-2 mb-2">
            <div class="flex-1 min-w-0">
                <h3 class="font-medium text-black text-lg leading-tight">
                    {title}
                </h3>
                <p class="text-black-700 opacity-50 font-medium leading-snug mt-1">{subtitle}</p>
            </div>
            {#if completed}
                <span
                    class="shrink-0 w-7 h-7 rounded-full bg-success-500 text-white text-base font-bold flex items-center justify-center"
                    aria-label="Completed"
                >
                    ✓
                </span>
            {/if}
        </header>
        {@render body()}
    </section>
{/snippet}

<!-- Rounded primary-100 CTA used to open each section's add/edit sheet. -->
{#snippet addButton(label: string, onclick: () => void)}
    <button
        type="button"
        {onclick}
        class="mt-3 w-full bg-primary-100 text-black-900 font-bold uppercase tracking-wide text-pill rounded-full py-3 active:opacity-70"
    >
        {label}
    </button>
{/snippet}

<!-- ── Per-section bodies ─────────────────────────────────────────────── -->
{#snippet photosBody()}
    {#if photosFilled}
        <ul class="flex flex-col gap-3 mt-3">
            {#each binding.photos as photo (photo.id)}
                <li class="flex items-center gap-3">
                    <img
                        src={photo.dataUrl}
                        alt=""
                        class="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <p
                        class="flex-1 min-w-0 text-black-900 font-medium truncate"
                    >
                        {photo.name || "Untitled photo"}
                    </p>
                    <button
                        type="button"
                        aria-label="Delete photo"
                        class="text-black-500 active:opacity-60"
                        onclick={() => removePhoto(photo.id)}
                    >
                        <HugeiconsIcon
                            icon={Delete02Icon}
                            size={20}
                            strokeWidth={1.8}
                        />
                    </button>
                    <button
                        type="button"
                        aria-label="Edit photo"
                        class="text-black-500 active:opacity-60"
                        onclick={() => openPhotoSheet(photo)}
                    >
                        <HugeiconsIcon
                            icon={PencilEdit02Icon}
                            size={20}
                            strokeWidth={1.8}
                        />
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
    {@render addButton("Add photo", () => openPhotoSheet(null))}
{/snippet}

<!-- Filled-state row shared by Parameters and Knowledge: a text block on
     the left and a small pencil-edit icon on the right. -->
{#snippet filledRow(text: string, ariaLabel: string, onclick: () => void)}
    <div class="flex items-start justify-between gap-3 mt-3">
        <p class="flex-1 text-black-900 text-lg font-medium leading-snug">
            {text}
        </p>
        <button
            type="button"
            aria-label={ariaLabel}
            class="text-black-500 active:opacity-60 shrink-0 mt-1"
            {onclick}
        >
            <HugeiconsIcon
                icon={PencilEdit02Icon}
                size={20}
                strokeWidth={1.8}
            />
        </button>
    </div>
{/snippet}

{#snippet parametersBody()}
    {#if parametersFilled}
        {@render filledRow(binding.parameters, "Edit parameters", () => {
            parametersSheetOpen = true;
        })}
    {:else}
        {@render addButton("Add description", () => {
            parametersSheetOpen = true;
        })}
    {/if}
{/snippet}

{#snippet knowledgeBody()}
    {#if knowledgeFilled && binding.knowledge}
        {@render filledRow(binding.knowledge.question, "Edit knowledge", () => {
            knowledgeSheetOpen = true;
        })}
    {:else}
        {@render addButton("Add question", () => {
            knowledgeSheetOpen = true;
        })}
    {/if}
{/snippet}

<AppNav title="Personal" subtitle="{achieved} of 3 marks achieved" />

{#if achieved === 0}
    <p class="text-black-500 text-lg mt-6 leading-snug">
        Add unique personal artifacts that only you own or know
    </p>
{/if}

<div class="flex flex-col gap-3 mt-6 pb-8">
    {@render markCard(
        photosFilled ? "Personal photos" : "Distinctive photos",
        "Unique traits: face, tattoos, moles, scars",
        photosFilled,
        photosBody,
    )}
    {@render markCard(
        "Personal parameters",
        "Personal details: date and place of birth, height, eye color and etc",
        parametersFilled,
        parametersBody,
    )}
    {@render markCard(
        knowledgeFilled ? "Personal knowledge" : "Unique knowledge",
        "Set a question that only you know the answer to",
        knowledgeFilled,
        knowledgeBody,
    )}
</div>

<AddPhotoSheet
    isOpen={photoSheetOpen}
    editing={editingPhoto}
    onOpenChange={handlePhotoSheetChange}
/>
<AddParametersSheet bind:isOpen={parametersSheetOpen} />
<AddKnowledgeSheet bind:isOpen={knowledgeSheetOpen} />
