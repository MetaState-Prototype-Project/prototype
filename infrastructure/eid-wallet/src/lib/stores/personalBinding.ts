/**
 * In-memory store for the Personal binding flow.
 *
 * This is dummy-data scaffolding — once evault-core supports a Personal
 * binding-doc type with an update mutation, swap the read/write paths to
 * round-trip through the vault. The shapes here mirror what the eventual
 * binding-doc payload is likely to carry.
 */

import { writable } from "svelte/store";

export interface PhotoMark {
    id: string;
    /** Data URL of the captured/picked image. */
    dataUrl: string;
    /** User-supplied label, e.g. "Face photo", "Left arm tattoo". */
    name: string;
    /** Free-form description */
    description: string;
    source: "camera" | "gallery";
}

export interface PersonalBinding {
    photos: PhotoMark[];
    /** Biographical free-text — "Personal parameters". */
    parameters: string;
    knowledge: {
        question: string;
        answer: string;
    } | null;
}

const initial: PersonalBinding = {
    photos: [],
    parameters: "",
    knowledge: null,
};

export const personalBinding = writable<PersonalBinding>(initial);

export function addPhoto(photo: Omit<PhotoMark, "id">): void {
    personalBinding.update((b) => ({
        ...b,
        photos: [...b.photos, { ...photo, id: crypto.randomUUID() }],
    }));
}

export function updatePhoto(id: string, patch: Partial<PhotoMark>): void {
    personalBinding.update((b) => ({
        ...b,
        photos: b.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
}

export function removePhoto(id: string): void {
    personalBinding.update((b) => ({
        ...b,
        photos: b.photos.filter((p) => p.id !== id),
    }));
}

export function setParameters(text: string): void {
    personalBinding.update((b) => ({ ...b, parameters: text }));
}

export function setKnowledge(question: string, answer: string): void {
    personalBinding.update((b) => ({
        ...b,
        knowledge: { question, answer },
    }));
}

/** Count of the three sub-marks that are filled. Drives the "X of 3" badge. */
export function marksAchieved(b: PersonalBinding): number {
    let n = 0;
    if (b.photos.length > 0) n++;
    if (b.parameters.trim().length > 0) n++;
    if (b.knowledge && b.knowledge.question && b.knowledge.answer) n++;
    return n;
}
