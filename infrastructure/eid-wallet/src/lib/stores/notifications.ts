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

export function hasNotification(
    title: string,
    body: string,
    data?: Record<string, string>,
): boolean {
    const notifications = loadNotifications();
    const key = `${title}\0${body}\0${JSON.stringify(data ?? {})}`;
    return notifications.some(
        (n) => `${n.title}\0${n.body}\0${JSON.stringify(n.data ?? {})}` === key,
    );
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

// Dev-only seed used to populate the notifications list with a varied set of
// fixtures while iterating on the notifications UI. Replaces any existing
// notifications. Spread across "Just now" → ~a week ago to exercise the
// relative-time formatter.
export function seedDummyNotifications(): void {
    const now = Date.now();
    const minutes = (n: number) =>
        new Date(now - n * 60_000).toISOString();
    const hours = (n: number) =>
        new Date(now - n * 3_600_000).toISOString();
    const days = (n: number) =>
        new Date(now - n * 86_400_000).toISOString();

    const dummies: StoredNotification[] = [
        {
            id: crypto.randomUUID(),
            title: "Alex Chen",
            body: "Are we still on for the meeting later today?",
            data: {
                type: "new_message",
                globalChatId: "dummy-chat-alex",
                globalMessageId: "dummy-msg-1",
                avatar: "https://i.pravatar.cc/96?img=12",
            },
            createdAt: minutes(0),
        },
        {
            id: crypto.randomUUID(),
            title: "Verification complete",
            body: "Your Legal ID has been verified successfully.",
            createdAt: minutes(8),
        },
        {
            id: crypto.randomUUID(),
            title: "Sam Patel",
            body: "Sent you a photo",
            data: {
                type: "new_message",
                globalChatId: "dummy-chat-sam",
                globalMessageId: "dummy-msg-2",
                avatar: "https://i.pravatar.cc/96?img=33",
            },
            createdAt: minutes(42),
        },
        {
            id: crypto.randomUUID(),
            title: "Social binding request",
            body: "Jordan Reyes wants to create a social binding with you.",
            createdAt: hours(2),
        },
        {
            id: crypto.randomUUID(),
            title: "eVault storage",
            body: "You've used 60% of your eVault storage.",
            createdAt: hours(5),
        },
        {
            id: crypto.randomUUID(),
            title: "Mia Tanaka",
            body: "👋",
            data: {
                type: "new_message",
                globalChatId: "dummy-chat-mia",
                globalMessageId: "dummy-msg-3",
                avatar: "https://i.pravatar.cc/96?img=45",
            },
            createdAt: hours(9),
        },
        {
            id: crypto.randomUUID(),
            title: "Backup reminder",
            body: "It's been 30 days since your last eVault backup. Take a moment to back up now.",
            createdAt: hours(18),
        },
        {
            id: crypto.randomUUID(),
            title: "App connected",
            body: "Pictique is now authorized to read your eName.",
            createdAt: days(1),
        },
        {
            id: crypto.randomUUID(),
            title: "Security alert",
            body: "A new device signed in to your eVault. Wasn't you? Tap to review.",
            createdAt: days(2),
        },
        {
            id: crypto.randomUUID(),
            title: "Riley Park",
            body: "Thanks for sending the docs!",
            data: {
                type: "new_message",
                globalChatId: "dummy-chat-riley",
                globalMessageId: "dummy-msg-4",
                avatar: "https://i.pravatar.cc/96?img=27",
            },
            createdAt: days(3),
        },
        {
            id: crypto.randomUUID(),
            title: "Marketplace",
            body: "Dreamsync just launched — try it out from the apps marketplace.",
            createdAt: days(5),
        },
        {
            id: crypto.randomUUID(),
            title: "Welcome to eID Wallet",
            body: "Thanks for setting up your wallet. You can replay the welcome tour anytime from settings.",
            createdAt: days(8),
        },
    ];

    saveNotifications(dummies);
    notify();
}
