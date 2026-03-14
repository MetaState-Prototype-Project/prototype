export interface StoredNotification {
    id: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    createdAt: string;
}

const STORAGE_KEY = "eid_wallet_notifications";
const MAX_NOTIFICATIONS = 200;

let cachedNotifications: StoredNotification[] | null = null;

function loadNotifications(): StoredNotification[] {
    if (cachedNotifications !== null) return cachedNotifications;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed: StoredNotification[] = raw ? JSON.parse(raw) : [];
        cachedNotifications = parsed;
        return parsed;
    } catch {
        cachedNotifications = [];
        return cachedNotifications;
    }
}

function saveNotifications(notifications: StoredNotification[]): void {
    cachedNotifications = notifications;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

let listeners: Array<() => void> = [];

function notify() {
    for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
    listeners.push(fn);
    return () => {
        listeners = listeners.filter((l) => l !== fn);
    };
}

export function getNotifications(): StoredNotification[] {
    return loadNotifications();
}

export function getUnreadCount(): number {
    return loadNotifications().length;
}

export function addNotification(
    notification: Omit<StoredNotification, "id" | "createdAt">,
): void {
    const notifications = loadNotifications();
    notifications.unshift({
        ...notification,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    });
    saveNotifications(notifications.slice(0, MAX_NOTIFICATIONS));
    notify();
}

export function clearNotificationsForChat(globalChatId: string): void {
    const notifications = loadNotifications();
    const filtered = notifications.filter(
        (n) => n.data?.globalChatId !== globalChatId,
    );
    saveNotifications(filtered);
    notify();
}

export function removeNotification(id: string): void {
    const notifications = loadNotifications();
    const filtered = notifications.filter((n) => n.id !== id);
    saveNotifications(filtered);
    notify();
}

export function clearAllNotifications(): void {
    saveNotifications([]);
    notify();
}
