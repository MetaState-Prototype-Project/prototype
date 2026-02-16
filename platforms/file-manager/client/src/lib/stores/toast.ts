import { writable } from 'svelte/store';

export interface Toast {
	id: string;
	message: string;
	type: 'success' | 'error' | 'info' | 'warning';
	duration?: number;
}

export const toasts = writable<Toast[]>([]);

let toastIdCounter = 0;

export function showToast(message: string, type: Toast['type'] = 'info', duration: number = 3000) {
	const id = `toast-${toastIdCounter++}`;
	const toast: Toast = { id, message, type, duration };
	
	toasts.update((current) => [...current, toast]);
	
	if (duration > 0) {
		setTimeout(() => {
			removeToast(id);
		}, duration);
	}
	
	return id;
}

export function removeToast(id: string) {
	toasts.update((current) => current.filter((t) => t.id !== id));
}

export const toast = {
	success: (message: string, duration?: number) => showToast(message, 'success', duration),
	error: (message: string, duration?: number) => showToast(message, 'error', duration),
	info: (message: string, duration?: number) => showToast(message, 'info', duration),
	warning: (message: string, duration?: number) => showToast(message, 'warning', duration),
};

