/**
 * Local view of the Personal binding flow. The store is just state — actual
 * BE writes live in lib/utils/personalBinding.ts. Pages call those helpers
 * and then call the mutators here to reflect the new state.
 *
 * Items that have round-tripped through the vault carry their
 * metaEnvelopeId; pre-save items (rare — only seen while a create mutation
 * is in flight) carry null.
 */

import { writable } from "svelte/store";

export interface PhotoMark {
    /** Local UUID — stable key for list rendering. */
    id: string;
    /** Server-assigned metaEnvelopeId once the binding doc is persisted. */
    metaEnvelopeId: string | null;
    /** Data URL of the captured/picked image (= photoBlob on the BE). */
    dataUrl: string;
    description: string;
    source: "camera" | "gallery";
}

export interface ParametersMark {
    metaEnvelopeId: string;
    text: string;
}

export interface KnowledgeMark {
    metaEnvelopeId: string;
    question: string;
}

export interface PersonalBinding {
    photos: PhotoMark[];
    parameters: ParametersMark | null;
    /** Note: raw answer is never kept locally. Only the question text. */
    knowledge: KnowledgeMark | null;
}

const initial: PersonalBinding = {
    photos: [],
    parameters: null,
    knowledge: null,
};

export const personalBinding = writable<PersonalBinding>(initial);

export function replaceAll(next: PersonalBinding): void {
    personalBinding.set(next);
}

export function addPhotoLocal(photo: PhotoMark): void {
    personalBinding.update((b) => ({ ...b, photos: [...b.photos, photo] }));
}

export function updatePhotoLocal(
    metaEnvelopeId: string,
    patch: Partial<PhotoMark>,
): void {
    personalBinding.update((b) => ({
        ...b,
        photos: b.photos.map((p) =>
            p.metaEnvelopeId === metaEnvelopeId ? { ...p, ...patch } : p,
        ),
    }));
}

export function removePhotoLocal(metaEnvelopeId: string): void {
    personalBinding.update((b) => ({
        ...b,
        photos: b.photos.filter((p) => p.metaEnvelopeId !== metaEnvelopeId),
    }));
}

export function setParametersLocal(mark: ParametersMark | null): void {
    personalBinding.update((b) => ({ ...b, parameters: mark }));
}

export function setKnowledgeLocal(mark: KnowledgeMark | null): void {
    personalBinding.update((b) => ({ ...b, knowledge: mark }));
}

export function marksAchieved(b: PersonalBinding): number {
    let n = 0;
    if (b.photos.length > 0) n++;
    if (b.parameters && b.parameters.text.trim().length > 0) n++;
    if (b.knowledge && b.knowledge.question.trim().length > 0) n++;
    return n;
}
