import { writable } from "svelte/store";

export interface Toast {
    id: string;
    message: string;
    type?: "success" | "error" | "info";
    duration?: number;
}

const createToastStore = () => {
    const { subscribe, update } = writable<Toast[]>([]);

    return {
        subscribe,
        add: (toast: Omit<Toast, "id">) => {
            const id = crypto.randomUUID();
            const newToast: Toast = {
                id,
                duration: 3000,
                ...toast,
            };

            update((toasts) => [...toasts, newToast]);

            // Auto remove after duration
            if (newToast.duration && newToast.duration > 0) {
                setTimeout(() => {
                    remove(id);
                }, newToast.duration);
            }

            return id;
        },
        remove: (id: string) => {
            update((toasts) => toasts.filter((t) => t.id !== id));
        },
        clear: () => {
            update(() => []);
        },
    };
};

export const toastStore = createToastStore();

export const toast = {
    success: (message: string, duration?: number) =>
        toastStore.add({ message, type: "success", duration }),
    error: (message: string, duration?: number) =>
        toastStore.add({ message, type: "error", duration }),
    info: (message: string, duration?: number) =>
        toastStore.add({ message, type: "info", duration }),
};

