import { writable } from 'svelte/store';

export const isDisclaimerModalOpen = writable(true);

export const closeDisclaimerModal = () => isDisclaimerModalOpen.set(false);
