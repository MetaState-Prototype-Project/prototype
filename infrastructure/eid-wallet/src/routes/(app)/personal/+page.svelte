<script lang="ts">
import { AppNav } from "$lib/fragments";
import type { GlobalState } from "$lib/global";
import {
    type PhotoMark,
    addPhotoLocal,
    marksAchieved,
    personalBinding,
    removePhotoLocal,
    replaceAll,
    setKnowledgeLocal,
    setParametersLocal,
} from "$lib/stores/personalBinding";
import { getCanonicalBindingDocString } from "$lib/utils/bindingDocHash";
import {
    createPersonalParameters,
    createPhotographMark,
    createSecurityQuestion,
    deletePersonalBinding,
    hashSecurityAnswerRemote,
    loadPersonalParameters,
    loadPersonalPhotographs,
    loadPersonalSecurityQuestion,
} from "$lib/utils/personalBinding";
import {
    deleteCachedPhoto,
    getCachedPhotosForEname,
    setCachedPhoto,
} from "$lib/utils/photoCache";
import { Delete02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/svelte";
import { type Snippet, getContext, onMount } from "svelte";
import AddKnowledgeSheet from "./components/AddKnowledgeSheet.svelte";
import AddParametersSheet from "./components/AddParametersSheet.svelte";
import AddPhotoSheet from "./components/AddPhotoSheet.svelte";

const binding = $derived($personalBinding);
const achieved = $derived(marksAchieved(binding));
const sortedPhotos = $derived(
    [...binding.photos].sort((a, b) =>
        (a.metaEnvelopeId ?? a.id).localeCompare(b.metaEnvelopeId ?? b.id),
    ),
);
const photosFilled = $derived(binding.photos.length > 0);
const parametersFilled = $derived(
    !!binding.parameters && binding.parameters.text.trim().length > 0,
);
const knowledgeFilled = $derived(
    !!binding.knowledge && binding.knowledge.question.trim().length > 0,
);

let photoSheetOpen = $state(false);
let editingPhoto = $state<PhotoMark | null>(null);
let parametersSheetOpen = $state(false);
let knowledgeSheetOpen = $state(false);

let loading = $state(true);
let saving = $state(false);
let errorMessage = $state<string | null>(null);

// IDs of photos the user explicitly deleted during this session.
// Prevents the background server fetch from re-adding them to the store
// and cache if it resolves after the delete (server hasn't propagated yet).
const locallyDeletedIds = new Set<string>();

const getGlobalState = getContext<() => GlobalState | undefined>("globalState");
let globalState: GlobalState | undefined = $state(undefined);
let gqlUrl = $state<string | null>(null);
let ename = $state<string | null>(null);

// ── Setup ─────────────────────────────────────────────────────────────
// Mirrors the bootstrap loop in /main: globalState arrives on a parent
// onMount which fires after ours.
onMount(() => {
    (async () => {
        let gs = getGlobalState?.();
        let retries = 0;
        while (!gs && retries < 50) {
            await new Promise((r) => setTimeout(r, 100));
            gs = getGlobalState?.();
            retries++;
        }
        if (!gs) {
            errorMessage = "Couldn't load your wallet state.";
            loading = false;
            return;
        }
        globalState = gs;

        try {
            const vault = await gs.vaultController.vault;
            if (!vault?.uri || !vault?.ename) {
                errorMessage = "No eVault available.";
                loading = false;
                return;
            }
            ename = vault.ename.startsWith("@")
                ? vault.ename
                : `@${vault.ename}`;
            gqlUrl = new URL("/graphql", vault.uri).toString();

            // Show cached photos immediately (IndexedDB read, ~10 ms).
            // This runs before the network requests so photos are already
            // in the store when loading = false fires and the UI becomes
            // visible — no skeleton flash on repeat visits.
            const cachedPhotos = await getCachedPhotosForEname(ename);
            if (cachedPhotos.length > 0) {
                replaceAll({
                    ...$personalBinding,
                    photos: cachedPhotos.map((p, i) => ({
                        id: `${p.metaEnvelopeId}-${i}`,
                        metaEnvelopeId: p.metaEnvelopeId,
                        dataUrl: p.dataUrl,
                        description: p.description,
                        source: "camera" as const,
                    })),
                });
            }

            // Fire all three network requests in parallel but handle each
            // independently. Parameters and security_question are tiny
            // responses (arrive in milliseconds). Photographs carry full
            // base64 blobs and arrive later — they update the store and
            // refresh the cache when done.
            const paramsPromise = loadPersonalParameters(gqlUrl, ename).then(
                (params) => {
                    setParametersLocal(params);
                },
            );
            const securityPromise = loadPersonalSecurityQuestion(
                gqlUrl,
                ename,
            ).then((security) => {
                setKnowledgeLocal(security);
            });
            const photosPromise = loadPersonalPhotographs(gqlUrl, ename).then(
                async (photographs) => {
                    const currentEname = ename;
                    if (!currentEname) return;
                    const current = $personalBinding;

                    // Strip photos that the user deleted during this session
                    // so a slow server response never resurrects them.
                    const visibleFromServer = photographs.filter(
                        (p) => !locallyDeletedIds.has(p.metaEnvelopeId),
                    );
                    const visibleIds = new Set(
                        visibleFromServer.map((p) => p.metaEnvelopeId),
                    );

                    // Photos in the store not in the server response were
                    // uploaded after this fetch started — keep them.
                    const localPending = current.photos.filter(
                        (p) =>
                            p.dataUrl &&
                            p.metaEnvelopeId !== null &&
                            !visibleIds.has(p.metaEnvelopeId) &&
                            !locallyDeletedIds.has(p.metaEnvelopeId),
                    );

                    replaceAll({
                        ...current,
                        photos: [
                            ...visibleFromServer.map((p, i) => ({
                                id: `${p.metaEnvelopeId}-${i}`,
                                metaEnvelopeId: p.metaEnvelopeId,
                                dataUrl: p.photoBlob,
                                description: p.description,
                                source: "camera" as const,
                            })),
                            ...localPending,
                        ],
                    });

                    // Refresh cache for server photos (excluding deleted ones).
                    await Promise.all(
                        visibleFromServer.map((p) =>
                            setCachedPhoto({
                                metaEnvelopeId: p.metaEnvelopeId,
                                dataUrl: p.photoBlob,
                                description: p.description,
                                ename: currentEname,
                            }),
                        ),
                    );

                    // Remove stale cache entries: not on server, not locally
                    // pending, and not already removed via deleteCachedPhoto.
                    const localPendingIds = new Set(
                        localPending.map((p) => p.metaEnvelopeId),
                    );
                    const allCached =
                        await getCachedPhotosForEname(currentEname);
                    await Promise.all(
                        allCached
                            .filter(
                                (p) =>
                                    !visibleIds.has(p.metaEnvelopeId) &&
                                    !localPendingIds.has(p.metaEnvelopeId),
                            )
                            .map((p) => deleteCachedPhoto(p.metaEnvelopeId)),
                    );
                },
            );

            // Reveal the UI as soon as text data is ready. If we already had
            // cached photos they're showing; otherwise the photo section
            // shows skeleton rows until photosPromise settles.
            await Promise.allSettled([paramsPromise, securityPromise]);
            loading = false;

            void photosPromise;
        } catch (err) {
            console.error("[personal] load failed", err);
            errorMessage = "Couldn't load personal binding documents.";
            loading = false;
        }
    })();
});

// ── Signing helper ────────────────────────────────────────────────────
// Owner signature shape used by every create-binding mutation.
async function signOwner(
    type: string,
    data: Record<string, unknown>,
): Promise<{ signer: string; signature: string; timestamp: string }> {
    if (!globalState || !ename) {
        throw new Error("Wallet not ready");
    }
    const canonical = getCanonicalBindingDocString({
        subject: ename,
        type,
        data,
    });
    const signature = await globalState.keyService.sign(canonical);
    return {
        signer: ename,
        signature,
        timestamp: new Date().toISOString(),
    };
}

function openPhotoSheet(photo: PhotoMark | null = null) {
    editingPhoto = photo;
    photoSheetOpen = true;
}

function handlePhotoSheetChange(open: boolean) {
    photoSheetOpen = open;
    if (!open) editingPhoto = null;
}

// ── Handlers ──────────────────────────────────────────────────────────

async function handlePhotoSave(data: {
    dataUrl: string;
    description: string;
    source: "camera" | "gallery";
}) {
    if (!gqlUrl || !ename) return;
    saving = true;
    errorMessage = null;
    // Edit = create new first, then delete old (no updateBindingDocument
    // mutation). If create fails the old doc is untouched. If the post-create
    // delete fails the next reload's dedupe picks the latest signature.
    const oldId = editingPhoto?.metaEnvelopeId ?? null;
    try {
        const sig = await signOwner("photograph", {
            photoBlob: data.dataUrl,
            ...(data.description ? { description: data.description } : {}),
        });
        const id = await createPhotographMark(
            gqlUrl,
            ename,
            sig,
            data.dataUrl,
            data.description,
        );
        addPhotoLocal({
            id: `${id}-${Date.now()}`,
            metaEnvelopeId: id,
            dataUrl: data.dataUrl,
            description: data.description,
            source: data.source,
        });
        void setCachedPhoto({
            metaEnvelopeId: id,
            dataUrl: data.dataUrl,
            description: data.description,
            ename: ename ?? "",
        });
        editingPhoto = null;

        if (oldId) {
            locallyDeletedIds.add(oldId);
            try {
                await deletePersonalBinding(gqlUrl, ename, oldId);
                removePhotoLocal(oldId);
                void deleteCachedPhoto(oldId);
            } catch (err) {
                console.warn(
                    "[personal] couldn't delete stale photo, will dedupe on next load",
                    err,
                );
            }
        }
    } catch (err) {
        console.error("[personal] photo save failed", err);
        errorMessage = "Couldn't save photo. Try again.";
    } finally {
        saving = false;
    }
}

async function handlePhotoDelete(photo: PhotoMark) {
    if (!gqlUrl || !ename || !photo.metaEnvelopeId) return;
    saving = true;
    errorMessage = null;
    try {
        locallyDeletedIds.add(photo.metaEnvelopeId);
        await deletePersonalBinding(gqlUrl, ename, photo.metaEnvelopeId);
        removePhotoLocal(photo.metaEnvelopeId);
        void deleteCachedPhoto(photo.metaEnvelopeId);
    } catch (err) {
        console.error("[personal] photo delete failed", err);
        errorMessage = "Couldn't delete photo. Try again.";
    } finally {
        saving = false;
    }
}

async function handleParametersSave(text: string) {
    if (!gqlUrl || !ename) return;
    saving = true;
    errorMessage = null;
    const oldId = binding.parameters?.metaEnvelopeId ?? null;
    try {
        const sig = await signOwner("personal_parameters", {
            kind: "personal_parameters",
            text,
        });
        const id = await createPersonalParameters(gqlUrl, ename, sig, text);
        setParametersLocal({ metaEnvelopeId: id, text });

        if (oldId) {
            try {
                await deletePersonalBinding(gqlUrl, ename, oldId);
            } catch (err) {
                console.warn(
                    "[personal] couldn't delete stale parameters, will dedupe on next load",
                    err,
                );
            }
        }
    } catch (err) {
        console.error("[personal] parameters save failed", err);
        errorMessage = "Couldn't save parameters. Try again.";
    } finally {
        saving = false;
    }
}

async function handleKnowledgeSave(data: {
    question: string;
    answer: string;
}) {
    if (!gqlUrl || !ename) return;
    saving = true;
    errorMessage = null;
    const oldId = binding.knowledge?.metaEnvelopeId ?? null;
    try {
        // Hash the raw answer on the BE — keeps Argon2id off the wallet bundle.
        const answerHash = await hashSecurityAnswerRemote(
            gqlUrl,
            ename,
            data.answer,
        );

        const sig = await signOwner("security_question", {
            kind: "security_question",
            question: data.question,
            answerHash,
        });
        const id = await createSecurityQuestion(
            gqlUrl,
            ename,
            sig,
            data.question,
            answerHash,
        );
        setKnowledgeLocal({ metaEnvelopeId: id, question: data.question });

        if (oldId) {
            try {
                await deletePersonalBinding(gqlUrl, ename, oldId);
            } catch (err) {
                console.warn(
                    "[personal] couldn't delete stale security question, will dedupe on next load",
                    err,
                );
            }
        }
    } catch (err) {
        console.error("[personal] knowledge save failed", err);
        errorMessage = "Couldn't save security question. Try again.";
    } finally {
        saving = false;
    }
}
</script>

<!-- ── Shared card shell ──────────────────────────────────────────────── -->
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
                <p
                    class="text-black-700 opacity-50 font-medium leading-snug mt-1"
                >
                    {subtitle}
                </p>
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

{#snippet addButton(label: string, onclick: () => void)}
    <button
        type="button"
        {onclick}
        disabled={saving}
        class="mt-3 w-full bg-primary-100 text-black-900 font-bold uppercase tracking-wide text-pill rounded-full py-3 active:opacity-70 disabled:opacity-40"
    >
        {label}
    </button>
{/snippet}

{#snippet photosBody()}
    {#if binding.photos.length > 0 || loading}
        <ul class="flex flex-col gap-3 mt-3">
            {#each sortedPhotos as photo (photo.id)}
                {#if photo.dataUrl}
                    <li class="flex items-center gap-3">
                        <img
                            src={photo.dataUrl}
                            alt=""
                            class="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                        <p class="flex-1 min-w-0 text-black-900 font-medium truncate">
                            {photo.description || "Photo mark"}
                        </p>
                        <button
                            type="button"
                            aria-label="Delete photo"
                            class="text-black-500 active:opacity-60 disabled:opacity-40"
                            disabled={saving}
                            onclick={() => handlePhotoDelete(photo)}
                        >
                            <HugeiconsIcon icon={Delete02Icon} size={20} strokeWidth={1.8} />
                        </button>
                        <button
                            type="button"
                            aria-label="Edit photo"
                            class="text-black-500 active:opacity-60 disabled:opacity-40"
                            disabled={saving}
                            onclick={() => openPhotoSheet(photo)}
                        >
                            <HugeiconsIcon icon={PencilEdit02Icon} size={20} strokeWidth={1.8} />
                        </button>
                    </li>
                {:else}
                    <!-- Full-row skeleton while this photo's blob is still loading -->
                    <li class="flex items-center gap-3" aria-hidden="true">
                        <div class="w-10 h-10 rounded-lg bg-gray-200 animate-pulse shrink-0"></div>
                        <div class="flex-1 h-4 bg-gray-200 animate-pulse rounded"></div>
                        <div class="w-5 h-5 bg-gray-200 animate-pulse rounded"></div>
                        <div class="w-5 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </li>
                {/if}
            {/each}
            {#if loading && binding.photos.length === 0}
                <!-- No stubs yet — show placeholder rows until count is known -->
                {#each [0, 1] as _}
                    <li class="flex items-center gap-3" aria-hidden="true">
                        <div class="w-10 h-10 rounded-lg bg-gray-200 animate-pulse shrink-0"></div>
                        <div class="flex-1 h-4 bg-gray-200 animate-pulse rounded"></div>
                        <div class="w-5 h-5 bg-gray-200 animate-pulse rounded"></div>
                        <div class="w-5 h-5 bg-gray-200 animate-pulse rounded"></div>
                    </li>
                {/each}
            {/if}
        </ul>
    {/if}
    {@render addButton("Add photo", () => openPhotoSheet(null))}
{/snippet}

{#snippet filledRow(text: string, ariaLabel: string, onclick: () => void)}
    <div class="flex items-start justify-between gap-3 mt-3">
        <p class="flex-1 text-black-900 text-lg font-medium leading-snug">
            {text}
        </p>
        <button
            type="button"
            aria-label={ariaLabel}
            class="text-black-500 active:opacity-60 shrink-0 mt-1 disabled:opacity-40"
            disabled={saving}
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
    {#if parametersFilled && binding.parameters}
        {@render filledRow(binding.parameters.text, "Edit parameters", () => {
            parametersSheetOpen = true;
        })}
    {:else if loading}
        <div class="mt-3 flex flex-col gap-2" aria-hidden="true">
            <div class="h-4 bg-gray-200 animate-pulse rounded w-3/4"></div>
            <div class="h-4 bg-gray-200 animate-pulse rounded w-1/2"></div>
        </div>
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
    {:else if loading}
        <div class="mt-3 h-4 bg-gray-200 animate-pulse rounded w-2/3" aria-hidden="true"></div>
    {:else}
        {@render addButton("Add question", () => {
            knowledgeSheetOpen = true;
        })}
    {/if}
{/snippet}

<AppNav title="Personal" subtitle="{achieved} of 3 marks achieved" />

{#if errorMessage}
    <p class="text-danger mt-6">{errorMessage}</p>
{/if}

{#if !loading && achieved === 0}
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
        "Personal details: date and place of birth, height, eye colour, and other identifying traits",
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
    onsave={handlePhotoSave}
    onOpenChange={handlePhotoSheetChange}
/>
<AddParametersSheet
    bind:isOpen={parametersSheetOpen}
    currentText={binding.parameters?.text ?? ""}
    onsave={handleParametersSave}
/>
<AddKnowledgeSheet
    bind:isOpen={knowledgeSheetOpen}
    currentQuestion={binding.knowledge?.question ?? ""}
    onsave={handleKnowledgeSave}
/>
